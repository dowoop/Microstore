# CRITICAL-REVIEW Remediation Plan

> **Goal:** Address all P0/P1/P2 issues from CRITICAL-REVIEW.md to ship a defensible v1.0.

**Architecture:** Four-phase approach — Phase 1 (BigInt foundation) must be done first as it touches all money math. Phases 2 and 3 can be parallelized via subagents after Phase 1 lands. Phase 4 (docs) is independent.

**Tech Stack:** Next.js App Router, TypeScript strict, Zustand, Dexie.js, @solana/web3.js, Vitest

---

## Phase 1: BigInt Money Refactor (P0 — Foundation)

### Problem
All money math uses JavaScript `number` (float). USDC has 6 decimals. When $10.13 is split across 3 legs using float arithmetic and multiplied by 10⁶, the sum of TransferChecked amounts can differ by ±1 base unit. The CR calls this a "class of bug permanently."

### Design Decision
- Canonical type for any monetary value is the SPL token's base unit as `bigint`
- Dollar inputs convert to `bigint` at the input boundary and never become floats again
- Cart math, splits, validation all derive from bigints
- Display formatting is the last step: `formatTokenAmount(bigint, decimals): string`

### Files to Touch
1. `/home/alex/Workstation/Microstore/src/lib/solanaPay.ts` — computeOrderTotals, computeAtomicSplit, buildAtomicSplitTransaction
2. `/home/alex/Workstation/Microstore/src/lib/posCartStore.ts` — computed getters, subtotal()
3. `/home/alex/Workstation/Microstore/src/lib/payStore.ts` — amounts in split, loadOrder
4. `/home/alex/Workstation/Microstore/src/lib/db.ts` — Order, Item price typing (keep as number for storage)
5. `/home/alex/Workstation/Microstore/src/app/pos/page.tsx` — display formatting
6. `/home/alex/Workstation/Microstore/src/app/pay/page.tsx` — split display
7. `/home/alex/Workstation/Microstore/src/app/receipt/[id]/page.tsx` — receipt display
8. `/home/alex/Workstation/Microstore/src/app/reports/revenue/page.tsx` — revenue reports
9. `/home/alex/Workstation/Microstore/src/app/reports/tax/page.tsx` — tax reports
10. Various components displaying money

### Key Changes

**1. Add bigint utility functions to solanaPay.ts:**
- `dollarsToBaseUnits(dollars: string, decimals: number): bigint` — converts "$10.13" to 10130000n
- `baseUnitsToDollars(units: bigint, decimals: number): string` — converts 10130000n to "10.13"
- `formatTokenAmount(units: bigint, decimals: number): string` — display formatting

**2. Rewrite computeOrderTotals to use bigint internally:**
- Input `subtotal: number` → convert to bigint at boundary
- All arithmetic in bigint
- Return bigint amounts; display conversion only at UI layer

**3. Fix buildAtomicSplitTransaction line 337:**
- Currently: `Math.round(leg.amount * Math.pow(10, mintInfo.decimals))`
- Should use bigint conversion directly

**4. Update posCartStore subtotal to use bigint internally**

---

## Phase 2: Tax→Reserve Rename (P0) + Memo Prefix Fix (P1) + Shipped Removal (P3)

### Design Decisions
- "tax wallet" → "reserve wallet" everywhere
- "tax allocation" → "reserve allocation" or "set-aside"
- "taxRate" → "reserveRate" in schema, code, UI
- Default rate 0% (was previously shop-configurable)
- UI copy: "Funds set aside for taxes you will remit separately. This is not a tax payment."
- Memo prefix: "microshop" → "microstore"

### Files to Touch
- `/home/alex/Workstation/Microstore/src/lib/db.ts` — Shop interface: taxWallet→reserveWallet, taxRate→reserveRate, taxAllocationEnabled→reserveAllocationEnabled, taxRegion→reserveRegion
- `/home/alex/Workstation/Microstore/src/lib/solanaPay.ts` — SplitBreakdown, computeAtomicSplit labels
- `/home/alex/Workstation/Microstore/src/lib/payStore.ts` — shop destructuring
- `/home/alex/Workstation/Microstore/src/lib/posCartStore.ts` — taxAllocationEnabled→reserveAllocationEnabled, taxRate→reserveRate
- `/home/alex/Workstation/Microstore/src/lib/createShopStore.ts` — form fields
- `/home/alex/Workstation/Microstore/src/lib/taxRegions.ts` — rename file to reserveRegions.ts
- `/home/alex/Workstation/Microstore/src/components/PaymentConfirmation.tsx` — split labels
- All page files referencing tax*

### Shipped/P3 Removal
- Remove `status: 'shipped'` from OrderStatus type in txLifecycle.ts
- Remove `customerName`, `customerPhone` from Order interface
- Remove `/home/alex/Workstation/Microstore/src/app/orders/new/page.tsx`
- Remove `/home/alex/Workstation/Microstore/src/app/customers/[id]/page.tsx`
- Clean up status-checking conditionals

---

## Phase 3: Auto-Backup (P0) + Cluster Scoping (P1) + Photo Blob (P1) + ATA Disclosure (P1)

### 3a: Auto-Backup
- Create `/home/alex/Workstation/Microstore/src/lib/backup.ts`
- Auto-download JSON snapshot every 24h on app open
- Also auto-download every Nth order (N=10)
- Integrate into app layout or root-shell

### 3b: Cluster Scoping
- Add `cluster: 'devnet' | 'mainnet-beta'` to Order, Shop, Expense interfaces
- Add Dexie migration for new field
- Filter UI by active cluster from useAppStore
- Add cluster mismatch banner

### 3c: Photo Blob Persistence
- In createShopStore / itemEditorStore: store photo Blob directly in Dexie
- On read: create ObjectURL from Blob
- Update Shop/Item interfaces to support Blob

### 3d: ATA Disclosure
- On /pay page: if customer pays for ATA creation, show cost disclosure

---

## Phase 4: Documentation (P1)

### Changes
1. README: replace "atomically splits into merchant revenue, tax, and charity" with "splits every sale into revenue, set-asides, and an optional charity round-up"
2. README: replace "tax" references → "reserve"/"set-aside"
3. README: Add demo link to https://microstore-three.vercel.app
4. README: Add 5 screenshots (shop list, POS cart with tip, pay QR with split, paid receipt, revenue report)
5. Deploy updated code to Vercel

---

## Execution Order (Dependency Graph)

```
Phase 1 (BigInt) ──┬── Phase 2 (Rename + Shipped)
                   │       └── (can start after Phase 1 files settle)
                   │
                   └── Phase 3 (Backup + Cluster + Photo + ATA)
                           └── (can run in parallel with Phase 2)
                                    │
Phase 4 (Docs) ─────────────────────┘
```

Phase 1 MUST complete first. Phases 2 and 3 run in parallel after Phase 1. Phase 4 runs last.
