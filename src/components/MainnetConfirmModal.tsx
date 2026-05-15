'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';

const MAINNET_CONFIRMED_KEY = 'microstore-mainnet-confirmed';

/**
 * Returns true if the user has previously confirmed they understand mainnet
 * risks during this browser session (persisted via localStorage).
 */
export function hasConfirmedMainnet(): boolean {
  if (typeof window === 'undefined') return true; // SSR: skip modal
  try {
    return localStorage.getItem(MAINNET_CONFIRMED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Set the flag so the modal won't show again this session.
 */
export function markMainnetConfirmed(): void {
  try {
    localStorage.setItem(MAINNET_CONFIRMED_KEY, 'true');
  } catch {
    // localStorage unavailable — modal will keep showing, which is safe
  }
}

/**
 * Modal shown when the user switches to mainnet-beta for the first time.
 * Requires explicit acknowledgment before proceeding.
 */
export function MainnetConfirmModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Trap focus inside the modal
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Mainnet confirmation"
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
            <Shield className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Switch to Mainnet
            </h2>
          </div>
        </div>

        <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm text-amber-800">
            You are switching to Mainnet. Real SOL will be used. Are you sure?
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              markMainnetConfirmed();
              onConfirm();
            }}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  );
}
