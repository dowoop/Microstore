'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  ShieldCheck,
  TrendingUp,
  Calendar,
  BarChart3,
  RefreshCw,
  Download,
} from 'lucide-react';
import { db, type Order } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { downloadCSV } from '@/lib/csvExport';

// ---------------------------------------------------------------------------
// Reserve Summary Report
// ---------------------------------------------------------------------------

type Period = 'monthly' | 'quarterly' | 'yearly';

interface ReserveBucket {
  key: string;       // e.g. "2026-05", "2026-Q2", "2026"
  label: string;     // e.g. "May 2026", "Q2 2026", "2026"
  reserveCollected: number;
  orderCount: number;
  totalRevenue: number;
  orders: Order[];   // underlying orders in this bucket
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

function buildBuckets(orders: Order[], period: Period): ReserveBucket[] {
  const getKey = period === 'monthly' ? getMonthlyKey
    : period === 'quarterly' ? getQuarterlyKey
    : getYearlyKey;

  const formatLabel = period === 'monthly' ? formatMonthLabel
    : period === 'quarterly' ? formatQuarterLabel
    : (k: string) => k;

  const map = new Map<string, Order[]>();

  for (const o of orders) {
    const d = new Date(o.createdAt);
    const key = getKey(d);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(o);
  }

  const buckets: ReserveBucket[] = [];
  for (const [key, bucketOrders] of map) {
    const reserveCollected = bucketOrders.reduce((sum, o) => sum + (o.reserve || 0), 0);
    const totalRevenue = bucketOrders.reduce((sum, o) => sum + o.total, 0);
    buckets.push({
      key,
      label: formatLabel(key),
      reserveCollected,
      orderCount: bucketOrders.length,
      totalRevenue,
      orders: bucketOrders,
    });
  }

  // Sort chronologically (newest first)
  buckets.sort((a, b) => b.key.localeCompare(a.key));
  return buckets;
}

function exportReserveCSV(buckets: ReserveBucket[]): void {
  const headers = ['Period', 'Taxable Sales', 'Reserve Collected', 'Reserve Remitted'];

  const rows = buckets.map((b) => [
    b.label,
    b.totalRevenue.toFixed(2),
    b.reserveCollected.toFixed(2),
    b.reserveCollected.toFixed(2), // reserve remitted = reserve collected (not tracked separately)
  ]);

  const date = new Date().toISOString().slice(0, 10);
  downloadCSV(headers, rows, `reserve-export-${date}.csv`);
}

export default function ReserveReportPage() {
  const { activeShopId } = useAppStore();
  const [period, setPeriod] = useState<Period>('monthly');
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);

  // Load all paid orders with non-zero reserve
  const orders = useLiveQuery(
    () =>
      db.orders
        .where('shopId')
        .equals(activeShopId ?? '')
        .filter((o) => o.status === 'paid' && (o.reserve ?? 0) > 0)
        .toArray(),
    [activeShopId],
  );

  const buckets = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    return buildBuckets(orders, period);
  }, [orders, period]);

  // Grand totals
  const totals = useMemo(() => {
    if (!buckets) return { reserveCollected: 0, orderCount: 0 };
    return buckets.reduce(
      (acc, b) => ({
        reserveCollected: acc.reserveCollected + b.reserveCollected,
        orderCount: acc.orderCount + b.orderCount,
      }),
      { reserveCollected: 0, orderCount: 0 },
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
        <p className="mt-1 text-xs">Select a shop to view its reserve report.</p>
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
        <p className="text-sm">Loading reserve data…</p>
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
          <h1 className="text-xl font-bold text-gray-900">Reserve Report</h1>
          <p className="text-sm text-gray-500">
            Total reserve collected per {period === 'monthly' ? 'month' : period === 'quarterly' ? 'quarter' : 'year'}
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
        <div className="flex gap-3">
          <div className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <ShieldCheck className="h-3 w-3 text-green-500" />
              Reserve Collected
            </div>
            <div className="text-lg font-bold text-green-700">
              ${totals.reserveCollected.toFixed(2)}
            </div>
          </div>
          <div className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <BarChart3 className="h-3 w-3 text-blue-500" />
              Reserve Orders
            </div>
            <div className="text-lg font-bold text-blue-700">
              {totals.orderCount}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {buckets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <ShieldCheck className="mb-3 h-10 w-10" />
          <p className="text-sm font-medium">No reserve data</p>
          <p className="mt-1 text-xs text-center">
            Reserve allocation will appear here once orders are paid.<br />
            Switch to a different period or check back later.
          </p>
        </div>
      )}

      {/* Reserve buckets table */}
      {buckets.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span className="flex-1">
              <Calendar className="inline h-3 w-3 mr-1" />
              Period
            </span>
            <span className="w-20 text-right">Reserve</span>
            <span className="w-12 text-right">Orders</span>
            <span className="w-6" />
          </div>

          {/* Rows */}
          {buckets.map((bucket) => {
            const isExpanded = expandedBucket === bucket.key;
            const maxReserve = Math.max(...buckets.map((b) => b.reserveCollected), 1);
            const barWidth = Math.max((bucket.reserveCollected / maxReserve) * 100, 2);

            return (
              <div key={bucket.key}>
                <button
                  onClick={() =>
                    setExpandedBucket(isExpanded ? null : bucket.key)
                  }
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {bucket.label}
                    </div>
                    {/* Mini bar chart */}
                    <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-400"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-20 text-right text-sm font-bold tabular-nums text-green-700">
                    ${bucket.reserveCollected.toFixed(2)}
                  </span>
                  <span className="w-12 text-right text-xs text-gray-500">
                    {bucket.orderCount}
                  </span>
                  <span className="w-6 text-right text-gray-500">
                    <TrendingUp
                      className={`h-3.5 w-3.5 ml-auto transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </span>
                </button>

                {/* Expanded: order list */}
                {isExpanded && (
                  <div className="bg-gray-50/50 border-t border-gray-100 px-3 py-2 space-y-1.5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                      Orders in {bucket.label}
                    </div>
                    {bucket.orders.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between text-xs"
                      >
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
                        <span className="text-gray-500">
                          ${o.total.toFixed(2)}
                        </span>
                        <span className="text-green-600 font-medium">
                          ${(o.reserve || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Print / export area */}
      <div className="flex items-center justify-center gap-2 pt-2 text-xs text-gray-500">
        <span>
          Reserve report for {buckets.length} {period === 'monthly' ? 'months' : period === 'quarterly' ? 'quarters' : 'years'}
        </span>
        <span>·</span>
        <button onClick={() => window.print()} className="text-blue-500 hover:text-blue-700 underline">
          Print
        </button>
        <span>·</span>
        <button
          onClick={() => exportReserveCSV(buckets)}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline font-medium"
        >
          <Download className="h-3 w-3" />
          Export CSV
        </button>
      </div>
    </div>
  );
}
