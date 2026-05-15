import Dexie, { type EntityTable } from 'dexie';

export interface Shop {
  id: number;
  name: string;
  username: string;           // @ slug — unique per shop
  photoUrl?: string;          // object URL from file upload
  description?: string;       // one-line tagline
  tipPresets: number[];       // e.g. [0, 10, 15, 20]
  taxAllocationEnabled: boolean;
  charityEnabled: boolean;
  charityPartners: string[];  // e.g. ["GiveDirectly", "Local Food Bank"]
  // Solana wallet addresses for atomic split
  merchantWallet?: string;    // merchant public key (base58)
  taxWallet?: string;         // tax authority public key
  charityWallet?: string;     // charity public key
  splTokenMint?: string;      // SPL token mint address
  splTokenSymbol?: string;    // e.g. "USDC"
  // legacy / optional
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ItemType = 'product' | 'service';
export type ItemStatus = 'live' | 'draft';

export interface ListingRules {
  enabled: boolean;
  // v1: rules UI is disabled; placeholder for future rule conditions
  conditions?: unknown[];
}

export interface Item {
  id: number;
  shopId: number;
  type: ItemType;
  name: string;
  description?: string;       // rich text (basic HTML)
  price: number;
  cost?: number;
  sku?: string;
  barcode?: string;
  stock: number;
  lowStockThreshold?: number;  // warn when stock <= this value
  category?: string;
  status: ItemStatus;
  photoUrl?: string;           // object URL from file upload
  payUpfrontTemplate?: string; // service-type items: pay-upfront description
  listingRules: ListingRules;  // v1 disabled
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: number;
  shopId: number;
  customerName?: string;
  customerPhone?: string;
  status: 'pending' | 'paid' | 'shipped' | 'cancelled';
  subtotal: number;
  tip: number;
  tipPercent: number;
  tax: number;
  charity: number;
  total: number;
  discount?: number;
  items: OrderItem[];
  // Solana transaction info
  txSignature?: string;         // umbrella signature
  merchantTxSignature?: string; // merchant split signature
  taxTxSignature?: string;      // tax split signature
  charityTxSignature?: string;  // charity split signature
  paymentRef?: string;
  // Wallet addresses used for this payment (snapshot at time of checkout)
  merchantWallet?: string;
  taxWallet?: string;
  charityWallet?: string;
  splTokenMint?: string;
  splTokenSymbol?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  itemId: number;
  name: string;
  price: number;
  quantity: number;
}

export interface Expense {
  id: number;
  shopId: number;
  category: string;
  amount: number;
  description?: string;
  date: Date;
  createdAt: Date;
}

export interface OfflineQueueEntry {
  id?: number;
  orderData: Omit<Order, 'id'>;
  createdAt: Date;
  attempts: number;
  status: 'pending' | 'processing' | 'failed';
  lastError?: string;
}

export interface ErrorLogEntry {
  id?: number;
  timestamp: Date;
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  context?: string; // JSON-serialized extra context
}

class MicrostoreDB extends Dexie {
  shops!: EntityTable<Shop, 'id'>;
  items!: EntityTable<Item, 'id'>;
  orders!: EntityTable<Order, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  offlineQueue!: EntityTable<OfflineQueueEntry, 'id'>;
  errorLogs!: EntityTable<ErrorLogEntry, 'id'>;

  constructor() {
    super('MicrostoreDB');
    this.version(1).stores({
      shops: '++id, name, username, createdAt',
      items: '++id, shopId, name, category, sku, barcode, createdAt',
      orders: '++id, shopId, status, createdAt',
      expenses: '++id, shopId, category, date',
    });
    // v2: added wallet address fields to Shops + tx fields to Orders
    this.version(2).stores({
      shops: '++id, name, username, merchantWallet, createdAt',
      items: '++id, shopId, name, category, sku, barcode, createdAt',
      orders: '++id, shopId, status, txSignature, createdAt',
      expenses: '++id, shopId, category, date',
    });
    // v3: added tip, charity, subtotal, per-split tx signatures to Orders + offlineQueue
    this.version(3).stores({
      shops: '++id, name, username, merchantWallet, createdAt',
      items: '++id, shopId, name, category, sku, barcode, createdAt',
      orders: '++id, shopId, status, txSignature, merchantTxSignature, createdAt',
      expenses: '++id, shopId, category, date',
      offlineQueue: '++id, status, createdAt',
    });
    // v4: added error log for client-side error tracking
    this.version(4).stores({
      shops: '++id, name, username, merchantWallet, createdAt',
      items: '++id, shopId, name, category, sku, barcode, createdAt',
      orders: '++id, shopId, status, txSignature, merchantTxSignature, createdAt',
      expenses: '++id, shopId, category, date',
      offlineQueue: '++id, status, createdAt',
      errorLogs: '++id, timestamp',
    });
  }
}

export const db = new MicrostoreDB();

// ---------------------------------------------------------------------------
// IndexedDB health check — detects browser cache wipes
// ---------------------------------------------------------------------------

const DB_INITIALIZED_KEY = 'microstore-db-initialized';

/**
 * Call this after the first successful write to IndexedDB.
 * Sets a localStorage flag so we can detect a future cache wipe.
 */
export function markDbInitialized(): void {
  try {
    localStorage.setItem(DB_INITIALIZED_KEY, '1');
  } catch {
    // localStorage unavailable (private browsing, quota exceeded) — ignore
  }
}

/**
 * Returns true if the DB was previously populated but now has no shops.
 * This indicates the browser cache was wiped (IndexedDB cleared) and the
 * user should be prompted to restore from a JSON backup.
 */
export async function isDbPossiblyWiped(): Promise<boolean> {
  try {
    const wasInitialized = localStorage.getItem(DB_INITIALIZED_KEY) === '1';
    if (!wasInitialized) return false;

    const shopCount = await db.shops.count();
    return shopCount === 0;
  } catch {
    return false;
  }
}