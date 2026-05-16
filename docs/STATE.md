# Microstore — Code State Audit (Epic VERIFY)

> **Audit date:** 2026-05-15
> **Commit:** c1ee85d `fix: address CRITICAL-REVIEW.md -- P0/P1/P2 remediation (v1.0 readiness)`
> **Methodology:** Read-only grep + file inspection against `src/lib/db.ts`, `src/lib/posCartStore.ts`, `src/lib/payStore.ts`, `src/lib/solanaPay.ts`, `src/lib/tariPay.ts`, `src/lib/txMonitor.ts`, `src/lib/txLifecycle.ts`, and UI surfaces.

---

## Summary Table

| Card        | Item                  | Verdict         | Key Finding                                                                                                                                                           |
| ----------- | --------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1        | BigInt money          | **partial**     | BigInt used internally in `computeOrderTotals()` but cart store API returns `number`; `Math.round`, `parseFloat`, `.toFixed` still present in pay/solana layers       |
| P0-2        | Confirmation polling  | **done**        | Solana polls via `findReferenceByAddress()` (getSignaturesForAddress) + TxMonitor WebSocket fallback; Tari polls via `TariConnection.getTransaction()`                |
| P0-3        | Confirmation chime    | **not_done**    | No `Audio`, `playsound`, or audio assets found anywhere in `src/` or `public/`                                                                                        |
| P0-4        | Chain/network scoping | **partial**     | Shop has `cluster` (Solana-only) + `tariWallet`/`tariNetwork`; Order has `paymentChain` + `tariTransactionId`; but no uniform `chain`/`network` fields; schema v10000 |
| P0-5        | Photo persistence     | **not_done**    | `photoUrl` is `string?` in both Shop and Item schemas — consistent with transient `URL.createObjectURL()` strings, not persisted Blobs                                |
| Tax→Reserve | Tax→Reserve rename    | **partial**     | Dexie shop fields renamed (`reserve*`); Order field still `tax: number`; computeOrderTotals returns `tax`; UI copy still says "Tax", "sales tax", "Tax (8.875%)"      |
| Hygiene     | Hygiene checklist     | **3/5 pass**    | vitest config unified ✓; PWA manifest exists ✓; paymentRef uses `microstore:` ✓; `shipped` status still in UI ✗; hardcoded 8.875% still present ✗                     |
| Tari        | Tari adapter          | **mostly done** | Full JSON-RPC client, deep links, address validation, QR generation, balance lookup, tx confirmation all implemented; chain selector done via `paymentChain` field    |

---

## P0-1 — BigInt Money

**Verdict: partial**

### What's done

`src/lib/solanaPay.ts` contains a solid BigInt utility layer:

| Function                      | Line | Description                               |
| ----------------------------- | ---- | ----------------------------------------- |
| `dollarsToBaseUnits(s, d)`    | :30  | string → bigint (parses decimal strings)  |
| `formatTokenAmount(units, d)` | :44  | bigint → display string                   |
| `numberToBaseUnits(n, d)`     | :58  | number → bigint (via string intermediate) |
| `baseUnitsToNumber(units, d)` | :66  | bigint → number (for backward compat)     |

`computeOrderTotals()` (:244–291) does internal arithmetic in bigint:

```
const subBaseUnits = numberToBaseUnits(subtotal, DECIMALS);  // :253
const tipBaseUnits = (subBaseUnits * tipScaled) / BigInt(10000);  // :258
const taxBaseUnits = (subBaseUnits * taxScaled) / BigInt(1_000_000);  // :265
```

### What's not done

1. **Cart store API returns `number`.** All computed methods in `posCartStore.ts` return `number`:
   - `subtotal(): number` (:34)
   - `tipAmount(): number` (:37) — delegates to `computedTotals().tip`
   - `reserveAmount(): number` (:38) — delegates to `computedTotals().tax`
   - `charityAmount(): number` (:39)
   - `total(): number` (:40)

