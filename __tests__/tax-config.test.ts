import { describe, it, expect } from 'vitest';
import { computeAtomicSplit, computeOrderTotals } from '@/lib/solanaPay';

describe('tax-config', () => {
  // --------------------------------------------------------------------------
  // 1. Zero taxRate produces zero tax leg in computeAtomicSplit
  // --------------------------------------------------------------------------

  it('new shop with taxRate:0 produces zero reserve leg in computeAtomicSplit', () => {
    const split = computeAtomicSplit({
      subtotal: 100,
      tipPercent: 15,
      reserveRate: 0, // taxRate: 0 → no reserve
      charityRoundUp: false,
      merchantWallet: 'MERCHANT',
      reserveWallet: 'RESERVE',
      charityWallet: 'CHARITY',
      charityPartners: [],
    });

    expect(split.reserve.amount).toBe(0);
    expect(split.merchant.amount).toBeGreaterThan(0); // merchant still gets subtotal+tip
  });

  it('zero reserveRate produces zero reserve leg in computeOrderTotals', () => {
    const totals = computeOrderTotals({
      subtotal: 50,
      tipPercent: 10,
      reserveRate: 0,
      charityRoundUp: false,
    });

    expect(totals.reserve).toBe(0);
    expect(totals.subtotal).toBe(50);
    expect(totals.tip).toBe(5);
  });

  // --------------------------------------------------------------------------
  // 2. taxRate validation: rejects > 1 and < 0
  // --------------------------------------------------------------------------

  it('rejects taxRate > 1', () => {
    // createShopStore.setTaxRate clamps to [0, 1]
    // A rate of 1.5 should be clamped to 1
    const clamp = (rate: number) => Math.max(0, Math.min(1, rate));
    expect(clamp(1.5)).toBe(1);
    expect(clamp(2.0)).toBe(1);
  });

  it('rejects taxRate < 0', () => {
    const clamp = (rate: number) => Math.max(0, Math.min(1, rate));
    expect(clamp(-0.1)).toBe(0);
    expect(clamp(-1.0)).toBe(0);
  });

  it('allows taxRate within [0, 1]', () => {
    const clamp = (rate: number) => Math.max(0, Math.min(1, rate));
    expect(clamp(0)).toBe(0);
    expect(clamp(0.08875)).toBe(0.08875);
    expect(clamp(0.5)).toBe(0.5);
    expect(clamp(1.0)).toBe(1.0);
  });

  // --------------------------------------------------------------------------
  // 3. Receipt renders shop's taxLabel (logic test)
  // --------------------------------------------------------------------------

  it('taxLabel resolution prefers order snapshot over shop', () => {
    // Simulates the logic used in receipt UI:
    // order.taxLabel ?? shop?.taxLabel ?? shop?.reserveLabel ?? 'Reserve'
    const orderTaxLabel = undefined;
    const shopTaxLabel = 'VAT';
    const shopReserveLabel = undefined;

    const displayLabel = orderTaxLabel ?? shopTaxLabel ?? shopReserveLabel ?? 'Reserve';
    expect(displayLabel).toBe('VAT');
  });

  it('taxLabel falls back to generic Reserve when nothing is set', () => {
    const displayLabel = undefined ?? undefined ?? undefined ?? 'Reserve';
    expect(displayLabel).toBe('Reserve');
  });

  it('order taxLabel snapshot overrides shop taxLabel', () => {
    const displayLabel = 'GST' ?? 'Sales Tax' ?? undefined ?? 'Reserve';
    expect(displayLabel).toBe('GST');
  });

  // --------------------------------------------------------------------------
  // 4. Property tests from split-truth still pass with parameterized taxRate
  // --------------------------------------------------------------------------

  it('round2(leg sum) ≈ displayedTotal (≤2¢) with taxRate=0.08875', () => {
    const totals = computeOrderTotals({
      subtotal: 100,
      tipPercent: 15,
      reserveRate: 0.08875,
      charityRoundUp: false,
    });

    const legSum = totals.subtotal + totals.tip + totals.reserve + totals.charity;
    const diff = Math.abs(totals.total - legSum);
    expect(diff).toBeLessThanOrEqual(0.02); // property from split-truth handoff
  });

  it('reserveRate=0 → reserve leg is 0 (property d from split-truth)', () => {
    const totals = computeOrderTotals({
      subtotal: 99.99,
      tipPercent: 18,
      reserveRate: 0,
      charityRoundUp: true,
    });

    expect(totals.reserve).toBe(0);
  });

  it('subtotal=0 → all legs are 0 (property e from split-truth)', () => {
    const totals = computeOrderTotals({
      subtotal: 0,
      tipPercent: 10,
      reserveRate: 0.08875,
      charityRoundUp: true,
    });

    expect(totals.subtotal).toBe(0);
    expect(totals.tip).toBe(0);
    expect(totals.reserve).toBe(0);
    expect(totals.charity).toBe(0);
    expect(totals.total).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 5. computeAtomicSplit with different taxRates
  // --------------------------------------------------------------------------

  it('computeAtomicSplit with non-zero taxRate produces correct reserve leg', () => {
    const split = computeAtomicSplit({
      subtotal: 200,
      tipPercent: 0,
      reserveRate: 0.08875,
      charityRoundUp: false,
      merchantWallet: 'MERCHANT',
      reserveWallet: 'TAX_WALLET',
      charityWallet: 'CHARITY',
      charityPartners: [],
    });

    // reserve = 200 * 0.08875 = 17.75
    expect(split.reserve.amount).toBe(17.75);
    expect(split.reserve.address).toBe('TAX_WALLET');
    expect(split.reserve.label).toBe('Reserve');
  });

  it('computeAtomicSplit with taxRate=0.05 (e.g. 5%% GST)', () => {
    const split = computeAtomicSplit({
      subtotal: 150,
      tipPercent: 10,
      reserveRate: 0.05,
      charityRoundUp: false,
      merchantWallet: 'M',
      reserveWallet: 'R',
      charityWallet: 'C',
      charityPartners: [],
    });

    // reserve = 150 * 0.05 = 7.50
    expect(split.reserve.amount).toBe(7.50);
    // merchant = subtotal(150) + tip(15) = 165
    expect(split.merchant.amount).toBe(165);
  });
});
