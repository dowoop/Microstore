import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enqueueOrder, processOfflineQueue, getQueueSize } from '../lib/offlineQueue';
import { db } from '../lib/db';

describe('offlineQueue', () => {
  beforeEach(async () => {
    await db.offlineQueue.clear();
  });

  afterEach(async () => {
    await db.offlineQueue.clear();
  });

  it('enqueueOrder adds an entry to the offline queue', async () => {
    const orderData = {
      shopId: 1,
      status: 'pending' as const,
      subtotal: 50,
      tip: 5,
      tipPercent: 10,
      tax: 4.44,
      charity: 0,
      total: 59.44,
      items: [{ itemId: 1, name: 'Coffee', price: 10, quantity: 5 }],
      merchantWallet: 'abc123',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const queueId = await enqueueOrder(orderData);
    expect(queueId).toBeGreaterThan(0);

    const entry = await db.offlineQueue.get(queueId);
    expect(entry).toBeDefined();
    expect(entry!.status).toBe('pending');
    expect(entry!.attempts).toBe(0);
    expect(entry!.orderData.total).toBe(59.44);
  });

  it('getQueueSize returns correct count of pending entries', async () => {
    const orderBase = {
      shopId: 1,
      status: 'pending' as const,
      subtotal: 10,
      tip: 1,
      tipPercent: 10,
      tax: 0.89,
      charity: 0,
      total: 11.89,
      items: [],
      merchantWallet: 'abc',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(await getQueueSize()).toBe(0);

    await enqueueOrder({ ...orderBase, total: 11 });
    await enqueueOrder({ ...orderBase, total: 22 });
    await enqueueOrder({ ...orderBase, total: 33 });

    expect(await getQueueSize()).toBe(3);
  });

  it('processOfflineQueue processes pending entries', async () => {
    const orderData = {
      shopId: 1,
      status: 'pending' as const,
      subtotal: 20,
      tip: 2,
      tipPercent: 10,
      tax: 1.78,
      charity: 0,
      total: 23.78,
      items: [{ itemId: 2, name: 'Latte', price: 20, quantity: 1 }],
      merchantWallet: 'def456',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await enqueueOrder(orderData);
    expect(await getQueueSize()).toBe(1);

    const result = await processOfflineQueue();
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(await getQueueSize()).toBe(0);
  });

  it('processOfflineQueue handles empty queue gracefully', async () => {
    const result = await processOfflineQueue();
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('enqueueOrder stores the full order data for later sync', async () => {
    const fullOrder = {
      shopId: 2,
      status: 'pending' as const,
      subtotal: 100,
      tip: 15,
      tipPercent: 15,
      tax: 8.88,
      charity: 0.12,
      total: 124,
      items: [
        { itemId: 10, name: 'T-shirt', price: 50, quantity: 2 },
      ],
      merchantWallet: 'merchant123',
      taxWallet: 'tax456',
      charityWallet: 'charity789',
      splTokenMint: 'mint111',
      splTokenSymbol: 'USDC',
      paymentRef: 'ref-test',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };

    const queueId = await enqueueOrder(fullOrder);
    const stored = await db.offlineQueue.get(queueId);

    expect(stored!.orderData).toEqual(fullOrder);
  });
});
