import Dexie, { type EntityTable } from 'dexie';
import type { OrderStatus } from '@/lib/txLifecycle';
import { fromDecimalString, toBaseString } from '@/lib/money';

export type { OrderStatus } from '@/lib/txLifecycle';

export interface AcceptedToken {
  mint: string;
  symbol: string;
  decimals?: number;
  name?: string;
  logoURI?: string;
}

export type ChainId = 'solana' | 'tari' | 'lightning' | 'evm' | 'monero' | 'bitcoin';

export type NetworkId =
  | 'devnet'
  | 'mainnet-beta'
  | 'igor'
  | 'esmeralda'
  | 'mainnet'
  | 'testnet'
  | 'regtest';

export interface ChainShopConfig {
  merchantWallet?: string;
  reserveWallet?: string;
  charityWallet?: string;
  tokenMint?: string;
  tokenSymbol?: string;
  acceptedTokens?: AcceptedToken[];
  reserveRate?: number;
  reserveRegion?: string;
}

export interface Shop {
  id: number;
  name: string;
  username: string;
  photoUrl?: Blob;
  description?: string;
  tipPresets: number[];
  reserveAllocationEnabled: boolean;
  reserveRate?: number;
  reserveRegion?: string;
  charityEnabled: boolean;
  charityPartners: string[];
  merchantWallet?: string;
  reserveWallet?: string;
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
  /** Custom display label for reserve allocation (e.g. "Tax", "Savings", "Partner Share"). Default "Reserve". */
  reserveLabel?: string;
  /** v4: unified chain identifier — default 'solana' */
  chain?: ChainId;
  /** v4: unified network identifier — default 'devnet' */
  network?: NetworkId;
  /** v4: chains configured for this shop */
  supportedChains?: ChainId[];
  /** v4: per-chain wallet/config map */
  chainConfig?: Record<ChainId, ChainShopConfig>;
  /** v4: default chain for new transactions */
  defaultChain?: ChainId;
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

export interface Customer {
  id: number;
  shopId: number;
  name: string;
  phone?: string;
  notes?: string;
  createdAt: Date;
}

export type InvoiceType = 'pos' | 'invoice';

export interface Order {
  id: number;
  shopId: number;
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  status: OrderStatus;
  subtotal: number;
  tip: number;
  tipPercent: number;
  /** v4: renamed from `tax`. Default populated by migration. */
  reserve?: number;
  charity: number;
  total: number;
  discount?: number;
  items: OrderItem[];
  txSignature?: string;
  merchantTxSignature?: string;
  reserveTxSignature?: string;
  charityTxSignature?: string;
  tariTransactionId?: string;
  paymentChain?: 'solana' | 'tari';
  tariTokenSymbol?: string;
  tariTokenResourceAddress?: string;
  paymentRef?: string;
  duplicateTxIds?: string[];
  merchantWallet?: string;
  reserveWallet?: string;
  charityWallet?: string;
  splTokenMint?: string;
  splTokenSymbol?: string;
  confirmedAt?: Date;
  failedReason?: string;
  lastAttemptAt?: Date;
  invoiceNumber?: number;
  invoiceType?: InvoiceType;
  invoiceDueDate?: Date;
  invoiceNotes?: string;
  viewedAt?: Date;
  expiresAt?: Date;
  cluster?: 'devnet' | 'mainnet-beta';
  createdAt: Date;
  updatedAt: Date;
  /** v4: unified chain — default 'solana', from paymentChain */
  chain?: ChainId;
  /** v4: unified network — default 'devnet', from shop or cluster */
  network?: NetworkId;
  /** v4: base-unit subtotal string (6 decimals) */
  subtotalBase?: string;
  /** v4: base-unit tip string (6 decimals) */
  tipBase?: string;
  /** v4: base-unit reserve string (6 decimals) */
  reserveBase?: string;
  /** v4: base-unit charity string (6 decimals) */
  charityBase?: string;
  /** v4: base-unit total string (6 decimals) */
  totalBase?: string;
  /** @deprecated v4 — renamed to `reserve`. Removed from DB by migration. */
  tax: number;
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
  cluster?: 'devnet' | 'mainnet-beta';
  createdAt: Date;
  /** v4: unified chain — default 'solana' */
  chain?: ChainId;
  /** v4: unified network — default 'devnet', from cluster */
  network?: NetworkId;
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

class MicrostoreDB extends Dexie {
  shops!: EntityTable<Shop, 'id'>;
  items!: EntityTable<Item, 'id'>;
  orders!: EntityTable<Order, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  customers!: EntityTable<Customer, 'id'>;
  offlineQueue!: EntityTable<OfflineQueueEntry, 'id'>;
  errorLogs!: EntityTable<ErrorLogEntry, 'id'>;
  cartDrafts!: EntityTable<CartDraft, 'id'>;

