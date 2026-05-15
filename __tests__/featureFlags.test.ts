import { describe, it, expect, beforeEach } from 'vitest';
import { Tier, getActiveTier, setActiveTier, isPro, isFeatureEnabled, getProFeatures, FEATURES } from '@/lib/featureFlags';
beforeEach(() => { setActiveTier(Tier.Free); });
describe('Tier management', () => {
  it('defaults to Free', () => { expect(getActiveTier()).toBe(Tier.Free); });
  it('changes to Pro', () => { setActiveTier(Tier.Pro); expect(getActiveTier()).toBe(Tier.Pro); });
});
describe('isPro', () => {
  it('false on Free', () => { expect(isPro()).toBe(false); });
  it('true on Pro', () => { setActiveTier(Tier.Pro); expect(isPro()).toBe(true); });
});
describe('isFeatureEnabled', () => {
  it('free features always true', () => { expect(isFeatureEnabled('POS')).toBe(true); expect(isFeatureEnabled('QR_PAYMENTS')).toBe(true); });
  it('pro features false on Free', () => { expect(isFeatureEnabled('MULTI_TOKEN')).toBe(false); expect(isFeatureEnabled('CRM')).toBe(false); });
  it('pro features true on Pro', () => { setActiveTier(Tier.Pro); expect(isFeatureEnabled('MULTI_TOKEN')).toBe(true); expect(isFeatureEnabled('ANALYTICS')).toBe(true); });
  it('unknown returns false', () => { expect(isFeatureEnabled('NONEXISTENT')).toBe(false); });
});
describe('getProFeatures', () => {
  it('returns 5 features', () => { expect(getProFeatures()).toHaveLength(5); });
  it('includes MULTI_TOKEN', () => { expect(getProFeatures()).toContain('MULTI_TOKEN'); });
  it('excludes POS', () => { expect(getProFeatures()).not.toContain('POS'); });
});
describe('FEATURES registry', () => {
  it('has 8 features', () => { expect(Object.keys(FEATURES)).toHaveLength(8); });
  it('each has name, tier, description', () => {
    for (const [, f] of Object.entries(FEATURES)) {
      expect(f.name).toBeTruthy();
      expect([Tier.Free, Tier.Pro]).toContain(f.tier);
      expect(f.description).toBeTruthy();
    }
  });
});
