'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store, Plus, Settings, Home, Package, ShoppingCart, Receipt, QrCode } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useLowStockStore } from '@/lib/lowStockStore';

const tabs = [
  { key: 'home', label: 'Home', href: '/', icon: Home },
  { key: 'shops', label: 'Shops', href: '/shops', icon: Store },
  { key: 'items', label: 'Items', href: '/items', icon: Package },
  { key: 'pos', label: 'POS', href: '/pos', icon: QrCode },
  { key: 'orders', label: 'Orders', href: '/orders', icon: ShoppingCart },
  { key: 'expenses', label: 'Expenses', href: '/expenses', icon: Receipt },
];

export function Tabs() {
  const pathname = usePathname();
  const { activeTab, setActiveTab } = useAppStore();
  const lowStockCount = useLowStockStore((s) => s.lowStockCount);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white">
      <div className="mx-auto flex max-w-md justify-around">
        {tabs.map((t) => {
          const isActive = pathname === t.href || pathname.startsWith(t.href + '/');
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={t.href}
              onClick={() => setActiveTab(t.key)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs ${
                isActive ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="relative">
                {t.label}
                {t.key === 'items' && lowStockCount > 0 && (
                  <span className="absolute -top-1.5 -right-5 inline-flex items-center justify-center rounded-full bg-amber-500 px-1 min-w-[16px] h-4 text-[9px] font-bold text-white">
                    {lowStockCount}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
