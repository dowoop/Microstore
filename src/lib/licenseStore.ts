// ---------------------------------------------------------------------------
// License store — persistent license state via zustand
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { verifyAndActivateLicense, deactivateLicense, type LicensePayload } from '@/lib/licenseKey';
import { getActiveTier, Tier, isPro } from '@/lib/featureFlags';

export type LicenseStatus = 'none' | 'activating' | 'active' | 'expired' | 'invalid';

export interface LicenseState {
  licenseKey: string | null; status: LicenseStatus; payload: LicensePayload | null; error: string | null;
  activate: (key: string) => Promise<void>; deactivate: () => void; isPro: () => boolean; getTier: () => Tier; revalidate: () => Promise<void>;
}

export const useLicenseStore = create<LicenseState>()(persist((set, get) => ({
  licenseKey: null, status: 'none', payload: null, error: null,
  activate: async (key: string) => {
    set({ status: 'activating', error: null });
    try {
      const result = await verifyAndActivateLicense(key);
      if (result.valid && result.payload) {
        set({ licenseKey: key, status: 'active', payload: result.payload, error: null });
      } else {
        deactivateLicense();
        set({ licenseKey: null, status: result.error === 'Expired' ? 'expired' : 'invalid', payload: result.payload ?? null, error: result.error ?? 'Unknown' });
      }
    } catch (err) {
      deactivateLicense();
      set({ licenseKey: null, status: 'invalid', payload: null, error: err instanceof Error ? err.message : 'Unknown' });
    }
  },
  deactivate: () => { deactivateLicense(); set({ licenseKey: null, status: 'none', payload: null, error: null }); },
  isPro, getTier: getActiveTier,
  revalidate: async () => {
    const { licenseKey } = get();
    if (!licenseKey) { set({ status: 'none', payload: null, error: null }); return; }
    set({ status: 'activating' });
    try {
      const result = await verifyAndActivateLicense(licenseKey);
      if (result.valid && result.payload) set({ status: 'active', payload: result.payload, error: null });
      else set({ status: result.error === 'Expired' ? 'expired' : 'invalid', payload: result.payload ?? null, error: result.error ?? 'Unknown' });
    } catch { set({ status: 'invalid', payload: null, error: 'Validation failed' }); }
  },
}), { name: 'microstore-license', partialize: (s) => ({ licenseKey: s.licenseKey }) }));
