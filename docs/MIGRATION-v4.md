# MIGRATION-v4 — Unified Chain/Network + BigInt Money Schema

> **Status:** Spec  
> **Target version:** `10000` → `10001`  
> **Depends on:** S2 (BigInt primitives / `Money` class), S3 (migration code), S4–S6 (cart rewrite, rename sweep, photo fix)  
> **Date:** 2026-05-15  

This document is the authoritative blueprint for the v-next Dexie migration. It defines the exact target schema for `shops`, `orders`, and `expenses`, the mapping from current fields to new fields, and the upgrade logic that S3 will implement.

---

## 1. Current Schema (version 10000)

Source: `src/lib/db.ts` — schema version `10000`.

### 1.1 shops

```ts
interface Shop {
  id:                   number;
  name:                 string;
  username:             string;
  photoUrl?:            string;
  description?:         string;
  tipPresets:           number[];
  reserveAllocationEnabled: boolean;
  reserveRate?:         number;
  reserveRegion?:       string;
  charityEnabled:       boolean;
  charityPartners:      string[];
  merchantWallet?:      string;
  reserveWallet?:       string;
  charityWallet?:       string;
  splTokenMint?:        string;
  splTokenSymbol?:      string;
  address?:             string;
  phone?:               string;
  email?:               string;
  currency?:            string;
  acceptedTokens?:      AcceptedToken[];
  tariWallet?:          string;
  tariNetwork?:         'igor' | 'mainnet';
  tariAcceptedTokens?:  { symbol: string; assetId?: string; resourceAddress?: string }[];
  isDemo?:              boolean;
  cluster?:             'devnet' | 'mainnet-beta';
  createdAt:            Date;
  updatedAt:            Date;
}
```

Dexie indexes: `++id, name, username, merchantWallet, cluster, createdAt`

### 1.2 orders

```ts
interface Order {
  id:                      number;
  shopId:                  number;
  customerId?:             number;
  customerName?:           string;          // @deprecated
  customerPhone?:          string;          // @deprecated
  status:                  OrderStatus;
  subtotal:                number;
  tip:                     number;
  tipPercent:              number;
  tax:                     number;          // ← MUST rename to reserve
  charity:                 number;
  total:                   number;
  discount?:               number;
  items:                   OrderItem[];
  txSignature?:            string;
  merchantTxSignature?:    string;
  reserveTxSignature?:     string;
  charityTxSignature?:     string;
  tariTransactionId?:      string;
  paymentChain?:           'solana' | 'tari';
  tariTokenSymbol?:        string;
  tariTokenResourceAddress?: string;
  paymentRef?:             string;
  duplicateTxIds?:         string[];
  merchantWallet?:         string;
  reserveWallet?:          string;
  charityWallet?:          string;
  splTokenMint?:           string;
  splTokenSymbol?:         string;
  confirmedAt?:            Date;
  failedReason?:           string;
  lastAttemptAt?:          Date;
  invoiceNumber?:          number;
  invoiceType?:            InvoiceType;
  invoiceDueDate?:         Date;
  invoiceNotes?:           string;
  viewedAt?:               Date;
  expiresAt?:              Date;
  cluster?:                'devnet' | 'mainnet-beta';
  createdAt:               Date;
  updatedAt:               Date;
}
```

Dexie indexes: `++id, shopId, customerId, status, txSignature, merchantTxSignature, paymentRef, cluster, createdAt`

### 1.3 expenses

```ts
interface Expense {
  id:          number;
  shopId:      number;
  category:    string;
  amount:      number;
  description?: string;
  date:        Date;
  cluster?:    'devnet' | 'mainnet-beta';
  createdAt:   Date;
}
```

Dexie indexes: `++id, shopId, category, cluster, date`

---

## 2. Prerequisite Types (S2 deliverable)

### 2.1 ChainId

```ts
type ChainId = 'solana' | 'tari' | 'lightning' | 'evm' | 'monero' | 'bitcoin';
```

The canonical set of supported chains. The migration only backfills `'solana'` and `'tari'`; future chains are added at write-time.

### 2.2 NetworkId

```ts
type NetworkId = 'devnet' | 'mainnet-beta' | 'igor' | 'esmeralda' | 'mainnet' | 'testnet' | 'regtest';
```

Map from legacy fields:

