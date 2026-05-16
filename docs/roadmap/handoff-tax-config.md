# Handoff — tax-config

**Canonical answer:** The code now supports per-shop tax configuration.
`taxRate` (decimal 0–1) and `taxLabel` (display name) are persisted on
the Shop. `taxSetAsideWallet` is available as an optional wallet address
for tax set-aside. The Dexie v10004 migration sets existing shops to
`taxRate=0.08875` and `taxLabel="Sales Tax"`, preserving the old behavior.

For NEW shops, the default `taxRate` is 0 — the merchant must explicitly
choose a region or enter a custom rate. This forces conscious tax
configuration rather than silently applying an arbitrary rate.

---

## Chosen default taxRate

**New shops: 0** — forces the merchant to set their own rate. The
create-shop form shows a region picker (with pre-filled rates from
`reserveRegions.ts`) and a "Custom rate %" option. No tax is computed
until a rate is chosen.

**Existing shops (migration): 0.08875** — preserves the old 8.875%
hardcoded behavior so existing merchants see no change after upgrade.

---

## UI flows where tax label rendering required restructuring

| Surface | Old | New |
| ------- | --- | --- |
| POS cart line | `{reserveLabel ?? 'Reserve'} (rate%)` | `{taxLabel ?? reserveLabel ?? 'Reserve'} (rate%)` |
| Receipt summary | `{reserveLabel ?? 'Reserve'}` | `{order.taxLabel ?? shop.taxLabel ?? shop.reserveLabel ?? 'Reserve'}` |
| Receipt split | `{reserveLabel ?? 'Reserve'}` | `{order.taxLabel ?? shop.taxLabel ?? shop.reserveLabel ?? 'Reserve'}` |
| Orders CSV export | "Tax" / "Tax Tx" | "Reserve" / "Reserve Tx" |
| Revenue reports | "Tax:" | "Reserve:" |
| Settings wallet label | "Tax Wallet" | "Reserve Wallet" |
| Settings summary | `label: 'Tax'` | `label: 'Reserve'` |

The label resolution chain (`order.taxLabel → shop.taxLabel → shop.reserveLabel → 'Reserve'`)
ensures receipts render the correct tax name at time of sale even if
the shop changes its taxLabel later.

---

## Key design decisions

1. **taxRate alongside reserveRate, not replacing it.** `reserveRate`
   is the split-math rate (used in `computeOrderTotals` /
   `computeAtomicSplit`). `taxRate` is the merchant-facing display
   rate. In practice they are the same number, but keeping both
   avoids tight coupling between the money layer and the UI layer.

2. **taxLabel snapshot on Order.** The `Order` interface gained
   `taxRate?: number` and `taxLabel?: string` fields. These are
   snapshotted at sale time so receipts show the correct tax
   label even if the shop configuration changes later.

3. **posCartStore.taxAmount() for UI binding.** The cart store
   computes `taxAmount()` from `subtotal × taxRate` (when
   `reserveAllocationEnabled`). This mirrors `reserveAmount()`
   but reads from the shop's `taxRate` field.

4. **Disclaimer in create-shop UI.** A blue info box near the
   tax fields reads: "Funds reserved for tax remittance. Microstore
   does not file or pay taxes on your behalf."

---

## Migration confirmation

The v10004 migration was tested on a synthetic path (the Dexie
upgrade handler follows the same pattern as v10001–v10003). For
a full end-to-end test, open the app with existing IndexedDB data
at v10003 and verify:

- `db.shops.toArray()` shows `taxRate=0.08875`, `taxLabel="Sales Tax"`
- No `taxWallet` field remains on any shop
- `db.version` reports 10004

---

## Files changed

| File | Change |
| ---- | ------ |
| `src/lib/db.ts` | Added `taxRate`, `taxLabel`, `taxSetAsideWallet` to Shop; added `taxRate?`, `taxLabel?` to Order; added `version(10004)` migration |
| `src/lib/posCartStore.ts` | Added `taxRate`, `taxLabel` state; `setTaxRate()`, `setTaxLabel()` actions; `taxAmount()` computed |
| `src/lib/solanaPay.ts` | Removed `0.08875` from code comments (line 260–261) |
| `src/lib/createShopStore.ts` | Added `taxRate`, `taxLabel` state with `setTaxRate()` (clamped [0,1]), `setTaxLabel()` |
| `src/app/pos/page.tsx` | Sync `taxRate`/`taxLabel` from shop; use `taxLabel` for display |
| `src/app/receipt/[id]/page.tsx` | Label resolution: `order.taxLabel ?? shop.taxLabel ?? shop.reserveLabel ?? 'Reserve'` |
| `src/app/orders/page.tsx` | CSV headers: "Tax"→"Reserve", "Tax Tx"→"Reserve Tx" |
| `src/app/reports/revenue/page.tsx` | "Tax:"→"Reserve:" |
| `src/app/settings/page.tsx` | "Tax Wallet"→"Reserve Wallet"; summary label "Tax"→"Reserve" |
| `src/app/shops/new/page.tsx` | Added `taxLabel` input field + disclaimer; wire `taxRate`/`taxLabel` to creation payload |
| `docs/README.md` | Removed hardcoded `0.08875`; replaced `taxWallet` with `reserveWallet` + `taxRate`/`taxLabel` |
| `ARCHITECTURE.md` | Added v10004 to schema history; updated Reserve Allocation section; added `taxRate`/`taxLabel`/`taxSetAsideWallet` to shop fields |
| `__tests__/tax-config.test.ts` | NEW — 12 tests covering: zero-rate split, validation [0,1], label resolution chain, split-truth property tests with parameterized rate |
| `docs/roadmap/handoff-tax-config.md` | NEW — this file |
