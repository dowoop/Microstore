import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/lib/db';

describe('customers table', () => {
  beforeEach(async () => { await db.delete(); await db.open(); });

  it('creates a customer', async () => {
    const id = await db.customers.add({ shopId: 1, name: 'Alice', phone: '555-0100', createdAt: new Date() });
    expect(id).toBeGreaterThan(0);
    expect((await db.customers.get(id))!.name).toBe('Alice');
  });

  it('finds by shop', async () => {
    await db.customers.bulkAdd([
      { shopId: 1, name: 'Alice', createdAt: new Date() },
      { shopId: 2, name: 'Bob', createdAt: new Date() },
    ]);
    expect(await db.customers.where('shopId').equals(1).count()).toBe(1);
  });

  it('updates notes', async () => {
    const id = await db.customers.add({ shopId: 1, name: 'Alice', createdAt: new Date() });
    await db.customers.update(id, { notes: 'Likes oat milk' });
    expect((await db.customers.get(id))!.notes).toBe('Likes oat milk');
  });
});

describe('order-customer linking', () => {
  beforeEach(async () => { await db.delete(); await db.open(); });

  it('links via customerId', async () => {
    const cid = await db.customers.add({ shopId: 1, name: 'Alice', createdAt: new Date() });
    const oid = await db.orders.add({
      shopId: 1, customerId: cid, customerName: 'Alice',
      status: 'pending', subtotal: 10, tip: 0, tipPercent: 0, tax: 0, charity: 0, total: 10,
      items: [{ itemId: 1, name: 'Item', price: 10, quantity: 1 }],
      createdAt: new Date(), updatedAt: new Date(),
    });
    expect((await db.orders.get(oid))!.customerId).toBe(cid);
  });

  it('computes total spent', async () => {
    const cid = await db.customers.add({ shopId: 1, name: 'Bob', createdAt: new Date() });
    await db.orders.bulkAdd([
      { id: 1, shopId: 1, customerId: cid, status: 'paid', subtotal: 20, tip: 0, tipPercent: 0, tax: 0, charity: 0, total: 20, items: [], createdAt: new Date(), updatedAt: new Date() },
      { id: 2, shopId: 1, customerId: cid, status: 'paid', subtotal: 30, tip: 0, tipPercent: 0, tax: 0, charity: 0, total: 30, items: [], createdAt: new Date(), updatedAt: new Date() },
      { id: 3, shopId: 1, customerId: cid, status: 'cancelled', subtotal: 5, tip: 0, tipPercent: 0, tax: 0, charity: 0, total: 5, items: [], createdAt: new Date(), updatedAt: new Date() },
    ]);
    const orders = await db.orders.where('customerId').equals(cid).toArray();
    const completed = orders.filter((o: any) => o.status !== 'cancelled');
    expect(completed.length).toBe(2);
    expect(completed.reduce((s: number, o: any) => s + o.total, 0)).toBe(50);
  });
});
