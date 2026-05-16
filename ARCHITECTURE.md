# Microstore Architecture

Chain-agnostic point-of-sale application for merchants. Accept payments on
Solana (SPL tokens) or Tari (native XTM + Ootle tokens) in a browser-first
progressive web app (PWA). All data lives client-side in IndexedDB via Dexie;
there is no backend server.

---

## 1. System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser (PWA)                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Next.js App Router                     │   │
│  │  ┌─────┐ ┌──────┐ ┌───────┐ ┌─────────┐ ┌──────────┐  │   │
│  │  │ POS │ │ Pay  │ │Orders │ │ Reports │ │ Settings │  │   │
│  │  │ Page│ │ Page │ │ Page  │ │  Pages  │ │  Page    │  │   │
│  │  └──┬──┘ └──┬───┘ └───┬───┘ └────┬────┘ └────┬─────┘  │   │
│  └─────┼───────┼─────────┼──────────┼────────────┼────────┘   │
│        │       │         │          │            │             │
│  ┌─────┴───────┴─────────┴──────────┴────────────┴────────┐   │
│  │                     Store Layer (Zustand)                │   │
│  │  posCartStore  │  payStore  │  createShopStore          │   │
│  │  appStore      │  lowStockStore                         │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                      │
│  ┌──────────────────────┴──────────────────────────────────┐   │
│  │                  Library Layer                           │   │
│  │  db.ts (Dexie)     │ solanaPay.ts     │ tariPay.ts      │   │
│  │  txLifecycle.ts    │ txMonitor.ts     │ notifications   │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                      │
│  ┌──────────────────────┴──────────────────────────────────┐   │
│  │                  External I/O                            │   │
│  │  IndexedDB   │ Helius RPC   │ Tari Wallet Daemon         │   │
│  │  (Dexie)     │ (devnet/     │ (JSON-RPC via HTTP)        │   │
│  │              │  mainnet)    │ + Indexer REST API         │   │
│  └──────────────┴──────────────┴────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

All code runs client-side. There is no Node.js server, no API routes,
no database backend. The only external dependencies are Solana RPC nodes
(Helius or public) and the local Tari wallet daemon.

---

## 2. Data Flow

The three-phase payment flow is the core data pipeline:

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  POS     │ ──▶ │  Pay     │ ──▶ │  Confirm │
│  (Cart)  │     │  (Link)  │     │  (Chain) │
└──────────┘     └──────────┘     └──────────┘

Phase 1 — POS (Cart)
  1. Items added to cart via posCartStore
  2. Totals computed by computeOrderTotals() (single source of truth)
  3. Order written to Dexie orders table with status='pending'
  4. Cart draft persisted to cartDrafts table (debounced, 300ms)

Phase 2 — Pay (Link Generation)
  1. payStore.loadOrder() reads order + shop from Dexie
  2. Chain detection: order.paymentChain ?? (shop.tariWallet ? 'tari' : 'solana')
  3. Solana path:
     a. computeAtomicSplit() → merchant/reserve/charity breakdown
     b. generatePaymentReference() → throwaway keypair for on-chain discovery
     c. Payment ref persisted to order.paymentRef
  4. Tari path:
     a. USD → XTM conversion (1 USD = 10 XTM placeholder)
     b. createTariDeepLink() per RFC-0154
     c. Deep link rendered as QR code

Phase 3 — Confirm (On-Chain Verification)
  Solana:
    a. Reference-based polling: findReferenceByAddress()
       polls getSignaturesForAddress at 1s intervals, 2-min timeout
    b. TxMonitor fallback: memo-based matching via Helius WebSocket
       or polling every 3s
    c. On confirmation: markFinalized() → order.status='paid',
       confirmedAt set

  Tari:
    a. Polls TariConnection.getTransaction() at 3s intervals, 2-min timeout
    b. Terminal statuses: Accepted → finalized, Rejected/Invalid → failed
    c. On confirmation: markFinalized() with tariTransactionId as signature

Idempotency:
  - Same-order: duplicateTxIds array tracks repeat payments
  - Cross-order: paymentRef collision check — second order gets
    status='pending_review', no double-credit
