/**
 * Migration tests for db version 10000 → 10001.
 *
 * Tests verify the upgrade(…) function:
 *   1. Empty DB upgrade produces correct defaults
 *   2. Existing shops/orders/expenses are migrated with chain/network/*Base
 *   3. tax → reserve rename
 *   4. Idempotency (running upgrade twice produces no errors)
 *   5. Monetary values round-trip correctly
 *   6. New chain/network indexes work for queries
 */

import { describe, it, expect, afterEach } from 'vitest';
import Dexie from 'dexie';
import { fromDecimalString, toBaseString, fromBaseString, toDisplay } from '@/lib/money';

const MONEY_DECIMALS = 6;

// ---------------------------------------------------------------------------
// Helper — open a DB that matches the real MicrostoreDB schema (both versions)
// ---------------------------------------------------------------------------

function openRealDb(): Dexie {
  const db = new Dexie('MicrostoreDB');
  db.version(10000).stores({
    shops:     '++id, name, username, merchantWallet, cluster, createdAt',
    items:     '++id, shopId, name, category, sku, barcode, createdAt',
    orders:    '++id, shopId, customerId, status, txSignature, merchantTxSignature, paymentRef, cluster, createdAt',
    expenses:  '++id, shopId, category, cluster, date',
    customers: '++id, shopId, name, phone, createdAt',
    offlineQueue: '++id, status, createdAt',
    errorLogs: '++id, timestamp',
    cartDrafts: '++id, shopId, updatedAt',
  });

  // v4 migration — mirrors src/lib/db.ts version(10001)
  db.version(10001).stores({
    shops:     '++id, name, username, chain, network, createdAt',
    items:     '++id, shopId, name, category, sku, barcode, createdAt',
    orders:    '++id, shopId, customerId, status, chain, network, txSignature, merchantTxSignature, paymentRef, createdAt',
    expenses:  '++id, shopId, category, chain, network, date',
    customers: '++id, shopId, name, phone, createdAt',
    offlineQueue: '++id, status, createdAt',
    errorLogs: '++id, timestamp',
    cartDrafts: '++id, shopId, updatedAt',
  }).upgrade(async tx => {
    const toBase = (val: number): string =>
      toBaseString(fromDecimalString((val ?? 0).toFixed(MONEY_DECIMALS), MONEY_DECIMALS));

    // ── shops ──────────────────────────────────────────────────
    const shopCount = await tx.table('shops').count();
    if (shopCount > 0) {
      const sample: any = await tx.table('shops').limit(1).first();
      if (!sample || !('chain' in sample)) {
        const shops: any[] = await tx.table('shops').toCollection().toArray();
        for (const s of shops) {
          s.chain = 'solana';
          s.network = s.cluster ?? s.tariNetwork ?? 'devnet';

          s.supportedChains = [];
          if (s.merchantWallet) s.supportedChains.push('solana');
          if (s.tariWallet) s.supportedChains.push('tari');

          s.chainConfig = {};

          const solCfg: any = {};
          if (s.merchantWallet !== undefined) solCfg.merchantWallet = s.merchantWallet;
          if (s.reserveWallet !== undefined) solCfg.reserveWallet = s.reserveWallet;
          if (s.charityWallet !== undefined) solCfg.charityWallet = s.charityWallet;
          if (s.splTokenMint !== undefined) solCfg.tokenMint = s.splTokenMint;
          if (s.splTokenSymbol !== undefined) solCfg.tokenSymbol = s.splTokenSymbol;
          if (s.acceptedTokens !== undefined) solCfg.acceptedTokens = s.acceptedTokens;
          if (s.reserveRate !== undefined) solCfg.reserveRate = s.reserveRate;
          if (s.reserveRegion !== undefined) solCfg.reserveRegion = s.reserveRegion;
          s.chainConfig['solana'] = solCfg;

          if (s.tariWallet) {
            const tariCfg: any = { merchantWallet: s.tariWallet };
            if (s.tariAcceptedTokens !== undefined) tariCfg.acceptedTokens = s.tariAcceptedTokens;
            s.chainConfig['tari'] = tariCfg;
          }

          s.defaultChain = s.supportedChains[0] ?? 'solana';

          await tx.table('shops').put(s);
        }
      }
    }

    // ── orders ─────────────────────────────────────────────────
    const orderCount = await tx.table('orders').count();
    if (orderCount > 0) {
      const sample: any = await tx.table('orders').limit(1).first();
      if (!sample || !('reserve' in sample)) {
        const shopMap = new Map<number, any>();
        await tx.table('shops').each((s: any) => { shopMap.set(s.id, s); });

        const orders: any[] = await tx.table('orders').toCollection().toArray();
        for (const o of orders) {
          o.reserve = o.tax ?? 0;
          delete o.tax;

          o.chain = o.paymentChain ?? 'solana';

          const shop = shopMap.get(o.shopId);
          o.network = shop?.network ?? shop?.cluster ?? o.cluster ?? 'devnet';

          o.subtotalBase = toBase(o.subtotal ?? 0);
          o.tipBase      = toBase(o.tip ?? 0);
          o.reserveBase  = toBase(o.reserve ?? 0);
          o.charityBase  = toBase(o.charity ?? 0);
          o.totalBase    = toBase(o.total ?? 0);

          await tx.table('orders').put(o);
        }
      }
    }

    // ── expenses ───────────────────────────────────────────────
    const expenseCount = await tx.table('expenses').count();
    if (expenseCount > 0) {
      const sample: any = await tx.table('expenses').limit(1).first();
      if (!sample || !('chain' in sample)) {
        const expenses: any[] = await tx.table('expenses').toCollection().toArray();
        for (const e of expenses) {
          e.chain   = 'solana';
          e.network = e.cluster ?? 'devnet';
          await tx.table('expenses').put(e);
        }
      }
    }
  });

  return db;
}