  constructor() {
    super('MicrostoreDB');
    this.version(10000).stores({
      shops: '++id, name, username, merchantWallet, cluster, createdAt',
      items: '++id, shopId, name, category, sku, barcode, createdAt',
      orders: '++id, shopId, customerId, status, txSignature, merchantTxSignature, paymentRef, cluster, createdAt',
      expenses: '++id, shopId, category, cluster, date',
      customers: '++id, shopId, name, phone, createdAt',
      offlineQueue: '++id, status, createdAt',
      errorLogs: '++id, timestamp',
      cartDrafts: '++id, shopId, updatedAt',
    });

    // v4 — unified chain/network + BigInt base-unit monetary fields
    this.version(10001).stores({
      shops:
        '++id, name, username, chain, network, createdAt',
      items:
        '++id, shopId, name, category, sku, barcode, createdAt',
      orders:
        '++id, shopId, customerId, status, chain, network, txSignature, merchantTxSignature, paymentRef, createdAt',
      expenses:
        '++id, shopId, category, chain, network, date',
      customers:
        '++id, shopId, name, phone, createdAt',
      offlineQueue:
        '++id, status, createdAt',
      errorLogs:
        '++id, timestamp',
      cartDrafts:
        '++id, shopId, updatedAt',
    }).upgrade(async tx => {
      const MONEY_DECIMALS = 6;

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

            s.supportedChains = [] as ChainId[];
            if (s.merchantWallet) s.supportedChains.push('solana');
            if (s.tariWallet) s.supportedChains.push('tari');

            s.chainConfig = {} as Record<ChainId, ChainShopConfig>;

            const solCfg: ChainShopConfig = {};
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
              const tariCfg: ChainShopConfig = { merchantWallet: s.tariWallet };
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
          // Pre-load shops for network lookup
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

    // v5 — Blob photo persistence
    this.version(10002).stores({
      shops:        '++id, name, username, chain, network, createdAt',
      items:        '++id, shopId, name, category, sku, barcode, createdAt',
      orders:       '++id, shopId, customerId, status, chain, network, txSignature, merchantTxSignature, paymentRef, createdAt',
      expenses:     '++id, shopId, category, chain, network, date',
      customers:    '++id, shopId, name, phone, createdAt',
      offlineQueue: '++id, status, createdAt',
      errorLogs:    '++id, timestamp',
      cartDrafts:   '++id, shopId, updatedAt',
    }).upgrade(async tx => {
      // Convert existing string photoUrls to Blobs
      // blob: URLs are ephemeral and can't be fetched — they become null.
      // /path URLs or http URLs may be fetchable — attempt conversion.

      async function stringToBlob(val: any): Promise<Blob | null> {
        if (val instanceof Blob) return val;
        if (typeof val !== 'string' || !val) return null;
        if (val.startsWith('blob:')) return null; // ephemeral, can't recover
        try {
          const res = await fetch(val);
          if (!res.ok) return null;
          return await res.blob();
        } catch {
          return null;
        }
      }

      // ── shops ──────────────────────────────────────────────────
      const shopCount = await tx.table('shops').count();
      if (shopCount > 0) {
        const sample: any = await tx.table('shops').limit(1).first();
        if (sample && sample.photoUrl !== undefined && !(sample.photoUrl instanceof Blob)) {
          const shops: any[] = await tx.table('shops').toCollection().toArray();
          for (const s of shops) {
            s.photoUrl = await stringToBlob(s.photoUrl);
            await tx.table('shops').put(s);
          }
        }
      }

      // ── items ──────────────────────────────────────────────────
      const itemCount = await tx.table('items').count();
      if (itemCount > 0) {
        const sample: any = await tx.table('items').limit(1).first();
        if (sample && sample.photoUrl !== undefined && !(sample.photoUrl instanceof Blob)) {
          const items: any[] = await tx.table('items').toCollection().toArray();
          for (const i of items) {
            i.photoUrl = await stringToBlob(i.photoUrl);
            await tx.table('items').put(i);
          }
        }
      }
    });
  }
}

export const db = new MicrostoreDB();

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
