'use client';

import Link from 'next/link';
import { Store, Plus, Settings, Coffee } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

export function TopNav() {
  const { activeShopId } = useAppStore();

  const shop = useLiveQuery(
    () => (activeShopId ? db.shops.get(activeShopId) : undefined),
    [activeShopId],
  );
  const isDemo = shop?.isDemo === true;

  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-gray-900">Microstore</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {isDemo ? (
              <span className="inline-flex items-center gap-1">
                <Coffee className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-amber-700 font-medium">Demo</span>
              </span>
            ) : activeShopId ? (
              `Shop #${activeShopId}`
            ) : (
              'No shop'
            )}
          </span>
          <Link
            href="/settings"
            className="text-gray-500 hover:text-gray-900"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