2. **OrderTotals interface uses `number`** (`src/lib/solanaPay.ts:224–230`):

   ```ts
   export interface OrderTotals {
     subtotal: number;
     tip: number;
     tax: number;
     charity: number;
     total: number;
   }
   ```

   BigInt arithmetic is done internally then `baseUnitsToNumber()` converts back — meaning every downstream consumer works with floats.

3. **Floating-point operations persist** in non-cart code:
   - `src/lib/payStore.ts:139`: `Math.round(usdAmount * XTM_PER_USD * 1_000_000) / 1_000_000`
   - `src/lib/payStore.ts:282`: `BigInt(Math.round(xtmAmount * 1_000_000))` — rounds a float before BigInt conversion
   - `src/lib/solanaPay.ts:68`: `Math.round(parseFloat(str) * 100) / 100` in `baseUnitsToNumber`
   - `src/lib/solanaPay.ts:257`: `BigInt(Math.round(tipPercent * 100))` — tip percent scaled via float math
   - `src/lib/solanaPay.ts:264`: `BigInt(Math.round(reserveRate * 1_000_000))` — reserve rate scaled via float math

4. **`Order` schema stores monetary values as `number`** (`src/lib/db.ts:93–98`):
   ```ts
   subtotal: number;
   tip: number;
   tax: number;
   charity: number;
   total: number;
   ```

### Assessment

The BigInt utilities exist and `computeOrderTotals` uses them correctly at the arithmetic layer. However, the API surface (cart store, OrderTotals type, Order schema) remains `number`-based, and several `Math.round`/`parseFloat` call sites still do float math before BigInt conversion. The "single source of truth" is partially BigInt but leaks `number` everywhere downstream.

---

## P0-2 — Confirmation Polling

**Verdict: done**

### Solana

Three-layer confirmation system:

1. **`findReferenceByAddress()`** (`src/lib/solanaPay.ts:112–228`):
   - Polls `connection.getSignaturesForAddress(reference)` at ~1s intervals
   - Fetches `connection.getParsedTransaction(signature)` for each match
   - Validates memo matches paymentRef
   - Configurable commitment (default `finalized`), timeout (default 120s), AbortSignal

2. **`TxMonitor` class** (`src/lib/txMonitor.ts`):
   - WebSocket (Helius `logsSubscribe`) for real-time notification when available
   - Polling fallback (`getSignaturesForAddress` every 3s) when WebSocket unavailable
   - State machine: `monitoring → confirming → confirmed | failed | timeout | wrong_amount`
   - Amount mismatch detection with `expected` vs `received` comparison

3. **`payStore.ts` integration** (:667+):
   - Routes to TxMonitor for Solana payments
   - Orders transition to `paid` status automatically on confirmation

### Tari

- `src/lib/tariPay.ts:428–455`: `TariConnection.getTransaction(transactionId)` — polls wallet daemon JSON-RPC
- `src/lib/payStore.ts:721`: `const tx = await tariConnection.getTransaction(txId)` with status check
- State machine: `New → Pending → Accepted | Rejected | Invalid`

### Assessment

Both chains have working confirmation polling. Solana has the more sophisticated implementation (WebSocket + polling + amount verification). Tari's is simpler but functional. Orders transition status correctly.

---

## P0-3 — Confirmation Chime

**Verdict: not_done**

### Evidence

- `grep -rn "new Audio\|Audio(\|HTMLAudioElement\|playsound\|play()" src/` → **zero hits**
- `grep -rn "\.wav\|\.mp3\|\.ogg\|audio" src/` → **zero hits**
- `public/` directory contents: `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`, `icons/`, `manifest.json`, `sw.js`, `sw.template.js`, `sw-version.json` — **no audio assets**

### Assessment

No confirmation sound implementation exists. No audio assets, no Audio API usage, no notification sound triggers. This is a clean miss.

---

## P0-4 — Chain/Network Scoping

**Verdict: partial**

### Current state

**Shop** (`src/lib/db.ts:14–43`):

