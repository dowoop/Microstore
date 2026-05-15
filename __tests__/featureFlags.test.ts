import { describe, it, expect, beforeEach } from 'vitest';
import { Tier, getActiveTier, setActiveTier, isPro, isFeatureEnabled, getProFeatures, FEATURES } from '@/lib/featureFlags';
beforeEach(() => { setActiveTier(Tier.Free); });
describe('getActiveTier', () => {
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
  it('unknown returns false', () => { expect(isFeatureEnabled('NOPE')).toBe(false); });
});
describe('getProFeatures', () => {
  it('returns 5 features', () => { expect(getProFeatures()).toHaveLength(5); });
  it('includes MULTI_TOKEN', () => { expect(getProFeatures()).toContain('MULTI_TOKEN'); });
});
describe('FEATURES', () => {
  it('has 8 features', () => { expect(Object.keys(FEATURES)).toHaveLength(8); });
});
