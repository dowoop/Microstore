import { db, type Order } from '@/lib/db';
import { useAppStore } from '@/lib/store';

/** USDC devnet mint — matches the known token in solanaTokens.ts */
const USDC_DEVNET_MINT = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';

/** Throwaway devnet merchant wallet. Not a real keypair — demo only. */
const DEMO_MERCHANT_WALLET = '2uVfLpMdaLaKx9dAXV7UjqML1j7VxPfM7gJDi9bjNwXX';

const CUSTOMER_NAMES = [
  'Alice Chen',
  'Bob Martinez',
  'Carol Nguyen',
  'Dave Kim',
  'Eva Johansson',
  'Frank Osei',
  'Grace Patel',
  'Hector Ruiz',
  'Iris Tanaka',
  'Jake Miller',
  'Karen Davis',
  'Leo Andersson',
  'Maria Silva',
  'Nate Brown',
  'Olivia Park',
  'Paul Wilson',
  'Quinn Taylor',
  'Rosa Garcia',
  'Sam Lee',
  'Tina Wright',
];

export interface DemoItem {
  name: string;
  price: number;
  stock: number;
}

const DEMO_ITEMS: DemoItem[] = [
  { name: 'Espresso', price: 3.5, stock: 50 },
  { name: 'Latte', price: 4.5, stock: 30 },
  { name: 'Cappuccino', price: 4.75, stock: 25 },
  { name: 'Americano', price: 3.75, stock: 35 },
  { name: 'Cold Brew', price: 4.25, stock: 20 },
  { name: 'Croissant', price: 5.0, stock: 18 },
  { name: 'Blueberry Muffin', price: 4.0, stock: 15 },
  { name: 'Bagel & Cream Cheese', price: 5.5, stock: 12 },
];

/**
 * Generate a pseudo-random float in [min, max] without importing crypto.
 * Uses a simple seeded LCG for deterministic demo content.
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * Seed a demo shop ("Demo Coffee") with 8 items and 20 orders.
 * Only seeds if no shops exist in Dexie yet.
 * Returns the new shop ID, or null if shops already exist.
 */
export async function seedDemoShop(): Promise<number | null> {
  const existingCount = await db.shops.count();
  if (existingCount > 0) return null;

  const rand = seededRandom(42);
  const now = new Date();

  const shopId = (await db.shops.add({
    name: 'Demo Coffee',
    username: 'demo-coffee',
    tipPresets: [0, 10, 15, 20],
    reserveAllocationEnabled: false,
    reserveRate: 0,
    taxRate: 0,
    taxLabel: 'Sales Tax',
    charityEnabled: false,
    charityPartners: [],
    merchantWallet: DEMO_MERCHANT_WALLET,
    acceptedTokens: [
      {
        mint: USDC_DEVNET_MINT,
        symbol: 'USDC',
        decimals: 6,
        name: 'USD Coin (Devnet)',
      },
    ],
    splTokenMint: USDC_DEVNET_MINT,
    splTokenSymbol: 'USDC',
    isDemo: true,
    createdAt: now,
    updatedAt: now,
  })) as number;

  // ── Seed 8 items ──────────────────────────────────────────────────
  for (const item of DEMO_ITEMS) {
    await db.items.add({
      shopId,
      type: 'product',
      name: item.name,
      price: item.price,
      stock: item.stock,
      status: 'live',
      listingRules: { enabled: false },
      createdAt: now,
      updatedAt: now,
    });
  }

  // ── Seed 20 fake orders over the past 5 days ─────────────────────
  for (let i = 0; i < 20; i++) {
    const daysAgo = Math.floor((19 - i) / 4); // spread across 5 days
    const orderDate = new Date(now);
    orderDate.setDate(orderDate.getDate() - daysAgo);
    orderDate.setHours(6 + Math.floor(rand() * 12)); // 6am-6pm
    orderDate.setMinutes(Math.floor(rand() * 60));

    // Pick 1-3 random items
    const itemCount = 1 + Math.floor(rand() * 3);
    const picked: { name: string; price: number }[] = [];
    for (let j = 0; j < itemCount; j++) {
      const demoItem = pickRandom(DEMO_ITEMS, rand);
      if (!picked.find((p) => p.name === demoItem.name)) {
        picked.push({ name: demoItem.name, price: demoItem.price });
      }
    }
    if (picked.length === 0) {
      picked.push({ name: DEMO_ITEMS[0].name, price: DEMO_ITEMS[0].price });
    }

    const orderItems = picked.map((pi) => ({
      name: pi.name,
      price: pi.price,
      quantity: 1 + Math.floor(rand() * 2), // 1-2 qty
      itemId: 0, // demo — no real item link needed
    }));

    const subtotal = orderItems.reduce((sum, oi) => sum + oi.price * oi.quantity, 0);
    const tipPercent = pickRandom([0, 10, 15, 20], rand);
    const tip = Math.round(subtotal * (tipPercent / 100) * 100) / 100;
    const reserve = 0;
    const charity = 0;
    const total = Math.round((subtotal + tip) * 100) / 100;

    // ~80% paid, 15% pending, 5% cancelled
    const statusRoll = rand();
    const status: Order['status'] =
      statusRoll < 0.8 ? 'paid' : statusRoll < 0.95 ? 'pending' : 'cancelled';

    await db.orders.add({
      shopId,
      customerName: pickRandom(CUSTOMER_NAMES, rand),
      status,
      subtotal,
      tip,
      tipPercent,
      reserve,
      charity,
      total,
      items: orderItems.map((oi, idx) => ({
        name: oi.name,
        price: oi.price,
        quantity: oi.quantity,
        itemId: idx + 1, // maps to item indices for demo
      })),
      createdAt: orderDate,
      updatedAt: orderDate,
      tax: 0, // deprecated but required by type
    });
  }

  useAppStore.getState().setActiveShopId(shopId);
  return shopId;
}

/**
 * Clear all demo data — deletes every shop marked isDemo, plus their items,
 * orders, expenses, and customers. Resets activeShopId to null and reloads
 * the page to start fresh.
 */
export async function clearDemoData(): Promise<void> {
  const demoShops = await db.shops.where('isDemo').equals(1).toArray();
  const demoShopIds = demoShops.map((s) => s.id);

  if (demoShopIds.length === 0) return;

  // Delete all related data for each demo shop
  for (let i = 0; i < demoShopIds.length; i++) {
    const sid = demoShopIds[i];
    await db.items.where('shopId').equals(sid).delete();
    await db.orders.where('shopId').equals(sid).delete();
    await db.expenses.where('shopId').equals(sid).delete();
    await db.customers.where('shopId').equals(sid).delete();
    await db.cartDrafts.where('shopId').equals(sid).delete();
    await db.shops.delete(sid);
  }

  useAppStore.getState().setActiveShopId(null);

  // Reload to reset all live queries and UI state
  window.location.reload();
}
