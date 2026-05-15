# Changelog

## v0.1.0-rc1 — 2026-05-15

### Added
- Payment confirmation loop via reference-based polling (`findReferenceByAddress`) with `finalized` commitment
- 7-state payment state machine: `awaiting_scan → broadcasting → confirming → finalized / expired / failed / cancelled`
- Web Audio API chime on payment finalization (200ms C5→E5)
- Presenter Mode: chromeless customer-facing `/pay` page (no admin chrome)
- Wallet adapter integration: Connect Wallet button on shop creation (Phantom, Solflare)
- SPL token picker with USDC/USDT/PYUSD options
- Smart wallet defaults: tax wallet → merchant wallet, charity → preset options
- Cart persistence to Dexie: survives iOS Safari eviction, tab duplication reconciliation
- Tax rate configuration: per-shop `taxRate` field, region picker with 52 US states
- `computeOrderTotals()` pure function — single source of truth for order calculations
- Docker Compose dev environment
- Playwright E2E smoke tests
- CSP and security headers
- CI/CD pipeline (GitHub Actions)
- Offline PWA support with service worker
- Receipt PDF generation with jspdf
- Inventory low-stock alerts
- Multi-token support (Solana SPL tokens)
- Tari/Ootle Esmeralda testnet support

### Changed
- Tax rate: removed all hardcoded `0.08875` magic numbers (now shop-configurable)
- `computeAtomicSplit()` delegates to `computeOrderTotals()` for unified arithmetic
- Shop schema v4 migration: added `taxRate`, `taxRegion` fields
- DEPLOY.md merge conflicts resolved
- Duplicate vitest.config.mjs removed

### Fixed
- Hardcoded tax rate in payStore.ts:253 replaced with `shop.taxRate ?? 0`
- Service Worker cache poisoning on deploys
- Form submit buttons (Enter key works, button click fixed)
- `/usr/bin/bash.01` rounding discrepancy in computeAtomicSplit edge cases
- Shop create form toggles (tax, charity) not persisting to DB
- POS order creation uses effectiveChain instead of paymentChain state

### Security
- CSP headers added (X-Frame-Options, X-Content-Type, Referrer-Policy)
- DOMpurify XSS sanitization on user input
- PIN gate planned for v0.2
