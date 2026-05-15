'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Download, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Banner = { type: 'update' } | { type: 'install' } | null;

// ---------------------------------------------------------------------------
// PWA registration + update/install prompts
// ---------------------------------------------------------------------------

export function PwaRegister() {
  const [banner, setBanner] = useState<Banner>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Register the service worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        console.log('[PWA] SW registered:', registration.scope);

        // Check if there's an update waiting
        if (registration.waiting) {
          setUpdateReady(true);
          setBanner({ type: 'update' });
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(true);
              setBanner({ type: 'update' });
            }
          });
        });
      } catch (err) {
        console.error('[PWA] SW registration failed:', err);
      }
    };

    registerSW();

    // Listen for controlling SW changes (after skipWaiting)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, []);

  // Capture beforeinstallprompt
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show banner if not already installed as standalone
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (!isStandalone) {
        setBanner({ type: 'install' });
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Accept update
  const handleUpdate = useCallback(() => {
    setBanner(null);
    // Tell the waiting SW to activate
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
  }, []);

  // Accept install
  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setBanner(null);

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Install outcome:', outcome);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  // Dismiss banner
  const handleDismiss = useCallback(() => {
    setBanner(null);
  }, []);

  // Don't render if no banner
  if (!banner) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 pointer-events-none">
      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-lg pointer-events-auto">
        {banner.type === 'update' ? (
          <>
            <RefreshCw className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-900">Update available</p>
              <p className="text-xs text-blue-700">Refresh to get the latest version.</p>
            </div>
            <button
              onClick={handleUpdate}
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={handleDismiss}
              className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <Download className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-900">Install Microstore</p>
              <p className="text-xs text-blue-700">Add to home screen for quick access.</p>
            </div>
            <button
              onClick={handleInstall}
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
