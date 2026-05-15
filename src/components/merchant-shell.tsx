'use client';

import { useEffect } from 'react';
import { TopNav } from './topnav';
import { Tabs } from './tabs';
import { NotificationPoller } from '@/lib/notifications';
import { DbHealthBanner } from './db-health-banner';
import { PwaRegister } from './pwa-register';
import { ConnectivityIndicator } from '@/lib/connectivity';
import { useOfflineSync } from '@/lib/offlineQueue';
import { db, markDbInitialized } from '@/lib/db';
import { NetworkBanner } from './NetworkBanner';

export function MerchantShell({ children }: { children: React.ReactNode }) {
  // Process offline queue when connectivity returns
  useOfflineSync();

  // Mark DB as initialized on first load (if it has data).
  useEffect(() => {
    db.shops.count().then((count) => {
      if (count > 0) markDbInitialized();
    });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <NotificationPoller />
      <PwaRegister />
      <ConnectivityIndicator />
      <TopNav />
      <DbHealthBanner />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-md flex-1 px-4 py-4 pb-24">
        {children}
      </main>
      <Tabs />
    </div>
  );
}
