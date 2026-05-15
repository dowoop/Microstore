'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, Download, X, AlertTriangle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Banner = { type: 'update' } | { type: 'install' } | { type: 'version-mismatch' } | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ask the controlling service worker for its version via MessageChannel.
 * Returns the version string or null if the SW doesn't respond.
 */
function getSwVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!navigator.serviceWorker.controller) {
      resolve(null);
      return;
    }
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      resolve(null);
    }, 2000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      resolve(event.data?.version ?? null);
    };
    navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  });
}

/**
 * Read the expected SW version from:
 * 1. __NEXT_DATA__.buildId (available on all Next.js pages)
 * 2. Fallback: fetch /sw-version.json (generated at build time)
 */
async function getExpectedVersion(): Promise<string | null> {
  // Next.js embeds the build ID in every page
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nextData = (window as any).__NEXT_DATA__;
  if (nextData?.buildId) {
    return nextData.buildId;
  }

  // Fallback: fetch the version manifest
  try {
    const res = await fetch('/sw-version.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return data.version ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}

// ---------------------------------------------------------------------------
// PWA registration + update/install/version-mismatch prompts
// ---------------------------------------------------------------------------

export function PwaRegister() {
  const [banner, setBanner] = useState<Banner>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const updateCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // -----------------------------------------------------------------------
  // Register the service worker with cache-busting query params + version
  // mismatch detection
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let cancelled = false;

    const registerSW = async () => {
      try {
        // 1. Get the expected build version
        const expectedVersion = await getExpectedVersion();
        console.log('[PWA] Expected SW version:', expectedVersion);

        // 2. Register with cache-busting query param so the browser always
        //    fetches the latest SW file (not a cached version)
        const swUrl = expectedVersion
          ? `/sw.js?v=${encodeURIComponent(expectedVersion)}`
          : '/sw.js';

        const registration = await navigator.serviceWorker.register(swUrl, {
          scope: '/',
          // Don't wait for the SW to become active before resolving
          updateViaCache: 'none',
        });

        if (cancelled) return;

        console.log('[PWA] SW registered:', registration.scope);

        // 3. Check for version mismatch: if the controlling SW has a
        //    different (older) version, unregister it so the old caches
        //    are purged and the new SW takes over
        if (navigator.serviceWorker.controller) {
          const activeVersion = await getSwVersion();
          if (activeVersion && expectedVersion && activeVersion !== expectedVersion) {
            console.warn(
              `[PWA] Version mismatch! Active SW: ${activeVersion}, expected: ${expectedVersion}. Unregistering old SW.`,
            );
            setBanner({ type: 'version-mismatch' });
            // Unregister the old SW and reload to get the new one
            const unreg = await registration.unregister();
            if (unreg) {
              console.log('[PWA] Old SW unregistered. Reloading...');
              window.location.reload();
              return;
            }
          }
        }

        // 4. Check if there's already an update waiting (edge case)
        if (registration.waiting) {
          setBanner({ type: 'update' });
        }

        // 5. Listen for new SW being installed (updatefound)
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New SW installed and waiting');
              setBanner({ type: 'update' });
            }
          });
        });

        // 6. Periodic update checks (every 30 minutes)
        if (updateCheckInterval.current) {
          clearInterval(updateCheckInterval.current);
        }
        updateCheckInterval.current = setInterval(
          () => {
            registration.update().catch((err) => {
              console.warn('[PWA] Update check failed:', err.message);
            });
          },
          30 * 60 * 1000,
        );
      } catch (err) {
        console.error('[PWA] SW registration failed:', err);
      }
    };

    registerSW();

    // Listen for controlling SW changes (after skipWaiting activates new SW)
    const onControllerChange = () => {
      console.log('[PWA] New SW took control, reloading page');
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      if (updateCheckInterval.current) {
        clearInterval(updateCheckInterval.current);
        updateCheckInterval.current = null;
      }
    };
  }, []);

  // -----------------------------------------------------------------------
  // Capture beforeinstallprompt
  // -----------------------------------------------------------------------
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

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  // Accept update: tell the waiting SW to skipWaiting and activate
  const handleUpdate = useCallback(() => {
    setBanner(null);
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

  // Handle version mismatch: clear caches and reload
  const handleVersionMismatch = useCallback(async () => {
    setBanner(null);
    // Tell the SW to clear all caches
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHES' });
    }
    // Unregister all SWs
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
    // Clear all caches directly as a safety net
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    window.location.reload();
  }, []);

  // Dismiss banner
  const handleDismiss = useCallback(() => {
    setBanner(null);
  }, []);

  // -----------------------------------------------------------------------
  // Render banner
  // -----------------------------------------------------------------------
  if (!banner) return null;

  return (
    <div className="fixed bottom-44 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      {banner.type === 'version-mismatch' ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Version mismatch detected</p>
            <p className="text-xs text-amber-700">
              A newer version of the app is available. Clear cache and reload to get the latest.
            </p>
          </div>
          <button
            onClick={handleVersionMismatch}
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
          >
            Reload
          </button>
          <button
            onClick={handleDismiss}
            className="shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : banner.type === 'update' ? (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-lg">
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
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-lg">
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
        </div>
      )}
    </div>
  );
}