```

---

## 3. Component Tree

All routes use the Next.js App Router under `src/app/`. The root layout
wraps everything in `AppWalletProvider` → `RootShell`. Merchant-facing
pages use `MerchantShell` which adds `TopNav`, `Tabs` (bottom nav),
`NotificationPoller`, `PwaRegister`, `ConnectivityIndicator`, and
`NetworkBanner`.

### Route Map (21 pages)

```
src/app/
├── layout.tsx                    Root layout (fonts, metadata, PWA manifest)
├── page.tsx                      /                   — Home / dashboard
├── globals.css                   Global styles
│
├── pos/
│   └── page.tsx                  /pos                — Point of Sale
│
├── pay/
│   ├── layout.tsx                /pay                — Minimal layout (no chrome)
│   └── page.tsx                  /pay                — Customer payment page
│
├── shops/
│   ├── page.tsx                  /shops              — Shop list
│   ├── new/
│   │   └── page.tsx              /shops/new          — Create shop form
│   └── [id]/
│       └── page.tsx              /shops/[id]         — Shop detail / edit
│
├── items/
│   ├── page.tsx                  /items              — Item inventory list
│   ├── new/
│   │   └── page.tsx              /items/new          — New item form
│   └── [id]/
│       └── page.tsx              /items/[id]         — Item detail / edit
│
├── orders/
│   ├── page.tsx                  /orders             — Order list
│   ├── new/
│   │   └── page.tsx              /orders/new         — New order (manual)
│   └── [id]/
│       └── page.tsx              /orders/[id]        — Order detail
│
├── customers/
│   ├── page.tsx                  /customers          — Customer list
│   └── [id]/
│       └── page.tsx              /customers/[id]     — Customer detail
│
├── expenses/
│   ├── page.tsx                  /expenses           — Expense list
│   └── new/
│       └── page.tsx              /expenses/new       — New expense form
│
├── settings/
│   └── page.tsx                  /settings           — App settings
│
├── receipt/
│   └── [id]/
│       └── page.tsx              /receipt/[id]       — Order receipt
│
├── reports/
│   ├── revenue/
│   │   └── page.tsx              /reports/revenue    — Revenue report
│   └── tax/
│       └── page.tsx              /reports/tax        — Tax / reserve report
│
└── offline/
    └── page.tsx                  /offline            — Offline queue status
```

### Layout Hierarchy

```
<html>
  <body>
    <AppWalletProvider>            Solana wallet adapter context
      <RootShell>                 Shops list / onboarding gate for unauthenticated visits
        ┌─ Public routes (/pay) use a minimal layout (pay/layout.tsx)
        │
        └─ Merchant routes use MerchantShell:
             <NotificationPoller />     Invisible — polls Dexie for notifications
             <PwaRegister />            Service worker registration
             <ConnectivityIndicator />  Online/offline state
             <TopNav />                 Shop name, settings icon
             <NetworkBanner />          Devnet/Mainnet indicator
             <DbHealthBanner />         IndexedDB wipe detection
             <main>{children}</main>    Route content (max-w-md, centered)
             <Tabs />                   Bottom nav (POS, Orders, Items, Reports)
