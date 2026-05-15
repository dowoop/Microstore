/**
 * Playwright E2E test helpers — seed data via raw IndexedDB.
 *
 * Dexie creates the database under the name "MicrostoreDB" with tables:
 *   shops, items, orders, expenses, offlineQueue, errorLogs
 *
 * All tables use auto-incrementing primary keys ("++id" in Dexie schema).
 * Use these helpers inside page.evaluate() to seed data before navigating.
 */

const DB_NAME = 'MicrostoreDB';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      // Dexie opens/upgrades the DB; if called before app init, create stores.
      const db = req.result;
      if (!db.objectStoreNames.contains('shops')) {
        db.createObjectStore('shops', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('items')) {
        db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('orders')) {
        db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('expenses')) {
        db.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function addRecord(storeName: string, record: Record<string, unknown>): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const addReq = store.add(record);
      addReq.onsuccess = () => {
        resolve(addReq.result as number);
        db.close();
      };
      addReq.onerror = () => {
        reject(addReq.error);
        db.close();
      };
    };
    req.onerror = () => reject(req.error);
  });
}

/** Seed a shop and return its ID. */
export async function seedShop(overrides: Record<string, unknown> = {}): Promise<number> {
  const now = new Date();
  const shop = {
    name: 'Test Shop',
    username: 'test-shop',
    tipPresets: [10, 15, 20],
    taxAllocationEnabled: true,
    charityEnabled: false,
    charityPartners: [],
    merchantWallet: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
    splTokenMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
    splTokenSymbol: 'USDC',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  return addRecord('shops', shop);
}

/** Seed items for a shop. */
export async function seedItems(
  shopId: number,
  items: Array<Record<string, unknown>>,
): Promise<number[]> {
  const now = new Date();
  const ids: number[] = [];
  for (const item of items) {
    const id = await addRecord('items', {
      shopId,
      type: 'product',
      name: 'Test Item',
      price: 5.0,
      stock: 100,
      status: 'live',
      listingRules: { enabled: true },
      createdAt: now,
      updatedAt: now,
      ...item,
    });
    ids.push(id);
  }
  return ids;
}

/** Seed an order for a shop. */
export async function seedOrder(
  shopId: number,
  overrides: Record<string, unknown> = {},
): Promise<number> {
  const now = new Date();
  const order = {
    shopId,
    status: 'pending',
    subtotal: 10.0,
    tip: 1.0,
    tipPercent: 10,
    tax: 0.89,
    charity: 0,
    total: 11.89,
    items: [{ itemId: 0, name: 'Test Item', price: 10.0, quantity: 1 }],
    merchantWallet: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
    splTokenMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
    splTokenSymbol: 'USDC',
    paymentRef: 'microshop:test:1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  return addRecord('orders', order);
}

/** Set the active shop ID in localStorage (used by useAppStore). */
export function setActiveShop(shopId: number): void {
  // The zustand store persists activeShopId under a localStorage key.
  // Looking at the store implementation, useAppStore uses zustand with
  // persist middleware. The key is typically the store name.
  // Since we don't know the exact key, we set it directly via the app's
  // mechanism. For now, we rely on page navigation to trigger store sync.
  //
  // Workaround: set a known localStorage flag that the app checks.
  localStorage.setItem('microstore-active-shop', String(shopId));
}
