# Microstore Roadmap

## Shipped (v1.0 — verified on master)

| Feature                      | Notes                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Point of Sale                | Tap-to-add cart with tip, configurable reserve allocation, optional charity round-up                                 |
| Split payments               | SPL token transfers split across merchant, reserve, and charity legs in one customer signature                       |
| Solana Pay QR codes          | QR encoded `solana:` URLs; customer scans and signs in Phantom, Solflare, or any wallet                              |
| Dual-chain support           | Solana + Tari with chain selector in POS; Solana Pay QR and Tari deep links side by side                             |
| Multi-token support          | USDC, USDT, PYUSD on Solana (devnet + mainnet); XTM + Ootle Esmeralda testnet tokens on Tari                         |
| Tari deep links              | RFC-0154 payment URLs with `resource_address` for Ootle token transfers                                              |
| Inventory management         | Stock tracking, low-stock alerts (visual + counter), barcode/SKU fields, categories                                  |
| Expense tracking             | Categorize, log, search, and delete business expenses per shop                                                       |
| Revenue & reserve reports    | Totals by period (monthly/quarterly/yearly) with CSV export; separate tax/reserve summary                            |
| Printable receipts           | Split breakdown with Solscan / Tari explorer links, PDF download, print, copy URL/text                               |
| Offline capable              | IndexedDB (Dexie) stores everything locally; PWA service worker with cache-first/network-first strategies            |
| Mobile-first                 | Thumb-friendly bottom tab bar, `max-w-md` container, portrait-primary orientation                                    |
| Payment confirmation polling | Reference-based on-chain lookup at `finalized` commitment; Helius WebSocket with polling fallback                    |
| Tari JSON-RPC integration    | Full wallet daemon JSON-RPC: balance queries, transaction status, RFC-0154 deep links, address validation            |
| Photo upload (UI)            | Item photo capture/upload in item editor — blob URL preview in form                                                  |
| PWA & service worker         | Installable PWA with cache-first/network-first SW strategies; `public/manifest.json` + `public/sw.js`                 |

## In Progress

| Feature                 | Status | Notes                                                                                                                                                                                                                    |
| ----------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BigInt money arithmetic | partial | Internals use `bigint` for precision (`dollarsToBaseUnits`, `computeOrderTotals`). Cart store API + Order schema still return `number`. `Math.round`, `parseFloat`, `.toFixed()` still present in pay/solana layers.     |
| Tax → Reserve rename    | partial (~40%) | Dexie shop fields renamed (`reserve*`). Order schema field still `tax: number`. 15+ UI strings still say "tax" or "sales tax". No `reserveLabel` per-shop setting.                                                       |
| Chain / network scoping | partial | No uniform `chain`/`network` fields on records. Ad-hoc: `cluster` (Solana), `paymentChain` (Order), `tariNetwork` (Shop). Schema version 10000.                                                                         |
| Photo persistence       | planned  | Photos stored as transient `string` (URL.createObjectURL), lost on reload. SCHEMA epic will convert to `Blob` in Dexie.                                                                                                 |

## Planned

| Feature                  | Notes                                                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmation chime       | Audio cue (Web Audio API) to play on payment finalization so merchants hear confirmations without watching the screen. V3 audit confirmed no implementation exists yet.                                                          |
| Photo persistence        | Item photos are captured as blob URLs in the editor but not persisted to IndexedDB or a CDN. Photos are lost on page refresh. Requires: store blob in IndexedDB (base64 or binary), or upload to a decentralized storage layer. |
| Invoice system           | Order-level invoice type (`invoice` vs `pos`) with due dates, notes, and invoice numbering (partial schema in place). Full invoice workflow — create, send, track, mark paid — not yet built.                                   |
| Customer management      | Customer CRUD with name, phone, notes fields in db schema. Customer search and linking to orders partially exists. Full CRM (history, segmentation, loyalty) planned.                                                           |
| Additional chain support | Ethereum / Base / Polygon chain adapters following the Tari adapter pattern (chain-specific pay store, deep links, polling/monitoring). Solana and Tari are the initial two.                                                    |

## Deferred

| Feature                            | Notes                                                                                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-merchant multi-tenant        | Multiple shops per device with role-based access (admin vs cashier mode). Cashier mode exists (tab restriction). Multi-shop switching works. Full multi-tenant isolation TBD. |
| Cloud sync / backup                | Encrypted cloud backup of IndexedDB to a user-controlled storage backend (S3, IPFS, etc.). Export/import UI planned.                                                          |
| Barcode scanner                    | Hardware barcode scanner support via camera / keyboard wedge. Barcode field exists in item schema.                                                                            |
| Point-of-sale hardware integration | Receipt printers, cash drawers, barcode scanners via WebUSB / Web Serial API.                                                                                                 |
