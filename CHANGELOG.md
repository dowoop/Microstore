# Changelog

## v1.0.0 — 2026-05-16

First stable release: chain-agnostic POS with multi-currency money, Pro/Free tiers, demo mode, and PWA support. 299 tests pass, clean build with 23 routes.

### Added

- **Demo mode**: Seeded "Demo Coffee" shop with 8 items and 20 sample orders, DEMO banner, and exit button — zero-config first-run experience
- **Smart address detection (O1)**: Auto-detects input type — Solana address, Tari address (bech32m HRP-based + legacy base58), or readable note
- **PIN-gate admin surfaces**: Settings lock with Web Crypto PBKDF2/SHA-256 hashing, cashier mode for restricted POS access
- **BigInt Money primitives (S2)**: `Money` class with configurable decimals, safe arithmetic (add/sub/mulPercent/ceilToDollar), and `fromUserInput` parser supporting $/£/€ and comma separators
- **v4 Dexie migration (S1)**: Schema 10000→10001 adding `chain`/`network`/`supportedChains`/`chainConfig` fields to shops, orders, and expenses — backfills existing data idempotently
- **License key system**: ECDSA P-256 verification, Pro/Free tier management via `featureFlags`, 8 feature gates — POS available on Free, MULTI_TOKEN/EXPENSE_TRACKING/TARI_ONRAMP/REPORTS/PHOTO_UPLOAD on Pro
- **Customer management**: Full CRUD on `/customers` with customer↔order linking, total-spent computation, phone/notes fields, and POS autocomplete suggestions (`customer-suggest`)
- **Expense tracking**: CRUD at `/expenses` with amount/description/datetime, chain-aware wallet addresses, CSV export
- **Price oracle**: Jupiter API integration for real-time SOL/USDC/USDT/PYUSD USD prices with 5-minute cache and 1-hour stale TTL
- **Feature flags registry**: Centralized `FEATURES` map with 8 entries, tier-gated `isFeatureEnabled()` guard, `usePro()` hook, and license store with activate/deactivate/verify lifecycle
- **Network selection**: Chain selector supporting Solana (devnet/mainnet-beta) and Tari (Igor testnet) with per-chain token lists, network banner showing active network
- **Reserve (tax→reserve rename)**: Full tax→reserve terminology sweep across UI, routes (`/reports/tax` → `/reports/reserve`), variable names, and copy — `taxRate` → `reserveRate`, `taxRegion` → `reserveRegion`
- **CSV export**: Shared `csvExport` utility used on `/reports/revenue`, `/reports/reserve`, and expenses list
- **PWA connectivity indicator**: Network status banner with online/offline detection
- **Photo Blob persistence (S6)**: Store item photos as Blobs in Dexie, survives page eviction via `usePhotoUrl` hook
- **Low-stock store**: Zustand store tracking items below threshold for inventory alerts
- **Error reporter**: Centralized error logging with IndexedDB persistence
- **Token validation**: On-chain SPL mint verification via `getMint()`, known-token lookup with mainnet/devnet defaults
- **Atomic split compute**: Pure function `computeAtomicSplit()` generating 3-way splits (merchant + tip + charity) from cart state
- **Tari QR generation**: PNG QR codes from deep links via `qrcode` library, 300px default
- **Tari Ootle token list**: Indexer-based token discovery with graceful fallback for unreachable endpoints

### Changed

- **tax→reserve**: All user-facing labels, route paths, DB field names, and internal references now use "reserve" terminology (breaking change for existing DB schemas — migration handles)
- **Money**: All monetary values now use `Money` class instead of raw numbers — eliminates floating-point errors across the app
- **POS cart**: Refactored to use Money primitives throughout, `reserveRate` replaces `taxRate`
- **PWA**: Improved manifest scope, added apple-touch-icon, connectivity indicator
- **Solana Pay**: Updated to use `@solana/kit`, Helius RPC with fallback, reference-based confirmation loop
- **Settings page**: Complete overhaul with PIN gate, Pro license key input, network selection, and backup/restore
- **Shop creation**: Redesigned with Tari accepted token management, chain selection, reserve region picker

### Fixed

- Floating-point rounding errors eliminated via BigInt Money primitives
- Photo persistence across Safari iOS page eviction (Blob → Dexie)
- DB schema migration: idempotent v4 upgrade, handles solana-only shops, preserves Tari network names
- Probe test DER signature parsing (rStart bug causing off-by-one in s marker)
- Probe test DER-to-raw conversion for ECDSA verify
- Broken O1 test helper causing build failure
- Critical review P0/P1/P2 remediation items

### Security

- PIN-gate with Web Crypto PBKDF2 (500K iterations) and SHA-256 hashing
- ECDSA P-256 license key verification — tamper-resistant Pro/Free gating
- CSP headers retained from v0.1.0-rc1

### Known Limitations

- Tari mainnet is planned but not yet production-ready (placeholder endpoints)
- Tari wallet daemon must run locally at `localhost:18103` — no remote daemon support
- Ootle token indexer is igor-testnet-only; other networks use placeholders
- Demo mode is read-only — no real transactions
- PIN gate recovery requires full data reset (no recovery mechanism)
- License keys are validated client-side only (no server-side enforcement)
- Pro features rely on client-side license state — no online activation server

---

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
