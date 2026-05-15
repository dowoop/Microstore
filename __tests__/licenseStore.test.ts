// ---------------------------------------------------------------------------
// Tests: licenseStore.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from 'vitest';
import { useLicenseStore } from '@/lib/licenseStore';
import { deactivateLicense } from '@/lib/licenseKey';
import { getActiveTier, Tier, isPro } from '@/lib/featureFlags';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  const store = useLicenseStore.getState();
  store.deactivate();
  deactivateLicense();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('licenseStore — initial state', () => {
  it('starts with no license', () => {
    const state = useLicenseStore.getState();
    expect(state.licenseKey).toBeNull();
    expect(state.status).toBe('none');
    expect(state.payload).toBeNull();
    expect(state.error).toBeNull();
    expect(state.isPro()).toBe(false);
    expect(state.getTier()).toBe(Tier.Free);
  });
});

// ---------------------------------------------------------------------------
// deactivate
// ---------------------------------------------------------------------------

describe('licenseStore — deactivate', () => {
  it('clears all license state', () => {
    const store = useLicenseStore.getState();
    store.deactivate();

    expect(store.licenseKey).toBeNull();
    expect(store.status).toBe('none');
    expect(store.payload).toBeNull();
    expect(store.error).toBeNull();
    expect(isPro()).toBe(false);
  });

  it('is idempotent', () => {
    const store = useLicenseStore.getState();
    store.deactivate();
    store.deactivate();
    expect(store.status).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// isPro / getTier delegates
// ---------------------------------------------------------------------------

describe('licenseStore — delegates', () => {
  it('isPro returns false initially', () => {
    expect(useLicenseStore.getState().isPro()).toBe(false);
  });

  it('getTier returns Free initially', () => {
    expect(useLicenseStore.getState().getTier()).toBe(Tier.Free);
  });
});
