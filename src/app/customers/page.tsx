'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import {
  Search,
  Users,
  UserPlus,
  ArrowUpDown,
  ChevronRight,
  Phone,
  Calendar,
  DollarSign,
  ShoppingCart,
} from 'lucide-react';
import { db, type Customer, type Order } from '@/lib/db';
import { useAppStore } from '@/lib/store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortKey = 'totalSpent' | 'orderCount' | 'lastVisit';

interface CustomerWithStats extends Customer {
  totalSpent: number;
  orderCount: number;
  lastVisit: Date | null;
}

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

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ---------------------------------------------------------------------------
// Customers Page
// ---------------------------------------------------------------------------

export default function CustomersPage() {
  const { activeShopId } = useAppStore();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('lastVisit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Load customers and orders for this shop
  const customers = useLiveQuery(
    () =>
      activeShopId
        ? db.customers.where('shopId').equals(activeShopId).toArray()
        : [],
    [activeShopId],
  );

  const orders = useLiveQuery(
    () =>
      activeShopId
        ? db.orders.where('shopId').equals(activeShopId).toArray()
        : [],
    [activeShopId],
  );

  // Compute stats for each customer from orders
  const customersWithStats = useMemo((): CustomerWithStats[] => {
    if (!customers || !orders) return [];

    return customers.map((c) => {
      // Find orders that match this customer
      const customerOrders = orders.filter(
        (o) => o.customerId && o.customerId === c.id,
      );

      const completedOrders = customerOrders.filter(
        (o) => o.status !== 'cancelled',
      );
      const totalSpent = completedOrders.reduce((sum, o) => sum + o.total, 0);
      const lastVisit =
        customerOrders.length > 0
          ? new Date(
              Math.max(
                ...customerOrders.map((o) => new Date(o.createdAt).getTime()),
              ),
            )
          : null;

      return {
        ...c,
        totalSpent,
        orderCount: customerOrders.length,
        lastVisit,
      };
    });
  }, [customers, orders]);

  // Filter + sort
  const displayedCustomers = useMemo(() => {
    let result = customersWithStats;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q),
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'totalSpent':
          cmp = a.totalSpent - b.totalSpent;
          break;
        case 'orderCount':
          cmp = a.orderCount - b.orderCount;
          break;
        case 'lastVisit':
          cmp =
            (a.lastVisit?.getTime() ?? 0) - (b.lastVisit?.getTime() ?? 0);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [customersWithStats, search, sortKey, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const total = displayedCustomers.length;
    const totalRevenue = displayedCustomers.reduce(
      (sum, c) => sum + c.totalSpent,
      0,
    );
    const totalOrders = displayedCustomers.reduce(
      (sum, c) => sum + c.orderCount,
      0,
    );
    return { total, totalRevenue, totalOrders };
  }, [displayedCustomers]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // -----------------------------------------------------------------------
  // No shop selected
  // -----------------------------------------------------------------------

  if (!activeShopId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Users className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">No shop selected</p>
        <p className="mt-1 text-xs">
          Select a shop to view its customers.
        </p>
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
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">
            {customers
              ? `${customers.length} customer${customers.length !== 1 ? 's' : ''}`
              : 'Loading…'}
          </p>
        </div>
      </div>

      {/* Stats bar */}
      {displayedCustomers.length > 0 && (
        <div className="flex gap-3">
          <div className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Customers</div>
            <div className="text-lg font-bold text-gray-900">
              {stats.total}
            </div>
          </div>
          <div className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Orders</div>
            <div className="text-lg font-bold text-gray-900">
              {stats.totalOrders}
            </div>
          </div>
          <div className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Revenue</div>
            <div className="text-lg font-bold text-gray-900">
              ${stats.totalRevenue.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
        />
      </div>

      {/* Sort chips */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <ArrowUpDown className="h-3 w-3" />
          Sort:
        </span>
        {(
          [
            { key: 'lastVisit' as const, label: 'Recency' },
            { key: 'totalSpent' as const, label: 'Spent' },
            { key: 'orderCount' as const, label: 'Visits' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggleSort(key)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              sortKey === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
            {sortKey === key && (sortDir === 'desc' ? ' ↓' : ' ↑')}
          </button>
        ))}
      </div>

      {/* Customer list */}
      <div className="space-y-2">
        {!customers ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Users className="mb-3 h-8 w-8 animate-pulse" />
            <p className="text-sm">Loading customers…</p>
          </div>
        ) : displayedCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Users className="mb-3 h-8 w-8" />
            <p className="text-sm font-medium">
              {search ? 'No customers match your search.' : 'No customers yet.'}
            </p>
            <p className="mt-1 text-xs">
              {search
                ? 'Try a different search term.'
                : 'Customer profiles are created automatically from orders, or you can add them here.'}
            </p>
          </div>
        ) : (
          displayedCustomers.map((c) => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
            >
              {/* Avatar */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                {c.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {c.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {c.phone && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                      <Phone className="h-2.5 w-2.5" />
                      {c.phone}
                    </span>
                  )}
                  {c.lastVisit && (
                    <span className="text-[11px] text-gray-400">
                      <Calendar className="inline h-2.5 w-2.5 mr-0.5" />
                      {formatRelative(c.lastVisit)}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="shrink-0 flex items-center gap-3 text-right">
                <div>
                  <div className="flex items-center justify-end gap-1 text-xs text-gray-500">
                    <ShoppingCart className="h-3 w-3" />
                    {c.orderCount}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-sm font-bold text-gray-900">
                    <DollarSign className="h-3 w-3 text-gray-400" />
                    {c.totalSpent.toFixed(2)}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
