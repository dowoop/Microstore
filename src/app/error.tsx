'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logError } from '@/lib/errorLog';

// ---------------------------------------------------------------------------
// Global Error Boundary (Next.js App Router error.tsx)
// Catches unhandled errors from any page/component in the subtree.
// ---------------------------------------------------------------------------

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[Microstore] Uncaught error:', error);
    // Persist to local error log + queue for remote reporting
    logError(error, { component: 'GlobalError', digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>

      <h1 className="mt-4 text-xl font-bold text-gray-900">
        Something went wrong
      </h1>

      <p className="mt-2 max-w-md text-sm text-gray-500">
        {error.message || 'An unexpected error occurred. This may be due to a database issue or network problem.'}
      </p>

      {error.digest && (
        <p className="mt-1 text-xs text-gray-500 font-mono">
          Error ID: {error.digest}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Go home
        </Link>
      </div>

      <p className="mt-6 text-xs text-gray-500">
        If the problem persists, try clearing your browser cache or restoring from a backup in Settings.
      </p>
    </div>
  );
}