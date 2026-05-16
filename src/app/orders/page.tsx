'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Search,
  Filter,
  Download,
  Calendar,
  RefreshCw,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  Copy,
  ExternalLink,
  BarChart3,
  AlertTriangle,
  Loader2,
  FileText,
} from 'lucide-react';
import { db, type Order } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { downloadCSV } from '@/lib/csvExport';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  Order['status'],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  paid: {
    label: 'Confirmed',
    icon: CheckCircle2,
    className: 'bg-green-50 text-green-700 border-green-200',
  },

  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  confirming: {
    label: 'Confirming',
    icon: Loader2,
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  failed: {
    label: 'Failed',
    icon: AlertTriangle,
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  pending_review: {
    label: 'Review',
    icon: AlertTriangle,
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateTx(tx: string | undefined): string {
  if (!tx) return '';
  if (tx.length <= 12) return tx;
  return `${tx.slice(0, 6)}...${tx.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

function exportOrdersJSON(orders: Order[]): void {
  const data = orders.map((o) => ({
    ...o,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
    updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : o.updatedAt,
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportOrdersCSV(orders: Order[]): void {
  const headers = [
    'Order ID',
    'Customer Name',
    'Customer Phone',
    'Status',
    'Subtotal',
    'Tip',
    'Tip %',
    'Reserve',
    'Charity',
    'Discount',
    'Total',
    'Item Count',
    'Items',
    'Tx Signature',
    'Merchant Tx',
    'Reserve Tx',
    'Charity Tx',
    'Payment Ref',
    'Token Symbol',
    'Created At',
    'Updated At',
  ];

  const rows = orders.map((o) => [
    o.id,
    o.customerName ?? '',
    o.customerPhone ?? '',
    o.status,
    o.subtotal.toFixed(2),
    o.tip.toFixed(2),
    o.tipPercent,
    (o.reserve ?? 0).toFixed(2),
    o.charity.toFixed(2),
    (o.discount ?? 0).toFixed(2),
    o.total.toFixed(2),
    o.items.length,
    o.items.map((i) => `${i.name} x${i.quantity} @ $${i.price.toFixed(2)}`).join('; '),
    o.txSignature ?? '',
    o.merchantTxSignature ?? '',
    o.reserveTxSignature ?? '',
    o.charityTxSignature ?? '',
    o.paymentRef ?? '',
    o.splTokenSymbol ?? '',
    o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
    o.updatedAt instanceof Date ? o.updatedAt.toISOString() : String(o.updatedAt),
  ]);

  const date = new Date().toISOString().slice(0, 10);
  downloadCSV(headers, rows, `orders-export-${date}.csv`);
}

// ---------------------------------------------------------------------------
// Orders Page
// ---------------------------------------------------------------------------

export default function OrdersPage() {
  const { activeShopId, solanaCluster } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Order['status'] | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Load orders for the active shop (newest first), filtered by active cluster
  const orders = useLiveQuery(
    () =>
      activeShopId
        ? db.orders
            .where('shopId')
            .equals(activeShopId)
            .filter((o) => !o.cluster || o.cluster === solanaCluster)
            .reverse()
            .sortBy('createdAt')
        : [],
    [activeShopId, solanaCluster],
  );

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      // Status filter
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;

      // Date from
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(o.createdAt) < from) return false;
      }

      // Date to
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(o.createdAt) > to) return false;
      }

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          o.customerName?.toLowerCase().includes(q) ||
          o.customerPhone?.toLowerCase().includes(q) ||
          o.txSignature?.toLowerCase().includes(q) ||
          o.paymentRef?.toLowerCase().includes(q) ||
          o.items.some((i) => i.name.toLowerCase().includes(q)) ||
          `#${o.id}`.includes(q)
        );
      }

      return true;
    });
  }, [orders, search, statusFilter, dateFrom, dateTo]);

  // Computed stats
  const stats = useMemo(() => {
    if (!filteredOrders) return { count: 0, total: 0 };
    return filteredOrders.reduce(
      (acc, o) => {
        acc.count += 1;
        if (o.status !== 'cancelled') acc.total += o.total;
        return acc;
      },
      { count: 0, total: 0 },
    );
  }, [filteredOrders]);

  // Copy tx signature to clipboard
  const copyTx = useCallback(async (tx: string, orderId: number) => {
    try {
      await navigator.clipboard.writeText(tx);
      setCopiedId(orderId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard API not available
    }
  }, []);

  // Clear filters
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = statusFilter !== 'all' || dateFrom || dateTo || search.trim();

  // -----------------------------------------------------------------------
  // No shop selected
  // -----------------------------------------------------------------------

  if (!activeShopId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <RefreshCw className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">No shop selected</p>
        <p className="mt-1 text-xs">Select a shop to view its orders.</p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500">
            {orders ? `${orders.length} orders` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/reports/revenue"
            className="inline-flex items-center gap-1 rounded-md bg-white border border-gray-300 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Reports
          </Link>
          <button
            onClick={() => filteredOrders && exportOrdersCSV(filteredOrders)}
            disabled={!filteredOrders || filteredOrders.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-white border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {filteredOrders && (
        <div className="flex gap-3">
          <div className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Orders</div>
            <div className="text-lg font-bold text-gray-900">{stats.count}</div>
          </div>
          <div className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Revenue</div>
            <div className="text-lg font-bold text-gray-900">
              ${stats.total.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders by customer, item, or tx…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
          />
        </div>

        {/* Status chips + date filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status chips */}
          <div className="flex gap-1">
            {(['all', 'pending', 'paid', 'cancelled'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === 'all' ? 'All' : s === 'paid' ? 'Confirmed' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Date filters */}
          <div className="flex items-center gap-1.5 ml-auto">
            <Calendar className="h-3.5 w-3.5 text-gray-500" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none"
            />
            <span className="text-xs text-gray-500">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none"
            />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Orders list */}
      <div className="space-y-2">
        {!orders ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <RefreshCw className="mb-3 h-8 w-8 animate-spin" />
            <p className="text-sm">Loading orders…</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <RefreshCw className="mb-3 h-8 w-8" />
            <p className="text-sm font-medium">No orders found</p>
            <p className="mt-1 text-xs">
              {hasActiveFilters
                ? 'Try adjusting your filters.'
                : 'Orders will appear here once you process transactions from the POS.'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const statusCfg = STATUS_CONFIG[order.status];
            const StatusIcon = statusCfg.icon;
            const isExpanded = expandedId === order.id;

            return (
              <div
                key={order.id}
                className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md"
              >
                {/* Order row header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left"
                >
                  {/* Order number */}
                  <div className="shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">
                      #{order.id}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {order.customerName || `Customer #${order.id}`}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${statusCfg.className}`}
                      >
                        <StatusIcon className="h-2.5 w-2.5" />
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">
                        {formatDate(order.createdAt)}
                      </span>
                      <span className="text-xs text-gray-500">·</span>
                      <span className="text-xs text-gray-500">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-gray-900">
                      ${order.total.toFixed(2)}
                    </div>
                    {order.txSignature && (
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                        <span>{truncateTx(order.txSignature)}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyTx(order.txSignature!, order.id);
                          }}
                          className="hover:text-blue-500 transition-colors"
                        >
                          {copiedId === order.id ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-3 space-y-3">
                    {/* Items */}
                    <div>
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Items
                      </div>
                      <div className="space-y-1">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-gray-700">
                              {item.name}
                              <span className="text-gray-500 ml-1">×{item.quantity}</span>
                            </span>
                            <span className="font-medium text-gray-900">
                              ${(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Totals breakdown */}
                    <div className="space-y-1 text-xs">
                      {(order.reserve ?? 0) > 0 && (
                        <div className="flex justify-between text-gray-500">
                          <span>Reserve</span>
                          <span>${(order.reserve ?? 0).toFixed(2)}</span>
                        </div>
                      )}
                      {order.discount !== undefined && order.discount > 0 && (
                        <div className="flex justify-between text-gray-500">
                          <span>Discount</span>
                          <span>-${order.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-semibold text-gray-900 pt-1 border-t border-gray-200">
                        <span>Total</span>
                        <span>${order.total.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Transaction info */}
                    {order.txSignature && (
                      <div className="rounded-md bg-white border border-gray-200 px-2.5 py-2">
                        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Transaction
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs text-gray-700 font-mono break-all">
                            {order.txSignature}
                          </code>
                          <button
                            onClick={() => copyTx(order.txSignature!, order.id)}
                            className="shrink-0 rounded p-1 text-gray-500 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                          >
                            {copiedId === order.id ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <a
                            href={`https://explorer.solana.com/tx/${order.txSignature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 rounded p-1 text-gray-500 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Payment ref */}
                    {order.paymentRef && (
                      <div className="text-[11px] text-gray-500">
                        Payment Ref: {order.paymentRef}
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="text-[11px] text-gray-500">
                      Created: {formatDateTime(order.createdAt)} · Updated:{' '}
                      {formatDateTime(order.updatedAt)}
                    </div>

                    {/* Receipt link */}
                    <div>
                      <Link
                        href={`/receipt/${order.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View Receipt
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