/** Seed old-schema data at version 10000 only (no upgrade). */
async function seedV10000(
  shops: any[] = [],
  orders: any[] = [],
  expenses: any[] = [],
): Promise<void> {
  const seedDb = new Dexie('MicrostoreDB');
  seedDb.version(10000).stores({
    shops:     '++id, name, username, merchantWallet, cluster, createdAt',
    items:     '++id, shopId, name, category, sku, barcode, createdAt',
    orders:    '++id, shopId, customerId, status, txSignature, merchantTxSignature, paymentRef, cluster, createdAt',
    expenses:  '++id, shopId, category, cluster, date',
    customers: '++id, shopId, name, phone, createdAt',
    offlineQueue: '++id, status, createdAt',
    errorLogs: '++id, timestamp',
    cartDrafts: '++id, shopId, updatedAt',
  });

  await seedDb.open();
  if (shops.length) await seedDb.table('shops').bulkPut(shops);
  if (orders.length) await seedDb.table('orders').bulkPut(orders);
  if (expenses.length) await seedDb.table('expenses').bulkPut(expenses);
  seedDb.close();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('v4 migration (10000 → 10001)', () => {
  afterEach(async () => {
    // Wipe IndexedDB clean
    await Dexie.delete('MicrostoreDB');
  });

  // ── 1. Empty DB ──────────────────────────────────────────────────────────

  it('migrates an empty DB without errors', async () => {
    const db = openRealDb();
    await db.open();
    const count = await db.table('shops').count();
    expect(count).toBe(0);
    db.close();
  });

  // ── 2. Shop migration ───────────────────────────────────────────────────

  it('backfills chain / network / supportedChains / chainConfig on shops', async () => {
    await seedV10000([
      {
        id: 1,
        name: 'Test Shop',
        username: 'testshop',
        tipPresets: [1, 2, 5],
        reserveAllocationEnabled: true,
        reserveRate: 0.08875,
        reserveRegion: 'US-CA',
        charityEnabled: false,
        charityPartners: [],
        merchantWallet: 'sol-wallet-abc',
        reserveWallet: 'sol-reserve-xyz',
        splTokenMint: 'mint123',
        splTokenSymbol: 'USDC',
        acceptedTokens: [{ mint: 'mint123', symbol: 'USDC' }],
        cluster: 'mainnet-beta',
        tariWallet: 'tari-wallet-def',
        tariNetwork: 'igor',
        tariAcceptedTokens: [{ symbol: 'XTR' }],
        isDemo: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      },
    ]);

    const db = openRealDb();
    await db.open(); // triggers upgrade

    const shops: any[] = await db.table('shops').toArray();
    expect(shops).toHaveLength(1);
    const s = shops[0];

    expect(s.chain).toBe('solana');
    expect(s.network).toBe('mainnet-beta');
    expect(s.supportedChains).toContain('solana');
    expect(s.supportedChains).toContain('tari');
    expect(s.supportedChains).toHaveLength(2);
    expect(s.defaultChain).toBe('solana');

    expect(s.chainConfig).toBeDefined();
    expect(s.chainConfig['solana']).toBeDefined();
    expect(s.chainConfig['solana'].merchantWallet).toBe('sol-wallet-abc');
    expect(s.chainConfig['solana'].reserveWallet).toBe('sol-reserve-xyz');
    expect(s.chainConfig['solana'].tokenMint).toBe('mint123');
    expect(s.chainConfig['solana'].tokenSymbol).toBe('USDC');
    expect(s.chainConfig['solana'].reserveRate).toBe(0.08875);
    expect(s.chainConfig['solana'].reserveRegion).toBe('US-CA');

    expect(s.chainConfig['tari']).toBeDefined();
    expect(s.chainConfig['tari'].merchantWallet).toBe('tari-wallet-def');

    db.close();
  });

  it('handles solana-only shops (no tari wallet)', async () => {
    await seedV10000([
      {
        id: 1,
        name: 'Sol Only',
        username: 'solonly',
        tipPresets: [1],
        reserveAllocationEnabled: false,
        charityEnabled: false,
        charityPartners: [],
        merchantWallet: 'sol-wallet',
        cluster: 'devnet',
        isDemo: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const db = openRealDb();
    await db.open();
    const shops: any[] = await db.table('shops').toArray();
    const s = shops[0];
    expect(s.chain).toBe('solana');
    expect(s.network).toBe('devnet');
    expect(s.supportedChains).toEqual(['solana']);
    expect(s.defaultChain).toBe('solana');
    expect(s.chainConfig['solana'].merchantWallet).toBe('sol-wallet');
    expect(s.chainConfig['tari']).toBeUndefined();
    db.close();
  });

  it('preserves tari network name in network field', async () => {
    await seedV10000([
      {
        id: 1,
        name: 'Tari Shop',
        username: 'tarishop',
        tipPresets: [1],
        reserveAllocationEnabled: false,
        charityEnabled: false,
        charityPartners: [],
        tariWallet: 'tari-wallet',
        tariNetwork: 'mainnet',
        isDemo: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const db = openRealDb();
    await db.open();
    const shops: any[] = await db.table('shops').toArray();
    const s = shops[0];
    expect(s.chain).toBe('solana');
    expect(s.network).toBe('mainnet');
    expect(s.supportedChains).toContain('tari');
    db.close();
  });

  // ── 3. Order migration ──────────────────────────────────────────────────

  it('renames tax → reserve on orders and computes *Base fields', async () => {
    await seedV10000(
      [
        {
          id: 1,
          name: 'Test Shop',
          username: 'testshop',
          tipPresets: [1],
          reserveAllocationEnabled: false,
          charityEnabled: false,
          charityPartners: [],
          cluster: 'mainnet-beta',
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        {
          id: 100,
          shopId: 1,
          status: 'confirmed',
          subtotal: 12.34,
          tip: 2.5,
          tipPercent: 20,
          tax: 0.5,
          charity: 0,
          total: 15.34,
          items: [],
          paymentChain: 'solana',
          cluster: 'mainnet-beta',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    );

    const db = openRealDb();
    await db.open();
    const orders: any[] = await db.table('orders').toArray();
    expect(orders).toHaveLength(1);
    const o = orders[0];

    expect(o.tax).toBeUndefined();
    expect(o.reserve).toBe(0.5);
    expect(o.chain).toBe('solana');
    expect(o.network).toBe('mainnet-beta');

    expect(o.subtotalBase).toBe('12340000');
    expect(o.tipBase).toBe('2500000');
    expect(o.reserveBase).toBe('500000');
    expect(o.charityBase).toBe('0');
    expect(o.totalBase).toBe('15340000');

    // Round-trip
    const rt = fromBaseString(o.subtotalBase, MONEY_DECIMALS);
    expect(toDisplay(rt)).toBe('12.34');

    db.close();
  });

  it('handles tari orders (paymentChain → chain: tari)', async () => {
    await seedV10000(
      [
        {
          id: 1,
          name: 'Tari Shop',
          username: 'tarishop',
          tipPresets: [1],
          reserveAllocationEnabled: false,
          charityEnabled: false,
          charityPartners: [],
          tariWallet: 'tari-wallet',
          tariNetwork: 'igor',
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        {
          id: 200,
          shopId: 1,
          status: 'confirmed',
          subtotal: 100,
          tip: 0,
          tipPercent: 0,
          tax: 0,
          charity: 0,
          total: 100,
          items: [],
          paymentChain: 'tari',
          tariTokenSymbol: 'XTR',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    );

    const db = openRealDb();
    await db.open();
    const orders: any[] = await db.table('orders').toArray();
    expect(orders).toHaveLength(1);
    const o = orders[0];
    expect(o.chain).toBe('tari');
    expect(o.network).toBe('igor');
    expect(o.subtotalBase).toBe('100000000');
    db.close();
  });

  it('defaults to solana/devnet when paymentChain and cluster are missing', async () => {
    await seedV10000(
      [
        {
          id: 1,
          name: 'No Config Shop',
          username: 'noconfig',
          tipPresets: [1],
          reserveAllocationEnabled: false,
          charityEnabled: false,
          charityPartners: [],
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        {
          id: 300,
          shopId: 1,
          status: 'draft',
          subtotal: 5,
          tip: 0,
          tipPercent: 0,
          tax: 0,
          charity: 0,
          total: 5,
          items: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    );

    const db = openRealDb();
    await db.open();
    const orders: any[] = await db.table('orders').toArray();
    const o = orders[0];
    expect(o.chain).toBe('solana');
    expect(o.network).toBe('devnet');
    db.close();
  });

  // ── 4. Expense migration ────────────────────────────────────────────────

  it('backfills chain/network on expenses', async () => {
    await seedV10000(
      [], [],
      [
        {
          id: 1,
          shopId: 1,
          category: 'rent',
          amount: 1000,
          date: new Date('2025-06-01'),
          cluster: 'mainnet-beta',
          createdAt: new Date(),
        },
      ],
    );

    const db = openRealDb();
    await db.open();
    const expenses: any[] = await db.table('expenses').toArray();
    expect(expenses).toHaveLength(1);
    const e = expenses[0];
    expect(e.chain).toBe('solana');
    expect(e.network).toBe('mainnet-beta');
    db.close();
  });

  it('defaults expense network to devnet when cluster missing', async () => {
    await seedV10000(
      [], [],
      [
        {
          id: 1,
          shopId: 1,
          category: 'supplies',
          amount: 50,
          date: new Date(),
          createdAt: new Date(),
        },
      ],
    );

    const db = openRealDb();
    await db.open();
    const expenses: any[] = await db.table('expenses').toArray();
    expect(expenses[0].chain).toBe('solana');
    expect(expenses[0].network).toBe('devnet');
    db.close();
  });

  // ── 5. Idempotency ──────────────────────────────────────────────────────

  it('is idempotent — running upgrade twice does not corrupt data', async () => {
    await seedV10000(
      [
        {
          id: 1,
          name: 'Idem Shop',
          username: 'idem',
          tipPresets: [1],
          reserveAllocationEnabled: false,
          charityEnabled: false,
          charityPartners: [],
          merchantWallet: 'sol-wallet',
          cluster: 'devnet',
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        {
          id: 400,
          shopId: 1,
          status: 'confirmed',
          subtotal: 42,
          tip: 3,
          tipPercent: 7,
          tax: 2,
          charity: 1,
          total: 48,
          items: [],
          paymentChain: 'solana',
          cluster: 'devnet',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        {
          id: 1,
          shopId: 1,
          category: 'rent',
          amount: 500,
          date: new Date(),
          cluster: 'devnet',
          createdAt: new Date(),
        },
      ],
    );

    // First open — triggers upgrade
    const db1 = openRealDb();
    await db1.open();
    db1.close();

    // Second open — upgrade runs again, idempotency guards should bail
    const db2 = openRealDb();
    await db2.open();

    const shops: any[] = await db2.table('shops').toArray();
    expect(shops).toHaveLength(1);
    expect(shops[0].chain).toBe('solana');
    expect(shops[0].supportedChains).toContain('solana');

    const orders: any[] = await db2.table('orders').toArray();
    expect(orders).toHaveLength(1);
    expect(orders[0].chain).toBe('solana');
    expect(orders[0].subtotalBase).toBe('42000000');
    expect(orders[0].tax).toBeUndefined();
    expect(orders[0].reserve).toBe(2);

    const expenses: any[] = await db2.table('expenses').toArray();
    expect(expenses).toHaveLength(1);
    expect(expenses[0].chain).toBe('solana');

    db2.close();
  });

  // ── 6. Monetary round-trip ──────────────────────────────────────────────

  it('monetary values round-trip correctly through Money class', async () => {
    await seedV10000(
      [
        {
          id: 1,
          name: 'RT Shop',
          username: 'rt',
          tipPresets: [1],
          reserveAllocationEnabled: false,
          charityEnabled: false,
          charityPartners: [],
          cluster: 'devnet',
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        {
          id: 500,
          shopId: 1,
          status: 'confirmed',
          subtotal: 99.999999,
          tip: 0.000001,
          tipPercent: 0,
          tax: 0,
          charity: 1.5,
          total: 101.5,
          items: [],
          cluster: 'devnet',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    );

    const db = openRealDb();
    await db.open();
    const orders: any[] = await db.table('orders').toArray();
    const o = orders[0];

    const rtSubt = fromBaseString(o.subtotalBase, MONEY_DECIMALS);
    expect(toDisplay(rtSubt, { maxDecimals: 6 })).toBe('99.999999');

    const rtTip = fromBaseString(o.tipBase, MONEY_DECIMALS);
    expect(toDisplay(rtTip, { maxDecimals: 6 })).toBe('0.000001');

    const rtCharity = fromBaseString(o.charityBase, MONEY_DECIMALS);
    expect(toDisplay(rtCharity)).toBe('1.5');

    const rtTotal = fromBaseString(o.totalBase, MONEY_DECIMALS);
    expect(toDisplay(rtTotal)).toBe('101.5');

    db.close();
  });

  // ── 7. All-zero monetary values ─────────────────────────────────────────

  it('handles all-zero monetary values', async () => {
    await seedV10000(
      [
        {
          id: 1,
          name: 'Zero Shop',
          username: 'zero',
          tipPresets: [],
          reserveAllocationEnabled: false,
          charityEnabled: false,
          charityPartners: [],
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        {
          id: 600,
          shopId: 1,
          status: 'draft',
          subtotal: 0,
          tip: 0,
          tipPercent: 0,
          tax: 0,
          charity: 0,
          total: 0,
          items: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    );

    const db = openRealDb();
    await db.open();
    const orders: any[] = await db.table('orders').toArray();
    const o = orders[0];
    expect(o.subtotalBase).toBe('0');
    expect(o.tipBase).toBe('0');
    expect(o.reserveBase).toBe('0');
    expect(o.charityBase).toBe('0');
    expect(o.totalBase).toBe('0');
    db.close();
  });

  // ── 8. Schema indexes ───────────────────────────────────────────────────

  it('has the new chain/network indexed fields on shops, orders, expenses', async () => {
    await seedV10000(
      [
        {
          id: 1,
          name: 'Idx Shop',
          username: 'idx',
          tipPresets: [1],
          reserveAllocationEnabled: false,
          charityEnabled: false,
          charityPartners: [],
          cluster: 'devnet',
          isDemo: false,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
      ],
      [
        {
          id: 700,
          shopId: 1,
          status: 'confirmed',
          subtotal: 10,
          tip: 1,
          tipPercent: 10,
          tax: 0.5,
          charity: 0,
          total: 11.5,
          items: [],
          cluster: 'devnet',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
      ],
      [
        {
          id: 1,
          shopId: 1,
          category: 'supplies',
          amount: 100,
          date: new Date('2025-01-01'),
          cluster: 'devnet',
          createdAt: new Date('2025-01-01'),
        },
      ],
    );

    const db = openRealDb();
    await db.open();

    const solShops = await db.table('shops').where('chain').equals('solana').toArray();
    expect(solShops).toHaveLength(1);

    const solOrders = await db.table('orders').where('chain').equals('solana').toArray();
    expect(solOrders).toHaveLength(1);

    const solExpenses = await db.table('expenses').where('chain').equals('solana').toArray();
    expect(solExpenses).toHaveLength(1);

    const devShops = await db.table('shops').where('network').equals('devnet').toArray();
    expect(devShops).toHaveLength(1);

    db.close();
  });
});
