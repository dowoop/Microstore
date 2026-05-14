# MicroShop v0

Solana-native micro-commerce application — Point of Sale first, built for mobile merchants.
No server. No signups. Just scan a QR code and pay with your Solana wallet.

---

## Quickstart

```bash
# Clone & install
git clone <repo-url> microstore && cd microstore
npm install

# Set your Helius API key (optional — falls back to public RPC)
export NEXT_PUBLIC_HELIUS_API_KEY="your-helius-key"

# Start dev server
npm run dev
# → http://localhost:3000
```

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (Mobile-First)                 │
├───────────┬───────────────┬───────────────┬──────────────┤
│ Next.js 16│  Zustand 5    │  Dexie 4      │ @solana/*    │
│ App Router│  (State)      │  (IndexedDB)  │ (Blockchain) │
├───────────┴───────────────┴───────────────┴──────────────┤
│              Helius RPC / Solana Devnet                   │
└──────────────────────────────────────────────────────────┘
```

Everything runs client-side. No backend server. Data lives in the browser's
IndexedDB. Solana transactions are built and signed in the browser, confirmed
via Helius RPC.

### Layer 1: Data (IndexedDB via Dexie)

`src/lib/db.ts` — Four entity tables with schema versioning:

| Table    | Indexes                                    | Purpose                   |
|----------|--------------------------------------------|---------------------------|
| shops    | id, name, username, merchantWallet, date   | Merchant profile + wallets|
| items    | id, shopId, name, category, sku, barcode   | Products & services       |
| orders   | id, shopId, status, txSignature            | Sales history + tx info   |
| expenses | id, shopId, category, date                 | Operating costs           |

Schema migrations use Dexie's `version()` API. The DB is at v3 currently,
adding Solana wallet addresses and per-split transaction signatures.

Key entities:

```typescript
// Shop — merchant identity with Solana wallet config
{
  name: string, username: string,
  tipPresets: number[],           // [0, 10, 15, 20]
  taxAllocationEnabled: boolean,
  charityEnabled: boolean, charityPartners: string[],
  merchantWallet: string,         // Solana pubkey (base58)
  taxWallet: string, charityWallet: string,
  splTokenMint: string,           // SPL token to accept (e.g. USDC)
}

// Item — sellable product or service
{
  type: 'product' | 'service',
  price: number, cost: number,
  stock: number, lowStockThreshold?: number,
  status: 'live' | 'draft',
  payUpfrontTemplate?: string,    // for services
}

// Order — completed sale with split tracking
{
  subtotal: number, tip: number, tax: number, charity: number,
  total: number,
  txSignature: string,            // umbrella tx
  merchantTxSignature: string,    // merchant split tx
  taxTxSignature: string,         // tax split tx
  charityTxSignature: string,     // charity split tx
}
```

### Layer 2: State (Zustand)

Each store handles one bounded concern:

| Store file            | Hook               | Concern                      |
|-----------------------|--------------------|------------------------------|
| `store.ts`            | `useAppStore`      | Active shop, tab navigation  |
| `createShopStore.ts`  | `useCreateShopStore`| Shop onboarding form         |
| `itemEditorStore.ts`  | `useItemEditorStore`| Product/service editor       |
| `posCartStore.ts`     | `usePosCartStore`  | POS cart + tip/tax/charity   |
| `payStore.ts`         | `usePayStore`      | Payment flow + split preview |

`useAppStore` uses Zustand `persist` middleware (saved to localStorage).
All other stores are ephemeral — reload the page, and the form resets.

The POS cart store is the **critical store** — it computes:

```
subtotal   = Σ(item.price × quantity)
tipAmount  = subtotal × tipPercent / 100
taxAmount  = taxAllocationEnabled ? subtotal × 0.08875 : 0
charity    = charityRoundUp ? ceil(total) - total : 0
total      = round2(subtotal) + round2(tip) + round2(tax) + round2(charity)
```

Each component is individually rounded to 2 decimal places before summing,
so the displayed total always equals the sum of individual split leg amounts.

### Layer 3: Solana Integration

`src/lib/solanaPay.ts` — The money layer. Four subsystems:

#### A. Connection Management

```typescript
getConnection(cluster) → Connection
```
- Prefers Helius RPC if `NEXT_PUBLIC_HELIUS_API_KEY` is set
- Falls back to `clusterApiUrl('devnet')` for public access
- `'confirmed'` commitment level

#### B. Atomic Split Computation

```typescript
computeAtomicSplit({ subtotal, tipPercent, taxRate, ... }) → SplitBreakdown
```
Produces three destination allocations:
- **Merchant**: subtotal + tip (the take-home)
- **Tax**: subtotal × taxRate (to tax wallet)
- **Charity**: round-up to nearest dollar (to charity wallet)

#### C. Transaction Construction

```typescript
buildAtomicSplitTransaction(connection, params) → Transaction
```
Builds a Solana `Transaction` with:
1. Three SPL `TransferChecked` instructions (one per split leg)
2. Zero-amount legs are skipped (only active destinations)
3. Uses `getAssociatedTokenAddress` for ATA derivation
4. Optional Memo instruction for transaction identity

The customer signs and submits this single transaction — all three
transfers execute atomically or not at all.

#### D. Solana Pay QR

```typescript
createSolanaPayURL({ recipient, amount, ... }) → string
generateQRCode(data) → dataURL (PNG)
serializeTransactionForQR(tx) → base64
```
Generates a `solana:` URL for @solana/pay encodeURL, renders it as
a QR code data URL, and serializes transactions for direct scan-and-sign.

#### E. Wallet Balance

```typescript
fetchWalletBalance(address) → SOL amount
fetchTokenBalances(address) → SPL token list
fetchWalletBalances(address) → { sol, tokens, fetchedAt }
```
Uses Helius `getTokenAccounts` when available, falls back to standard
`getParsedTokenAccountsByOwner`.

### Layer 4: UI (Next.js App Router)

Screen routes (14 total) organized by domain:

| Route               | Screen              | Purpose                          |
|---------------------|---------------------|----------------------------------|
| `/`                 | Dashboard           | Revenue cards, recent orders     |
| `/shops/new`        | Create Shop         | Merchant onboarding form         |
| `/shops/[id]`       | Shop Detail         | Edit shop profile                |
| `/items`            | Inventory List      | All items with search/filter     |
| `/items/new`        | Product/Service Ed. | Add item (product or service)    |
| `/items/[id]`       | Item Editor         | Edit existing item               |
| `/pos`              | Point of Sale      | Cart builder, checkout panel     |
| `/orders`           | Order List          | All orders, filter by status     |
| `/orders/[id]`      | Order Detail        | Single order with split display  |
| `/orders/new`       | Manual Order        | Offline order entry              |
| `/expenses`         | Expense List        | Operating costs                  |
| `/expenses/new`     | Add Expense         | Record expense                   |
| `/settings`         | Settings            | Shop configuration               |
| `/pay`              | Customer Pay        | QR code + split preview (public) |
| `/receipt/[id]`     | Receipt             | Post-payment receipt             |

#### Shared Components

| Component          | File                        | Role                          |
|--------------------|-----------------------------|-------------------------------|
| `MerchantShell`    | `components/merchant-shell.tsx` | Layout wrapper: topnav + tabs + content |
| `TopNav`           | `components/topnav.tsx`     | Shop name, connection status  |
| `Tabs`             | `components/tabs.tsx`       | Bottom tab bar navigation     |
| `NotificationPoller` | `lib/notifications.tsx`   | Background order notifications|

`MerchantShell` is the layout shell wrapping every merchant-facing page:

```
┌─────────────────────┐
│      TopNav          │  ← shop name, wallet status
├─────────────────────┤
│                     │
│      Content         │  ← page-specific content
│    (max-w-md)       │
│                     │
├─────────────────────┤
│      Tabs            │  ← home | orders | items | pos | more
└─────────────────────┘
```

### Data Flow: How a Sale Works

```
1. Merchant opens /pos
2. Cart → usePosCartStore → addItem, setTip, toggleCharity
3. "Charge" → creates Order in Dexie (db.orders.add)
4. Redirect to /pay?id=<orderId>
5. usePayStore.loadOrder() → fetches Order + Shop from Dexie
6. computeAtomicSplit() → merchant/tax/charity breakdown
7. createSolanaPayURL() → solana: URL
8. generateQRCode() → QR PNG displayed on screen
9. Customer scans QR with Phantom/Solflare
10. Wallet shows atomic split transaction → customer signs
11. Transaction confirmed via Helius RPC
12. NotificationPoller detects confirmation → updates Order status
```

---

## Dependencies

### Runtime

| Package                    | Version  | Purpose                              |
|----------------------------|----------|--------------------------------------|
| next                       | ^16.2.6  | React framework, App Router          |
| react / react-dom           | ^19.2.4  | UI rendering                         |
| dexie                      | ^4.4.2   | IndexedDB wrapper (offline data)     |
| dexie-react-hooks          | ^4.4.0   | React hooks for Dexie queries        |
| zustand                    | ^5.0.13  | Lightweight state management         |
| @solana/web3.js            | ^1.98.4  | Solana RPC, transactions, keys       |
| @solana/spl-token          | ^0.4.14  | SPL token transfer instructions      |
| @solana/pay                | ^1.0.16  | Solana Pay URL encoding              |
| qrcode                     | ^1.5.4   | QR code generation (canvas)          |
| qrcode.react               | ^4.2.0   | QR code React component              |
| lucide-react               | ^1.14.0  | Icon library                         |

### Dev Dependencies

| Package                    | Version  | Purpose                              |
|----------------------------|----------|--------------------------------------|
| typescript                 | ^5       | Type checking                        |
| tailwindcss                | ^4       | Utility-first CSS framework          |
| @tailwindcss/postcss       | ^4       | PostCSS plugin for Tailwind 4        |
| eslint                     | ^9       | Linting                              |
| eslint-config-next         | ^16.2.6  | Next.js ESLint preset                |
| @types/react, @types/node  | ^19, ^20 | TypeScript type definitions          |

### External Services

| Service   | Purpose                                    | Required? |
|-----------|--------------------------------------------|-----------|
| Helius    | High-performance Solana RPC with token metadata | Optional (falls back to public RPC) |
| Solana Devnet | Blockchain environment for testing     | Required  |

### Key Architectural Decisions

1. **No backend** — Everything is client-side. Data in IndexedDB. No auth.
   This means data doesn't sync across devices. Future: optional cloud sync.

2. **Atomic split as the core** — The three-way SPL transfer is the raison
   d'être. Merchant gets the sale, tax goes to authority, charity goes to
   designated partner — all in one transaction the customer signs.

3. **Scratch workspaces per task** — The kanban workers each work in isolated
   directories. The real project lives at `/home/alex/Workstation/Microstore/`.
   Workers write their output there directly.

4. **Zustand over Redux** — Minimal boilerplate, TypeScript-native, no
   providers needed. Each store is a standalone module.

5. **Dexie v3 schema migrations** — The database has evolved across 3 versions
   as features were added (v1: basic CRUD, v2: wallet addresses, v3: per-split
   transaction signatures).

---

## Setup Guide

### Prerequisites

- Node.js >= 18
- npm >= 9
- A Solana wallet (Phantom, Solflare, or Backpack) for testing

### 1. Clone and Install

```bash
cd /home/alex/Workstation/Microstore
npm install
```

### 2. Helius API Key (Recommended)

Get a free API key at [helius.dev](https://helius.dev) — you get higher rate
limits and better RPC performance.

```bash
export NEXT_PUBLIC_HELIUS_API_KEY="your-key-here"
```

Without this, the app uses Solana's public devnet RPC (rate-limited).

### 3. Start Dev Server

```bash
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000)

### 4. Initialize a Shop

1. Open the app → click "Create Shop"
2. Fill in shop name, @username, description
3. Configure tip presets (select which percentages to offer)
4. Toggle tax allocation and charity on/off
5. Enter Solana wallet addresses:
   - **Merchant wallet**: your wallet (receives sale + tip)
   - **Tax wallet**: tax authority wallet (receives tax portion)
   - **Charity wallet**: charity partner wallet (receives round-up)
6. Enter SPL token mint address (or leave default)
7. Save → shop is persisted to IndexedDB

### 5. Add Items

Navigate to Items → Add Item:
- Choose Product or Service type
- Set name, price, stock count, category
- For services: add pay-upfront description
- Toggle live/draft status
- Upload product photo (stored as object URL in IndexedDB)

### 6. Make a Sale (POS)

1. Go to POS tab
2. Tap items to add to cart (quantity increments)
3. Adjust quantities in the cart panel
4. Select tip percentage
5. Toggle charity round-up
6. Tap "Charge" → order is created, redirect to /pay
7. A Solana Pay QR code appears with the atomic split breakdown
8. Customer scans QR with their wallet
9. Customer signs the three-way SPL transfer transaction
10. Payment confirmed → order status updates

### 7. View Orders & Expenses

- **Orders**: list with status filter, click for detail (shows per-split tx signatures)
- **Expenses**: track operating costs, categorize by type

---

## File Map

```
src/
├── app/                      # Next.js App Router pages
│   ├── layout.tsx            # Root layout (MerchantShell wrapper)
│   ├── page.tsx              # Home / dashboard
│   ├── globals.css           # Tailwind imports + global styles
│   ├── pos/page.tsx          # Point of Sale
│   ├── pay/page.tsx          # Customer payment (QR code)
│   ├── receipt/[id]/page.tsx # Post-payment receipt
│   ├── shops/
│   │   ├── page.tsx          # Shop list
│   │   ├── new/page.tsx      # Create Shop form
│   │   └── [id]/page.tsx     # Edit Shop
│   ├── items/
│   │   ├── page.tsx          # Inventory list
│   │   ├── new/page.tsx      # Add item
│   │   └── [id]/page.tsx     # Edit item
│   ├── orders/
│   │   ├── page.tsx          # Order list
│   │   ├── new/page.tsx      # Manual order entry
│   │   └── [id]/page.tsx     # Order detail
│   ├── expenses/
│   │   ├── page.tsx          # Expense list
│   │   └── new/page.tsx      # Add expense
│   └── settings/
│       └── page.tsx          # Settings
├── components/
│   ├── merchant-shell.tsx    # Layout: TopNav + Tabs + content
│   ├── topnav.tsx            # Top navigation bar
│   └── tabs.tsx              # Bottom tab bar
└── lib/
    ├── db.ts                 # Dexie schema + indexes
    ├── store.ts              # App state (active shop, tab)
    ├── createShopStore.ts    # Shop onboarding form state
    ├── itemEditorStore.ts    # Product/service editor state
    ├── posCartStore.ts       # POS cart + split computation
    ├── payStore.ts           # Payment flow + split preview
    ├── solanaPay.ts          # Solana: tx, split, QR, balances
    └── notifications.tsx     # Order status polling
```

---

## Development Notes

### Build

```bash
npm run build    # TypeScript + Next.js production build
npm run lint     # ESLint
```

All 16 routes compile and pass TypeScript checking. The build output is a
static export compatible with any static hosting.

### Adding a New Screen

1. Create `src/app/<route>/page.tsx`
2. Wrap content in `MerchantShell`
3. If it needs state: create a Zustand store in `src/lib/`
4. If it touches data: use `db.<table>` from `src/lib/db.ts`
5. If it needs routes: Next.js file-system routing handles it

### Testing

Run the dev server and test on **mobile viewport** (375px width) — this is a
mobile-first POS app designed for phone screens.

For Solana testing:
1. Use **devnet** (default) — no real money
2. Get devnet SOL from [solfaucet.com](https://solfaucet.com)
3. Create test SPL tokens using the Solana CLI or a devnet faucet
4. Test the full flow: create shop → add items → POS checkout → scan QR → sign

### Limitations (v0)

- **No cloud sync** — data lives in browser IndexedDB only
- **Single device** — no multi-merchant or multi-device sync
- **No real-time inventory** — stock is local, not shared
- **No fiat on-ramp** — customers must already have a Solana wallet with SPL tokens
- **Listing rules disabled** — the `listingRules` field exists but the UI is stubbed
- **USDC assumed** — the SPL token mint is configurable but the UX assumes a stablecoin
