# Microstore Deployment Guide

## Prerequisites

- GitHub push access to `dowoop/Microstore`
- Vercel account with access to create projects
- Helius API key from https://dev.helius.xyz/dashboard

## 1. Environment Variables (Vercel Dashboard)

In Vercel project settings → Environment Variables, add:

<<<<<<< HEAD
| Key                          | Value                        | Environment         |
| ---------------------------- | ---------------------------- | ------------------- |
| `NEXT_PUBLIC_HELIUS_API_KEY` | Your Helius API key          | Production, Preview |
=======
| Key | Value | Environment |
|-----|-------|------------|
| `NEXT_PUBLIC_HELIUS_API_KEY` | Your Helius API key | Production, Preview |
>>>>>>> kanban/supply-chain
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `devnet` (or `mainnet-beta`) | Production, Preview |

Alternatively, via Vercel CLI after login:

```bash
vercel secrets add helius-api-key "your-helius-key"
vercel env add NEXT_PUBLIC_HELIUS_API_KEY
# Select @helius-api-key as the value
vercel env add NEXT_PUBLIC_SOLANA_CLUSTER
# Enter: devnet
```

## 2. GitHub Actions CI/CD

<<<<<<< HEAD
The `.github/workflows/ci.yml` pipeline runs on every push/PR to master/main:

| Job            | What it does                               |
| -------------- | ------------------------------------------ |
| **Lint**       | ESLint + Prettier format check             |
| **Type Check** | `tsc --noEmit`                             |
| **Tests**      | `vitest run` (depends on lint + typecheck) |
| **Build**      | `next build` (depends on tests)            |

Node modules are cached via `actions/setup-node@v4` with `cache: npm`.
=======
The `.github/workflows/ci.yml` pipeline is already committed. It runs on every push/PR to master/main:
- `npx tsc --noEmit` — type checking
- `npm run build` — Turbopack production build
>>>>>>> kanban/supply-chain

Push to GitHub to activate:

```bash
git push origin master
```

<<<<<<< HEAD
### Pre-commit Hooks

Husky + lint-staged are configured. On every commit:

- ESLint auto-fixes `.js/.ts/.tsx` files
- Prettier formats all staged files

To run manually: `npm run format` (write) or `npm run format:check` (dry-run).

## 3. Deploy to Vercel

### Vercel GitHub Integration

If the [Vercel GitHub App](https://vercel.com/docs/deployments/git#vercel-for-github) is installed on the `dowoop/Microstore` repo, Vercel will automatically:

- Deploy every push to preview branches
- Deploy every push to `master`/`main` to production (if configured)
- Post preview URL comments on Pull Requests

To verify the integration is active:

1. Go to https://vercel.com/dowoop → Microstore → Settings → Git
2. Confirm `dowoop/Microstore` is connected
3. Check that "Pull Request Comments" is enabled (for preview URL comments)

If not set up, follow Option A or B below to deploy manually.

=======
## 3. Deploy to Vercel

>>>>>>> kanban/supply-chain
### Option A: Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Import `dowoop/Microstore`
3. Framework: Next.js (auto-detected)
4. Root Directory: `./`
5. Build Command: `next build` (from vercel.json)
6. Install Command: `npm ci` (from vercel.json)
7. Add the environment variables listed above
8. Deploy

Preview deploys on PR branches are automatic once the GitHub repo is linked.

### Option B: Vercel CLI

```bash
vercel login
vercel link                      # Link to Vercel project
vercel env pull .env.local       # Pull env vars locally
vercel                           # Preview deploy
vercel --prod                    # Production deploy
```

## 4. Custom Domain

In Vercel project → Settings → Domains:
<<<<<<< HEAD

=======
>>>>>>> kanban/supply-chain
1. Add your custom domain (e.g., `microstore.example.com`)
2. Follow Vercel's DNS configuration instructions
3. Vercel auto-provisions SSL via Let's Encrypt

## 5. Production Checklist

Before going live, verify:

- [ ] **All routes work**: 19 routes compile clean (verified)
  - [ ] `/` — Home
  - [ ] `/shops` — Shop list
  - [ ] `/shops/[id]`, `/shops/new` — Shop CRUD
  - [ ] `/items`, `/items/[id]`, `/items/new` — Inventory
  - [ ] `/pos` — Point of Sale
  - [ ] `/pay` — Customer payment page (QR)
  - [ ] `/orders`, `/orders/[id]`, `/orders/new` — Order management
  - [ ] `/receipt/[id]` — Receipt with Solscan links
  - [ ] `/expenses`, `/expenses/new` — Expense tracking
  - [ ] `/settings` — Shop settings + data export/import
  - [ ] `/reports/revenue`, `/reports/tax` — Revenue & tax reports

- [ ] **QR generation works**: Uses `qrcode` + `@solana/pay`, generates Solana Pay URLs
- [ ] **Atomic split transactions**: Verify split breakdown on POS and Pay pages
- [ ] **No console errors**: Check browser dev console
- [ ] **Helius RPC healthy**: Transfers fetch wallet balances, confirmations work
- [ ] **Cluster switcher works**: Devnet ↔ Mainnet toggle (Settings page)
- [ ] **Data export/import**: JSON backup works (Settings → Data Management)
- [ ] **Solscan links**: Receipt page links resolve correctly on target cluster
- [ ] **Mobile responsive**: Test on phone viewport (POS + QR scanning flow)

## 6. Rollback

```bash
vercel rollback         # Roll back to previous deployment
# Or via Vercel Dashboard → Deployments → ... → Rollback
```

## Tech Stack

- **Framework**: Next.js 16.2.6 (App Router, Turbopack)
- **UI**: React 19.2.4, Tailwind CSS 4
- **State**: Zustand 5
- **DB**: Dexie 4.x (IndexedDB)
- **Solana**: @solana/web3.js 1.98, @solana/pay 1.0, @solana/spl-token 0.4
- **QR**: qrcode 1.5 + qrcode.react 4.2
