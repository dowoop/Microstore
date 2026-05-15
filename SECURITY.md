# Security Model

## Threat Model

### What We Protect

- **Private keys** — Never enter the Microstore app. Never stored. Never transmitted.
- **Payment integrity** — Transactions are atomic: all split legs succeed or all fail. No partial payments.
- **Data locality** — All business data (shops, items, orders, expenses) lives in the browser's IndexedDB. Nothing is sent to a server.

### What We Don't Protect

- **Browser-level attacks** — If the user's browser is compromised (malicious extensions, XSS in another tab), IndexedDB data can be read. Microstore cannot defend against a compromised browser.
- **Device loss** — If the merchant loses their phone/computer, the IndexedDB data is lost unless they've exported a JSON backup.
- **Network observers** — RPC calls to Helius/Solana are visible to network observers (ISP, VPN provider). Transaction signatures are public on-chain regardless.
- **Phishing** — A fake QR code or payment page could trick a customer into sending funds to the wrong address. Microstore's /pay page shows full split details; customers should verify before signing.

## Wallet Security

### Private Keys Never Touch the App

Microstore **does not handle private keys** at any point:

- The merchant enters **public wallet addresses** (base58 strings) into shop settings
- The customer's wallet (Phantom, Solflare, Backpack) holds their private keys locally
- When the customer scans a QR code, their wallet constructs and signs the transaction — Microstore only provides the transfer instructions
- No seed phrases, private keys, or keypairs are ever entered, stored, or transmitted by the app

### What the App Knows About Wallets

| Information | How it's used | Where it lives |
|-------------|--------------|----------------|
| Merchant public key (base58) | Destination for merchant split of payment | IndexedDB (`shops.merchantWallet`) |
| Tax authority public key | Destination for tax split | IndexedDB (`shops.taxWallet`) |
| Charity public key | Destination for charity round-up | IndexedDB (`shops.charityWallet`) |
| SPL token mint address | Which token to accept (e.g., USDC) | IndexedDB (`shops.splTokenMint`) |
| Customer public key | Fee payer for transaction construction | Never stored — used ephemerally during transaction build |

All wallet addresses are snapshotted into the Order record at checkout time so the receipt always reflects the wallets used, even if the shop config changes later.

## Transaction Safety

### Atomic Split Guarantees

The core payment mechanism uses Solana's atomic transaction model:

- A single transaction contains up to 3 SPL token `TransferChecked` instructions (merchant, tax, charity)
- All instructions execute atomically — either all succeed or all fail
- If any destination lacks an Associated Token Account (ATA), a `createAssociatedTokenAccount` instruction is prepended atomically
- The customer signs once; the entire transaction is submitted as a unit

This means:
- **No partial payments** — the merchant never receives funds while tax/charity don't (or vice versa)
- **No double-spend** — the transaction either confirms entirely or reverts entirely
- **No stuck funds** — if the transaction fails, all funds remain in the customer's wallet

### Transaction Construction

`buildAtomicSplitTransaction()` in `src/lib/solanaPay.ts`:
1. Fetches the SPL token mint decimals from the chain
2. Derives Associated Token Addresses for each destination
3. For each split leg with `amount > 0`: creates a `TransferChecked` instruction (validates decimals)
4. Zero-amount legs are skipped (no unnecessary transfers)
5. Optional Memo instruction for transaction identity
6. Sets recent blockhash and fee payer (customer)
7. Returns an unsigned `Transaction` — signing happens in the customer's wallet

### QR Code Payments

The QR code encodes a `solana:` URL (Solana Pay spec) containing:
- Recipient address (merchant wallet)
- Amount (in the SPL token's decimal units)
- SPL token mint address
- Label (shop name)
- Message (item count)
- Memo (shop ID + order ID)

The customer's wallet reads this URL and presents the payment for signing. The app never sees the customer's signature or private key.

## Data Storage

### IndexedDB is Local-Only

All business data is stored in the browser's IndexedDB via Dexie:

| Table | Sensitive data? | Notes |
|-------|----------------|-------|
| `shops` | Wallet addresses (public keys only) | Public keys are not sensitive — they're already on the blockchain |
| `items` | Product prices, inventory counts | Business data, not PII |
| `orders` | Customer names (optional), wallet addresses, tx signatures | Customer names are entered by merchant manually |
| `expenses` | Expense amounts and categories | Business data |

**IndexedDB data never leaves the browser.** There is no backend server, no cloud sync, no API endpoint that receives this data.

### Data Export / Import (Backup)

The Settings page provides manual JSON export/import:
- **Export**: Downloads all shops, items, orders, and expenses as a single JSON file
- **Import**: Uploads a previously exported JSON file to restore data

This is the **only backup mechanism**. Without this, clearing the browser cache or switching devices means losing all data.

### Cache Wipe Detection

The app includes a health check that detects when IndexedDB has been cleared unexpectedly:
- `markDbInitialized()` sets a localStorage flag after first successful write
- `isDbPossiblyWiped()` checks if the flag exists but the shops table is empty
- A banner appears warning the user and linking to Settings for backup restoration

## Known Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| No cloud sync | Data lost on device switch / cache clear | Manual JSON export/import from Settings |
| No authentication | Anyone with access to the browser can see all data | Physical device security; user-managed |
| No encryption at rest | IndexedDB data is unencrypted | Browser's built-in storage isolation per origin |
| Single device | No multi-merchant or multi-location sync | One phone = one shop; future: optional cloud sync |
| No transaction monitoring | ~~The app doesn't poll for on-chain confirmation after QR generation~~ **Resolved in v0.2.** The `/pay` page now uses reference-based polling (`findReference` pattern) with a state machine (`awaiting_scan → broadcasting → confirming → finalized`) and plays a confirmation chime on success. | See `src/lib/solanaPay.ts::findReferenceByAddress` |
| No dispute resolution | No chargeback or refund mechanism | All sales are final on-chain; manual refunds require a new transaction |
| Network fee estimation | SOL fee shown is a fixed estimate ($0.001) | Actual fee depends on network congestion and instruction count |

## Reporting Security Issues

If you discover a security vulnerability, please report it privately. Do not open a public issue.

*Contact and disclosure policy to be determined.*