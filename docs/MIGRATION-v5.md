# Dexie schema v5 — Phase 0 consolidation

**Effective:** 2026-05-16
**Schema file:** `src/lib/db.ts`

## What changed

The Dexie schema was renumbered from `10000-10005` back to a clean **`5`** and the
six historical version blocks were collapsed into a single `this.version(5).stores({...})`.

In the process the following fields, tables, and types were removed:

### Removed tables

| Table       | Reason                                                              |
| ----------- | ------------------------------------------------------------------- |
| `customers` | CRM/invoicing feature was Phase 0 scope creep (deleted in Task #3). |

### Removed Shop fields

| Field                                     | Replacement / Reason                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `chain`                                   | Dead. Nothing reads it. Shop chain is inferred from `tariWallet` presence. |
| `network`                                 | Dead. Solana network is in `cluster`, Tari in `tariNetwork`.               |
| `supportedChains`                         | Dead. v4 multi-chain abstraction; Phase 0 is Solana + Tari only.           |
| `chainConfig`                             | Dead. Per-chain wallet map for the multi-chain branches we deleted.        |
| `defaultChain`                            | Dead. Inferred from wallet config.                                         |
| `reserveAllocationEnabled` → `taxEnabled` | Vocabulary revert (Task #4).                                               |
| `reserveRate`                             | Consolidated into `taxRate`.                                               |
| `reserveLabel`                            | Consolidated into `taxLabel`.                                              |
| `reserveRegion` → `taxRegion`             | Vocabulary revert.                                                         |
| `reserveWallet` → `taxSetAsideWallet`     | Vocabulary revert.                                                         |

### Removed Order fields

| Field                                                                           | Replacement / Reason                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `customerId`, `customerName`, `customerPhone`                                   | CRM removed.                                                  |
| `invoiceNumber`, `invoiceType`, `invoiceDueDate`, `invoiceNotes`                | Invoicing removed.                                            |
| `chain`, `network`                                                              | Dead. Replaced by `paymentChain` + `cluster`.                 |
| `subtotalBase`, `tipBase`, `taxBase`, `charityBase`, `totalBase`, `reserveBase` | BigInt money migration reverted (Task #5).                    |
| `reserve` → `tax`                                                               | Vocabulary revert.                                            |
| `reserveTxSignature` → `taxTxSignature`                                         | Vocabulary revert. Retained as deprecated for legacy display. |

### Removed Expense fields

| Field              | Reason                               |
| ------------------ | ------------------------------------ |
| `chain`, `network` | Dead. `cluster` is the active field. |

### Removed Types

- `ChainId` — listed Bitcoin / Lightning / EVM / Monero, all postponed.
- `NetworkId` — listed every chain's testnet; over-engineered.
- `ChainShopConfig` — per-chain wallet map, only ever read from itself.

### Removed indexes

- `customerId` from orders index.
- `chain`, `network` from shops/orders/expenses indexes.
- `merchantTxSignature` from orders index (per-leg signatures are deprecated under atomic-tx).

## v5 schema (canonical)

```ts
shops: '++id, name, username, cluster, createdAt';
items: '++id, shopId, name, category, sku, barcode, createdAt';
orders: '++id, shopId, status, paymentChain, cluster, txSignature, paymentRef, referencePubkey, createdAt';
expenses: '++id, shopId, category, cluster, date';
offlineQueue: '++id, status, createdAt';
errorLogs: '++id, timestamp';
cartDrafts: '++id, shopId, updatedAt';
```

## Migration story for existing local data

**There is no auto-migration.** The version number was bumped _backwards_ (10005 → 5),
which Dexie does not support. Any local IndexedDB at version 10000–10005 will
fail to open with a `VersionError` when the v5 code loads.

**To recover from `VersionError`:**

1. Open DevTools → **Application** → **Storage** → **IndexedDB** → `MicrostoreDB`.
2. Right-click → **Delete database**.
3. Reload the page. The DB initializes fresh at v5.

This affects exactly one developer (the project author) and was an explicit Phase 0
decision: the prior version numbers were arbitrary 5-digit values with no semantic
meaning. Going forward, increments are sequential (5 → 6 → 7).

## Legacy version history (for reference)

The prior schema versions were:

| Version | Date (approx) | Purpose                                                                                              |
| ------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| 10000   | initial       | Original schema with customers + per-leg tx signatures.                                              |
| 10001   | March         | Added `chain`/`network`/`chainConfig`/`supportedChains` + BigInt base-unit fields. (v4 abstraction.) |
| 10002   | March         | Convert string `photoUrl` → Blob.                                                                    |
| 10003   | April         | No schema change — marked per-leg signatures deprecated.                                             |
| 10004   | April         | Per-shop `taxRate`/`taxLabel`; rename `taxWallet` → `taxSetAsideWallet`.                             |
| 10005   | May           | Added `referencePubkey` on orders for Solana Pay reference discovery.                                |

All six version blocks were collapsed into the single v5 declaration above.

## Adding the next version

When you add a new field or table:

```ts
this.version(5).stores({
  /* keep this block frozen */
});
this.version(6)
  .stores({
    shops: '++id, name, username, cluster, newIndex, createdAt',
    // ... only repeat tables that changed
  })
  .upgrade(async (tx) => {
    // backfill new fields on existing rows
  });
```

Do **not** edit the v5 stores block once it has shipped. Add a new `.version(N+1)` instead.
