// ---------------------------------------------------------------------------
// Tests: featureFlags.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Tier,
  getActiveTier,
  setActiveTier,
  isPro,
  isFeatureEnabled,
  getProFeatures,
  FEATURES,
} from '@/lib/featureFlags';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  setActiveTier(Tier.Free);
});

// ---------------------------------------------------------------------------
// Tier management
// ---------------------------------------------------------------------------

describe('getActiveTier', () => {
  it('returns Free by default', () => {
    expect(getActiveTier()).toBe(Tier.Free);
  });

  it('returns Pro after setActiveTier(Tier.Pro)', () => {
    setActiveTier(Tier.Pro);
    expect(getActiveTier()).toBe(Tier.Pro);
  });

  it('returns Free after toggling back', () => {
    setActiveTier(Tier.Pro);
    setActiveTier(Tier.Free);
    expect(getActiveTier()).toBe(Tier.Free);
  });
});

describe('isPro', () => {
  it('returns false when tier is Free', () => {
    expect(isPro()).toBe(false);
  });

  it('returns true when tier is Pro', () => {
    setActiveTier(Tier.Pro);
    expect(isPro()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Feature enablement (tier-based)
// ---------------------------------------------------------------------------

describe('isFeatureEnabled', () => {
  it('returns true for free-tier features on Free tier', () => {
    expect(isFeatureEnabled('POS')).toBe(true);
    expect(isFeatureEnabled('SINGLE_SHOP')).toBe(true);
    expect(isFeatureEnabled('QR_PAYMENTS')).toBe(true);
  });

  it('returns false for pro-tier features on Free tier', () => {
    expect(isFeatureEnabled('MULTI_TOKEN')).toBe(false);
    expect(isFeatureEnabled('MULTI_SHOP')).toBe(false);
    expect(isFeatureEnabled('CRM')).toBe(false);
    expect(isFeatureEnabled('PDF_RECEIPTS')).toBe(false);
    expect(isFeatureEnabled('ANALYTICS')).toBe(false);
  });

  it('returns true for pro-tier features on Pro tier', () => {
    setActiveTier(Tier.Pro);
    expect(isFeatureEnabled('MULTI_TOKEN')).toBe(true);
    expect(isFeatureEnabled('MULTI_SHOP')).toBe(true);
    expect(isFeatureEnabled('CRM')).toBe(true);
    expect(isFeatureEnabled('PDF_RECEIPTS')).toBe(true);
    expect(isFeatureEnabled('ANALYTICS')).toBe(true);
  });

  it('returns false for unknown feature names', () => {
    expect(isFeatureEnabled('NONEXISTENT')).toBe(false);
    expect(isFeatureEnabled('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getProFeatures
// ---------------------------------------------------------------------------

describe('getProFeatures', () => {
  it('returns all pro-tier feature names', () => {
    const pro = getProFeatures();
    expect(pro).toContain('MULTI_TOKEN');
    expect(pro).toContain('MULTI_SHOP');
    expect(pro).toContain('CRM');
    expect(pro).toContain('PDF_RECEIPTS');
    expect(pro).toContain('ANALYTICS');
  });

  it('does not include free-tier features', () => {
    const pro = getProFeatures();
    expect(pro).not.toContain('POS');
    expect(pro).not.toContain('SINGLE_SHOP');
    expect(pro).not.toContain('QR_PAYMENTS');
  });

  it('returns 5 pro features', () => {
    expect(getProFeatures()).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// FEATURES registry
// ---------------------------------------------------------------------------

describe('FEATURES', () => {
  it('has 8 total features', () => {
    expect(Object.keys(FEATURES)).toHaveLength(8);
  });

  it('every feature has name, tier, and description', () => {
    for (const [, flag] of Object.entries(FEATURES)) {
      expect(flag.name).toBeTruthy();
      expect([Tier.Free, Tier.Pro]).toContain(flag.tier);
      expect(flag.description).toBeTruthy();
    }
  });
});
