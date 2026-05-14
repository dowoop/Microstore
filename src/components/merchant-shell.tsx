'use client';

import { TopNav } from './topnav';
import { Tabs } from './tabs';

export function MerchantShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <TopNav />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4 pb-24">
        {children}
      </main>
      <Tabs />
    </div>
  );
}
