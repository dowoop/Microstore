'use client';

import { useState, useSyncExternalStore } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

// ---------------------------------------------------------------------------
// External store: subscribe to browser online/offline events.
// `useSyncExternalStore` is the React-idiomatic way to read external mutable
// state — server snapshot avoids the SSR/client hydration mismatch we get
// from a useState initializer that reads `navigator.onLine`.
// ---------------------------------------------------------------------------

function subscribeOnline(cb: () => void): () => void {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

function getServerOnlineSnapshot(): boolean {
  // SSR doesn't know the user's actual state. Render as online; the client
  // syncs to the true value on first commit without a hydration mismatch.
  return true;
}

export function useConnectivity(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerOnlineSnapshot);
}

// ---------------------------------------------------------------------------
// ConnectivityIndicator — offline banner only.
// (The "back online" toast was dropped to keep the offline state purely
// derived from the connectivity store. Add it back when needed.)
// ---------------------------------------------------------------------------

export function ConnectivityIndicator() {
  const online = useConnectivity();
  const [dismissed, setDismissed] = useState(false);

  if (online || dismissed) return null;

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
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
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
