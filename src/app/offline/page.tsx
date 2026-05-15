'use client';

import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="mx-auto max-w-sm">
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
            <WifiOff className="h-10 w-10 text-blue-600" />
          </div>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">You&apos;re Offline</h1>
        <p className="mb-6 text-sm text-gray-600">
          Microstore works offline. Your data is stored locally and will sync when you&apos;re back online.
        </p>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-left text-sm text-gray-600">
          <p className="font-medium text-gray-900">What you can do offline:</p>
          <ul className="mt-2 space-y-1 text-xs">
            <li>• Browse your inventory and shops</li>
            <li>• Create orders via POS (queued for sync)</li>
            <li>• View past orders and expenses</li>
          </ul>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