| Chain   | Legacy field      | `network` value      |
| ------- | ----------------- | -------------------- |
| solana  | `cluster`         | `'devnet'` or `'mainnet-beta'` |
| tari    | `tariNetwork`     | `'igor'` or `'mainnet'` |

### 2.3 ChainShopConfig

```ts
interface ChainShopConfig {
  /** Wallet address for receiving payments on this chain */
  merchantWallet?: string;
  /** Optional reserve wallet (if different from merchant) */
  reserveWallet?: string;
  /** Optional charity wallet */
  charityWallet?: string;
  /** Token mint / contract address for this chain */
  tokenMint?: string;
  /** Token symbol on this chain */
  tokenSymbol?: string;
  /** Accepted tokens list */
  acceptedTokens?: AcceptedToken[];
  /** Base reserve/dead-man-switch rate (e.g. 0.08875 for 8.875%) */
  reserveRate?: number;
  /** Jurisdiction for reserve region lookup */
  reserveRegion?: string;
}
```

### 2.4 Money class (S2)

```ts
class Money {
  /** Base-unit bigint representation (e.g. 10_130_000n for $10.13 at 6 decimals) */
  readonly base: bigint;
  /** Number of decimal places for this token */
  readonly decimals: number;

  /** Construct from decimal string. '10.13' + 6 decimals → base = 10130000n */
  static fromDecimalString(value: string, decimals: number): Money;

  /** Construct from number. Uses .toFixed(decimals) to avoid float drift. */
  static fromNumber(value: number, decimals: number): Money;

  /** Construct directly from base-unit bigint. */
  static fromBase(value: bigint, decimals: number): Money;

  /** Output base units as string. '10130000n' with 6 decimals → '10130000' */
  toBaseString(): string;

  /** Format for display. '10130000n' with 6 decimals → '10.13' */
  toDecimalString(minDecimals?: number): string;

  /** Convert to number (lossy — prefer toBaseString for storage). */
  toNumber(): number;

  /** Arithmetic: add, subtract, multiply by scalar, divide by scalar. All return new Money. */
  add(other: Money): Money;
  subtract(other: Money): Money;
  multiply(scalar: number): Money;
  divide(scalar: number): Money;
}
```

> **Implementation note:** The Money class wraps the existing BigInt utilities in `src/lib/solanaPay.ts` (`dollarsToBaseUnits`, `formatTokenAmount`, `numberToBaseUnits`, `baseUnitsToNumber`). S2 should consolidate those into this class and remove/re-export the old function signatures.

---

## 3. Target Schema (version 10001)

### 3.1 shops (v-next)

```ts
interface Shop {
  // ── Unchanged fields ──────────────────────────────────────────
  id:                   number;
  name:                 string;
  username:             string;
  photoUrl?:            string;
  description?:         string;
  tipPresets:           number[];
  charityEnabled:       boolean;
  charityPartners:      string[];
  address?:             string;
  phone?:               string;
  email?:               string;
  currency?:            string;
  isDemo?:              boolean;
  createdAt:            Date;
  updatedAt:            Date;

  // ── Renamed: tax* → reserve* (already done in v10000) ─────────
  reserveAllocationEnabled: boolean;
  reserveRate?:         number;
  reserveRegion?:       string;

  // ── NEW: Unified chain/network ────────────────────────────────
  chain:                ChainId;                           // default 'solana'
  network:              NetworkId;                         // default 'devnet'
  supportedChains:      ChainId[];                         // derived from configured wallets
  chainConfig:          Record<ChainId, ChainShopConfig>;  // per-chain wallet addresses
  defaultChain:         ChainId;                           // first configured chain

  // ── DEPRECATED (migrated into chainConfig) ────────────────────
  // merchantWallet?    → chainConfig['solana'].merchantWallet
  // reserveWallet?     → chainConfig['solana'].reserveWallet
  // charityWallet?     → chainConfig['solana'].charityWallet
  // splTokenMint?      → chainConfig['solana'].tokenMint
  // splTokenSymbol?    → chainConfig['solana'].tokenSymbol
  // acceptedTokens?    → chainConfig['solana'].acceptedTokens
  // reserveRate?       → chainConfig['solana'].reserveRate
  // reserveRegion?     → chainConfig['solana'].reserveRegion
  // tariWallet?        → chainConfig['tari'].merchantWallet
  // tariNetwork?       → (mapped to network)
  // tariAcceptedTokens?→ chainConfig['tari'].acceptedTokens
  // cluster?           → (mapped to network)
}
```