```

---

## 4. Store Architecture

All stores use [Zustand](https://github.com/pmndrs/zustand) with
`create<T>()()`. There is no middleware or persistence adapter — stores
manage their own Dexie reads/writes directly.

### 4.1 posCartStore (`src/lib/posCartStore.ts`)

Manages the point-of-sale shopping cart.

**State:**

- `items: CartItem[]` — cart line items
- `selectedTipPercent: number` — tip percentage (0, 10, 15, 20)
- `charityRoundUp: boolean` — round-up to nearest dollar for charity
- `reserveAllocationEnabled: boolean` — whether reserve allocation applies
- `reserveRate: number` — shop-level reserve rate (decimal)
- `taxRate: number` — shop-level tax rate (decimal, from shop.taxRate)
- `taxLabel: string` — display label for tax line (from shop.taxLabel)
- `activeShopId: number | null` — current shop scope

**Key operations:**

- `addItem(item)`, `removeItem(itemId)`, `updateQuantity(itemId, qty)`
- `clearCart()`, `setActiveShopId(shopId)`
- `reconcileFromDb()` — cross-tab sync via Dexie (triggers on visibilitychange)

**Persistence:** Cart is debounce-persisted (300ms) to `cartDrafts` table.
Empty carts delete the draft record. On shop switch, the previous cart is
persisted and the new shop's draft is restored.

### 4.2 payStore (`src/lib/payStore.ts`)

Drives the `/pay` page — the customer-facing payment flow.

**State:**

- `order: Order | null` — the order being paid
- `shop` — resolved shop info (wallets, rates, network config)
- `split: SplitBreakdown | null` — merchant/reserve/charity amounts
- `payState: PayStateMachine` — current UI state
- `paymentChain: PaymentChain` — 'solana' or 'tari'
- `tariDeepLink: string | null` — Tari deep link URL
- `paymentRefPubkey: string | null` — Solana payment reference
- `regenerationCount: number` — QR regen counter (max 3)

**PayStateMachine:**

```
awaiting_scan → broadcasting → confirming → finalized
                                  ↓
                           expired | failed | cancelled
