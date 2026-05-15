'use client';

// ---------------------------------------------------------------------------
// ErrorMonitor — client-side error listeners
// ---------------------------------------------------------------------------
// Attaches unhandledrejection and unhandled error listeners so that
// errors not caught by React error boundaries are still logged to the
// error log. Renders nothing — it's a side-effect-only component.
// Import in layout.tsx (root layout).

import { useEffect } from 'react';
import { logError } from '@/lib/errorLog';
import { flushImmediately } from '@/lib/errorReporter';

export function ErrorMonitor() {
  useEffect(() => {
    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      logError(event.reason, {
        type: 'unhandledrejection',
        promise: String(event.promise),
      });
    }

    function handleError(event: ErrorEvent) {
      logError(event.error || event.message, {
        type: 'error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    // Flush any queued reports on page unload
    window.addEventListener('beforeunload', flushImmediately);

    return () => {
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection,
      );
      window.removeEventListener('error', handleError);
      window.removeEventListener('beforeunload', flushImmediately);
    };
  }, []);

  return null;
}