Dexie indexes: `++id, name, username, chain, network, createdAt`

### 3.2 orders (v-next)

```ts
interface Order {
  // ── Unchanged fields ──────────────────────────────────────────
  id:                      number;
  shopId:                  number;
  customerId?:             number;
  customerName?:           string;        // @deprecated — S4 removal
  customerPhone?:          string;        // @deprecated — S4 removal
  status:                  OrderStatus;
  tipPercent:              number;
  discount?:               number;
  items:                   OrderItem[];
  txSignature?:            string;
  merchantTxSignature?:    string;
  reserveTxSignature?:     string;
  charityTxSignature?:     string;
  tariTransactionId?:      string;
  tariTokenSymbol?:        string;
  tariTokenResourceAddress?: string;
  paymentRef?:             string;
  duplicateTxIds?:         string[];
  merchantWallet?:         string;
  reserveWallet?:          string;
  charityWallet?:          string;
  splTokenMint?:           string;
  splTokenSymbol?:         string;
  confirmedAt?:            Date;
  failedReason?:           string;
  lastAttemptAt?:          Date;
  invoiceNumber?:          number;
  invoiceType?:            InvoiceType;
  invoiceDueDate?:         Date;
  invoiceNotes?:           string;
  viewedAt?:               Date;
  expiresAt?:              Date;
  createdAt:               Date;
  updatedAt:               Date;

  // ── RENAMED: tax → reserve ────────────────────────────────────
  reserve:                 number;

  // ── Migrated from cluster / paymentChain ──────────────────────
  chain:                   ChainId;       // default 'solana'
  network:                 NetworkId;     // default 'devnet'

  // ── NEW: BigInt base-unit money fields ────────────────────────
  subtotalBase:            string;        // populated from subtotal via Money
  tipBase:                 string;        // populated from tip via Money
  reserveBase:             string;        // populated from old tax field via Money
  charityBase:             string;        // populated from charity via Money
  totalBase:               string;        // populated from total via Money

  // ── RETAINED for backward compat (removed in S4) ──────────────
  subtotal:                number;        // ← keep until S4
  tip:                     number;        // ← keep until S4
  charity:                 number;        // ← keep until S4
  total:                   number;        // ← keep until S4

  // ── DEPRECATED (migrated to chain/network) ────────────────────
  // tax          → reserve (rename)
  // paymentChain → chain
  // cluster      → network
}
```

Dexie indexes: `++id, shopId, customerId, status, chain, network, txSignature, merchantTxSignature, paymentRef, createdAt`

### 3.3 expenses (v-next)

```ts
interface Expense {
  // ── Unchanged fields ──────────────────────────────────────────
  id:          number;
  shopId:      number;
  category:    string;
  amount:      number;
  description?: string;
  date:        Date;
  createdAt:   Date;

  // ── NEW: chain/network ────────────────────────────────────────
  chain:       ChainId;     // default 'solana'
  network:     NetworkId;   // default 'devnet'

  // ── DEPRECATED ────────────────────────────────────────────────
  // cluster    → network
}
```

Dexie indexes: `++id, shopId, category, chain, network, date`

---

## 4. Field Rename Map

| Table   | Old name         | New name      | Notes                                          |
| ------- | ---------------- | ------------- | ---------------------------------------------- |
| orders  | `tax`            | `reserve`     | Monetary field — both `number` and `*Base`     |
| orders  | `paymentChain`   | `chain`       | Type narrows to `ChainId`                      |
| shops   | `cluster`        | `network`     | Solana-only → universal network                |
| orders  | `cluster`        | `network`     | Solana-only → universal network                |
| expenses| `cluster`        | `network`     | Solana-only → universal network                |
| shops   | `merchantWallet` | `chainConfig['solana'].merchantWallet` | Nest under chain config      |
| shops   | `reserveWallet`  | `chainConfig['solana'].reserveWallet`  | Nest under chain config      |
| shops   | `charityWallet`  | `chainConfig['solana'].charityWallet`  | Nest under chain config      |
| shops   | `splTokenMint`   | `chainConfig['solana'].tokenMint`      | Nest under chain config      |
| shops   | `splTokenSymbol` | `chainConfig['solana'].tokenSymbol`    | Nest under chain config      |
| shops   | `acceptedTokens` | `chainConfig['solana'].acceptedTokens` | Nest under chain config      |
| shops   | `reserveRate`    | `chainConfig['solana'].reserveRate`    | Nest under chain config      |
| shops   | `reserveRegion`  | `chainConfig['solana'].reserveRegion`  | Nest under chain config      |
| shops   | `tariWallet`     | `chainConfig['tari'].merchantWallet`   | Nest under chain config      |
| shops   | `tariAcceptedTokens` | `chainConfig['tari'].acceptedTokens` | Nest under chain config      |
| shops   | `tariNetwork`    | `network`      | Mapped; tari-specific network name preserved |