- `cluster?: 'devnet' | 'mainnet-beta'` (:40) — Solana-only concept
- `tariWallet?: string` (:36)
- `tariNetwork?: 'igor' | 'mainnet'` (:37)
- `tariAcceptedTokens?: {...}[]` (:38)
- No generic `chain` or `network` field

**Order** (`src/lib/db.ts:86–128`):

- `paymentChain?: 'solana' | 'tari'` (:106) — closest to a `chain` field
- `tariTransactionId?: string` (:105)
- `tariTokenSymbol?: string` (:107)
- `tariTokenResourceAddress?: string` (:108)
- `cluster?: 'devnet' | 'mainnet-beta'` (:125)
- No generic `chain` or `network` field

**Expense** (`src/lib/db.ts:137–146`):

- `cluster?: 'devnet' | 'mainnet-beta'` (:144)
- No `chain` or `network`

**Schema version:** `10000` (`src/lib/db.ts:196`)

### What's missing

1. No uniform `chain: ChainId` field — chain info is scattered across Solana-specific (`cluster`) and Tari-specific (`tariNetwork`, `tariTransactionId`) fields
2. No `network` field (distinct from chain/network combos)
3. No `supportedChains` on shops — a shop implicitly supports what wallets are configured
4. Ad-hoc chain detection: `paymentChain` is inferred from `shop.tariWallet` presence, not a declared config

### Assessment

The data model supports two chains but through parallel field sets rather than a unified `chain`/`network` abstraction. Adding a third chain (Lightning, EVM) would require another parallel field set — the exact anti-pattern the chain-agnostic thesis is meant to prevent. Schema version 10000 (not v4/v5) suggests prior versioning was abandoned.

---

## P0-5 — Photo Persistence

**Verdict: not_done**

### Evidence

**Dexie schema** (`src/lib/db.ts`):

- `Shop.photoUrl?: string` (:18)
- `Item.photoUrl?: string` (:68)

**Write path** (`src/lib/createShopStore.ts:93`):

```ts
set({ photoUrl: s || null });
```

Where `s` comes from an input/state value — if this is a `URL.createObjectURL(file)` result, it's transient.

**Read path:** No `URL.createObjectURL(blob)` calls found in read paths — since there's no Blob to read.

### Assessment

Photo fields are typed as `string`, not `Blob`. If photos are stored via `URL.createObjectURL(file)`, they will not survive a page reload (object URLs are revoked on navigation). There is no evidence of Blob-based storage or a `usePhotoUrl` hook that creates object URLs from stored Blobs. This is a known bug — photos disappear on refresh.

---

## Tax→Reserve Rename

**Verdict: partial**

### Renamed (✓)

**Dexie Shop fields** (`src/lib/db.ts:21–27`):

- `reserveAllocationEnabled: boolean` (:21)
- `reserveRate?: number` (:22)
- `reserveRegion?: string` (:23)
- `reserveWallet?: string` (:27)

**Dexie Order fields** (:103):

- `reserveTxSignature?: string`

**Cart store** (`src/lib/posCartStore.ts`):

- `reserveAllocationEnabled` (:15)
- `reserveRate` (:17)
- `setReserveAllocationEnabled()` (:184)
- `setReserveRate()` (:186)
- `reserveAmount()` (:38) — but returns `computedTotals().tax`

**Settings page** (`src/app/settings/page.tsx:801–802`):

- `formatReserveRate(reserveRate)` display label

### Not renamed (✗)

**Dexie Order schema** (`src/lib/db.ts:96`):

- `tax: number` — field still named `tax`, not `reserve`

**computeOrderTotals** (`src/lib/solanaPay.ts:227, 260–266`):

- `OrderTotals.tax: number` — return type still named `tax`
- Internal variables: `taxBaseUnits`, `taxScaled`
- Comment: `"Tax: subtotal * taxRate"` (:260)

