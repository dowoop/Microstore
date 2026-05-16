import Dexie, { type EntityTable } from 'dexie';
import type { OrderStatus } from '@/lib/txLifecycle';

export type { OrderStatus } from '@/lib/txLifecycle';

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export interface AcceptedToken {
  mint: string;
  symbol: string;
  decimals?: number;
  name?: string;
  logoURI?: string;
}

export interface Shop {
  id: number;
  name: string;
  username: string;
  photoUrl?: Blob;
  description?: string;
  tipPresets: number[];
  /** Whether tax is collected/displayed on POS orders. */
  taxEnabled: boolean;
  /** Per-shop tax rate (decimal, e.g. 0.08875 for 8.875%). Validated [0, 1]. */
  taxRate: number;
  /** Display label for tax line item (e.g. "Sales Tax", "VAT", "GST"). */
  taxLabel: string;
  /** US region code (e.g. "NY") used to pick a default tax rate; "__custom__" for manual entry. */
  taxRegion?: string;
  /** Wallet address for funds set aside for tax remittance. */
  taxSetAsideWallet?: string;
  charityEnabled: boolean;
  charityPartners: string[];
  merchantWallet?: string;
  charityWallet?: string;
  splTokenMint?: string;
  splTokenSymbol?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
  acceptedTokens?: AcceptedToken[];
  tariWallet?: string;
  tariNetwork?: 'igor' | 'mainnet';
  tariAcceptedTokens?: { symbol: string; assetId?: string; resourceAddress?: string }[];
  isDemo?: boolean;
  cluster?: 'devnet' | 'mainnet-beta';
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
  notifyLowStock?: boolean;
  category?: string;
  status: ItemStatus;
  photoUrl?: Blob;
  payUpfrontTemplate?: string;
  listingRules: ListingRules;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  itemId: number;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: number;
  shopId: number;
  status: OrderStatus;
  subtotal: number;
  tip: number;
  tipPercent: number;
  tax: number;
  /** Snapshot of shop.taxRate at time of sale — for receipt rendering. */
  taxRate?: number;
  /** Snapshot of shop.taxLabel at time of sale — for receipt rendering. */
  taxLabel?: string;
  charity: number;
  total: number;
  discount?: number;
  items: OrderItem[];
  txSignature?: string;
  /** @deprecated Phase 0 uses atomic single-tx — only `txSignature` is written. Retained for legacy data display. */
  merchantTxSignature?: string;
  /** @deprecated Phase 0 uses atomic single-tx — only `txSignature` is written. Retained for legacy data display. */
  taxTxSignature?: string;
  /** @deprecated Phase 0 uses atomic single-tx — only `txSignature` is written. Retained for legacy data display. */
  charityTxSignature?: string;
  tariTransactionId?: string;
  paymentChain?: 'solana' | 'tari';
  tariTokenSymbol?: string;
  tariTokenResourceAddress?: string;
  paymentRef?: string;
  /** Solana Pay reference public key (base58). Generated at order creation for on-chain transaction discovery. */
  referencePubkey?: string;
  duplicateTxIds?: string[];
  merchantWallet?: string;
  taxSetAsideWallet?: string;
  charityWallet?: string;
  splTokenMint?: string;
  splTokenSymbol?: string;
  confirmedAt?: Date;
  failedReason?: string;
  lastAttemptAt?: Date;
  viewedAt?: Date;
  expiresAt?: Date;
  cluster?: 'devnet' | 'mainnet-beta';
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: number;
  shopId: number;
  category: string;
  amount: number;
  description?: string;
  date: Date;
  cluster?: 'devnet' | 'mainnet-beta';
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

export interface CartDraft {
  id?: number;
  shopId: number;
  items: CartDraftItem[];
  updatedAt: number;
}

export interface CartDraftItem {
  itemId: number;
  name: string;
  price: number;
  quantity: number;
}

// ---------------------------------------------------------------------------
// Schema v5 — Phase 0 consolidation.
// See docs/MIGRATION-v5.md for the history of how we got here.
//
// Existing local data from the legacy 10000–10005 versions is NOT migrated —
// the version numbers were bumped backwards, so Dexie will throw VersionError
// on open. Solution: clear IndexedDB once (DevTools → Application → Storage).
// ---------------------------------------------------------------------------

class MicrostoreDB extends Dexie {
  shops!: EntityTable<Shop, 'id'>;
  items!: EntityTable<Item, 'id'>;
  orders!: EntityTable<Order, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  offlineQueue!: EntityTable<OfflineQueueEntry, 'id'>;
  errorLogs!: EntityTable<ErrorLogEntry, 'id'>;
  cartDrafts!: EntityTable<CartDraft, 'id'>;

  constructor() {
    super('MicrostoreDB');
    this.version(5).stores({
      shops: '++id, name, username, cluster, createdAt',
      items: '++id, shopId, name, category, sku, barcode, createdAt',
      orders:
        '++id, shopId, status, paymentChain, cluster, txSignature, paymentRef, referencePubkey, createdAt',
      expenses: '++id, shopId, category, cluster, date',
      offlineQueue: '++id, status, createdAt',
      errorLogs: '++id, timestamp',
      cartDrafts: '++id, shopId, updatedAt',
    });
  }
}

export const db = new MicrostoreDB();

// Expose db on `window` for Playwright tests. Same connection, no races.
// In production this is a harmless dev hook; the app never reads it.
if (typeof window !== 'undefined') {
  (window as unknown as { __dexie: MicrostoreDB }).__dexie = db;
}

// ---------------------------------------------------------------------------
// DB initialization tracking — used by db-health-banner to detect wipe.
// ---------------------------------------------------------------------------

const DB_INITIALIZED_KEY = 'microstore-db-initialized';

export function markDbInitialized(): void {
  try {
    localStorage.setItem(DB_INITIALIZED_KEY, '1');
  } catch {}
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
