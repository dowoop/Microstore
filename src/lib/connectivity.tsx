'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

// ---------------------------------------------------------------------------
// useConnectivity hook
// ---------------------------------------------------------------------------

export function useConnectivity(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

// ---------------------------------------------------------------------------
// ConnectivityIndicator — shown when offline
// ---------------------------------------------------------------------------

export function ConnectivityIndicator() {
  const online = useConnectivity();

  // Only show when offline
  if (online) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center">
      <WifiOff className="h-3.5 w-3.5 text-white" />
      <span className="text-xs font-semibold text-white">
        You are offline — changes will sync when connected
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConnectivityBadge — lightweight online/offline dot for inline use
// ---------------------------------------------------------------------------

export function ConnectivityBadge() {
  const online = useConnectivity();

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        online ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {online ? (
        <>
          <Wifi className="h-3 w-3" />
          Online
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Offline
        </>
      )}
    </span>
  );
}