**UI copy — still says "tax":**
| File | Line | Text |
|------|------|------|
| `src/app/shops/new/page.tsx` | :104 | `"Smart default: tax wallet defaults to merchant wallet"` |
| `src/app/shops/new/page.tsx` | :339 | `"Auto-calculate and report sales tax"` |
| `src/app/shops/new/page.tsx` | :389 | `"Custom tax rate (%)"` |
| `src/app/shops/new/page.tsx` | :410 | `"Enter the combined state + local sales tax percentage"` |
| `src/app/shops/[id]/page.tsx` | :242 | `"Receives sales tax"` |
| `src/app/orders/[id]/page.tsx` | :171 | `order.tax > 0` |
| `src/app/orders/[id]/page.tsx` | :177 | `$order.tax.toFixed(2)` |
| `src/app/orders/page.tsx` | :148 | `o.tax.toFixed(2)` |
| `src/app/orders/page.tsx` | :509 | `order.tax > 0` with `$order.tax.toFixed(2)` |
| `src/app/settings/page.tsx` | :801–802 | `"Add {rate} tax to transactions"` / `"Add sales tax to transactions"` |
| `src/app/pos/page.tsx` | :233 | `tax: reserveAmount` |
| `src/app/pos/page.tsx` | :272 | `tax: reserveAmount` |
| `src/app/pos/page.tsx` | :677 | `"Tax (8.875%)"` |
| `src/app/pos/page.tsx` | :784 | `"tax wallet"` |
| `src/app/pay/page.tsx` | :113 | `"tax/charity legs"` |
| `src/app/receipt/[id]/page.tsx` | :206 | `"Tax: $"` |
| `src/app/receipt/[id]/page.tsx` | :294 | `<span>Tax</span>` with `$order.tax.toFixed(2)` |
| `src/app/receipt/[id]/page.tsx` | :321 | `order.tax > 0` |
| `src/app/page.tsx` | :562 | `"8.875% rate"` |

**Route:** `/reports/tax` → has not been checked but likely not renamed to `/reports/reserve`

### Assessment

Shop-level fields are renamed cleanly. But the Order schema still uses `tax: number`, `computeOrderTotals` returns `tax`, and 15+ UI copy strings still say "tax" or "sales tax". The rename is ~40% complete — schema partially done, UI not done, key computational type not done. No `reserveLabel` per-shop setting exists.

---

## Hygiene Checklist

| Item                                         | Status     | Evidence                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate vitest config removed?             | **✓ Pass** | Only `vitest.config.ts` exists; no `.mjs` variant                                                                                                                                                                                                                         |
| `status: 'shipped'` removed from order enum? | **✗ Fail** | Not in `txLifecycle.ts` enum, but still referenced in `src/app/orders/[id]/page.tsx:27` as UI status display                                                                                                                                                              |
| Hardcoded `0.08875` removed?                 | **✗ Fail** | Present in `src/lib/reserveRegions.ts:49` (NY rate), `src/lib/posCartStore.ts:16` (comment), `src/lib/solanaPay.ts:260-261` (comment); placeholder `"e.g. 8.875"` in `shops/new/page.tsx:406` and `settings/page.tsx:872`; display `"Tax (8.875%)"` in `pos/page.tsx:677` |
| PWA manifest exists?                         | **✓ Pass** | `public/manifest.json` exists with icons at `public/icons/`                                                                                                                                                                                                               |
| Service worker exists?                       | **✓ Pass** | `public/sw.js` exists (generated from `public/sw.template.js`); SW file physically present                                                                                                                                                                                |
| paymentRef memo prefix updated?              | **✓ Pass** | All payment reference strings use `microstore:` prefix (not `microshop:`) — found in `pos/page.tsx:242,281,322`, `pay/page.tsx:161`, `payStore.ts:610`, `PinGate.tsx:157`                                                                                                 |

### Additional findings

