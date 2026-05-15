import Dexie, { type EntityTable } from 'dexie';
import type { OrderStatus } from '@/lib/txLifecycle';

// Re-export for convenience so callers can `import { OrderStatus } from '@/lib/db'`.
export type { OrderStatus } from '@/lib/txLifecycle';

export interface Shop {
  id: number;
  name: string;
  username: string;
  photoUrl?: string;
  description?: string;
  tipPresets: number[];
  taxAllocationEnabled: boolean;
  charityEnabled: boolean;
  charityPartners: string[];
  merchantWallet?: string;
  taxWallet?: string;
  charityWallet?: string;
  splTokenMint?: string;
  splTokenSymbol?: string;
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
  conditions?: unknown[];
}

export interface Item {
  id: number;
  shopId: number;
  type: ItemType;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  sku?: string;
  barcode?: string;
  stock: number;
  lowStockThreshold?: number;
  category?: string;
  status: ItemStatus;
  photoUrl?: string;
  payUpfrontTemplate?: string;
  listingRules: ListingRules;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: number;
  shopId: number;
  customerName?: string;
  customerPhone?: string;
  status: OrderStatus;
  subtotal: number;
  tip: number;
  tipPercent: number;
  tax: number;
  charity: number;
  total: number;
  discount?: number;
  items: OrderItem[];
  txSignature?: string;
  merchantTxSignature?: string;
  taxTxSignature?: string;
  charityTxSignature?: string;
  paymentRef?: string;
  merchantWallet?: string;
  taxWallet?: string;
  charityWallet?: string;
  splTokenMint?: string;
  splTokenSymbol?: string;
  confirmedAt?: Date;
  failedReason?: string;
  lastAttemptAt?: Date;
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
  shopId: number;
  orderData: Omit<Order, 'id'>;
  status: 'pending' | 'processing' | 'syncing' | 'synced' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: Date;
  attemptedAt?: Date;
}

export interface ErrorLogEntry {
  id?: number;
  timestamp: Date;
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  context?: string;
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

    // Single-version schema — all tables and indexes in one place.
    // Prior versions (v1–v400) were accidental bumps from worker migrations;
    // this v9999 catch-all owns the schema at any version so Dexie never
    // blocks on an unknown upgrade.
    this.version(9999).stores({
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

export function markDbInitialized(): void {
  try {
    localStorage.setItem(DB_INITIALIZED_KEY, '1');
  } catch {
    // localStorage unavailable (private browsing, quota exceeded) — ignore
  }
}

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