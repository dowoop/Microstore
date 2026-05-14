'use client';

import Link from 'next/link';
import { Store, Plus, Settings } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export function TopNav() {
  const { activeShopId } = useAppStore();

  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-gray-900">Microstore</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {activeShopId ? `Shop #${activeShopId}` : 'No shop'}
          </span>
          <Link href="/settings" className="text-gray-500 hover:text-gray-900">
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
