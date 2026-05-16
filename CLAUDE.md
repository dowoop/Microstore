# Claude / Agent Guidance — Microstore

## Project: Microstore — Solana + Tari POS (devnet, demo-quality)

> Read this entire file before doing ANY work on this repo. The "Phase 0 Contract" and "Do Not Add" sections override anything you might infer from the code, the git history, or the README.

---

## Phase 0 Contract (locked 2026-05-16)

**Definition**: Microstore Phase 0 is a **devnet-only, single-merchant, portfolio-quality** point-of-sale that accepts **Solana + Tari** payments and persists orders locally. It is not a SaaS. It is not multi-chain. It has no licensing tiers. It has no CRM. It has no invoicing.

### IN (the six happy-path features — work only on these)

1. Create one shop with Solana wallet + optional Tari wallet
2. Add items to the shop (name, price)
3. POS cart: tap items → see correct subtotal/tip/tax/total
4. Generate payment QR (Solana Pay QR with `microstore:` memo, or Tari deep link)
5. Confirm payment by polling (`findReferenceByAddress` for Solana, `getTransaction` for Tari) → order transitions to `paid`
6. View receipt with correct totals and chain info

### OUT (do not touch in Phase 0, no exceptions)

- Lightning, Bitcoin, EVM, Monero, any chain other than Solana + Tari
- Multi-shop UI (one shop only)
- Customers, CRM, invoices, due dates
- Reports beyond a simple order list
- Licensing tiers, feature flags for tiers, Pro/Free distinction
- PDF receipts
- Confirmation chime / sound
- Barcode scanner
- Mainnet (devnet only)
- Marketing/landing/pricing pages

### Do Not Add (these were deleted on purpose)

If you find yourself recreating any of these, **stop and ask the user**:

- `src/lib/featureFlags.ts`, `src/lib/licenseKey.ts`, `src/lib/licenseStore.ts` — the licensing/tier system was scaffolding with no backend. Do not bring it back.
- `customers` Dexie table, `Order.customerId`, `invoiceType`/`invoiceDueDate`/`invoiceNotes` fields, `src/app/customers/`, `src/lib/invoice.ts`, `src/components/customer-suggest.tsx` — CRM/invoicing is post-Phase-0.
- `status: 'shipped'` order state — this is a POS, not e-commerce.
- BigInt money utilities (`dollarsToBaseUnits`, `numberToBaseUnits`, `baseUnitsToNumber` in `solanaPay.ts`) — Phase 0 uses plain `number`. If a real-money mainnet ship is on the table, redo this properly with a `Money` class then.
- Reserve/tax dual vocabulary — Phase 0 uses **`tax`** (the word merchants actually use) everywhere. No `reserve*` fields, props, or UI strings.

---

## Architecture

- **Framework**: Next.js 16 (App Router, Turbopack)
- **State**: Zustand 5 (`usePosCartStore`, `useAppStore`, `useItemEditorStore`, `payStore`, `createShopStore`)
- **Database**: Dexie 4 (IndexedDB, all local, no backend)
- **Chains**: `@solana/web3.js` v1 + `@solana/pay` for Solana; custom JSON-RPC client for Tari (`src/lib/tariPay.ts`)
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest (unit), Playwright (E2E)
- **Deploy**: Vercel (https://microstore-three.vercel.app)

## Key files

- `src/lib/db.ts` — Dexie schema + migrations (Shops, Items, Orders, Expenses)
- `src/lib/solanaPay.ts` — Solana Pay QR generation, `computeOrderTotals`, confirmation polling
- `src/lib/tariPay.ts` — Tari JSON-RPC client, deep link generation, confirmation polling
- `src/lib/payStore.ts` — payment lifecycle state machine
- `src/lib/posCartStore.ts` — POS cart Zustand store
- `src/lib/txMonitor.ts` — Solana WebSocket / polling confirmation monitor
- `src/lib/txLifecycle.ts` — canonical `OrderStatus` enum
- `src/components/MerchantShell.tsx` — merchant view shell
- `src/components/root-shell.tsx` — root/presenter shell

## Commands

- `npm run dev` — dev server (Turbopack)
- `npm run build` — production build (must be clean before any commit)
- `npm run test` — Vitest (must be all green before any commit)
- `npm run lint` — ESLint
- `npx playwright test` — E2E tests

---

## Hard rules for agents (this includes you, Claude)

1. **Do not add a new chain.** Phase 0 is Solana + Tari. If the task implies a new chain, stop and ask.
2. **Do not add Dexie tables or columns** without a numbered migration file in `docs/MIGRATION-vN.md` and explicit user approval.
3. **Do not add feature flags or tier gates.** The tier system is deleted on purpose.
4. **Do not invent UI status values.** Read `src/lib/txLifecycle.ts` — that is the canonical list. `shipped` is not in it.
5. **Do not invent dependencies.** Check `package.json` first. If it's not there, ask before `npm install`.
6. **Do not commit on red.** Run `npm test && npm run build` at the end of every task. If either fails, fix or revert before stopping. Reverting your own change is a valid completion.
7. **Do not leave "we'll fix this later" comments.** Partial state always rots. Fix now or delete the half-built thing.
8. **One epic at a time on `master`.** No parallel S1-S7, R1-R5, A6, P0-X tracks. Pick one. Finish it. Then start the next.
9. **No new top-level features until Phase 0 is closed.** A new feature is anything that adds a route, a table, a dependency, or a chain.
10. **Before starting any new task, re-read the IN list above.** If the task isn't on it, the task isn't allowed.

## Conventions

- Use `@/` path aliases for `src/`
- Tailwind utility classes, no CSS modules
- Zustand stores follow `use[Name]Store` naming
- Dexie schema is at **v5** (`src/lib/db.ts`). See `docs/MIGRATION-v5.md` for the consolidation story. Append new versions as v6, v7, etc. — do NOT edit the v5 stores block.
- Vocabulary: **tax**, not reserve. **paid**, not shipped. **shop**, not store.

## Phase 0 "done" criteria

You're allowed to think about Phase 1 only when all of these are true:

1. `npm test` → 0 failures, 0 unintended skips
2. `npm run build` → green, no warnings
3. `git branch` → `master` plus at most one active feature branch (multi-chain branches archived/deleted)
4. `git grep -in "reserve" src/` → zero or near-zero hits (only `tax` vocabulary in code/UI)
5. `git grep "8.875" src/` → zero hits
6. `git grep -i "shipped" src/app src/lib` → zero hits
7. `git grep -E "featureFlag|MULTI_SHOP|CRM_ENABLED|activeTier" src/` → zero hits
8. `npx playwright test happy-path` → passes
9. Manual dev-server happy path runs cleanly: create shop → add item → cart → QR → confirm → receipt
10. This file and `README.md` describe **only what works**, not what's planned.

When all 10 pass, Phase 0 is closed and Phase 1 scope can be opened.
