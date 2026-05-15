import { describe, it, expect } from 'vitest';
import { computeAtomicSplit, type SplitBreakdown } from '@/lib/solanaPay';

describe('computeAtomicSplit', () => {
  const baseParams = {
    subtotal: 100,
    tipPercent: 15,
    taxRate: 0.08875,
    charityRoundUp: false,
    merchantWallet: 'Mk1',
    taxWallet: 'Tk1',
    charityWallet: 'Ck1',
    charityPartners: [] as string[],
  };

  it('computes basic split with tip and tax, no charity', () => {
    const split = computeAtomicSplit(baseParams);
    expect(split.merchant.amount).toBeCloseTo(100 + 15); // subtotal + tip
    expect(split.tax.amount).toBeCloseTo(100 * 0.08875); // 8.875
    expect(split.charity.amount).toBe(0);
  });

  it('handles 0 tip', () => {
    const split = computeAtomicSplit({ ...baseParams, tipPercent: 0 });
    expect(split.merchant.amount).toBeCloseTo(100);
    expect(split.tax.amount).toBeCloseTo(8.875);
  });

  it('handles 0 tax rate', () => {
    const split = computeAtomicSplit({ ...baseParams, taxRate: 0 });
    expect(split.tax.amount).toBe(0);
    expect(split.merchant.amount).toBeCloseTo(115);
  });

  it('handles 100% tip', () => {
    const split = computeAtomicSplit({ ...baseParams, tipPercent: 100 });
    expect(split.merchant.amount).toBeCloseTo(200);
  });

  it('computes charity round-up when enabled', () => {
    // preCharity = 100 + 15 + 8.875 = 123.875
    // ceil(123.875) = 124, charity = 124 - 123.875 = 0.125
    const split = computeAtomicSplit({ ...baseParams, charityRoundUp: true });
    expect(split.charity.amount).toBeCloseTo(0.125);
    expect(split.charity.address).toBe('Ck1');
  });

  it('sets charity amount to 0 when disabled', () => {
    const split = computeAtomicSplit({ ...baseParams, charityRoundUp: false });
    expect(split.charity.amount).toBe(0);
  });

  it('uses charity partner names in label when provided', () => {
    const split = computeAtomicSplit({
      ...baseParams,
      charityRoundUp: true,
      charityPartners: ['RedCross', 'UNICEF'],
    });
    expect(split.charity.label).toBe('RedCross & UNICEF');
  });

  it('uses generic label when no charity partners', () => {
    const split = computeAtomicSplit({ ...baseParams });
    expect(split.charity.label).toBe('Charity');
  });

  it('correctly labels merchant and tax legs', () => {
    const split = computeAtomicSplit(baseParams);
    expect(split.merchant.label).toBe('Merchant + Tip');
    expect(split.tax.label).toBe('Tax');
  });

  it('assigns correct wallet addresses', () => {
    const split = computeAtomicSplit(baseParams);
    expect(split.merchant.address).toBe('Mk1');
    expect(split.tax.address).toBe('Tk1');
    expect(split.charity.address).toBe('Ck1');
  });

  it('edge case: zero subtotal', () => {
    const split = computeAtomicSplit({
      ...baseParams,
      subtotal: 0,
      charityRoundUp: true,
    });
    expect(split.merchant.amount).toBe(0);
    expect(split.tax.amount).toBe(0);
    expect(split.charity.amount).toBe(0);
  });
});
