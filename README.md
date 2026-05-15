# Microstore

**Privacy-first point of sale for merchants who accept crypto.** Built entirely client-side — no backend, no auth, no cloud dependency. Your data stays in your browser.

Run your shop from a phone. Customers pay by scanning a QR code with Phantom, Solflare, or a Tari wallet. Every sale atomically splits into merchant revenue, tax, and charity — three transfers, one transaction, no intermediary. Supports **Solana** (SOL + SPL tokens) and **Tari** (XTM + Ootle Esmeralda testnet tokens).

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.6 |
| UI | React + Tailwind CSS | 19.2.4 / 4.x |
| State | Zustand | 5.0.13 |
| Database | Dexie.js (IndexedDB) | 4.4.2 |
| Blockchain | @solana/web3.js | 1.98.4 |
| Payments | @solana/pay + @solana/spl-token | 1.0.16 / 0.4.14 |
| **Tari / Ootle** | **JSON-RPC (wallet daemon)** | **igor + esmeralda testnets** |
| QR Codes | qrcode | 1.5.4 |
| Icons | Lucide React | 1.14.0 |
| Language | TypeScript (strict) | 5.x |
| Testing | Vitest | 4.1.6 |

## Quick Start

```bash
# Clone
git clone https://github.com/dowoop/Microstore.git
cd Microstore

# Install
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local — add your Helius API key (get one at https://dev.helius.xyz/dashboard)

# Start dev server
npm run dev
# → http://localhost:3000
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_HELIUS_API_KEY` | No | — | Helius RPC API key for enhanced Solana connectivity. Falls back to public cluster endpoints if unset. |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | No | `devnet` | Solana cluster: `devnet` or `mainnet-beta`. |

## How It Works

1. **Create a shop** — add your merchant wallet address (public key only, never a private key)
2. **Add items** — products and services with prices, stock levels, and categories
3. **Ring up sales** — tap items on the POS screen, set a tip, optionally round up for charity
4. **Customer pays** — they scan a QR code and sign a single transaction that atomically splits payment into merchant + tax + charity
5. **Auto-confirmation** — the app polls the chain via reference-based lookup (`finalized` commitment), updates the order to `paid`, and plays a confirmation chime
6. **Print a receipt** — with full split breakdown and Solscan links

Everything runs locally. No server sees your shop data, inventory, orders, or wallet addresses.

## Screenshots

<!-- TODO: Add screenshots of main screens (POS, payment QR, receipt, dashboard) -->

## Features

- **Point of Sale** — tap-to-add cart with tip, configurable tax rate, and optional charity round-up
- **Atomic split payments** — optional three-way SPL token transfer: merchant, tax authority, charity (all legs optional, charity off by default)
- **Solana Pay QR codes** — customer scans and signs in their own wallet
- **Dual-chain support** — accept payments on Solana or Tari with a chain selector in POS
- **Multi-token support** — USDC, USDT, PYUSD on Solana; Ootle Esmeralda testnet tokens on Tari
- **Tari deep links** — RFC-0154 payment URLs with resource_address for Ootle token transfers
- **Inventory management** — stock tracking, low-stock alerts, barcode/SKU fields
- **Expense tracking** — categorize and log business expenses
- **Revenue & tax reports** — totals by period with CSV export
- **Printable receipts** — split breakdown with Solscan transaction links
- **Offline capable** — IndexedDB stores everything locally; works without internet for POS operations
- **Mobile-first** — designed for phone screens with a thumb-friendly bottom tab bar

## Documentation

- [Architecture Overview](ARCHITECTURE.md) — system diagram, data flow, component tree, store design, database schema
- [Deployment Guide](DEPLOY.md) — Vercel deployment, environment variables, mainnet checklist
- [Security Model](SECURITY.md) — threat model, wallet security, transaction safety, data storage
- [Contributing](CONTRIBUTING.md) — development workflow, code style, testing, PR template

## Status

Microstore is under active development. Features are being added iteratively. Expect breaking changes. Target: stable v1.0 on Solana mainnet.

## License

MIT
