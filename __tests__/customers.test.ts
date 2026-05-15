import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { db, type Customer, type Order } from '@/lib/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 1,
    shopId: 1,
    name: 'Alice Johnson',
    phone: '555-0100',
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    shopId: 1,
    customerName: 'Alice Johnson',
    customerPhone: '555-0100',
    status: 'pending',
    subtotal: 10,
    tip: 1,
    tipPercent: 10,
    tax: 0.89,
    charity: 0,
    total: 11.89,
    items: [{ itemId: 1, name: 'Latte', price: 5, quantity: 2 }],
    createdAt: new Date('2025-03-01'),
    updatedAt: new Date('2025-03-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('customers table', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates a customer', async () => {
    const id = await db.customers.add({
      shopId: 1,
      name: 'Alice Johnson',
      phone: '555-0100',
      createdAt: new Date(),
    });
    expect(id).toBeGreaterThan(0);

    const customer = await db.customers.get(id);
    expect(customer).toBeDefined();
    expect(customer!.name).toBe('Alice Johnson');
    expect(customer!.phone).toBe('555-0100');
  });

  it('finds customers by shop', async () => {
    await db.customers.bulkAdd([
      { shopId: 1, name: 'Alice', phone: '555-0100', createdAt: new Date() },
      { shopId: 1, name: 'Bob', phone: '555-0200', createdAt: new Date() },
      { shopId: 2, name: 'Charlie', phone: '555-0300', createdAt: new Date() },
    ]);

    const shop1 = await db.customers.where('shopId').equals(1).toArray();
    expect(shop1).toHaveLength(2);

    const shop2 = await db.customers.where('shopId').equals(2).toArray();
    expect(shop2).toHaveLength(1);
    expect(shop2[0].name).toBe('Charlie');
  });

  it('searches by name', async () => {
    await db.customers.bulkAdd([
      { shopId: 1, name: 'Alice Johnson', phone: '555-0100', createdAt: new Date() },
      { shopId: 1, name: 'Bob Smith', phone: '555-0200', createdAt: new Date() },
      { shopId: 1, name: 'Alicia Brown', phone: '555-0300', createdAt: new Date() },
    ]);

    const matches = await db.customers
      .where('shopId')
      .equals(1)
      .filter((c) => c.name.toLowerCase().includes('ali'))
      .toArray();
    expect(matches).toHaveLength(2);
  });

  it('searches by phone', async () => {
    await db.customers.bulkAdd([
      { shopId: 1, name: 'Alice', phone: '555-0100', createdAt: new Date() },
      { shopId: 1, name: 'Bob', phone: '555-0200', createdAt: new Date() },
    ]);

    const matches = await db.customers
      .where('shopId')
      .equals(1)
      .filter((c) => c.phone?.includes('0100'))
      .toArray();
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('Alice');
  });

  it('updates customer notes', async () => {
    const id = await db.customers.add({
      shopId: 1,
      name: 'Alice',
      phone: '555-0100',
      createdAt: new Date(),
    });

    await db.customers.update(id, { notes: 'Likes oat milk. Prefers contactless.' });
    const customer = await db.customers.get(id);
    expect(customer!.notes).toBe('Likes oat milk. Prefers contactless.');
  });

  it('handles missing phone numbers', async () => {
    const id = await db.customers.add({
      shopId: 1,
      name: 'Walk-in',
      createdAt: new Date(),
    });

    const customer = await db.customers.get(id);
    expect(customer).toBeDefined();
    expect(customer!.phone).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Order-customer linking
// ---------------------------------------------------------------------------

describe('order-customer linking', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('links an order to a customer via customerId', async () => {
    const custId = await db.customers.add({
      shopId: 1,
      name: 'Alice',
      phone: '555-0100',
      createdAt: new Date(),
    });

    const orderId = await db.orders.add(
      makeOrder({
        customerId: custId,
        customerName: 'Alice',
        customerPhone: '555-0100',
      }),
    );

    const order = await db.orders.get(orderId);
    expect(order).toBeDefined();
    expect(order!.customerId).toBe(custId);
  });

  it('matches customer to orders by customerId', async () => {
    const custId = await db.customers.add({
      shopId: 1,
      name: 'Bob',
      phone: '555-0200',
      createdAt: new Date(),
    });

    // Create orders for this customer and another
    await db.orders.bulkAdd([
      makeOrder({
        id: 1,
        customerId: custId,
        customerName: 'Bob',
        customerPhone: '555-0200',
        total: 20,
      }),
      makeOrder({
        id: 2,
        customerId: custId,
        customerName: 'Bob',
        customerPhone: '555-0200',
        total: 30,
      }),
      makeOrder({
        id: 3,
        customerId: 999,
        customerName: 'Someone Else',
        customerPhone: '555-9999',
        total: 10,
      }),
    ]);

    const bobOrders = await db.orders
      .where('customerId')
      .equals(custId)
      .toArray();
    expect(bobOrders).toHaveLength(2);
    expect(bobOrders.reduce((s, o) => s + o.total, 0)).toBe(50);
  });

  it('computes customer stats from linked orders', async () => {
    const custId = await db.customers.add({
      shopId: 1,
      name: 'Stats Person',
      createdAt: new Date(),
    });

    // 3 orders: 2 paid ($100 total), 1 cancelled
    await db.orders.bulkAdd([
      makeOrder({
        id: 1,
        customerId: custId,
        status: 'paid',
        total: 40,
        createdAt: new Date('2025-01-01'),
      }),
      makeOrder({
        id: 2,
        customerId: custId,
        status: 'paid',
        total: 60,
        createdAt: new Date('2025-02-01'),
      }),
      makeOrder({
        id: 3,
        customerId: custId,
        status: 'cancelled',
        total: 5,
        createdAt: new Date('2025-03-01'),
      }),
    ]);

    const orders = await db.orders
      .where('customerId')
      .equals(custId)
      .toArray();

    const completed = orders.filter((o) => o.status !== 'cancelled');
    const totalSpent = completed.reduce((s, o) => s + o.total, 0);
    const firstVisit = new Date(
      Math.min(...orders.map((o) => new Date(o.createdAt).getTime())),
    );
    const lastVisit = new Date(
      Math.max(...orders.map((o) => new Date(o.createdAt).getTime())),
    );

    expect(orders).toHaveLength(3);
    expect(completed).toHaveLength(2);
    expect(totalSpent).toBe(100);
    expect(firstVisit.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(lastVisit.toISOString()).toBe('2025-03-01T00:00:00.000Z');
  });

  it('matches legacy orders by name+phone when no customerId', async () => {
    // Create a customer
    await db.customers.add({
      id: 1,
      shopId: 1,
      name: 'Legacy Person',
      phone: '555-legacy',
      createdAt: new Date(),
    });

    // Create an order with customerName/customerPhone but no customerId
    await db.orders.add(
      makeOrder({
        customerId: undefined,
        customerName: 'Legacy Person',
        customerPhone: '555-legacy',
      }),
    );

    const orders = await db.orders.where('shopId').equals(1).toArray();
    expect(orders).toHaveLength(1);

    // Simulate the matching logic from the CRM page
    const customer = (await db.customers.get(1))!;
    const matched = orders.filter(
      (o) =>
        (!o.customerId &&
          o.customerName?.toLowerCase() === customer.name.toLowerCase() &&
          o.customerPhone === customer.phone) ||
        (o.customerId && o.customerId === customer.id),
    );
    expect(matched).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Deduplication on upsert
// ---------------------------------------------------------------------------

describe('customer deduplication', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('finds existing customer by exact name+phone match', async () => {
    await db.customers.add({
      shopId: 1,
      name: 'Repeat Customer',
      phone: '555-repeat',
      createdAt: new Date(),
    });

    // Simulate upsert logic
    const existing = await db.customers
      .where('shopId')
      .equals(1)
      .filter(
        (c) =>
          c.name.toLowerCase() === 'repeat customer' &&
          c.phone === '555-repeat',
      )
      .first();

    expect(existing).toBeDefined();
    expect(existing!.name).toBe('Repeat Customer');
  });

  it('returns undefined when no match exists', async () => {
    const existing = await db.customers
      .where('shopId')
      .equals(1)
      .filter(
        (c) =>
          c.name.toLowerCase() === 'nonexistent' &&
          c.phone === '000-0000',
      )
      .first();

    expect(existing).toBeUndefined();
  });

  it('creates new customer when no match found', async () => {
    // Ensure table is empty
    const count = await db.customers.count();
    expect(count).toBe(0);

    const id = await db.customers.add({
      shopId: 1,
      name: 'New Person',
      phone: '555-new',
      createdAt: new Date(),
    });

    const customer = await db.customers.get(id);
    expect(customer).toBeDefined();
    expect(customer!.name).toBe('New Person');
  });
});
