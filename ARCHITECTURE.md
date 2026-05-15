# Microstore Architecture

Microstore is a fully client-side Next.js application. No backend server. No database server. No authentication service. Everything runs in the browser — data lives in IndexedDB, state lives in Zustand stores, and Solana transactions are built and signed entirely on the client.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Mobile-First)                       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Next.js 16 (App Router)                     │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │  Pages   │  │  Layout  │  │  Error   │  │   Loading    │  │  │
│  │  │ (15 rts) │  │ (Shell)  │  │ Boundary │  │   Fallback   │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                               │                                     │
│  ┌────────────────────────────┼────────────────────────────────┐   │
│  │                    Zustand 5 (State)                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │   │
│  │  │ useApp   │  │ usePos   │  │ usePay   │  │ useCreate  │  │   │
│  │  │ Store    │  │ Cart     │  │ Store    │  │ ShopStore  │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │   │
│  │  ┌──────────┐                                                │   │
│  │  │ useItem  │                                                │   │
│  │  │ Editor   │                                                │   │
│  │  └──────────┘                                                │   │
│  └──────────────────────────────────────────────────────────────┘  │
│                               │                                     │
│  ┌────────────────────────────┼────────────────────────────────┐   │
│  │                    Dexie 4 (IndexedDB)                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │   │
│  │  │  shops   │  │  items   │  │  orders  │  │  expenses   │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘  │
│                               │                                     │
│  ┌────────────────────────────┼────────────────────────────────┐   │
│  │                    @solana/* + Tari JSON-RPC (Web3)              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │   │
│  │  │  web3.js │  │ spl-token│  │ solana/  │  │  qrcode    │  │   │
│  │  │ (RPC)    │  │ (SPL)    │  │ pay (QR) │  │ (render)   │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │   │
│  │  ┌──────────┐  ┌──────────────────────────────────────┐    │   │
│  │  │ tariPay  │  │     Ootle Wallet Daemon JSON-RPC     │    │   │
│  │  │ (client) │  │  (accounts / transactions / tokens)  │    │   │
│  │  └──────────┘  └──────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Helius RPC / Public   │
                    │   Solana Devnet/Mainnet │
                    │   + Tari Igor/Esmeralda │
                    └─────────────────────────┘
```

## Data Flow

### Complete Sale Flow (POS → Payment → Confirmation)

```
Merchant opens /pos
    │
    ▼
Cart: usePosCartStore
  ├── addItem(item)          → push to items[]
  ├── setSelectedTipPercent  → selectedTipPercent
  ├── setCharityRoundUp      → charityRoundUp
  └── computed:
       ├── subtotal  = Σ(item.price × qty)
       ├── tipAmount = subtotal × tipPercent / 100
       ├── taxAmount = subtotal × shop.taxRate (configurable, default 0)
       ├── charity   = ceil(preCharity) - preCharity
       └── total     = round2(subtotal + tip + tax + charity)
    │
    ▼
Merchant taps "Charge"
    │
    ▼
Order created in Dexie (db.orders.add)
  {
    shopId, status: 'pending',
    subtotal, tip, tax, charity, total,
    items: OrderItem[],
    merchantWallet, taxWallet, charityWallet,
    splTokenMint, splTokenSymbol,
    paymentRef, createdAt
  }
    │
    ▼
Redirect to /pay?orderId=<id>
    │
    ▼
usePayStore.loadOrder(id)
  ├── db.orders.get(id)       → Order
  ├── db.shops.get(shopId)    → Shop config
  └── computeAtomicSplit()    → SplitBreakdown
       ├── merchant: { address, amount: subtotal+tip }
       ├── tax:      { address, amount: tax }
       └── charity:  { address, amount: charity }
    │
    ▼
createSolanaPayURL({ recipient, amount, splToken, label, memo })
    │
    ▼
generateQRCode(solanaPayURL) → QR PNG (dataURL)
    │
    ▼
Payment reference keypair generated (Keypair.generate())
  └── Public key embedded in Solana Pay URL as `reference` parameter
  └── Stored in Order.paymentRef for idempotency
    │
    ▼
Customer scans QR with Phantom/Solflare
  └── Wallet includes the `reference` account in the transaction
    │
    ▼
findReferenceByAddress() polls `getSignaturesForAddress` for the reference key
  ├── Poll interval: 1s | Commitment: finalized | Timeout: 120s
  ├── State machine: awaiting_scan → broadcasting → confirming → finalized
  └── On timeout/failure: expired | failed states
    │
    ▼
Confirmation detected → Order status updated to 'paid', `paidAt` set
  └── Audio chime plays on finalized (Web Audio API, C5→E5, 200ms)
    │
    ▼
NotificationPoller sends browser notification of new order
```

## Component Tree

```
RootLayout (src/app/layout.tsx)
└── MerchantShell (src/components/merchant-shell.tsx)
    ├── NotificationPoller (src/lib/notifications.tsx)
    │   └── (invisible — polls Dexie for new orders + low stock)
    ├── TopNav (src/components/topnav.tsx)
    │   └── Shop name, active shop indicator, settings link
    ├── DbHealthBanner (src/components/db-health-banner.tsx)
    │   └── Warns if IndexedDB was wiped (cache clear)
    ├── <main> {children} </main>
    │   ├── /                    → MoneyPage (dashboard)
    │   ├── /pos                → PosPage (item grid + cart)
    │   ├── /pay                → PayPage (QR + split preview)
    │   ├── /shops              → ShopList
    │   ├── /shops/new          → CreateShopPage
    │   ├── /shops/[id]         → ShopDetailPage
    │   ├── /items              → InventoryList
    │   ├── /items/new          → AddItemPage
    │   ├── /items/[id]         → EditItemPage
    │   ├── /orders             → OrderList
    │   ├── /orders/new         → ManualOrderPage
    │   ├── /orders/[id]        → OrderDetailPage
    │   ├── /expenses           → ExpenseList
    │   ├── /expenses/new       → AddExpensePage
    │   ├── /receipt/[id]       → ReceiptPage
    │   ├── /reports/revenue    → RevenueReports
    │   ├── /reports/tax        → TaxReports
    │   └── /settings           → SettingsPage
    └── Tabs (src/components/tabs.tsx)
        └── Home | Shops | Items | POS | Orders | Expenses
```

### Shared Components

| Component | File | Purpose |
|-----------|------|---------|
| `MerchantShell` | `components/merchant-shell.tsx` | Root layout: TopNav + content + Tabs. Mounts NotificationPoller and DbHealthBanner. Sets `max-w-md` for mobile-first design. |
| `TopNav` | `components/topnav.tsx` | Sticky header with shop name and settings gear icon. |
| `Tabs` | `components/tabs.tsx` | Bottom tab bar with 6 navigation tabs using lucide-react icons. Highlights current route. |
| `DbHealthBanner` | `components/db-health-banner.tsx` | Conditionally rendered banner warning user when IndexedDB has been wiped. Links to Settings for backup restore. |

## Store Architecture

Microstore uses Zustand for state management. Each store is a self-contained module handling one bounded concern. Only `useAppStore` uses persistence (Zustand `persist` middleware → localStorage); all others are ephemeral.

### useAppStore (`src/lib/store.ts`)
**Persisted to localStorage.**

| State | Type | Purpose |
|-------|------|---------|
| `activeShopId` | `number \| null` | Currently selected shop |
| `activeTab` | `string` | Active bottom-tab key |

This is the only cross-cutting store — every page reads `activeShopId` to filter data.

### usePosCartStore (`src/lib/posCartStore.ts`)
**Critical store — the sale computation engine.**

| State / Action | Purpose |
|----------------|---------|
| `items: CartItem[]` | Items in the POS cart with quantities |
| `selectedTipPercent` | Chosen tip percentage from shop's presets |
| `charityRoundUp` | Whether to round up to nearest dollar for charity |
| `taxAllocationEnabled` | Whether to apply configured tax rate |
| `addItem(item)` | Add item to cart (increments qty if present) |
| `removeItem(id)` / `updateQuantity(id, qty)` | Cart manipulation |
| `subtotal()` / `tipAmount()` / `taxAmount()` / `charityAmount()` / `total()` | Computed values — each component rounded to 2dp before summing |

**Total formula**: `round2(subtotal) + round2(tip) + round2(tax) + round2(charity)` — this ensures the displayed total always matches the sum of individually rounded split leg amounts, preventing floating-point discrepancies.

### usePayStore (`src/lib/payStore.ts`)
**Payment page state — loads order + shop from Dexie, computes atomic split, polls for on-chain confirmation.**

| State | Purpose |
|-------|---------|
| `order`, `shop`, `split` | Loaded from Dexie + computation |
| `payState` | State machine: `awaiting_scan`, `broadcasting`, `confirming`, `finalized`, `expired`, `failed`, `cancelled` |
| `paymentRefPubkey` | Public key of throwaway Keypair embedded in Solana Pay URL for reference-based discovery |
| `loading`, `error: PayError` | Loading and error states with user-friendly messages |
| `loadOrder(id)` | Loads Order + Shop from Dexie, computes split, generates payment reference keypair |
| `startConfirmation()` | Begins `findReferenceByAddress` polling (1s interval, finalized commitment) |
| `markFinalized(sig)` | Writes `status: 'paid'` + `confirmedAt` to Dexie |
| `reset()` | Clears all state on unmount |

Uses a monotonically increasing `loadRequestId` to guard against stale async callbacks when `loadOrder` is called rapidly with different order IDs.

### useCreateShopStore (`src/lib/createShopStore.ts`)
**Shop onboarding form state.**

Manages all shop fields (name, username auto-slug, wallets, SPL token config, tip presets, toggles). Auto-generates `username` slug from `name` on input, maintaining manual overrides.

### useItemEditorStore (`src/lib/itemEditorStore.ts`)
**Product/service editor form state.**

All fields stored as strings for controlled inputs. `loadItem()` populates from an existing Item object for editing. `reset()` clears the form.

### Summary

| Store | Persisted? | Lifecycle |
|-------|-----------|-----------|
| `useAppStore` | Yes (localStorage) | Survives page reloads |
| `usePosCartStore` | No | Resets on reload |
| `usePayStore` | No | Resets on unmount |
| `useCreateShopStore` | No | Resets on reload |
| `useItemEditorStore` | No | Resets on reload/unmount |

## Database Schema

Microstore uses Dexie 4 (IndexedDB wrapper) with schema versioning. The database `MicrostoreDB` has evolved across 3 versions:

### Tables

#### shops
| Column | Type | Indexed | Notes |
|--------|------|---------|-------|
| `id` | `++number` | PK | Auto-increment |
| `name` | `string` | ✓ | Shop display name |
| `username` | `string` | ✓ | @slug, unique per shop |
| `photoUrl` | `string?` | | Object URL from file upload |
| `description` | `string?` | | One-line tagline |
| `tipPresets` | `number[]` | | e.g. `[0, 10, 15, 20]` |
| `taxAllocationEnabled` | `boolean` | | Configurable tax rate applied |
| `taxRate` | `number?` | | e.g. `0.08875`, range 0–0.5 |
| `taxRegion` | `string?` | | e.g. `\"NY\"`, from 52-state picker |
| `charityEnabled` | `boolean` | | Round-up to dollar |
| `charityPartners` | `string[]` | | e.g. `["GiveDirectly"]` |
| `merchantWallet` | `string?` | ✓ | Solana base58 pubkey |
| `taxWallet` | `string?` | | Tax authority pubkey |
| `charityWallet` | `string?` | | Charity pubkey |
| `splTokenMint` | `string?` | | SPL token mint address |
| `splTokenSymbol` | `string?` | | e.g. `"USDC"` |
| `address` | `string?` | | Legacy field |
| `phone` | `string?` | | Legacy field |
| `email` | `string?` | | Legacy field |
| `currency` | `string?` | | Legacy field |
| `createdAt` | `Date` | ✓ | |
| `updatedAt` | `Date` | | |

**Indexes**: `++id`, `name`, `username`, `merchantWallet`, `createdAt`

#### items
| Column | Type | Indexed | Notes |
|--------|------|---------|-------|
| `id` | `++number` | PK | Auto-increment |
| `shopId` | `number` | ✓ | FK to shops |
| `type` | `'product' \| 'service'` | | |
| `name` | `string` | ✓ | |
| `description` | `string?` | | Rich text (basic HTML) |
| `price` | `number` | | |
| `cost` | `number?` | | COGS |
| `sku` | `string?` | ✓ | |
| `barcode` | `string?` | ✓ | |
| `stock` | `number` | | Current inventory count |
| `lowStockThreshold` | `number?` | | Warnings trigger at or below |
| `category` | `string?` | ✓ | |
| `status` | `'live' \| 'draft'` | | Only `live` items appear in POS |
| `photoUrl` | `string?` | | Object URL from file upload |
| `payUpfrontTemplate` | `string?` | | For service-type items |
| `listingRules` | `{ enabled, conditions? }` | | v1 disabled |
| `createdAt` | `Date` | ✓ | |
| `updatedAt` | `Date` | | |

**Indexes**: `++id`, `shopId`, `name`, `category`, `sku`, `barcode`, `createdAt`

#### orders
| Column | Type | Indexed | Notes |
|--------|------|---------|-------|
| `id` | `++number` | PK | Auto-increment |
| `shopId` | `number` | ✓ | FK to shops |
| `customerName` | `string?` | | |
| `customerPhone` | `string?` | | |
| `status` | `'pending' \| 'paid' \| 'shipped' \| 'cancelled'` | ✓ | |
| `subtotal` | `number` | | Before tip/tax/charity |
| `tip` | `number` | | |
| `tipPercent` | `number` | | e.g. `15` |
| `tax` | `number` | | Configurable % of subtotal |
| `charity` | `number` | | Round-up amount |
| `total` | `number` | | Final charged amount |
| `discount` | `number?` | | |
| `duplicateTxIds` | `string[]?` | | Duplicate payment tx sigs |
| `items` | `OrderItem[]` | | Line items (embedded) |
| `txSignature` | `string?` | ✓ | Umbrella transaction sig |
| `merchantTxSignature` | `string?` | ✓ | Merchant split sig |
| `taxTxSignature` | `string?` | | Tax split sig |
| `charityTxSignature` | `string?` | | Charity split sig |
| `paymentRef` | `string?` | | `microshop:<shopId>:<timestamp>` |
| `merchantWallet` | `string?` | | Snapshot at checkout |
| `taxWallet` | `string?` | | Snapshot at checkout |
| `charityWallet` | `string?` | | Snapshot at checkout |
| `splTokenMint` | `string?` | | Snapshot at checkout |
| `splTokenSymbol` | `string?` | | Snapshot at checkout |
| `createdAt` | `Date` | ✓ | |
| `updatedAt` | `Date` | | |

**Indexes**: `++id`, `shopId`, `status`, `txSignature`, `merchantTxSignature`, `createdAt`

#### expenses
| Column | Type | Indexed | Notes |
|--------|------|---------|-------|
| `id` | `++number` | PK | Auto-increment |
| `shopId` | `number` | ✓ | FK to shops |
| `category` | `string` | ✓ | e.g. `"Rent"`, `"Supplies"` |
| `amount` | `number` | | |
| `description` | `string?` | | |
| `date` | `Date` | ✓ | Date expense was incurred |
| `createdAt` | `Date` | | When record was created |

**Indexes**: `++id`, `shopId`, `category`, `date`

### Schema Migrations

| Version | Changes | Reason |
|---------|---------|--------|
| v1 | Initial schema: 4 tables with basic indexes | Project bootstrap |
| v2 | Added wallet address fields to shops, tx fields to orders | Solana wallet integration |
| v3 | Added tip, charity, per-split tx signatures to orders | Atomic split with 3-way tracking |
| v4 | Added `taxRate`, `taxRegion` to shops; `cartDrafts` table | Per-shop tax configuration + cart persistence |

#### cart_drafts
| Column | Type | Indexed | Notes |
|--------|------|---------|-------|
| `id` | `++number` | PK | Auto-increment |
| `shopId` | `string` | ✓ | One draft per shop |
| `items` | `CartDraftItem[]` | | Cart contents (JSON blob) |
| `updatedAt` | `number` | ✓ | Debounced 300ms persist |

### IndexedDB Health Check

The app includes a localStorage-based health check (`markDbInitialized()` / `isDbPossiblyWiped()`) that detects when the browser cache has been cleared. If IndexedDB was previously populated but now has zero shops, a banner appears warning the user and linking to Settings for JSON backup restoration.

## Solana Integration

Located in `src/lib/solanaPay.ts`, the Solana layer has five subsystems:

### 1. Connection Management
`getConnection(cluster)` → `Connection` with `'confirmed'` commitment. Prefers Helius RPC if `NEXT_PUBLIC_HELIUS_API_KEY` is set; falls back to `clusterApiUrl()`.

### 2. Atomic Split Computation
`computeAtomicSplit({ subtotal, tipPercent, taxRate, ... })` → `SplitBreakdown`

Produces three destination allocations:
- **Merchant**: `subtotal + tip`
- **Tax**: `subtotal × taxRate` (shop-configurable)
- **Charity**: round-up to nearest dollar

All three legs are optional: merchant leg is always present; tax and charity legs are skipped when their amount is zero. The atomic split happens whenever ≥2 legs are non-zero.

### 3. Transaction Construction
`buildAtomicSplitTransaction(connection, params)` → `Transaction`

Builds a Solana transaction with:
- Three SPL `TransferChecked` instructions (one per split leg with `amount > 0`)
- Automatic ATA creation if destination doesn't have a token account
- Optional Memo instruction for identity
- All instructions execute atomically — all succeed or all fail

### 4. Solana Pay QR
- `createSolanaPayURL()` — generates `solana:` URL via `@solana/pay encodeURL`, now includes a `reference` public key parameter
- `generateQRCode()` — renders to PNG data URL via `qrcode`
- `serializeTransactionForQR()` — serializes transaction to base64 for direct scan-and-sign

### 5. Payment Confirmation (Reference-Based Polling)
- `generatePaymentReference()` — generates a throwaway Solana Keypair whose public key is embedded in the Solana Pay URL
- `findReferenceByAddress(connection, reference, options)` — polls `getSignaturesForAddress` at 1s intervals with `finalized` commitment, the web3.js v1 equivalent of `findReference` from `@solana/pay`
- Drives a state machine on `/pay`: `awaiting_scan → broadcasting → confirming → finalized` (with terminal states `expired`, `failed`, `cancelled`)
- Plays a Web Audio API chime (C5→E5, 200ms) on `finalized` — critical for retail where the merchant isn't staring at the screen
- Falls back to TxMonitor (memo-based) if no reference key is available

### 6. Wallet Balance
- `fetchWalletBalance(address)` → SOL amount in SOL
- `fetchTokenBalances(address)` → SPL token list with symbols (Helius enhanced API when available)
- `fetchWalletBalances(address)` → combined `{ sol, tokens, fetchedAt }`

### Token Registry
`src/lib/solanaTokens.ts` maintains a known token registry:

| Cluster | Symbol | Mint Address |
|---------|--------|-------------|
| Devnet | USDC | `Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr` |
| Mainnet | USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Mainnet | USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| Mainnet | PYUSD | `2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo` |

### Error Handling
`formatWalletError(code, detail?)` → `WalletError` with `userMessage` — maps internal error codes (`WALLET_DISCONNECTED`, `INSUFFICIENT_BALANCE`, `TX_TIMEOUT`, etc.) to safe, displayable user messages.

## Notification System

`src/lib/notifications.tsx` provides a `NotificationPoller` component that:
- Polls Dexie every 15 seconds for new orders and low-stock items
- Sends browser notifications via the Notification API
- Tracks already-notified low-stock items to avoid repeated alerts (30-min cooldown)
- Clears low-stock notifications when stock levels recover

## Key Architectural Decisions

1. **No backend** — Everything is client-side. Data in IndexedDB. No auth. No sync. This means data doesn't sync across devices. Future: optional cloud backup sync.

2. **Zustand over Redux** — Minimal boilerplate, TypeScript-native, no providers. Each store is a standalone module that can be imported directly.

3. **Dexie schema versioning** — The database has evolved across 3 versions, adding wallet addresses and per-split transaction tracking incrementally. Dexie's `version()` API handles migrations transparently.

4. **Atomic split as core value prop** — The three-way SPL transfer is the defining feature. Merchant, tax authority, and charity all receive funds in one customer-signed transaction.

5. **Mobile-first layout** — All merchant-facing pages use `max-w-md` to target phone screens. The bottom tab bar provides thumb-friendly navigation.

6. **Computed rounding in POS cart** — Each component (subtotal, tip, tax, charity) is individually rounded to 2dp before summing. This prevents floating-point discrepancies where the displayed total wouldn't match the sum of individually displayed split leg amounts.

7. **Charity split is optional and off-by-default** — The atomic three-leg SPL transfer is a technical differentiator, not a mandatory feature. Merchants can enable tax, charity, both, or neither. When only the merchant leg is non-zero, the transaction falls back to a plain transfer.

8. **Transfer Request (not Transaction Request) for Solana Pay** — We use Solana Pay's transfer-request URL format, not transaction-request. Tradeoff: no dynamic pricing, no identity verification, no sponsored transactions (covering customer fees). Benefit: zero backend infrastructure required — the URL encodes everything the wallet needs to construct the transfer.

## v1 Sync Strategy (Decision)

**Decision: P2P CRDT via Yjs + WebRTC with a free public relay.**

The serverless-no-backend architecture is a strength for v0.1 (zero infra, full sovereignty, no auth surface). It is also a hard ceiling: no multi-device sync, no employee accounts, no multi-location consolidation.

Two paths preserve sovereignty. We chose **P2P CRDT**:

| Option | Pros | Cons |
|--------|------|------|
| P2P CRDT (chosen) | No backend to operate; preserves sovereignty; real-time sync | Identifier schema must support CRDT semantics (clientId + Lamport clock per record) |
| Encrypted blob sync to backend | Simpler model; familiar Postgres | Must operate infrastructure; contradicts no-backend stance |

The CRDT path requires schema changes before v0.1 ships: every record needs `clientId` + a Lamport clock to support conflict-free merging. This decision is documented now so the schema doesn't solidify further without these fields.

## Chain Reconciliation (v0.2+)

**Decision: Build a "rebuild orders from chain" function using paymentRef memo scanning.**

The blockchain is the actual source of truth for payments. IndexedDB is just an index. If a user loses their JSON backup and clears cache, their books are gone forever — but the chain still has the data.

The reconciliation function:
- Takes the merchant wallet pubkey
- Scans for transactions containing the shop's `paymentRef` memo prefix (`microshop:<shopId>:<timestamp>`)
- Reconstructs the orders table from on-chain data

This makes the IndexedDB-wipe scenario survivable. The paymentRef format already encodes shop and timestamp uniquely, enabling deterministic reconstruction.

## Stock Decrement Policy

**Decision: Decrement on `paid` with optimistic UI lock during `pending`.**

| Policy | Risk |
|--------|------|
| Decrement on `addItem` | Phantom stock-outs from abandoned carts |
| Decrement on order `pending` | Phantom stock-outs from abandoned/expired pays |
| Decrement on `paid` (chosen) | Window of oversell between Charge and confirm |

The window of oversell is mitigated by an optimistic UI lock: items are shown as "reserved" during the `pending` → `paid` transition. Stock is only decremented on confirmed `paid` status. The decrement executes in a Dexie transaction with idempotency guard so duplicate `paid` events don't decrement twice.

## Helius Vendor Risk

**Decision: Document a plug-replaceable RPC strategy.**

Microstore depends on Helius for enhanced RPC (token balance APIs, DAS). The public Solana cluster is a fallback but loses enhanced features. To prevent a single vendor outage from taking down the till:

- Primary: Helius RPC (`NEXT_PUBLIC_HELIUS_API_KEY`)
- Fallback: `clusterApiUrl()` (public Solana RPC)
- Alternative providers: Triton, QuickNode — drop-in replacements via environment variable

The `getConnection()` function already implements this fallback chain. Document the plug-replaceable strategy so users can swap providers without code changes.