---

## 5. New Fields Summary

| Table   | Field             | Type                    | Default        | Source / Derivation                                     |
| ------- | ----------------- | ----------------------- | -------------- | ------------------------------------------------------- |
| shops   | `chain`           | `ChainId`               | `'solana'`     | Always solana for existing; writable for new shops      |
| shops   | `network`         | `NetworkId`             | `'devnet'`     | From `cluster` or `tariNetwork`                         |
| shops   | `supportedChains` | `ChainId[]`             | `[]`           | `'solana'` if merchantWallet; `'tari'` if tariWallet    |
| shops   | `chainConfig`     | `Record<ChainId, CCS>`  | `{}`           | Populated from legacy flat fields                       |
| shops   | `defaultChain`    | `ChainId`               | first in list  | First element of `supportedChains`                      |
| orders  | `chain`           | `ChainId`               | `'solana'`     | From `paymentChain`; fallback `'solana'`                |
| orders  | `network`         | `NetworkId`             | `'devnet'`     | From shop's network at creation time (or `cluster`)     |
| orders  | `reserve`         | `number`                | `tax` value    | Rename of `tax` field                                   |
| orders  | `subtotalBase`    | `string`                | `'0'`          | `Money.fromNumber(subtotal, 6).toBaseString()`          |
| orders  | `tipBase`         | `string`                | `'0'`          | `Money.fromNumber(tip, 6).toBaseString()`               |
| orders  | `reserveBase`     | `string`                | `'0'`          | `Money.fromNumber(tax, 6).toBaseString()`               |
| orders  | `charityBase`     | `string`                | `'0'`          | `Money.fromNumber(charity, 6).toBaseString()`            |
| orders  | `totalBase`       | `string`                | `'0'`          | `Money.fromNumber(total, 6).toBaseString()`              |
| expenses| `chain`           | `ChainId`               | `'solana'`     | Always solana for existing                              |
| expenses| `network`         | `NetworkId`             | `'devnet'`     | From `cluster` field                                    |

> **Money decimals:** All monetary base fields use 6 decimal places (SOL standard for USDC). This is a system constant (`MONEY_DECIMALS = 6`).

---

## 6. Migration Logic (upgrade function pseudocode)

The migration executes inside a `db.version(10001).stores(...).upgrade(async tx => { ... })` block.

### 6.1 Pre-upgrade guard

```ts
// Prevent double migration if upgrade runs twice (idempotency)
const shopCount = await tx.table('shops').count();
if (shopCount > 0) {
  const sample = await tx.table('shops').limit(1).first();
  if (sample && 'chain' in sample) {
    return; // Already migrated
  }
}
```

### 6.2 shops migration

