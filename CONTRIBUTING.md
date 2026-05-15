# Contributing to Microstore

## Development Workflow

### Branch, Commit, PR

1. **Create a feature branch** from `master`:
   ```bash
   git checkout master
   git pull origin master
   git checkout -b feature/my-feature
   ```

2. **Make focused commits** with descriptive messages:
   ```
   feat(pos): add barcode scanner support
   fix(solana): handle TransactionExpiredBlockheightExceededError
   docs: update DEPLOY.md with mainnet checklist
   ```

3. **Push and open a PR** against `master`:
   ```bash
   git push origin feature/my-feature
   # Open PR on GitHub
   ```

4. **CI checks must pass**: Lint, TypeScript type checking, tests, and build all run automatically on every PR.

5. **Request review** from a maintainer. PRs require approval before merging.

### Commit Convention

| Prefix | When to use |
|--------|------------|
| `feat:` | New feature or significant enhancement |
| `fix:` | Bug fix |
| `docs:` | Documentation changes |
| `style:` | Formatting, whitespace (no code changes) |
| `refactor:` | Code restructuring without behavior change |
| `test:` | Adding or updating tests |
| `chore:` | Build config, dependencies, tooling |

## Code Style

### TypeScript

- **Strict mode** is enabled (`tsconfig.json` → `"strict": true`)
- All new code must pass `npx tsc --noEmit` with no errors
- Use explicit types for function parameters and return values when non-obvious
- Prefer `interface` over `type` for object shapes; use `type` for unions and primitives
- Avoid `any` — use `unknown` and narrow with type guards

### ESLint + Prettier

```bash
# Check formatting
npx prettier --check .

# Auto-fix formatting
npx prettier --write .

# Run ESLint
npm run lint
```

The project uses `eslint-config-next` with Core Web Vitals and TypeScript rules. All PRs are checked in CI.

### React / Next.js Conventions

- **Client components**: Always include `'use client'` directive at the top of files using hooks, state, or browser APIs
- **Server components**: Omit the directive — Next.js App Router defaults to server components
- **Zustand stores**: Create in `src/lib/` as standalone modules. Only use `persist` middleware when state must survive page reloads (currently only `useAppStore`)
- **Dexie queries**: Use `useLiveQuery` from `dexie-react-hooks` for reactive IndexedDB queries in components
- **Mobile-first**: All layouts use `max-w-md` to target phone screens. Test on 375px viewport

### Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Pages | kebab-case directory, PascalCase component | `src/app/shops/new/page.tsx` → `CreateShopPage` |
| Components | PascalCase file + export | `merchant-shell.tsx` → `MerchantShell` |
| Stores | camelCase file, `use` prefix hook | `posCartStore.ts` → `usePosCartStore` |
| Lib files | camelCase | `solanaPay.ts`, `db.ts` |
| Types | PascalCase | `SplitBreakdown`, `WalletError` |

## Testing

### Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-run on changes)
npm run test:watch

# With coverage report
npm run test:coverage
```

### Test Configuration

- **Runner**: Vitest with jsdom environment
- **Test files**: `__tests__/**/*.test.ts` and `__tests__/**/*.test.tsx`
- **Coverage**: `src/lib/**/*.ts` (excludes `db.ts` and `notifications.tsx`)
- **Path alias**: `@/` resolves to `./src/`

### Writing Tests

- Test files go in `__tests__/` at the project root
- Name test files to match the module they test: `__tests__/solanaPay.test.ts`
- Use `describe` / `it` blocks from Vitest (globals enabled)
- Mock external dependencies (Helius RPC, Solana connection, browser APIs)
- Test computed values (split breakdown, cart totals) with known inputs
- Test error cases and edge conditions explicitly

### CI Pipeline

Tests run in CI (`.github/workflows/ci.yml`) in this order:
1. Lint (ESLint + Prettier)
2. Type Check (`tsc --noEmit`)
3. Tests (Vitest)
4. Build (`npm run build`)

All must pass before merge.

## PR Template

When opening a pull request, include:

```markdown
## Summary
<!-- What does this PR do? 1-2 sentences -->

## Changes
- 
- 

## Screenshots (if UI change)
<!-- Before/after screenshots at 375px width -->

## Testing
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] Tested manually on mobile viewport (375px)
- [ ] If Solana-related: tested on devnet

## Related
<!-- Link issues, related PRs -->
```

## File Structure

```
src/
├── app/                      # Next.js App Router pages
│   ├── layout.tsx            # Root layout (MerchantShell wrapper)
│   ├── page.tsx              # Home / dashboard
│   ├── globals.css           # Tailwind imports
│   ├── error.tsx             # Global error boundary
│   ├── loading.tsx           # Global loading fallback
│   ├── pos/page.tsx          # Point of Sale
│   ├── pay/page.tsx          # Customer payment
│   ├── receipt/[id]/page.tsx # Receipt
│   ├── shops/                # Shop CRUD
│   ├── items/                # Inventory CRUD
│   ├── orders/               # Order management
│   ├── expenses/             # Expense tracking
│   ├── settings/             # Shop settings + data mgmt
│   └── reports/              # Revenue + tax reports
├── components/
│   ├── merchant-shell.tsx    # Layout wrapper
│   ├── topnav.tsx            # Top navigation
│   ├── tabs.tsx              # Bottom tab bar
│   └── db-health-banner.tsx  # Cache wipe warning
└── lib/
    ├── db.ts                 # Dexie schema + indexes
    ├── store.ts              # App state (persisted)
    ├── createShopStore.ts    # Shop onboarding form
    ├── itemEditorStore.ts    # Item editor form
    ├── posCartStore.ts       # POS cart + computation
    ├── payStore.ts           # Payment page state
    ├── solanaPay.ts          # Solana integration
    ├── solanaTokens.ts       # Token registry
    └── notifications.tsx     # Order poller
```

## Adding a New Feature

1. **Screen**: Create `src/app/<route>/page.tsx`. If it needs dynamic segments, use `[param]` directory names.
2. **State**: If the screen has form state, create a Zustand store in `src/lib/`. Keep stores focused on one concern.
3. **Data**: Use `db.<table>` from `src/lib/db.ts` for IndexedDB operations. Use `useLiveQuery` for reactive reads.
4. **Solana**: Import from `src/lib/solanaPay.ts` for blockchain operations. Always use `getConnection()` rather than creating connections directly.
5. **Navigation**: Add routes to the `tabs` array in `src/components/tabs.tsx` if it belongs in the bottom bar.

## Local Development

```bash
# Install dependencies
npm install

# Copy env template
cp .env.example .env.local
# Edit .env.local with your Helius key

# Start dev server
npm run dev
# → http://localhost:3000

# Run tests
npm test

# Run lint
npm run lint
```

For Solana testing, use **devnet** (default) — no real money involved. Get devnet SOL from [solfaucet.com](https://solfaucet.com).