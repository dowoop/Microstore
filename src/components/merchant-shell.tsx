'use client';

import { useEffect, useState } from 'react';
import { TopNav } from './topnav';
import { Tabs } from './tabs';
import { NotificationPoller } from '@/lib/notifications';
import { DbHealthBanner } from './db-health-banner';
import { PwaRegister } from './pwa-register';
import { ConnectivityIndicator } from '@/lib/connectivity';
import { useOfflineSync } from '@/lib/offlineQueue';
import { db, markDbInitialized } from '@/lib/db';
import { NetworkBanner } from './NetworkBanner';
import { triggerBackupIfNeeded } from '@/lib/backup';
import { useAppStore } from '@/lib/store';
import { clearDemoData } from '@/lib/demoShop';
import { useLiveQuery } from 'dexie-react-hooks';
import { Coffee, X } from 'lucide-react';

export function MerchantShell({ children }: { children: React.ReactNode }) {
  const { activeShopId } = useAppStore();
  const [exitingDemo, setExitingDemo] = useState(false);

  // Process offline queue when connectivity returns
  useOfflineSync();

  // Mark DB as initialized on first load (if it has data).
  useEffect(() => {
    db.shops.count().then((count) => {
      if (count > 0) markDbInitialized();
    });
  }, []);

  // Trigger auto-backup on mount (time-based + order-count-based)
  useEffect(() => {
    triggerBackupIfNeeded();
  }, []);

  // Check if active shop is a demo
  const shop = useLiveQuery(
    () => (activeShopId ? db.shops.get(activeShopId) : undefined),
    [activeShopId],
  );
  const isDemo = shop?.isDemo === true;

  const handleExitDemo = async () => {
    if (!confirm('Exit demo mode? All demo data will be deleted.')) return;
    setExitingDemo(true);
    try {
      await clearDemoData();
    } catch {
      setExitingDemo(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <NotificationPoller />
      <PwaRegister />
      <ConnectivityIndicator />
      <TopNav />
      <NetworkBanner />
      <DbHealthBanner />

      {/* DEMO MODE banner — shown across all pages when active shop is a demo */}
      {isDemo && (
        <div className="sticky top-[57px] z-40 border-b border-amber-300 bg-amber-100">
          <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <Coffee className="h-4 w-4 text-amber-700 shrink-0" />
              <span className="text-sm font-semibold text-amber-800">DEMO MODE</span>
              <span className="text-xs text-amber-600 hidden sm:inline">
                — {shop?.name ?? 'Demo Shop'}
              </span>
            </div>
            <button
              onClick={handleExitDemo}
              disabled={exitingDemo}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors"
            >
              <X className="h-3 w-3" />
              {exitingDemo ? 'Exiting…' : 'Exit Demo'}
            </button>
          </div>
        </div>
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-md flex-1 px-4 py-4 pb-24"
      >
        {children}
      </main>
      <Tabs />
    </div>
  );
}
