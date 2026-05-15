// ---------------------------------------------------------------------------
// License store — persistent license state via zustand
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  verifyAndActivateLicense,
  deactivateLicense,
  type LicensePayload,
} from '@/lib/licenseKey';
import { getActiveTier, Tier, isPro } from '@/lib/featureFlags';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LicenseStatus = 'none' | 'activating' | 'active' | 'expired' | 'invalid';

export interface LicenseState {
  /** The raw license key string (persisted). */
  licenseKey: string | null;
  /** Current validation status. */
  status: LicenseStatus;
  /** Decoded payload when status is 'active'. */
  payload: LicensePayload | null;
  /** Error message when status is 'expired' or 'invalid'. */
  error: string | null;

  /** Attempt to activate with a license key string. */
  activate: (key: string) => Promise<void>;
  /** Remove the license and revert to Free tier. */
  deactivate: () => void;
  /** Check if Pro features are currently active. */
  isPro: () => boolean;
  /** Get the active tier. */
  getTier: () => Tier;
  /** Re-validate on app start. Called by app bootstrap. */
  revalidate: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set, get) => ({
      licenseKey: null,
      status: 'none',
      payload: null,
      error: null,

      activate: async (key: string) => {
        set({ status: 'activating', error: null });
        try {
          const result = await verifyAndActivateLicense(key);
          if (result.valid && result.payload) {
            set({
              licenseKey: key,
              status: 'active',
              payload: result.payload,
              error: null,
            });
          } else {
            deactivateLicense();
            const isExpired =
              result.payload && result.payload.exp !== 0 &&
              result.payload.exp < Math.floor(Date.now() / 1000);
            set({
              licenseKey: null,
              status: isExpired ? 'expired' : 'invalid',
              payload: result.payload ?? null,
              error: result.error ?? 'Unknown error',
            });
          }
        } catch (err) {
          deactivateLicense();
          set({
            licenseKey: null,
            status: 'invalid',
            payload: null,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      },

      deactivate: () => {
        deactivateLicense();
        set({ licenseKey: null, status: 'none', payload: null, error: null });
      },

      isPro,
      getTier: getActiveTier,

      revalidate: async () => {
        const { licenseKey } = get();
        if (!licenseKey) {
          set({ status: 'none', payload: null, error: null });
          return;
        }
        set({ status: 'activating' });
        try {
          const result = await verifyAndActivateLicense(licenseKey);
          if (result.valid && result.payload) {
            set({ status: 'active', payload: result.payload, error: null });
          } else {
            const isExpired =
              result.payload && result.payload.exp !== 0 &&
              result.payload.exp < Math.floor(Date.now() / 1000);
            set({
              status: isExpired ? 'expired' : 'invalid',
              payload: result.payload ?? null,
              error: result.error ?? 'Unknown error',
            });
          }
        } catch {
          set({ status: 'invalid', payload: null, error: 'Validation failed' });
        }
      },
    }),
    {
      name: 'microstore-license',
      partialize: (state) => ({ licenseKey: state.licenseKey }),
    },
  ),
);
