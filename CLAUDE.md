# Claude / Agent Guidance

## Project: Microstore — Solana-native POS for micro-merchants

### Architecture
- **Framework:** Next.js 16 (App Router, Turbopack)
- **State:** Zustand 5 (stores: usePosCartStore, useAppStore, useItemEditorStore, payStore, createShopStore)
- **Database:** Dexie 4 (IndexedDB wrapper — all local, no backend)
- **Blockchain:** @solana/web3.js v1 for on-chain operations, @solana/pay for QR generation
- **Styling:** Tailwind CSS 4
- **Testing:** Vitest (unit), Playwright (E2E)
- **Deploy:** Vercel (https://microstore-three.vercel.app)

### Key files
- `src/lib/db.ts` — Dexie schema + migrations (all tables)
- `src/lib/solanaPay.ts` — QR generation, atomic split, payment confirmation
- `src/lib/payStore.ts` — Payment lifecycle state machine
- `src/stores/usePosCartStore.ts` — POS cart state
- `src/stores/useAppStore.ts` — App-level state (active shop, network)
- `src/components/MerchantShell.tsx` — Merchant view shell (tabs)
- `src/components/root-shell.tsx` — Root/presenter shell (no tabs)
- `docs/ARCHITECTURE.md` — Architecture overview
- `docs/SECURITY.md` — Security model + known limitations

### Commands
- `npm run dev` — Dev server (Turbopack)
- `npm run build` — Production build
- `npm run test` — Vitest
- `npm run lint` — ESLint
- `vercel --prod --yes` — Deploy to production
- `HERMES_KANBAN_BOARD=microstore-next hermes kanban dispatch` — Dispatch kanban workers

### Conventions
- Prefer no-verify commits during orchestration (lint-staged can block)
- Use @/ path aliases for src/
- Tailwind utility classes, no CSS modules
- Zustand stores follow `use[Name]Store` naming
- New Dexie migrations append as v5, v6, etc.
