# Software Bill of Materials (SBOM)

**Project:** microstore v0.1.0
**Generated:** 2026-05-14
**Branch:** kanban/supply-chain
**Tool:** npm audit + depcheck + manual review

## Direct Dependencies

| Package | Version | Type | License | Purpose | Risk |
|---------|---------|------|---------|---------|------|
| @solana/pay | 1.0.16 | prod | MIT | Solana Pay protocol integration — QR-based payment requests | NONE |
| @solana/spl-token | 0.4.14 | prod | Apache-2.0 | Solana SPL token operations — token transfers on Solana | HIGH — transitive dep bigint-buffer has unpatched buffer overflow (GHSA-3gc7-fjrx-p6mg). No fix available. |
| @solana/web3.js | 1.98.4 | prod | MIT | Solana blockchain RPC client — wallet connections, transactions | NONE |
| @tailwindcss/postcss | 4.3.0 | dev | MIT | Tailwind CSS v4 PostCSS plugin — build-time CSS processing | NONE |
| @types/dexie | 1.3.32 | dev | MIT | TypeScript types for Dexie.js IndexedDB wrapper | NONE |
| @types/node | 20.19.41 | dev | MIT | TypeScript types for Node.js runtime APIs | NONE |
| @types/qrcode | 1.5.6 | prod | MIT | TypeScript types for qrcode library | NONE |
| @types/react | 19.2.14 | dev | MIT | TypeScript types for React | NONE |
| @types/react-dom | 19.2.3 | dev | MIT | TypeScript types for React DOM | NONE |
| @vitest/coverage-v8 | 4.1.6 | dev | ? |  | NONE |
| dexie | 4.4.2 | prod | Apache-2.0 | IndexedDB wrapper — client-side offline database | NONE |
| dexie-react-hooks | 4.4.0 | prod | Apache-2.0 | React hooks for Dexie live queries | NONE |
| dompurify | 3.4.3 | prod | (MPL-2.0 OR Apache-2.0) | XSS sanitization — sanitizes HTML/inputs | NONE |
| eslint | 9.39.4 | dev | MIT | JavaScript/TypeScript linter — code quality | NONE |
| eslint-config-next | 16.2.6 | dev | MIT | Next.js ESLint configuration preset | NONE |
| husky | 9.1.7 | dev | MIT | Git hooks manager — runs lint-staged on pre-commit | NONE |
| lint-staged | 17.0.4 | dev | MIT | Runs linters on staged git files — pre-commit quality gate | NONE |
| lucide-react | 1.14.0 | prod | ISC | Icon library — UI icons for the app | NONE |
| next | 16.2.6 | prod | MIT | Next.js framework — React SSR, routing, build tooling | LOW — postcss XSS fixed via overrides |
| prettier | 3.8.3 | dev | MIT | Code formatter — consistent code style | NONE |
| qrcode | 1.5.4 | prod | MIT | QR code generation library — payment QR codes | NONE |
| react | 19.2.4 | prod | MIT | React UI library — core rendering engine | NONE |
| react-dom | 19.2.4 | prod | MIT | React DOM renderer — browser rendering | NONE |
| tailwindcss | 4.3.0 | dev | MIT | Tailwind CSS v4 — utility-first CSS framework | NONE |
| typescript | 5.9.3 | dev | Apache-2.0 | TypeScript compiler — static type checking | NONE |
| vitest | 4.1.6 | dev | MIT | Test runner — unit/integration tests | NONE |
| zustand | 5.0.13 | prod | MIT | State management — lightweight React state store | NONE |

**Total:** 13 production, 14 development

## Audit Summary

### Resolved
- **postcss XSS (MODERATE, GHSA-qx2v-qp2m-jg93):** Fixed via npm `overrides` — postcss >= 8.5.10

### Accepted Risks
- **bigint-buffer buffer overflow (HIGH, GHSA-3gc7-fjrx-p6mg, CVSS 7.5):** Transitive via `@solana/spl-token` → `@solana/buffer-layout-utils`. No patched version (unmaintained since 2021). Fix would require downgrading @solana/spl-token to 0.1.8 (breaking). Risk: app crash only, no data exfiltration. Requires attacker-crafted on-chain data.

## Supply Chain Actions

1. **Version pinning:** All `^` and `~` ranges → exact versions
2. **`.npmrc`:** Added `save-exact=true`
3. **Unused removed:** `qrcode.react` (project uses `qrcode` directly)
4. **Missing added:** `dompurify`, `vitest`, `husky`, `lint-staged`, `prettier`
5. **Maintenance:** All deps actively maintained. Stalest: `qrcode` (Aug 2024), `husky` (Nov 2024), `@types/dexie` (Oct 2024)
