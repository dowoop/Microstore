'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  Search,
  Package,
  Wrench,
  AlertTriangle,
  Circle,
  CheckCircle2,
  Camera,
} from 'lucide-react';
import { db, type Item } from '@/lib/db';
import { usePhotoUrl } from '@/lib/usePhotoUrl';
import { useAppStore } from '@/lib/store';

function ItemPhotoThumb({ blob, alt }: { blob: Blob | null | undefined; alt: string }) {
  const url = usePhotoUrl(blob);
  if (!url) return <Camera className="h-5 w-5 text-gray-300" />;
  return <Image src={url} alt={alt} fill sizes="96px" className="object-cover" unoptimized />;
}

type TypeFilter = 'all' | 'product' | 'service';

export default function ItemsPage() {
  const { activeShopId } = useAppStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const items = useLiveQuery(
    () =>
      activeShopId
        ? db.items.where('shopId').equals(activeShopId).reverse().sortBy('createdAt')
        : db.items.orderBy('createdAt').reverse().toArray(),
    [activeShopId],
  );

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          item.name.toLowerCase().includes(q) ||
          (item.sku?.toLowerCase().includes(q) ?? false) ||
          (item.barcode?.toLowerCase().includes(q) ?? false) ||
          (item.category?.toLowerCase().includes(q) ?? false);
        if (!match) return false;
      }
      return true;
    });
  }, [items, search, typeFilter]);

  const productCount = items?.filter((i) => i.type === 'product').length ?? 0;
  const serviceCount = items?.filter((i) => i.type === 'service').length ?? 0;
  const lowStockCount =
    items?.filter((i) => {
      if (!i.lowStockThreshold) return false;
      return i.stock <= i.lowStockThreshold;
    }).length ?? 0;

  // --- Render helpers -------------------------------------------------------

  function statusBadge(status: Item['status']) {
    return status === 'live' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        Live
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Circle className="h-3 w-3" />
        Draft
      </span>
    );
  }

  function stockIndicator(item: Item) {
    const threshold = item.lowStockThreshold ?? 0;
    const low = item.stock <= threshold;
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium ${
          low ? 'text-red-600' : 'text-gray-500'
        }`}
      >
        {low && <AlertTriangle className="h-3 w-3" />}
        {item.type === 'product' ? `Stock: ${item.stock}` : '—'}
      </span>
    );
  }

  // --- Empty state -----------------------------------------------------------

  if (!items) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Package className="mb-3 h-10 w-10 animate-pulse" />
        <p className="text-sm">Loading inventory…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
          <Package className="h-8 w-8 text-blue-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">No items yet</h2>
        <p className="mt-1 text-sm text-gray-500">
          Add your first product or service to get started.
        </p>
        <Link
          href="/items/new"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add item
        </Link>
      </div>
    );
  }

  // --- List ------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Items</h1>
          <p className="text-sm text-gray-500">
            {productCount} products · {serviceCount} services
            {lowStockCount > 0 && (
              <span className="ml-2 text-amber-600">
                · {lowStockCount} low stock
              </span>
            )}
          </p>
        </div>
        <Link
          href="/items/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add
        </Link>
      </div>

      {/* Search & filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
          />
        </div>
        <div className="flex rounded-lg border border-gray-300 bg-white p-0.5">
          {(['all', 'product', 'service'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t === 'all' ? 'All' : t === 'product' ? 'Products' : 'Services'}
            </button>
          ))}
        </div>
      </div>

      {/* Items list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Search className="mb-2 h-6 w-6" />
          <p className="text-sm">No items match your search.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={`/items/${item.id}`}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
            >
              {/* Thumbnail */}
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                <ItemPhotoThumb blob={item.photoUrl} alt={item.name} />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-gray-900">
                    {item.name}
                  </span>
                  {statusBadge(item.status)}
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                  <span>
                    {item.type === 'product' ? (
                      <Package className="inline h-3 w-3 mr-0.5" />
                    ) : (
                      <Wrench className="inline h-3 w-3 mr-0.5" />
                    )}
                    {item.type === 'product' ? 'Product' : 'Service'}
                  </span>
                  <span>${item.price.toFixed(2)}</span>
                  {stockIndicator(item)}
                </div>
              </div>

              {/* Arrow */}
              <div className="text-gray-300">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}