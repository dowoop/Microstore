'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, X, Database } from 'lucide-react';
import { isDbPossiblyWiped } from '@/lib/db';

export function DbHealthBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isDbPossiblyWiped().then((wiped) => {
      if (!cancelled && wiped && !dismissed) {
        setVisible(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dismissed]);

  if (!visible) return null;

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-3">
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
        <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">
            Your data has been cleared
          </p>
          <p className="mt-0.5 text-xs text-amber-600">
            Your browser cache was wiped and all shop data was lost. If you
            have a JSON backup, you can restore it from Settings.
          </p>
          <Link
            href="/"
            className="mt-2 inline-block text-xs font-medium text-amber-700 underline hover:text-amber-900"
          >
            Go to Settings to import your backup →
          </Link>
        </div>
        <button
          onClick={() => {
            setVisible(false);
            setDismissed(true);
          }}
          className="shrink-0 rounded p-0.5 text-amber-400 hover:text-amber-600 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
