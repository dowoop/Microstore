# Handoff — pay-reference

**Canonical answer:** Every new Solana order now gets a unique
`referencePubkey` (an ed25519 public key, base58-encoded) generated
at creation time. This key is embedded in the Solana Pay URL as a
`reference=` query parameter, added as a non-signer/non-writable
`AccountMeta` on the first SPL transfer instruction, and used by
the confirmation poll via `getSignaturesForAddress` instead of
memo-string parsing.

---

## Audit result: reference field status before Agent 0.3

| Feature | Status | Details |
| ------- | ------ | ------- |
| `generatePaymentReference()` | Already existed | `src/lib/solanaPay.ts` L82–85 |
| `findReferenceByAddress()` | Already existed | `src/lib/solanaPay.ts` L112–173 — polls `getSignaturesForAddress` |
| `createSolanaPayURL()` accepts `reference` param | Already existed | L470–504 — param was in the interface and passed to `encodeURL()` |
| `/pay` page passes reference to URL | Already existed | `src/app/pay/page.tsx` L158 — `reference: paymentRefPubkey ?? undefined` |
| payStore uses reference for confirmation | Already existed | `startSolanaReferencePolling()` — already preferred over TxMonitor |
| POS page generates reference at creation | **Missing** — added | Now generates `Keypair.generate()` → `referencePubkey` at `db.orders.add()` |
| POS page passes reference to QR | **Missing** — added | Now passes `reference: referencePubkey ?? undefined` to `createSolanaPayURL` |
| `buildAtomicSplitTransaction` includes reference | **Missing** — added | Now adds reference as non-signer/non-writable `AccountMeta` on first instruction |
| `referencePubkey` field on Order | **Missing** — added | New `referencePubkey?: string` field on Order interface |
| Dexie migration v10005 | **Missing** — added | New version with `referencePubkey` index; existing orders → `null` |

**Conclusion:** The infrastructure for reference-based payment discovery
(`generatePaymentReference`, `findReferenceByAddress`, `createSolanaPayURL`)
was partially wired in the `/pay` page flow but not in the POS order-creation
flow. The reference was never stored as a first-class database field nor
added to transaction instructions. Agent 0.3 closed these gaps.

---

## Confirmation poll behavior for historical (null-reference) orders

Orders predating Agent 0.3 have `referencePubkey: null`. The confirmation
polling resolves this in two layers:

1. **payStore.loadOrder()** — if `order.referencePubkey` is null, a fresh
   reference is generated via `Keypair.generate()`, persisted to the order
   as a backfill (`referencePubkey: paymentRefPubkey`), and used for this
   session. Subsequent loads of the same order will reuse the backfilled key.

2. **startSolanaReferencePolling()** — if `paymentRefPubkey` is still null
   (no Solana wallet configured), falls back to `TxMonitor` with memo-based
   matching (`microstore:shopId:orderId` pattern).

The old `order.paymentRef` field (a formatted string like
`microstore:shopId:timestamp`) is **no longer used** for pubkey-based
discovery. It remains in the schema for backwards compatibility but is
not referenced by the confirmation path.

---

## Phase 1 considerations — QR/URL structure

- The Solana Pay URL now includes `reference=<base58-pubkey>` as a query
  parameter. Phase 1 QR generation should maintain this.
- The reference pubkey is a **non-signer key** — the private key is
  discarded after generation. Phase 1 should NOT attempt to sign with it.
- Transaction instructions now include a blank `TransactionInstruction`
  (empty data, customer as dummy programId) whose only purpose is attaching
  the reference pubkey as an `AccountMeta`. This is a pragmatic approach
  that avoids modifying the SPL token transfer instruction structure.
  Phase 1 should preserve this or replace it with the official Solana Pay
  reference-key pattern if a better approach emerges.

---

## Design decisions

1. **Reference stored as base58 string, not raw bytes.** The Order lives
   in IndexedDB; base58 serialization is the standard for public keys and
   avoids storing Uint8Arrays (which Dexie handles differently).

2. **Private key is discarded.** The reference keypair is never used for
   signing. Only the public key matters for on-chain discovery. The
   `Keypair.generate()` call produces a secretKey that is immediately
   dropped after extracting `publicKey.toBase58()`.

3. **Reference added as a separate no-op instruction, not injected into
   existing transfers.** Adding extra `AccountMeta` to
   `createTransferCheckedInstruction` would require modifying the SPL
   token library's output. Instead, a separate `TransactionInstruction`
   with zero data and the reference key as sole account is appended.
   This keeps the SPL transfer logic untouched while still achieving the
   on-chain footprint.

4. **One reference per transaction, not per instruction.** The reference
   instruction is only pushed once (for the first non-zero leg). This
   avoids bloating the transaction with redundant account entries.

5. **`referencePubkey` distinct from legacy `paymentRef`.** The old
   `paymentRef` field holds a memo-formatted string
   (`microstore:shopId:timestamp`). The new `referencePubkey` holds a
   base58 public key. They serve different purposes and coexist in the
   schema.

---

## Files changed

| File | Change |
| ---- | ------ |
| `src/lib/db.ts` | Added `referencePubkey?: string` to Order; added v10005 Dexie migration with index |
| `src/lib/solanaPay.ts` | Added `referencePubkey?` to `BuildAtomicTxParams`; `buildAtomicSplitTransaction` now adds reference as non-signer AccountMeta |
| `src/lib/payStore.ts` | `loadOrder` reads `order.referencePubkey` (backfill if null); persists to `referencePubkey` field |
| `src/app/pos/page.tsx` | Generates `Keypair.generate()` → `referencePubkey` at order creation for Solana orders; passes reference to `createSolanaPayURL` |
| `__tests__/pay-reference.test.ts` | NEW — 21 tests covering: key generation, URL reference parameter, BuildAtomicTxParams type, ReferenceLookupOutcome, null-safety |
| `ARCHITECTURE.md` | Added `referencePubkey` to Orders schema; added "Payment matching" §6.7; added v10005 to schema history |
| `docs/roadmap/handoff-pay-reference.md` | NEW — this file |