```
for each shop in tx.table('shops').toCollection():

  // 1. Determine chain — always solana for existing shops
  shop.chain = 'solana'

  // 2. Determine network — from cluster, fallback 'devnet'
  shop.network = shop.cluster ?? 'devnet'

  // 3. Derive supportedChains from configured wallets
  shop.supportedChains = []
  if shop.merchantWallet: shop.supportedChains.push('solana')
  if shop.tariWallet:      shop.supportedChains.push('tari')

  // 4. Build chainConfig
  shop.chainConfig = {}

  // Solana config
  shop.chainConfig['solana'] = packSolanaConfig(shop)

  // Tari config (if configured)
  if shop.tariWallet:
    shop.chainConfig['tari'] = packTariConfig(shop)

  // 5. Set defaultChain — first configured chain
  shop.defaultChain = shop.supportedChains[0] ?? 'solana'

  // 6. Put updated shop
  await tx.table('shops').put(shop)

// Helper: pack Solana config from legacy flat fields
function packSolanaConfig(shop):
  cfg = {}
  if shop.merchantWallet:    cfg.merchantWallet = shop.merchantWallet
  if shop.reserveWallet:     cfg.reserveWallet  = shop.reserveWallet
  if shop.charityWallet:     cfg.charityWallet  = shop.charityWallet
  if shop.splTokenMint:      cfg.tokenMint      = shop.splTokenMint
  if shop.splTokenSymbol:    cfg.tokenSymbol    = shop.splTokenSymbol
  if shop.acceptedTokens:    cfg.acceptedTokens = shop.acceptedTokens
  if shop.reserveRate:       cfg.reserveRate    = shop.reserveRate
  if shop.reserveRegion:     cfg.reserveRegion  = shop.reserveRegion
  return cfg

// Helper: pack Tari config from legacy flat fields
function packTariConfig(shop):
  cfg = {}
  if shop.tariWallet:              cfg.merchantWallet = shop.tariWallet
  if shop.tariAcceptedTokens:      cfg.acceptedTokens = shop.tariAcceptedTokens
  return cfg
```

### 6.3 orders migration

```
allShops = Map<shopId, shop>  // pre-load all shops for network lookup

for each order in tx.table('orders').toCollection():

  // 1. Rename tax → reserve
  order.reserve = order.tax ?? 0
  delete order.tax

  // 2. Determine chain
  order.chain = order.paymentChain ?? 'solana'

  // 3. Determine network — prefer shop's network, fallback to cluster
  shop = allShops.get(order.shopId)
  if shop:
    order.network = shop.network
  else:
    order.network = order.cluster ?? 'devnet'

  // 4. Compute base-unit monetary fields via Money class
  //    All use 6 decimal places (default — independent of chain's native decimals;
  //    base-unit representation is for precision, not chain-native display)
  const DECIMALS = 6

  order.subtotalBase = Money.fromNumber(order.subtotal ?? 0, DECIMALS).toBaseString()
  order.tipBase      = Money.fromNumber(order.tip ?? 0, DECIMALS).toBaseString()
  order.reserveBase  = Money.fromNumber(order.reserve ?? 0, DECIMALS).toBaseString()
  order.charityBase  = Money.fromNumber(order.charity ?? 0, DECIMALS).toBaseString()
  order.totalBase    = Money.fromNumber(order.total ?? 0, DECIMALS).toBaseString()

  // 5. Put updated order
  await tx.table('orders').put(order)
```

### 6.4 expenses migration

```
for each expense in tx.table('expenses').toCollection():

  expense.chain   = 'solana'
  expense.network = expense.cluster ?? 'devnet'

  await tx.table('expenses').put(expense)
```

### 6.5 Idempotency summary

| Table    | Guard                                                                 |
| -------- | --------------------------------------------------------------------- |
| shops    | Sample first shop; if `chain` field exists, bail out                  |
| orders   | Sample first order; if `reserve` field exists (not `tax`), bail out   |
| expenses | Sample first expense; if `chain` field exists, bail out               |

The migration can safely run multiple times — each table-level loop exits early if its target fields are already present.

---

## 7. Dexie Schema Declaration (version 10001)

```ts
this.version(10001).stores({
  shops:
    '++id, name, username, chain, network, createdAt',
  items:
    '++id, shopId, name, category, sku, barcode, createdAt',
  orders:
    '++id, shopId, customerId, status, chain, network, txSignature, merchantTxSignature, paymentRef, createdAt',
  expenses:
    '++id, shopId, category, chain, network, date',
  customers:
    '++id, shopId, name, phone, createdAt',
  offlineQueue:
    '++id, status, createdAt',
  errorLogs:
    '++id, timestamp',
  cartDrafts:
    '++id, shopId, updatedAt',
}).upgrade(async tx => {
  // Migration pseudocode from Section 6
});
```

> **Note:** Index changes:
> - shops: `merchantWallet` + `cluster` → `chain` + `network`
> - orders: `cluster` → `chain` + `network`
> - expenses: `cluster` → `chain` + `network`
> - tables not undergoing migration (items, customers, offlineQueue, errorLogs, cartDrafts): indexes unchanged.

---

