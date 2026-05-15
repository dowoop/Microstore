'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, AlertTriangle, Shield } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { db } from '@/lib/db';

/**
 * NetworkBanner — persistent bar at the top of every view showing the active
 * Solana cluster and shop name.
 *
 * - Devnet: amber/orange background, "DEVNET — Test Mode"
 * - Mainnet: subtle green, "MAINNET"
 * - Dismissible per session (reappears on next page load)
 */
export function NetworkBanner() {
  const { solanaCluster, activeShopId } = useAppStore();
  const [dismissed, setDismissed] = useState(false);

  const shop = useLiveQuery(
    () => (activeShopId ? db.shops.get(activeShopId) : undefined),
    [activeShopId],
  );

  // Reset dismissed when cluster or shop changes
  useEffect(() => {
    setDismissed(false);
  }, [solanaCluster, activeShopId]);

  if (dismissed) return null;

  const isMainnet = solanaCluster === 'mainnet-beta';

  return (
    <div
      role="alert"
      className={
        isMainnet
          ? 'bg-green-50 border-b border-green-200'
          : 'bg-amber-500 border-b border-amber-600'
      }
    >
      <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-1.5">
        {isMainnet ? (
          <Shield className="h-3.5 w-3.5 shrink-0 text-green-600" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-white" />
        )}
        <span
          className={`flex-1 truncate text-xs font-semibold ${
            isMainnet ? 'text-green-700' : 'text-white'
          }`}
        >
          {isMainnet ? 'MAINNET' : 'DEVNET — Test Mode'}
          {shop ? ` · ${shop.name}` : ''}
        </span>
        <button
          onClick={() => setDismissed(true)}
          className={`shrink-0 rounded p-0.5 transition-opacity hover:opacity-70 ${
            isMainnet ? 'text-green-400' : 'text-amber-100'
          }`}
          aria-label="Dismiss network banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
