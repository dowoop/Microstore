# Handoff — split-truth

**Canonical answer:** The code IS atomic. `buildAtomicSplitTransaction()`
at `src/lib/solanaPay.ts:359` builds a SINGLE Solana `Transaction` with
3 `TransferChecked` instructions plus optional memo. All three split-leg
transfers go into one transaction envelope — they either all succeed or
all fail together. There is no code path that signs or broadcasts per-leg
transactions individually.

---

## Deprecated fields

The Order interface in `src/lib/db.ts` previously carried four signature
fields:

| Field | Status |
| ----- | ------ |
| `txSignature` | **Active** — the single atomic transaction signature |
| `merchantTxSignature` | **Deprecated** — backwards compat only |
| `reserveTxSignature` | **Deprecated** — backwards compat only |
| `charityTxSignature` | **Deprecated** — backwards compat only |

**Rationale:** Since `buildAtomicSplitTransaction()` produces one
transaction, there is conceptually one signature. The per-leg signature
fields were a design artifact from a time when split payments were
imagined as separate transactions. They are retained in the Dexie schema
(indices preserved through v10003) and on the Order TypeScript interface
(marked `@deprecated`) so existing user data is never lost, but no new
code writes to them.

**Write audit:** Grep of `src/` for assignments and `.update()` calls
targeting `merchantTxSignature`, `reserveTxSignature`, or
`charityTxSignature` returned zero matches. The code already only writes
`txSignature`. Reads in `orders/page.tsx` (CSV export) and
`receipt/[id]/page.tsx` (UI display) are intentionally left in place —
they will show empty values for new orders but continue to surface data
from pre-deprecation orders.

---

## Property test summary

File: `__tests__/split-math.property.test.ts`

Uses `fast-check` (~30,000 random inputs across 6 properties) to verify
the split math in `computeAtomicSplit()` / `computeOrderTotals()`:

| # | Property | Result |
| - | -------- | ------ |
| a | round2(leg sum) ≈ displayedTotal (≤2¢ tolerance) | pass |
| b | All leg amounts ≥ 0 | pass |
| c | charityRoundUp=false → charity leg is 0 | pass |
| d | reserveRate=0 → reserve leg is 0 | pass |
| e | subtotal=0 → all legs are 0 | pass |
| f | round2(leg) is exactly representable for 6/8/9 decimals | pass |

**Known edge case (property a):** At very low tip percentages (<0.5%),
`computeOrderTotals` rounds `tipPercent * 100` via `Math.round()`, causing
a 1–2¢ discrepancy between the sum of individually-round2'd leg amounts
and the bigint-computed total. The split math is still internally
consistent — all legs derive from the same bigint arithmetic as the total.
This is a pre-existing precision quirk in `computeOrderTotals`, not
introduced by this pass.

---

## Surprises in solanaPay.ts for the next agent

1. **Rounding quirk at low tip %:** `Math.round(tipPercent * 100)` can
   round sub-1% values unexpectedly (e.g., 0.005% → 1 instead of 0.5).
   This affects accuracy at very low tip percentages. The fix would be to
   use a different scaling factor (e.g., scale by 10,000 instead of 100)
   but that's a behavioral change best addressed in a separate pass.

2. **DECIMALS constant:** Hardcoded to 6 in `computeOrderTotals` and
   `computeAtomicSplit`. If multi-mint support expands beyond 6-decimals,
   these functions need a `decimals` parameter.

3. **computeAtomicSplit** delegates entirely to `computeOrderTotals` for
   the money math and only adds wallet addresses + labels. The merchant
   leg is `totals.subtotal + totals.tip` (sum of two round2'd values),
   which can introduce floating-point artifacts.

---

## Dexie version bump

```
10002 → 10003
```

Migration body is empty — no data transform. The `version(10003).stores()`
declaration mirrors 10002 exactly. Per-leg signature fields remain
indexed for backwards compatibility.

---

## Files changed

| File | Change |
| ---- | ------ |
| `src/lib/db.ts` | `@deprecated` JSDoc on `merchantTxSignature`, `reserveTxSignature`, `charityTxSignature`; added `version(10003)` migration block |
| `ARCHITECTURE.md` | Orders interface updated with deprecation annotations; schema section reflects v10003; added Schema Version History table |
| `__tests__/split-math.property.test.ts` | NEW — 6 property-based tests using fast-check |
| `package.json` / `package-lock.json` | Added `fast-check` devDependency |
| `docs/roadmap/handoff-split-truth.md` | NEW — this file |