```

**Key operations:**

- `loadOrder(orderId)` — loads from Dexie, detects chain, generates link/ref
- `startConfirmation()` — begins on-chain monitoring (Solana or Tari)
- `stopConfirmation()` — cancels all monitors/timers
- `retryConfirmation()` — resets and restarts after failure
- `markFinalized(signature)` — persists confirmation with idempotency checks
- `regenerateQR()` — fetches fresh blockhash for Solana QR, max 3 times

**Chain detection:** `order.paymentChain ?? (shop.tariWallet ? 'tari' : 'solana')`

### 4.3 createShopStore (`src/lib/createShopStore.ts`)

Shop creation/edit form state. Covers both Solana and Tari wallet configuration.

**State includes:**

- Shop identity: name, username (auto-slugged), photoUrl, description
- Tip: tipPresets array (default: [0, 10, 15, 20])
- Solana: merchantWallet, reserveWallet, charityWallet, splTokenMint, splTokenSymbol, acceptedTokens
- Reserve: reserveAllocationEnabled, reserveRate (capped 0–0.5), reserveRegion
- Charity: charityEnabled
- Tari: tariWallet, tariNetwork ('igor' | 'mainnet'), tariAcceptedTokens

**Validation:** Inputs go through sanitizers (`sanitizeTextField`,
`sanitizePhotoUrl`, `stripHtml`). Reserve rate clamped to [0, 0.5].

### 4.4 appStore (`src/lib/store.ts`)

Global app state: `activeShopId` and related app-level flags. Consumed by
`NotificationPoller`, shell components, and route guards.

### 4.5 lowStockStore (`src/lib/lowStockStore.ts`)

Tracks low-stock items and alert history. Fed by `NotificationPoller` during
its polling cycle.

---

## 5. Database Schema

Dexie schema uses versioned migrations from **10000** through **10005**. The current
version is **10005**. See §9 for the full version history.

Database name: `MicrostoreDB`

### 5.1 Shops

```typescript
interface Shop {
  id: number;
  name: string;
  username: string;
  photoUrl?: string;
  description?: string;
  tipPresets: number[];
  reserveAllocationEnabled: boolean;
  reserveRate?: number;
  taxRate: number;
  taxLabel: string;
  taxSetAsideWallet?: string;
  /** Unified chain identifier */
  charityEnabled: boolean;
  charityPartners: string[];
  merchantWallet?: string;
  reserveWallet?: string;
  charityWallet?: string;
  splTokenMint?: string;
  splTokenSymbol?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
  acceptedTokens?: AcceptedToken[];
  tariWallet?: string;
  tariNetwork?: 'igor' | 'mainnet';
  tariAcceptedTokens?: { symbol: string; assetId?: string; resourceAddress?: string }[];
  isDemo?: boolean;
  cluster?: 'devnet' | 'mainnet-beta';
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `id`, `name`, `username`, `merchantWallet`, `cluster`, `createdAt`

### 5.2 Items

```typescript
type ItemType = 'product' | 'service';
type ItemStatus = 'live' | 'draft';

interface ListingRules {
  enabled: boolean;
  conditions?: unknown[];
}

interface Item {
  id: number;
  shopId: number;
  type: ItemType;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  sku?: string;
  barcode?: string;
  stock: number;
  lowStockThreshold?: number;
  notifyLowStock?: boolean;
  category?: string;
  status: ItemStatus;
  photoUrl?: string;
  payUpfrontTemplate?: string;
  listingRules: ListingRules;
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `id`, `shopId`, `name`, `category`, `sku`, `barcode`, `createdAt`

### 5.3 Orders

```typescript
interface Order {
  id: number;
  shopId: number;
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  status: OrderStatus;
  subtotal: number;
  tip: number;
  tipPercent: number;
  tax: number;
  charity: number;
  total: number;
  discount?: number;
  items: OrderItem[];
  txSignature?: string;
  /** @deprecated Phase 0: atomic transaction — only txSignature is written. Retained for backwards compatibility with existing user data. */
  merchantTxSignature?: string;
  /** @deprecated Phase 0: atomic transaction — only txSignature is written. Retained for backwards compatibility with existing user data. */
  reserveTxSignature?: string;
  /** @deprecated Phase 0: atomic transaction — only txSignature is written. Retained for backwards compatibility with existing user data. */
  charityTxSignature?: string;
  tariTransactionId?: string;
  paymentChain?: 'solana' | 'tari';
  tariTokenSymbol?: string;
  tariTokenResourceAddress?: string;
  paymentRef?: string;
  /** Solana Pay reference public key (base58) — generated at order creation, used by getSignaturesForAddress for unambiguous on-chain tx discovery. */
  referencePubkey?: string;
  duplicateTxIds?: string[];
  merchantWallet?: string;
  reserveWallet?: string;
  charityWallet?: string;
  splTokenMint?: string;
  splTokenSymbol?: string;
  confirmedAt?: Date;
  failedReason?: string;
  lastAttemptAt?: Date;
  invoiceNumber?: number;
  invoiceType?: InvoiceType;
  invoiceDueDate?: Date;
  invoiceNotes?: string;
  viewedAt?: Date;
  expiresAt?: Date;
  cluster?: 'devnet' | 'mainnet-beta';
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `id`, `shopId`, `customerId`, `status`, `txSignature`,
`merchantTxSignature`, `paymentRef`, `cluster`, `createdAt`

### 5.4 OrderItem (embedded in Order)

```typescript
interface OrderItem {
  itemId: number;
  name: string;
  price: number;
  quantity: number;
}
```

### 5.5 OrderStatus (from txLifecycle.ts)

```typescript
type OrderStatus =
  | 'pending' // Order created, awaiting payment
  | 'confirming' // Transaction submitted, awaiting confirmation
  | 'paid' // Transaction confirmed on-chain
  | 'failed' // Transaction failed or timed out
  | 'pending_review' // Manual review needed (timeout, unclear state)
  | 'cancelled'; // Cancelled by merchant or customer
```

### 5.6 Expenses

```typescript
interface Expense {
  id: number;
  shopId: number;
  category: string;
  amount: number;
  description?: string;
  date: Date;
  cluster?: 'devnet' | 'mainnet-beta';
  createdAt: Date;
}
```

Indexes: `id`, `shopId`, `category`, `cluster`, `date`

### 5.7 Customers

```typescript
interface Customer {
  id: number;
  shopId: number;
  name: string;
  phone?: string;
  notes?: string;
  createdAt: Date;
}
```

Indexes: `id`, `shopId`, `name`, `phone`, `createdAt`

### 5.8 Offline Queue

```typescript
interface OfflineQueueEntry {
  id?: number;
  shopId: number;
  orderData: Omit<Order, 'id'>;
  status: 'pending' | 'processing' | 'syncing' | 'synced' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: Date;
  attemptedAt?: Date;
}
```

Indexes: `id`, `status`, `createdAt`

### 5.9 Error Logs

```typescript
interface ErrorLogEntry {
  id?: number;
  timestamp: Date;
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  context?: string;
}
```

Indexes: `id`, `timestamp`

### 5.10 Cart Drafts

```typescript
interface CartDraft {
  id?: number;
  shopId: number;
  items: CartDraftItem[];
  updatedAt: number;
}

interface CartDraftItem {
  itemId: number;
  name: string;
  price: number;
  quantity: number;
}
```

Indexes: `id`, `shopId`, `updatedAt`

### 5.11 Dexie Constructor

```typescript
class MicrostoreDB extends Dexie {
  shops!: EntityTable<Shop, 'id'>;
  items!: EntityTable<Item, 'id'>;
  orders!: EntityTable<Order, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  customers!: EntityTable<Customer, 'id'>;
  offlineQueue!: EntityTable<OfflineQueueEntry, 'id'>;
  errorLogs!: EntityTable<ErrorLogEntry, 'id'>;
  cartDrafts!: EntityTable<CartDraft, 'id'>;

  constructor() {
    super('MicrostoreDB');
    this.version(10000).stores({
      shops: '++id, name, username, merchantWallet, cluster, createdAt',
      items: '++id, shopId, name, category, sku, barcode, createdAt',
      orders:
        '++id, shopId, customerId, status, txSignature, merchantTxSignature, paymentRef, cluster, createdAt',
      expenses: '++id, shopId, category, cluster, date',
      customers: '++id, shopId, name, phone, createdAt',
      offlineQueue: '++id, status, createdAt',
      errorLogs: '++id, timestamp',
      cartDrafts: '++id, shopId, updatedAt',
    });
  }
}
```

---

## 6. Solana Integration

All Solana code lives in `src/lib/solanaPay.ts` (~946 lines). It provides
the full payment lifecycle: money arithmetic, reference generation,
transaction discovery, atomic splits, QR codes, and wallet balance checks.

### 6.1 BigInt Money Arithmetic

To prevent floating-point errors in SPL token base-unit calculations, all
arithmetic uses bigint internally:

- `dollarsToBaseUnits(dollars: string, decimals: number): bigint`
- `numberToBaseUnits(amount: number, decimals: number): bigint`
- `formatTokenAmount(units: bigint, decimals: number): string`
- `baseUnitsToNumber(units: bigint, decimals: number): number`

### 6.2 Payment References

A throwaway Solana keypair is generated per order. Its public key is
embedded in the Solana Pay URL as a reference account. On-chain discovery
finds the customer's transaction by scanning signatures for that address.

- `generatePaymentReference()` → `{ publicKey: string, secretKey: Uint8Array }`
- `findReferenceByAddress(connection, referenceAddress, options)` —
  polls `getSignaturesForAddress` at 1s intervals with 2-min timeout.
  A web3.js v1 equivalent of `@solana/pay`'s `findReference`.

### 6.3 Order Totals

`computeOrderTotals(params)` — the single source of truth for order
arithmetic. Accepts `{subtotal, tipPercent, reserveRate, charityRoundUp}`
and returns `OrderTotals: {subtotal, tip, tax, charity, total}`.

All calculations use bigint math with 6-decimal precision, converted back
to `number` for display compatibility.

### 6.4 Atomic Split

`computeAtomicSplit(params)` computes a three-way split breakdown:

```typescript
interface SplitBreakdown {
  merchant: { address: string; amount: number; label: string };
  reserve: { address: string; amount: number; label: string };
  charity: { address: string; amount: number; label: string };
}
```

- Merchant receives subtotal + tip
- Reserve receives the computed tax amount
- Charity receives the round-up amount

`buildAtomicSplitTransaction(connection, params)` builds a Solana
Transaction with 3 SPL `transferChecked` instructions plus optional memo.
It auto-creates destination ATAs if they don't exist.

### 6.5 Solana Pay URL

`createSolanaPayURL(params)` uses `@solana/pay`'s `encodeURL` to create
a `solana:` URL. If a `blockhash` is provided, it is appended as a query
parameter for wallets that pre-fetch blockhashes.

### 6.6 QR Code

`generateQRCode(data, options)` lazily imports the `qrcode` library and
returns a base64 PNG data URL.

### 6.7 Payment Matching

Payment confirmation uses Solana Pay's `reference` public key for unambiguous
on-chain transaction discovery:

- A fresh `Keypair.generate()` is created at order creation (POS page) and its
  public key is stored as `order.referencePubkey` (base58 string).
- The reference pubkey is embedded in the Solana Pay URL (`reference=` query
  parameter) and added as a **non-signer, non-writable `AccountMeta`** on
  the first SPL transfer instruction in `buildAtomicSplitTransaction`.
- `payStore.loadOrder()` reads `order.referencePubkey` — if present, it uses it
  directly; if null (historical orders predating v10005), it generates a fresh
  reference and backfills the order.
- `startSolanaReferencePolling()` polls `connection.getSignaturesForAddress`
  via `findReferenceByAddress()` at 1s intervals with a 2-min timeout.
- When `paymentRefPubkey` is null (historical order with no Solana wallet
  configured), the system falls back to `TxMonitor` (memo-based matching).

### 6.8 Wallet Balance

- `fetchWalletBalance(address, cluster)` — SOL balance in SOL
- `fetchTokenBalances(address, cluster)` — all SPL token balances
  (Helius `getTokenAccounts` first, then RPC fallback)
- `fetchWalletBalances(address, cluster)` — combined SOL + SPL
- `fetchTokenBalance(connection, owner, mint)` — single token balance
- `checkSufficientBalance(...)` — returns `WalletError | null`

### 6.9 Network & Error Handling

- `getConnection(cluster)` — configures Helius RPC when API key present
- `getLatestBlockhash(cluster)` — for QR regeneration
- `detectNetworkMismatch(walletCluster, expectedCluster)` — mismatch check
- `sendWithBlockhashRetry(connection, buildTx, signAndSend)` — automatic
  retry on `BlockheightExceededError` (max 2 retries)
- Wallet error types: `WALLET_DISCONNECTED`, `WALLET_REJECTED`,
  `WRONG_NETWORK`, `INSUFFICIENT_BALANCE`, `MISSING_ATA`,
  `BLOCKHASH_EXPIRED`, `TX_TIMEOUT`, `TX_FAILED`

### 6.10 Helius RPC

Uses `NEXT_PUBLIC_HELIUS_API_KEY` env var. When configured, the app uses
Helius for all RPC calls (Solana connection, token balances). Falls back
to `clusterApiUrl('devnet')` or `clusterApiUrl('mainnet-beta')`.

---

## 7. Tari Integration

Tari is a **peer** payment chain alongside Solana. All Tari code lives in
`src/lib/tariPay.ts` (~616 lines).

### 7.1 Network Configuration

Five supported networks, each with wallet daemon JSON-RPC endpoint, indexer
REST API endpoint, address HRP, and deep-link network name:

| Network   | HRP      | Deep-link ID | Status                |
| --------- | -------- | ------------ | --------------------- |
| igor      | otl*igr* | igor         | Testnet (default)     |
| mainnet   | otl\_    | mainnet      | Placeholder endpoints |
| esmeralda | otl*esm* | esmeralda    | Testnet               |
| nextnet   | otl*nxt* | nextnet      | Testnet               |
| localnet  | otl*loc* | localnet     | Local development     |

```typescript
interface TariNetworkConfig {
  name: string;
  walletDaemonUrl: string; // Ootle wallet daemon JSON-RPC
  indexerUrl: string; // Indexer REST API
  addressHrp: string; // e.g. "otl_igr_"
  deepLinkNetwork: string; // per RFC-0154
}
```

### 7.2 TariConnection

JSON-RPC wrapper for the Ootle wallet daemon. Communicates over HTTP POST
with optional Bearer token auth.

**Methods:**

- `getBalance(address)` → `TariAccountBalances | null` — calls
  `accounts.get_balances` with `refresh: true`
- `getNativeBalance(address)` → `bigint` — native XTM balance in microTari
- `getTransaction(transactionId)` → `TariTransaction | null` — calls
  `transactions.get`
- `createDeepLink(params)` → `string` — convenience wrapper around
  `createTariDeepLink` using the connection's network config

### 7.3 Deep Links (RFC-0154)

`createTariDeepLink(params)` generates URLs in the format:
`tari://{network}/transactions/send?tariAddress=X&amount=Y&resource_address=Z&note=W`

Parameters: `recipient`, `amount` (microTari), `note`, `network`,
`label`, `resourceAddress`, `divisibility`, `tokenSymbol`.

The deep link is rendered as a QR code by `generateTariQR(deepLink, options)`,
which lazily imports the `qrcode` library.

### 7.4 Address Validation

Accepts both Ootle HRP-prefixed addresses (`otl_igr_...`) and legacy
base58 TariAddress format:

- `isValidTariAddress(address: string): boolean`
- `detectNetworkFromAddress(address: string): TariNetwork | null`

### 7.5 Transaction Status

```typescript
type TariTransactionStatus =
  | 'New'
  | 'DryRun'
  | 'Pending'
  | 'Accepted'
  | 'Rejected'
  | 'Invalid'
  | 'OnlyFeeAccepted';
```

The pay store polls `TariConnection.getTransaction()` and maps these to
the `PayStateMachine`:

- `Accepted` → `finalized`
- `Rejected` / `Invalid` → `failed`
- `OnlyFeeAccepted` → `failed` with `WRONG_AMOUNT` error
- `Pending` / `DryRun` / `New` → `confirming`

### 7.6 Token List

`getOotleTokenList(network)` fetches the native Tari resource and cached
templates from the network indexer REST API. Combines results into a
`TariTokenBalance[]` array (metadata only, zero balances). Used for
shop token configuration.

### 7.7 Chain Detection in payStore

Payment chain is selected at `loadOrder` time:

```
order.paymentChain ?? (shop.tariWallet ? 'tari' : 'solana')
```

If explicit `order.paymentChain` is set, it takes precedence. Otherwise,
the presence of a `tariWallet` on the shop config determines the chain.

### 7.8 USD to XTM Conversion

A placeholder rate of 1 USD = 10 XTM is used:

```typescript
function usdToXtm(usdAmount: number): number {
  return Math.round(usdAmount * 10 * 1_000_000) / 1_000_000;
}
```

This is applied to `order.total + networkFee` to generate the Tari deep
link amount in microTari.

---

## 8. Notification System

In-browser notifications without a backend server. Implemented in
`src/lib/notifications.tsx` (~196 lines).

### 8.1 Architecture

The `NotificationPoller` component mounts once in `MerchantShell`.
It renders nothing — all logic is side-effect driven:

- Requests browser Notification permission on mount
- Polls Dexie every 15 seconds for the active shop
- Checks for new orders and low-stock items

### 8.2 New Order Detection

Tracks `state.lastOrderId`. On each poll:

1. Queries the latest order for the active shop
2. If the latest ID > last seen ID, fetches all new orders since last check
3. Sends a browser notification: "New Order(s) Received"
   with customer name and total (single) or count and total (multiple)

### 8.3 Low Stock Alerts

1. Queries active items where `type === 'product'`, `status === 'live'`,
   `lowStockThreshold > 0`, and `stock <= lowStockThreshold`
2. Filters for items where `notifyLowStock !== false`
3. Pushes results to `lowStockStore` for UI consumption
4. Sends notification for items not previously alerted
5. Records alert history via `lowStockStore.addAlert()`

Cooldown: an item is only notified once until its stock rises back above
the threshold, at which point the cooldown resets.

### 8.4 Low-Stock Alert History

`lowStockStore` maintains:

- Current low-stock items (for display)
- Alert history: `{ itemId, itemName, stock, threshold, alertedAt }[]`

---

## 9. Key Architectural Decisions

### Chain-Agnostic POS

Microstore treats Solana and Tari as **peer payment chains**, not primary
and secondary. The payment flow detects which chain to use at order load
time based on shop configuration. The `paymentChain` field on orders
records which chain processed the payment. Both chains share the same
order lifecycle (`OrderStatus`), the same confirmation state machine
(`PayStateMachine`), and the same idempotency guarantees.

### Client-Side Database

All data lives in IndexedDB via Dexie. There is no server, no API, no
sync engine. This makes the app fully functional offline. The trade-off is
that data is per-device — there is no cross-device sync.

### Schema Version History

| Version | Description |
| ------- | ----------- |
| 10000   | Monolithic schema — all 8 tables declared in a single `version()` call. |
| 10001   | v4 migration: unified chain/network fields, BigInt base-unit monetary fields (`subtotalBase`, `tipBase`, `reserveBase`, `charityBase`, `totalBase`), `chainConfig` on shops, `tax` → `reserve` rename. |
| 10002   | v5 migration: Blob photo persistence — convert string `photoUrl` to Blob where fetchable. |
| 10003   | Phase 0 deprecation pass: no schema change. Per-leg signature fields (`merchantTxSignature`, `reserveTxSignature`, `charityTxSignature`) retained for backwards compatibility but deprecated — only `txSignature` is written going forward. |
| 10004   | Agent 0.2: per-shop `taxRate`, `taxLabel`, `taxSetAsideWallet` fields on Shop. Migration sets existing shops to `taxRate=0.08875`, `taxLabel="Sales Tax"`. Order gains `taxRate`/`taxLabel` snapshots for receipt rendering. |
| 10005   | Agent 0.3: `referencePubkey` field on orders — a fresh Solana keypair public key generated at order creation. Uses `getSignaturesForAddress` for unambiguous on-chain transaction discovery instead of memo-string parsing. Existing orders get `referencePubkey: null` (fall back to legacy confirmation path). |

### BigInt Money Arithmetic

All financial calculations use bigint math with 6-decimal SPL token
precision (`DECIMALS = 6`). This prevents floating-point errors that
can cause off-by-one-micro-unit discrepancies in SPL token transfers.

### computeOrderTotals as Single Source of Truth

Order arithmetic (subtotal, tip, tax/reserve, charity, total) is computed
by a single pure function `computeOrderTotals()`. Both the POS cart and
the payment store call this function, ensuring totals are always
consistent between the cart display and the payment QR.

### Payment Reference Discovery

Instead of relying on memo-only transaction matching (fragile — some
wallets strip memos), the primary discovery method uses Solana Pay
reference keys. A throwaway keypair is generated per order and its
public key is embedded in the Solana Pay URL. On-chain discovery polls
`getSignaturesForAddress` on that reference address.

A secondary `TxMonitor` fallback (memo-based) exists for edge cases
where the reference key approach fails, supporting both Helius WebSocket
(logsSubscribe) and polling fallbacks.

### QR Regeneration

Solana blockhashes expire after ~60-90 seconds. The payment page allows
up to 3 QR regenerations per order, each fetching a fresh blockhash.
Tari QR codes do not need regeneration (deep links are state-independent).

### Idempotency

Two layers of duplicate payment protection:

1. **Same-order:** `duplicateTxIds` array logs repeat payment signatures
   on already-paid orders.
2. **Cross-order:** `paymentRef` collision check — if a payment reference
   was already used on a different paid order, the current order is
   marked `pending_review` instead of `paid`.

### No Backend

Deliberate architectural choice: Microstore has zero backend infrastructure.
No API routes, no database server, no authentication service. The app is
deployed as static files. Payments are verified purely on-chain — the app
trusts the Solana/Tari networks, not a server.

### Progressive Web App

The app registers a service worker (`public/sw.js`), includes a
`manifest.json`, and uses the `PwaRegister` component. This enables
install-to-home-screen, offline access, and a native-like experience
for merchants.

### Reserve Allocation (Tax Set-Aside)

The shop configuration uses `reserveAllocationEnabled`, `reserveRate`,
`reserveRegion`, `taxRate`, `taxLabel`, and `reserveWallet` fields.
The `taxRate` field (0–1 decimal) is the merchant's chosen tax rate,
validated on create and editable in shop settings. `taxLabel` is the
human-readable tax name shown on receipts and UI (e.g. "Sales Tax",
"VAT", "GST"). `taxSetAsideWallet` is an optional wallet for funds
that the merchant sets aside for tax remittance.

The `Order.tax` field still uses the legacy name but represents the
reserve allocation amount (computed from `reserveRate × subtotal`).
The `Order.taxRate` and `Order.taxLabel` fields capture a snapshot
at time of sale for accurate receipt rendering.
