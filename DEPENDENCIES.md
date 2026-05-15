# Software Bill of Materials (SBOM)

**Project:** microstore v0.1.0
**Generated:** 2026-05-14
**Tool:** npm audit + depcheck + manual review

## Direct Dependencies

| Package | Version | Type | License | Purpose | Risk |
|---------|---------|------|---------|---------|------|
| @solana/pay | 1.0.16 | prod | MIT | Solana Pay protocol — QR-based payment requests | NONE |
| @solana/spl-token | 0.4.14 | prod | Apache-2.0 | Solana SPL token operations | HIGH — bigint-buffer overflow |
| @solana/web3.js | 1.98.4 | prod | MIT | Solana blockchain RPC client | NONE |
| @tailwindcss/postcss | 4.3.0 | dev | MIT | Tailwind CSS v4 PostCSS plugin | NONE |
| @types/dexie | 1.3.32 | dev | MIT | TypeScript types for Dexie.js | NONE |
| @types/node | 20.19.41 | dev | MIT | TypeScript types for Node.js | NONE |
| @types/qrcode | 1.5.6 | prod | MIT | TypeScript types for qrcode | NONE |
| @types/react | 19.2.14 | dev | MIT | TypeScript types for React | NONE |
| @types/react-dom | 19.2.3 | dev | MIT | TypeScript types for React DOM | NONE |
| dexie | 4.4.2 | prod | Apache-2.0 | IndexedDB wrapper — offline database | NONE |
| dexie-react-hooks | 4.4.0 | prod | Apache-2.0 | React hooks for Dexie live queries | NONE |
| dompurify | 3.4.3 | prod | MPL-2.0 OR Apache-2.0 | XSS sanitization | NONE |
| eslint | 9.39.4 | dev | MIT | JavaScript/TypeScript linter | NONE |
| eslint-config-next | 16.2.6 | dev | MIT | Next.js ESLint config | NONE |
| husky | 9.1.7 | dev | MIT | Git hooks manager | NONE |
| lint-staged | 17.0.4 | dev | MIT | Lint staged git files | NONE |
| lucide-react | 1.14.0 | prod | ISC | Icon library | NONE |
| next | 16.2.6 | prod | MIT | Next.js framework | LOW — postcss XSS mitigated |
| prettier | 3.8.3 | dev | MIT | Code formatter | NONE |
| qrcode | 1.5.4 | prod | MIT | QR code generation | NONE |
| react | 19.2.4 | prod | MIT | React UI library | NONE |
| react-dom | 19.2.4 | prod | MIT | React DOM renderer | NONE |
| tailwindcss | 4.3.0 | dev | MIT | Tailwind CSS v4 | NONE |
| typescript | 5.9.3 | dev | Apache-2.0 | TypeScript compiler | NONE |
| vitest | 4.1.6 | dev | MIT | Test runner | NONE |
| zustand | 5.0.13 | prod | MIT | State management | NONE |

**Total:** 13 production + 13 development = 26 direct dependencies

## Audit Summary

### Resolved
- **postcss XSS (MODERATE, GHSA-qx2v-qp2m-jg93):** Fixed via npm `overrides` — postcss >= 8.5.10

### Accepted Risks
- **bigint-buffer buffer overflow (HIGH, GHSA-3gc7-fjrx-p6mg, CVSS 7.5):** Transitive via @solana/spl-token → @solana/buffer-layout-utils. No patched version exists (package unmaintained since 2021). The only npm-suggested fix is downgrading @solana/spl-token to 0.1.8 (massive breaking change). Risk: application crash via crafted on-chain data, no data exfiltration.

## Supply Chain Actions Taken

1. **Version pinning:** All `^` and `~` ranges replaced with exact versions
2. **`.npmrc`:** Added `save-exact=true` to enforce exact versions on future installs
3. **Unused dependency removed:** `qrcode.react` (project uses `qrcode` library directly)
4. **Missing dependencies added:** `dompurify` (used in security.ts), `vitest` (used by test suite)
5. **Dependencies added for tooling:** `husky`, `lint-staged`, `prettier` (pre-commit quality)
6. **Maintenance check:** All direct dependencies actively maintained. Stalest: `qrcode` (Aug 2024), `husky` (Nov 2024), `@types/dexie` (Oct 2024) — all stable, fit-for-purpose
7. **Build verified:** `npm run build` passes — compiles and type-checks cleanly
