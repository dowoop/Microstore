     1|import Dexie, { type EntityTable } from 'dexie';
     2|import type { OrderStatus } from '@/lib/txLifecycle';
     3|
     4|export type { OrderStatus } from '@/lib/txLifecycle';
     5|
    53|export interface AcceptedToken {
    54|  mint: string;
    55|  symbol: string;
    56|  decimals: number;
    57|  name?: string;
    58|  logoURI?: string;
    59|}
    60|
    61|export interface Shop {
    62|  id: number;
    63|  name: string;
    64|  username: string;
    65|  photoUrl?: string;
    66|  description?: string;
    67|  tipPresets: number[];
    68|  taxAllocationEnabled: boolean;
    69|  charityEnabled: boolean;
    70|  charityPartners: string[];
    71|  merchantWallet?: string;
    72|  taxWallet?: string;
    73|  charityWallet?: string;
    74|  splTokenMint?: string;
    75|  splTokenSymbol?: string;
    76|  address?: string;
    77|  phone?: string;
    78|  email?: string;
    79|  currency?: string;
    80|  createdAt: Date;
    81|  updatedAt: Date;
    82|}
    83|export type ItemType = 'product' | 'service';
    84|export type ItemStatus = 'live' | 'draft';
    85|export interface ListingRules {
    86|  enabled: boolean;
    87|  conditions?: unknown[];
    88|}
    89|export interface Item {
    90|  id: number;
    91|  shopId: number;
    92|  type: ItemType;
    93|  name: string;
    94|  description?: string;
    95|  price: number;
    96|  cost?: number;
    97|  sku?: string;
    98|  barcode?: string;
    99|  stock: number;
   100|  lowStockThreshold?: number;
   101|  notifyLowStock?: boolean;
   102|  category?: string;
   103|  status: ItemStatus;
   104|  photoUrl?: string;
   105|  payUpfrontTemplate?: string;
   106|  listingRules: ListingRules;
   107|  createdAt: Date;
   108|  updatedAt: Date;
   109|}
   110|export interface Order {
   111|  id: number;
   112|  shopId: number;
   113|  customerName?: string;
   114|  customerPhone?: string;
   115|  status: OrderStatus;
   116|  subtotal: number;
   117|  tip: number;
   118|  tipPercent: number;
   119|  tax: number;
   120|  charity: number;
   121|  total: number;
   122|  discount?: number;
   123|  items: OrderItem[];
   124|  txSignature?: string;
   125|  merchantTxSignature?: string;
   126|  taxTxSignature?: string;
   127|  charityTxSignature?: string;
   128|  paymentRef?: string;
   129|  merchantWallet?: string;
   130|  taxWallet?: string;
   131|  charityWallet?: string;
   132|  splTokenMint?: string;
   133|  splTokenSymbol?: string;
   134|  confirmedAt?: Date;
   135|  failedReason?: string;
   136|  lastAttemptAt?: Date;
   137|  createdAt: Date;
   138|  updatedAt: Date;
   139|}
   140|export interface OrderItem {
   141|  itemId: number;
   142|  name: string;
   143|  price: number;
   144|  quantity: number;
   145|}
   146|export interface Expense {
   147|  id: number;
   148|  shopId: number;
   149|  category: string;
   150|  amount: number;
   151|  description?: string;
   152|  date: Date;
   153|  createdAt: Date;
   154|}
   155|export interface OfflineQueueEntry {
   156|  id?: number;
   157|  shopId: number;
   158|  orderData: Omit<Order, 'id'>;
   159|  status: 'pending' | 'processing' | 'syncing' | 'synced' | 'failed';
   160|  attempts: number;
   161|  lastError?: string;
   162|  createdAt: Date;
   163|  attemptedAt?: Date;
   164|}
   165|export interface ErrorLogEntry {
   166|  id?: number;
   167|  timestamp: Date;
   168|  message: string;
   169|  stack?: string;
   170|  componentStack?: string;
   171|  url: string;
   172|  userAgent: string;
   173|  context?: string;
   174|}
   175|class MicrostoreDB extends Dexie {
   176|  shops!: EntityTable<Shop, 'id'>;
   177|  items!: EntityTable<Item, 'id'>;
   178|  orders!: EntityTable<Order, 'id'>;
   179|  expenses!: EntityTable<Expense, 'id'>;
   180|  offlineQueue!: EntityTable<OfflineQueueEntry, 'id'>;
   181|  errorLogs!: EntityTable<ErrorLogEntry, 'id'>;
   182| (feat: multi-token support complete - token registry, picker, price oracle, dashboard, tests)
   183|  constructor() {
   184|    super('MicrostoreDB');
   185|    this.version(9999).stores({
   186|      shops: '++id, name, username, merchantWallet, createdAt',
   187|      items: '++id, shopId, name, category, sku, barcode, createdAt',
   188|      orders: '++id, shopId, status, txSignature, merchantTxSignature, createdAt',
   189|      expenses: '++id, shopId, category, date',
   190|      offlineQueue: '++id, status, createdAt',
   191|      errorLogs: '++id, timestamp',
   192|    });
   193|  }
   194|}
   195|