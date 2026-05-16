'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLiveQuery } from 'dexie-react-hooks';
import { Store, Plus, ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { usePhotoUrl } from '@/lib/usePhotoUrl';
import { useAppStore } from '@/lib/store';

function ShopPhotoThumb({ blob, alt }: { blob: Blob | null | undefined; alt: string }) {
  const url = usePhotoUrl(blob);
  if (!url) return <Store className="h-5 w-5 text-gray-500" />;
  return <Image src={url} alt={alt} fill sizes="96px" className="rounded-full object-cover" unoptimized />;
}

export default function ShopsPage() {
  const { activeShopId, setActiveShopId } = useAppStore();

  const shops = useLiveQuery(() => db.shops.toArray());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Shops</h1>
          <p className="text-sm text-gray-500">
            {shops ? `${shops.length} shop${shops.length !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
        <Link
          href="/shops/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add shop
        </Link>
      </div>

      {!shops ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Store className="mb-3 h-8 w-8 animate-pulse" />
          <p className="text-sm">Loading shops…</p>
        </div>
      ) : shops.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Store className="mb-3 h-8 w-8" />
          <p className="text-sm font-medium">No shops yet</p>
          <p className="mt-1 text-xs">Create your first shop to get started.</p>
          <Link
            href="/shops/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add shop
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {shops.map((shop) => (
            <div
              key={shop.id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${
                activeShopId === shop.id
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                <ShopPhotoThumb blob={shop.photoUrl} alt={shop.name} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate">{shop.name}</span>
                  {activeShopId === shop.id && (
                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">@{shop.username}</p>
              </div>
              <div className="flex items-center gap-1">
                {activeShopId !== shop.id && (
                  <button
                    onClick={() => setActiveShopId(shop.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    Select
                  </button>
                )}
                <Link
                  href={`/shops/${shop.id}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
