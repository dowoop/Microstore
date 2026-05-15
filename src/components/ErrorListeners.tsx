'use client';

// ---------------------------------------------------------------------------
// ErrorListeners — client-side error listeners
// ---------------------------------------------------------------------------

import { useEffect } from 'react';
import { logError } from '@/lib/errorLog';
import { flushPending } from '@/lib/errorReporter';

export function ErrorListeners() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      logError(
        reason instanceof Error ? reason : new Error(String(reason)),
        { type: 'unhandledrejection' },
      );
    };

    window.addEventListener('unhandledrejection', onRejection);

    const onUnload = () => {
      flushPending();
    };

    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  return null;
}