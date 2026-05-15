# Microstore

**Solana-native micro-commerce — Point of Sale first. No server. No signups.**

Scan a QR code and pay with your Solana wallet. Built for mobile merchants, street vendors, pop-up shops, and anyone who wants to accept crypto payments without setting up a backend.

Microstore turns your phone into a complete point-of-sale system with inventory management, expense tracking, tax allocation, charitable round-ups, and real-time revenue dashboards — all running in your browser. Customer payments execute as atomic SPL token transfers on Solana, splitting the payment across merchant, tax authority, and charity wallets in a single on-chain transaction.

## Tech Stack

| Layer           | Technology            | Version   |
| --------------- | --------------------- | --------- |
| Framework       | Next.js (App Router)  | 16.2.6    |
| UI              | React                 | 19.2.4    |
| Styling         | Tailwind CSS          | 4         |
| State           | Zustand               | 5.0.13    |
| Database        | Dexie (IndexedDB)     | 4.4.2     |
| Blockchain      | @solana/web3.js       | 1.98.4    |
| Token transfers | @solana/spl-token     | 0.4.14    |
| Payments        | @solana/pay           | 1.0.16    |
| QR codes        | qrcode + qrcode.react | 1.5 / 4.2 |
| Icons           | lucide-react          | 1.14.0    |
| Language        | TypeScript            | 5         |
| Testing         | Vitest                | latest    |
| Linting         | ESLint                | 9         |

## Quick Start

```bash
# Clone and install
git clone https://github.com/dowoop/Microstore.git
cd Microstore
npm install

# Set your Helius API key (recommended — falls back to public RPC otherwise)
cp .env.example .env.local
# Edit .env.local with your Helius key from https://dev.helius.xyz/dashboard

# Start dev server
npm run dev
# → http://localhost:3000
```

## Environment Variables

| Variable                     | Required | Default  | Description                                                                                                                        |
| ---------------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_HELIUS_API_KEY` | No       | (empty)  | Helius RPC API key for high-performance Solana access. Without this, the app uses public `clusterApiUrl` endpoints (rate-limited). |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | No       | `devnet` | Solana cluster: `devnet` for testing, `mainnet-beta` for real payments.                                                            |

All env vars are prefixed `NEXT_PUBLIC_` because they must be available in the browser (the app is fully client-side).

## Screenshots

_Screenshots to be added — capture these screens after running the dev server:_

- **Point of Sale** (`/pos`): The item grid, cart with tip/tax/charity controls, and checkout panel
- **Payment QR** (`/pay?orderId=1`): The Solana Pay QR code with atomic split breakdown
- **Dashboard** (`/`): Revenue cards, period selector, wallet balances, expense tracking
- **Shop Settings** (`/settings`): Shop editor with wallet address configuration and data export/import
- **Inventory** (`/items`): Item list with search, stock levels, and status filters

## How It Works

1. **Create a shop** — Set up your merchant profile, wallet addresses, and accepted SPL token
2. **Add inventory** — Products and services with prices, stock levels, and categories
3. **Build a cart** — POS screen lets you tap items to add them to the cart with tip/tax/charity controls
4. **Generate payment** — A Solana Pay QR code appears with the atomic split breakdown
5. **Customer scans and pays** — Their wallet signs a single transaction that splits the payment three ways
6. **Get notified** — Browser notifications alert you to new orders and low stock

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design, data flow, component tree, and store architecture
- [DEPLOY.md](./DEPLOY.md) — Vercel deployment, environment config, and mainnet checklist
- [SECURITY.md](./SECURITY.md) — Threat model, wallet security, and data storage considerations
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Development workflow, code style, and PR guidelines

## License

Private — not licensed for redistribution.
