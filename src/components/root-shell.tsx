'use client';

import { usePathname } from 'next/navigation';
import { MerchantShell } from './merchant-shell';
import { NetworkBanner } from './NetworkBanner';
import { ConnectivityIndicator } from '@/lib/connectivity';

/**
 * RootShell — conditionally wraps children in MerchantShell.
 *
 * The /pay route is the customer-facing presenter surface: no tabs, no top nav,
 * no admin chrome. Every other route gets the full MerchantShell (TopNav, Tabs,
 * notifications, offline sync).
 */
export function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Presenter mode — chromeless, customer-facing
  if (pathname.startsWith('/pay')) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <ConnectivityIndicator />
        <NetworkBanner />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-md flex-1 px-4 py-6 pb-8"
        >
          {children}
        </main>
      </div>
    );
  }

  // Merchant mode — full chrome
  return <MerchantShell>{children}</MerchantShell>;
}