## 8. Test Plan

### 8.1 Unit tests

**Money class (S2):**
- `Money.fromDecimalString()` — handles `'0'`, `'10.13'`, `'0.000001'`, `''`, `'999999.999999'`
- `Money.fromNumber()` — verifies no float drift: `fromNumber(0.1 + 0.2, 6).toBaseString()` should NOT equal `fromNumber(0.3, 6).toBaseString()` minus epsilon; the former should be `300000` NOT `300001`
- `Money.toBaseString()` — round-trip: `Money.fromDecimalString(x, 6).toBaseString()` gives expected bigint string
- `Money.toDecimalString()` — formatting correctness
- Arithmetic: `add`, `subtract` with same decimals, `multiply`/`divide` with edge zeros

**Migration (S3):**
- Empty DB → migration runs, all tables have new fields with defaults
- Shop with Solana-only config → `supportedChains = ['solana']`, `chainConfig['solana']` populated
- Shop with both Solana + Tari → `supportedChains = ['solana', 'tari']`, both chain configs populated
- Order with `paymentChain = 'tari'` → `chain = 'tari'`
- Order with all zero monetary values → `*Base = '0'`
- Order with fractional monetary values (e.g. subtotal = 12.34) → `subtotalBase = '12340000'`
- Multiple runs → idempotency guards prevent duplicate field writes
- Shop with `tariNetwork = 'mainnet'` → `network = 'mainnet'` (preserves tari network name)
- Shop with `cluster = 'mainnet-beta'` → `network = 'mainnet-beta'`

### 8.2 Integration tests

- App boots after migration; all existing shops/orders/expenses readable
- New order creation uses `chain`/`network` fields (not legacy)
- POS page renders migrated order monetary values correctly
- Cart store returns numeric fields still present (backward compat during S3)

### 8.3 Manual verification checklist

- [ ] Open app in dev mode after migration — no JS errors in console
- [ ] Existing shops visible in settings
- [ ] Existing orders visible in order list with correct amounts
- [ ] Create new order → saved with `chain`, `network`, `*Base` fields
- [ ] Tari shop → `supportedChains` includes `'tari'`
- [ ] Force migration re-run → no duplicate data or errors

---

## 9. Rollback Strategy

### 9.1 Before migration (pre-deploy)

| Step | Action                                                                 |
| ---- | ---------------------------------------------------------------------- |
| 1    | Tag current commit for fast revert                                     |
| 2    | Document that `localStorage` clearing may be needed for rollback       |
| 3    | Ensure CI passes on version 10000 branch before bumping                |

### 9.2 During migration (runtime)

If the upgrade function throws, Dexie automatically rolls back the transaction. The DB remains at version 10000 with no partial writes.

### 9.3 Post-migration rollback

1. Revert code to pre-migration commit
2. Users must clear their IndexedDB (`localStorage.clear()` + `indexedDB.deleteDatabase('MicrostoreDB')`) because there is no Dexie downgrade path (version numbers are monotonic)
3. Re-open app — DB reinitialized at version 10000 with empty tables

> **Warning:** Clearing IndexedDB is destructive. The migration is designed to be forward-only. For production users, ensure the migration is tested thoroughly before shipping.

---

## 10. Files Affected

| Phase | File                                 | Change                                              |
| ----- | ------------------------------------ | --------------------------------------------------- |
| S2    | `src/lib/money.ts`                   | **NEW** — Money class + `ChainId`, `NetworkId` types |
| S2    | `src/lib/solanaPay.ts`               | Re-export Money; deprecate standalone BigInt fns    |
| S3    | `src/lib/db.ts`                      | Bump to `version(10001)`; new interfaces; upgrade() |
| S3    | `src/lib/db.ts`                      | Add `ChainShopConfig` interface                     |
| S4    | `src/lib/posCartStore.ts`            | Rewrite to use Money + `*Base` fields               |
| S4    | `src/lib/payStore.ts`                | Use `chain`/`network` instead of `paymentChain`     |
| S5    | `src/lib/solanaPay.ts`               | Rename `tax` → `reserve` in `OrderTotals`           |
| S5    | `src/app/**` (15+ files)             | UI copy: "tax" → "reserve"                          |
| S6    | Photo persistence (out of scope)     | Schema already has `photoUrl?: string`; S6 fixes UX |
```

