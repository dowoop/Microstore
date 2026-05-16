'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  DollarSign,
  HandCoins,
  Heart,
  TrendingUp,
  Calendar,
  RefreshCw,
  BarChart3,
  Download,
} from 'lucide-react';
import { db, type Order } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { downloadCSV } from '@/lib/csvExport';

// ---------------------------------------------------------------------------
// Revenue Report
// ---------------------------------------------------------------------------

type Period = 'monthly' | 'quarterly' | 'yearly';

interface RevenueBucket {
  key: string;
  label: string;
  sales: number; // subtotal revenue
  tips: number;
  charity: number;
  total: number;
  tax: number;
  orderCount: number;
  orders: Order[];
}

function getMonthlyKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getQuarterlyKey(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

function getYearlyKey(d: Date): string {
  return `${d.getFullYear()}`;
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function formatQuarterLabel(key: string): string {
  const [y, q] = key.split('-');
  return `${q} ${y}`;
}

function buildBuckets(orders: Order[], period: Period): RevenueBucket[] {
  const getKey =
    period === 'monthly' ? getMonthlyKey : period === 'quarterly' ? getQuarterlyKey : getYearlyKey;

  const formatLabel =
    period === 'monthly'
      ? formatMonthLabel
      : period === 'quarterly'
        ? formatQuarterLabel
        : (k: string) => k;

  const map = new Map<string, Order[]>();

  for (const o of orders) {
    const d = new Date(o.createdAt);
    const key = getKey(d);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(o);
  }

  const buckets: RevenueBucket[] = [];
  for (const [key, bucketOrders] of map) {
    const sales = bucketOrders.reduce((sum, o) => sum + o.subtotal, 0);
    const tips = bucketOrders.reduce((sum, o) => sum + (o.tip || 0), 0);
    const charity = bucketOrders.reduce((sum, o) => sum + (o.charity || 0), 0);
    const total = bucketOrders.reduce((sum, o) => sum + o.total, 0);
    const tax = bucketOrders.reduce((sum, o) => sum + (o.tax || 0), 0);

    buckets.push({
      key,
      label: formatLabel(key),
      sales,
      tips,
      charity,
      total,
      tax,
      orderCount: bucketOrders.length,
      orders: bucketOrders,
    });
  }

  buckets.sort((a, b) => b.key.localeCompare(a.key));
  return buckets;
}

function exportRevenueCSV(buckets: RevenueBucket[]): void {
  const headers = ['Date', 'Orders', 'Revenue', 'Tips', 'Sales Tax', 'Charity', 'Net'];

  const rows = buckets.map((b) => {
    const net = b.sales + b.tips - b.charity; // revenue the business keeps
    return [
      b.label,
      b.orderCount,
      b.sales.toFixed(2),
      b.tips.toFixed(2),
      b.tax.toFixed(2),
      b.charity.toFixed(2),
      net.toFixed(2),
    ];
  });

  const date = new Date().toISOString().slice(0, 10);
  downloadCSV(headers, rows, `revenue-export-${date}.csv`);
}

export default function RevenueReportPage() {
  const { activeShopId, solanaCluster } = useAppStore();
  const [period, setPeriod] = useState<Period>('monthly');
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);

  // Load all paid orders, filtered by active cluster
  const orders = useLiveQuery(
    () =>
      db.orders
        .where('shopId')
        .equals(activeShopId ?? '')
        .filter((o) => o.status === 'paid' && (!o.cluster || o.cluster === solanaCluster))
        .toArray(),
    [activeShopId, solanaCluster],
  );

  const buckets = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    return buildBuckets(orders, period);
  }, [orders, period]);

  // Grand totals
  const totals = useMemo(() => {
    if (!buckets) return { sales: 0, tips: 0, charity: 0, total: 0, orderCount: 0 };
    return buckets.reduce(
      (acc, b) => ({
        sales: acc.sales + b.sales,
        tips: acc.tips + b.tips,
        charity: acc.charity + b.charity,
        total: acc.total + b.total,
        orderCount: acc.orderCount + b.orderCount,
      }),
      { sales: 0, tips: 0, charity: 0, total: 0, orderCount: 0 },
    );
  }, [buckets]);

  // -----------------------------------------------------------------------
  // No shop selected
  // -----------------------------------------------------------------------

  if (!activeShopId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <RefreshCw className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">No shop selected</p>
        <p className="mt-1 text-xs">Select a shop to view its revenue report.</p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------

  if (!orders) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <RefreshCw className="mb-3 h-8 w-8 animate-spin" />
        <p className="text-sm">Loading revenue data…</p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/orders"
          className="rounded-full p-2 -ml-2 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Revenue Report</h1>
          <p className="text-sm text-gray-500">
            Sales, tips & donations per{' '}
            {period === 'monthly' ? 'month' : period === 'quarterly' ? 'quarter' : 'year'}
          </p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {(['monthly', 'quarterly', 'yearly'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              period === p
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      {buckets.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <DollarSign className="h-3 w-3 text-blue-500" />
              Total Revenue
            </div>
            <div className="text-lg font-bold text-blue-700">${totals.total.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <BarChart3 className="h-3 w-3 text-gray-500" />
              Paid Orders
            </div>
            <div className="text-lg font-bold text-gray-700">{totals.orderCount}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <DollarSign className="h-3 w-3 text-green-600" />
              Sales (subtotals)
            </div>
            <div className="text-lg font-bold text-green-700">${totals.sales.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <HandCoins className="h-3 w-3 text-amber-500" />
              Tips
            </div>
            <div className="text-lg font-bold text-amber-700">${totals.tips.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <Heart className="h-3 w-3 text-rose-400" />
              Charity Donations
            </div>
            <div className="text-lg font-bold text-rose-600">${totals.charity.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {buckets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <DollarSign className="mb-3 h-10 w-10" />
          <p className="text-sm font-medium">No revenue data</p>
          <p className="mt-1 text-xs text-center">
            Revenue will appear here once orders are paid.
            <br />
            Complete some sales from the POS to get started.
          </p>
        </div>
      )}

      {/* Revenue buckets table */}
      {buckets.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            <span className="flex-1">
              <Calendar className="inline h-3 w-3 mr-1" />
              Period
            </span>
            <span className="w-18 text-right">Revenue</span>
            <span className="w-16 text-right">Tips</span>
            <span className="w-16 text-right">Donations</span>
            <span className="w-6" />
          </div>

          {buckets.map((bucket) => {
            const isExpanded = expandedBucket === bucket.key;
            const maxTotal = Math.max(...buckets.map((b) => b.total), 1);
            const barWidth = Math.max((bucket.total / maxTotal) * 100, 2);

            return (
              <div key={bucket.key}>
                <button
                  onClick={() => setExpandedBucket(isExpanded ? null : bucket.key)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{bucket.label}</div>
                    <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-400"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-18 text-right text-sm font-bold tabular-nums text-blue-700">
                    ${bucket.total.toFixed(0)}
                  </span>
                  <span className="w-16 text-right text-xs text-amber-600">
                    ${bucket.tips.toFixed(0)}
                  </span>
                  <span className="w-16 text-right text-xs text-rose-500">
                    ${bucket.charity.toFixed(0)}
                  </span>
                  <span className="w-6 text-right text-gray-500">
                    <TrendingUp
                      className={`h-3.5 w-3.5 ml-auto transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </span>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="bg-gray-50/50 border-t border-gray-100 px-3 py-2 space-y-2">
                    <div className="flex gap-3 text-xs">
                      <div>
                        <span className="text-gray-500">Sales:</span>{' '}
                        <span className="font-medium">${bucket.sales.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Tax:</span>{' '}
                        <span className="font-medium text-green-600">${bucket.tax.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Orders:</span>{' '}
                        <span className="font-medium">{bucket.orderCount}</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                      Orders in {bucket.label}
                    </div>
                    <div className="space-y-1">
                      {bucket.orders.slice(0, 10).map((o) => (
                        <div key={o.id} className="flex items-center justify-between text-xs">
                          <Link
                            href={`/receipt/${o.id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            #{o.id}
                          </Link>
                          <span className="text-gray-500">
                            {new Date(o.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="text-gray-500">${o.total.toFixed(2)}</span>
                          {o.tip > 0 && (
                            <span className="text-amber-500 text-[10px]">
                              +${o.tip.toFixed(2)} tip
                            </span>
                          )}
                          {o.charity > 0 && (
                            <span className="text-rose-400 text-[10px]">
                              ♥${o.charity.toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))}
                      {bucket.orders.length > 10 && (
                        <p className="text-[10px] text-gray-500">
                          +{bucket.orders.length - 10} more orders
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 pt-2 text-xs text-gray-500">
        <span>
          {buckets.length}{' '}
          {period === 'monthly' ? 'months' : period === 'quarterly' ? 'quarters' : 'years'} of
          revenue data
        </span>
        <span>·</span>
        <button
          onClick={() => window.print()}
          className="text-blue-500 hover:text-blue-700 underline"
        >
          Print
        </button>
        <span>·</span>
        <button
          onClick={() => exportRevenueCSV(buckets)}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline font-medium"
        >
          <Download className="h-3 w-3" />
          Export CSV
        </button>
      </div>
    </div>
  );
}
