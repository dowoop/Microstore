'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store, Plus, Settings, Home, Package, ShoppingCart, Receipt, QrCode, Users } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const tabs = [
  { key: 'home', label: 'Home', href: '/', icon: Home },
  { key: 'shops', label: 'Shops', href: '/shops', icon: Store },
  { key: 'items', label: 'Items', href: '/items', icon: Package },
  { key: 'pos', label: 'POS', href: '/pos', icon: QrCode },
  { key: 'orders', label: 'Orders', href: '/orders', icon: ShoppingCart },
  { key: 'customers', label: 'Cust.', href: '/customers', icon: Users },
  { key: 'expenses', label: 'Expenses', href: '/expenses', icon: Receipt },
];

export function Tabs() {
  const pathname = usePathname();
  const { activeTab, setActiveTab } = useAppStore();

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
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