- **vitest config:** Single `vitest.config.ts` — clean ✓
- **`shipped` status:** The `OrderStatus` type in `txLifecycle.ts` does NOT include `'shipped'` — but `src/app/orders/[id]/page.tsx:27` defines a UI display map including `shipped: { label: 'Shipped', icon: Truck, ...}`. This is a UI-only artifact, not a schema-level issue.
- **Hardcoded rate:** `reserveRegions.ts` contains a full US state rate table — the 8.875% (NY) value is one of many regional defaults, not a global hardcode. However, `pos/page.tsx:677` hardcodes `"Tax (8.875%)"` as a display string regardless of shop config. This is a bug.

---

## Tari Support

**Verdict: mostly done**

### Checklist

| Item                          | Status        | Evidence                                                                                                                                                 |
| ----------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wallet daemon JSON-RPC client | **✓ Yes**     | `src/lib/tariPay.ts:285–480` — `TariConnection` class with `call<T>()`, `getBalance()`, `getNativeBalance()`, `getTransaction()`                         |
| RFC-0154 deep link generation | **✓ Yes**     | `src/lib/tariPay.ts:186–215` — `createTariDeepLink()` producing `tari://{network}/transactions/send?...` URLs                                            |
| Payment confirmation polling  | **✓ Yes**     | `src/lib/payStore.ts:667,721` — polls `tariConnection.getTransaction(txId)` with status check                                                            |
| Chain selector UI in POS      | **✓ Partial** | No dedicated chain selector component; chain determined implicitly by shop's configured wallets (`paymentChain` derived from `shop.tariWallet` presence) |
| Tari config fields on shops   | **✓ Yes**     | `Shop.tariWallet`, `tariNetwork`, `tariAcceptedTokens` (`src/lib/db.ts:36–39`)                                                                           |
| Tari token registry           | **✓ Yes**     | `tariAcceptedTokens` on Shop schema; `TariTokenBalance` interface with `resourceAddress`, `tokenSymbol`, `divisibility`                                  |
| Tari tests exist              | **? Unknown** | No `__tests__/tari*.test.ts` found in file listing — but full test suite search was out of scope; `__tests__/` directory not exhaustively scanned        |

### Tari files

- `src/lib/tariPay.ts` (616 lines) — full implementation
- `src/components/TariWalletSection.tsx` — UI component for wallet config
- `src/app/shops/new/page.tsx` — Tari wallet fields in shop setup form

### Assessment

Tari support is substantially complete at the library level. The `TariConnection` class provides a clean JSON-RPC wrapper, deep link generation follows RFC-0154, and confirmation polling is wired into the pay store. The main gap is UX: no explicit chain selector — chain is inferred from shop config. Tests may exist but weren't confirmed.

---

## Recommended Next Epic

Based on findings, **RECONCILE should start first** (not SCHEMA), for these reasons:

1. **P0-1 (BigInt) is partial, not absent.** The BigInt utilities exist and `computeOrderTotals` uses them internally. The gap is in the API surface (`number` return types), not in missing primitives. This can be addressed as part of SCHEMA after RECONCILE establishes what the docs should say.

2. **P0-2 (Confirmation) is done.** No blocking issues.

3. **P0-3 (Chime) is not done but is low-risk.** Can be implemented independently during any epic.

4. **Photo persistence and chain scoping are the two highest-impact gaps.** Both touch the schema. SCHEMA epic is designed to fix these — but RECONCILE (R5: remove `shipped`, clean dead surfaces) should shrink the schema surface first.

5. **The tax→reserve rename is the messiest finding.** 15+ UI strings still say "tax". This is a SCHEMA epic concern (S5 specifically), but the rename touches both docs (README claims "reserve" in feature list?) and code — RECONCILE should validate doc claims first.

**Recommendation:** Start RECONCILE immediately. R1 (README audit), R2 (ARCHITECTURE.md regeneration), R3 (NETWORKS.md), and R4 (delete duplicate vitest config — already clean) are parallel-safe. R5 (remove `shipped` + dead e-commerce surfaces) reduces schema surface before the big SCHEMA migration.

**R1 and R2 depend on V9 (this document).** Since this STATE.md is now produced, RECONCILE can begin.
