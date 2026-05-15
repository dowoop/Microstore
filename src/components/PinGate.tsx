'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Lock, ShieldAlert, Download, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { verifyPin, isValidPin } from '@/lib/pinCrypto';

/** Base lockout duration in seconds — doubles each consecutive lockout. */
const BASE_LOCKOUT_SECONDS = 30;

interface PinGateProps {
  /** Called after successful PIN entry so parent can proceed. */
  onUnlock?: () => void;
}

/**
 * PinGate — full-screen PIN entry modal.
 *
 * Renders when a PIN is set but the session hasn't been unlocked yet.
 * After 3 failed attempts, enforces an escalating lockout timer.
 * Provides a "Forgot PIN?" recovery flow that warns about local-only data
 * and offers to export data before clearing the PIN.
 */
export function PinGate({ onUnlock }: PinGateProps) {
  const pinHash = useAppStore((s) => s.pinHash);
  const pinSalt = useAppStore((s) => s.pinSalt);
  const clearPin = useAppStore((s) => s.clearPin);
  const setSessionUnlocked = useAppStore((s) => s.setSessionUnlocked);

  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);

  // Attempt tracking
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const [lockoutMultiplier, setLockoutMultiplier] = useState(1);
  const [countdown, setCountdown] = useState(0);

  // Recovery flow
  const [showRecovery, setShowRecovery] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the hidden input on mount and after interactions
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Countdown timer during lockout
  useEffect(() => {
    if (lockoutUntil === 0) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        setLockoutUntil(0);
        setAttempts(0); // reset attempts after lockout ends
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (lockoutUntil > 0) return;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        setDigits((prev) => prev.slice(0, -1));
        setError(null);
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        const next = [...digits, e.key];
        setDigits(next);
        setError(null);

        // Auto-submit when 6 digits reached
        if (next.length >= 6) {
          submitPin(next.join(''));
        } else if (next.length >= 4) {
          // Could submit — but wait, user might type more
        }
        return;
      }

      if (e.key === 'Enter') {
        submitPin(digits.join(''));
      }
    },
    [digits, lockoutUntil],
  );

  const submitPin = useCallback(
    async (pin: string) => {
      if (!pinHash || !pinSalt) return;
      if (pin.length < 4 || pin.length > 6) {
        setError('Enter 4–6 digits');
        return;
      }

      setChecking(true);
      try {
        const valid = await verifyPin(pin, pinHash, pinSalt);
        if (valid) {
          setSessionUnlocked(true);
          setDigits([]);
          setAttempts(0);
          setLockoutMultiplier(1);
          onUnlock?.();
        } else {
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          setDigits([]);
          setShake(true);
          setTimeout(() => setShake(false), 500);

          if (newAttempts >= 3) {
            const duration = BASE_LOCKOUT_SECONDS * 1000 * lockoutMultiplier;
            setLockoutUntil(Date.now() + duration);
            setLockoutMultiplier((m) => m * 2);
            setError(`Too many attempts. Locked for ${duration / 1000}s.`);
          } else {
            setError(`Wrong PIN. ${3 - newAttempts} attempt${3 - newAttempts === 1 ? '' : 's'} remaining.`);
          }
        }
      } finally {
        setChecking(false);
      }
    },
    [pinHash, pinSalt, attempts, lockoutMultiplier, setSessionUnlocked, onUnlock],
  );

  // Number pad buttons
  const handleNumPad = (digit: string) => {
    if (lockoutUntil > 0) return;
    const next = [...digits, digit];
    setDigits(next);
    setError(null);
    if (next.length >= 6) {
      submitPin(next.join(''));
    }
  };

  const handleDelete = () => {
    setDigits((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleExportBeforeReset = () => {
    // Trigger data export via a custom event that the settings page listens for
    window.dispatchEvent(new CustomEvent('microstore:export-data'));
  };

  const handleResetPin = () => {
    clearPin();
    setSessionUnlocked(true);
    setShowRecovery(false);
    setShowResetConfirm(false);
    onUnlock?.();
  };

  // If no PIN is set, don't render the gate
  if (!pinHash) return null;

  const isLocked = lockoutUntil > 0 && countdown > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="flex w-full max-w-sm flex-col items-center px-6">
        {/* Icon */}
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
          <Lock className="h-8 w-8 text-blue-600" />
        </div>

        {/* Title */}
        <h1 className="mb-2 text-xl font-bold text-gray-900">Enter PIN</h1>
        <p className="mb-8 text-sm text-gray-500">
          {isLocked
            ? `Locked — wait ${countdown}s`
            : showRecovery
              ? 'PIN reset — read carefully'
              : '4–6 digit security PIN'}
        </p>

        {showRecovery ? (
          /* ---- Recovery flow ---- */
          <div className="w-full space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Data is stored locally</p>
                  <p className="mt-1 text-amber-700">
                    There is no server recovery. Resetting the PIN will NOT delete your data,
                    but you should export it first as a backup.
                  </p>
                </div>
              </div>
            </div>

            {!showResetConfirm ? (
              <div className="space-y-2">
                <button
                  onClick={handleExportBeforeReset}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Export Data First
                </button>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Skip Export — Reset PIN
                </button>
                <button
                  onClick={() => {
                    setShowRecovery(false);
                    setShowResetConfirm(false);
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Go Back
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p>
                    This will clear the PIN. Anyone with access to this device will be able to
                    access all settings and data.
                  </p>
                </div>
                <button
                  onClick={handleResetPin}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                >
                  Confirm Reset
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ---- PIN entry ---- */
          <>
            {/* Dot display */}
            <div className="mb-6 flex gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
                    i < digits.length
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300 bg-white'
                  } ${i >= 4 && i >= digits.length ? 'opacity-50' : ''}`}
                />
              ))}
            </div>

            {/* Error message */}
            {error && (
              <div
                className={`mb-4 rounded-lg px-4 py-2 text-center text-sm ${
                  isLocked
                    ? 'bg-red-50 text-red-600'
                    : 'bg-red-50 text-red-600'
                } ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
              >
                {error}
              </div>
            )}

            {/* Hidden input for keyboard focus */}
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value=""
              onKeyDown={handleKeyDown}
              disabled={isLocked || checking}
              className="absolute opacity-0 w-0 h-0"
              aria-label="PIN input"
            />

            {/* Number pad */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key, i) => {
                if (key === '') {
                  return <div key={i} />;
                }
                if (key === '⌫') {
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={handleDelete}
                      disabled={isLocked || checking}
                      className="flex h-14 items-center justify-center rounded-xl bg-gray-100 text-lg font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition-colors"
                      aria-label="Delete"
                    >
                      ⌫
                    </button>
                  );
                }
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleNumPad(key)}
                    disabled={isLocked || checking}
                    className="flex h-14 items-center justify-center rounded-xl bg-gray-50 text-xl font-semibold text-gray-900 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-30 transition-colors"
                  >
                    {key}
                  </button>
                );
              })}
            </div>

            {/* Submit button for 4-5 digit PINs */}
            {digits.length >= 4 && digits.length < 6 && (
              <button
                type="button"
                onClick={() => submitPin(digits.join(''))}
                disabled={isLocked || checking}
                className="mt-4 w-full max-w-[280px] rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {checking ? 'Checking…' : 'Unlock'}
              </button>
            )}

            {/* Checking spinner */}
            {checking && (
              <div className="mt-3 text-sm text-gray-500">Verifying…</div>
            )}

            {/* Forgot PIN link */}
            <button
              type="button"
              onClick={() => setShowRecovery(true)}
              disabled={isLocked}
              className="mt-6 text-sm text-gray-400 hover:text-blue-600 disabled:opacity-30 transition-colors"
            >
              Forgot PIN?
            </button>
          </>
        )}
      </div>

      {/* Shake animation keyframes */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
