'use client';

import { useEffect, useState, useRef } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

// ---------------------------------------------------------------------------
// useConnectivity hook — subscribes to online/offline events
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
// ConnectivityIndicator — offline banner + back-online toast
// ---------------------------------------------------------------------------

export function ConnectivityIndicator() {
  const [dismissed, setDismissed] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [offline, setOffline] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    return !navigator.onLine;
  });
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setOffline(false);
      setDismissed(false);
      setShowReconnected(true);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => setShowReconnected(false), 4000);
    };

    const handleOffline = () => {
      setOffline(true);
      setDismissed(false);
      setShowReconnected(false);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []);

  // Back online toast
  if (showReconnected) {
    return (
      <div role="status" aria-live="polite">
        <div className="bg-green-600 border-b border-green-700">
          <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-2">
            <Wifi className="h-3.5 w-3.5 shrink-0 text-white" />
            <span className="flex-1 text-xs font-semibold text-white">
              Back online — changes will sync automatically
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Only show offline banner
  if (!offline || dismissed) return null;

  return (
    <div role="alert">
      <div className="bg-red-600 border-b border-red-700">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-2">
          <WifiOff className="h-3.5 w-3.5 shrink-0 text-white" />
          <span className="flex-1 text-xs font-semibold text-white">
            No internet connection — changes saved locally
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded p-0.5 text-red-200 transition-opacity hover:text-white"
            aria-label="Dismiss offline notice"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
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
