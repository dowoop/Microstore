import { describe, it, expect } from 'vitest';
import { computeOrderTotals } from '@/lib/solanaPay';

describe('computeOrderTotals', () => {
  // --------------------------------------------------------------------------
  // Basic arithmetic
  // --------------------------------------------------------------------------

  it('returns zeroes for empty cart', () => {
    const totals = computeOrderTotals({
      subtotal: 0,
      tipPercent: 0,
      taxRate: 0,
      charityRoundUp: false,
    });
    expect(totals).toEqual({
      subtotal: 0,
      tip: 0,
      tax: 0,
      charity: 0,
      total: 0,
    });
  });

  it('computes subtotal + tip only (no tax, no charity)', () => {
    const totals = computeOrderTotals({
      subtotal: 100,
      tipPercent: 15,
      taxRate: 0,
      charityRoundUp: false,
    });
    expect(totals.subtotal).toBe(100);
    expect(totals.tip).toBe(15);
    expect(totals.tax).toBe(0);
    expect(totals.charity).toBe(0);
    expect(totals.total).toBe(115);
  });

  it('computes subtotal + tax only (no tip, no charity)', () => {
    const totals = computeOrderTotals({
      subtotal: 200,
      tipPercent: 0,
      taxRate: 0.08875,
      charityRoundUp: false,
    });
    expect(totals.subtotal).toBe(200);
    expect(totals.tip).toBe(0);
    expect(totals.tax).toBe(17.75); // 200 * 0.08875 = 17.75
    expect(totals.charity).toBe(0);
    expect(totals.total).toBe(217.75);
  });

  it('computes full order: subtotal + tip + tax + charity', () => {
    const totals = computeOrderTotals({
      subtotal: 42.5,
      tipPercent: 18,
      taxRate: 0.08875,
      charityRoundUp: true,
    });
    // subtotal: 42.5, tip: 7.65, tax: 3.771875, preCharity: 53.921875
    // charity: ceil(53.921875) - 53.921875 = 54 - 53.921875 = 0.078125
    expect(totals.subtotal).toBe(42.5);
    expect(totals.tip).toBeCloseTo(7.65, 5);
    expect(totals.tax).toBeCloseTo(3.77, 2);
    expect(totals.charity).toBeCloseTo(0.08, 2);
    // round2: 42.5 + 7.65 + 3.77 + 0.08 = 54.00
    expect(totals.total).toBe(54.0);
  });

  // --------------------------------------------------------------------------
  // Edge case: floating-point sub-cent residuals
  // --------------------------------------------------------------------------

  it('handles sub-cent residuals with fine-grained prices', () => {
    // 3 items at $3.33, $6.67, $10.01
    const totals = computeOrderTotals({
      subtotal: 20.01, // 3.33 + 6.67 + 10.01
      tipPercent: 10,
      taxRate: 0.05,
      charityRoundUp: false,
    });
    // tip: 2.001, tax: 1.0005
    expect(totals.tip).toBeCloseTo(2.0, 2); // rounded to 2dp
    expect(totals.tax).toBeCloseTo(1.0, 2);
    // total: round2(20.01) + round2(2.001) + round2(1.0005) + 0 = 20.01 + 2.00 + 1.00 = 23.01
    expect(totals.total).toBe(23.01);
  });

  it('handles sub-cent subtotal (e.g., single item at $0.01)', () => {
    const totals = computeOrderTotals({
      subtotal: 0.01,
      tipPercent: 20,
      taxRate: 0.08875,
      charityRoundUp: false,
    });
    // tip: 0.002, tax: 0.0008875
    expect(totals.tip).toBe(0); // rounded to 0
    expect(totals.tax).toBe(0); // rounded to 0
    expect(totals.total).toBe(0.01);
  });

  // --------------------------------------------------------------------------
  // Edge case: charity at exact-dollar amounts
  // --------------------------------------------------------------------------

  it('returns 0 charity when pre-charity total is exactly a whole dollar', () => {
    const totals = computeOrderTotals({
      subtotal: 100,
      tipPercent: 0,
      taxRate: 0,
      charityRoundUp: true,
    });
    // preCharity: 100, ceil(100) - 100 = 0
    expect(totals.charity).toBe(0);
    expect(totals.total).toBe(100);
  });

  it('returns 0 charity when pre-charity total is $47.00 exactly', () => {
    const totals = computeOrderTotals({
      subtotal: 40,
      tipPercent: 0,
      taxRate: 0.175, // 40 * 0.175 = 7.0, 40 + 7 = 47.00
      charityRoundUp: true,
    });
    expect(totals.charity).toBe(0);
    expect(totals.total).toBe(47.0);
  });

  // --------------------------------------------------------------------------
  // Edge case: very small tips (< $0.01)
  // --------------------------------------------------------------------------

  it('rounds very small tips to 0', () => {
    const totals = computeOrderTotals({
      subtotal: 0.05,
      tipPercent: 1, // 1% of 0.05 = 0.0005
      taxRate: 0,
      charityRoundUp: false,
    });
    expect(totals.tip).toBe(0); // 0.0005 rounds to 0.00
    expect(totals.total).toBe(0.05);
  });

  it('surfaces a tip of exactly 0.005 as 0.01 after rounding', () => {
    const totals = computeOrderTotals({
      subtotal: 0.50,
      tipPercent: 1, // 1% of 0.50 = 0.005
      taxRate: 0,
      charityRoundUp: false,
    });
    expect(totals.tip).toBe(0.01); // round2(0.005) = 0.01
  });

  // --------------------------------------------------------------------------
  // Edge case: very large tips (> $1000)
  // --------------------------------------------------------------------------

  it('handles large subtotals with large tips', () => {
    const totals = computeOrderTotals({
      subtotal: 5000,
      tipPercent: 25,
      taxRate: 0.08875,
      charityRoundUp: false,
    });
    // tip: 1250, tax: 443.75
    expect(totals.tip).toBe(1250);
    expect(totals.tax).toBe(443.75);
    expect(totals.total).toBe(6693.75);
  });

  it('handles $10k order with 20% tip', () => {
    const totals = computeOrderTotals({
      subtotal: 10000,
      tipPercent: 20,
      taxRate: 0.08875,
      charityRoundUp: true,
    });
    // tip: 2000, tax: 887.5, preCharity: 12887.5
    // charity: ceil(12887.5) - 12887.5 = 12888 - 12887.5 = 0.5
    expect(totals.tip).toBe(2000);
    expect(totals.tax).toBe(887.5);
    expect(totals.charity).toBe(0.5);
    // round2: 10000 + 2000 + 887.5 + 0.5 = 12888
    expect(totals.total).toBe(12888);
  });

  // --------------------------------------------------------------------------
  // Edge case: tax at various rates (0%, 5%, 8.875%, 10%, 25%)
  // --------------------------------------------------------------------------

  it('tax at 0%', () => {
    const totals = computeOrderTotals({
      subtotal: 100,
      tipPercent: 10,
      taxRate: 0,
      charityRoundUp: false,
    });
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(110);
  });

  it('tax at 5%', () => {
    const totals = computeOrderTotals({
      subtotal: 100,
      tipPercent: 10,
      taxRate: 0.05,
      charityRoundUp: false,
    });
    expect(totals.tax).toBe(5);
    expect(totals.total).toBe(115);
  });

  it('tax at 8.875%', () => {
    const totals = computeOrderTotals({
      subtotal: 100,
      tipPercent: 10,
      taxRate: 0.08875,
      charityRoundUp: false,
    });
    expect(totals.tax).toBe(8.88); // 8.875 → round2 = 8.88
    // total: round2(100) + round2(10) + round2(8.875) = 100 + 10 + 8.88 = 118.88
    expect(totals.total).toBe(118.88);
  });

  it('tax at 10%', () => {
    const totals = computeOrderTotals({
      subtotal: 100,
      tipPercent: 10,
      taxRate: 0.10,
      charityRoundUp: false,
    });
    expect(totals.tax).toBe(10);
    expect(totals.total).toBe(120);
  });

  it('tax at 25%', () => {
    const totals = computeOrderTotals({
      subtotal: 100,
      tipPercent: 10,
      taxRate: 0.25,
      charityRoundUp: false,
    });
    expect(totals.tax).toBe(25);
    expect(totals.total).toBe(135);
  });

  // --------------------------------------------------------------------------
  // Edge case: tax enabled but rate is 0 (should behave like no tax)
  // --------------------------------------------------------------------------

  it('returns 0 tax when rate is 0 even with charity on', () => {
    const totals = computeOrderTotals({
      subtotal: 50,
      tipPercent: 10,
      taxRate: 0,
      charityRoundUp: true,
    });
    expect(totals.tax).toBe(0);
    // preCharity: 50 + 5 = 55, charity: 0
    expect(totals.charity).toBe(0);
    expect(totals.total).toBe(55);
  });

  // --------------------------------------------------------------------------
  // Edge case: charity with no tip, no tax — rounds to next dollar
  // --------------------------------------------------------------------------

  it('charity round-up from $9.50 to $10.00', () => {
    const totals = computeOrderTotals({
      subtotal: 9.50,
      tipPercent: 0,
      taxRate: 0,
      charityRoundUp: true,
    });
    expect(totals.charity).toBe(0.5);
    expect(totals.total).toBe(10.0);
  });

  it('charity round-up from $8.01 to $9.00', () => {
    const totals = computeOrderTotals({
      subtotal: 8.01,
      tipPercent: 0,
      taxRate: 0,
      charityRoundUp: true,
    });
    expect(totals.charity).toBeCloseTo(0.99, 2);
    expect(totals.total).toBe(9.0);
  });

  // --------------------------------------------------------------------------
  // Consistency: total equals sum of individually rounded legs
  // --------------------------------------------------------------------------

  it('total equals sum of individually rounded components consistently', () => {
    // Test with various random-ish inputs
    const testCases = [
      { subtotal: 13.37, tipPercent: 12, taxRate: 0.0725, charityRoundUp: false },
      { subtotal: 99.99, tipPercent: 18, taxRate: 0.08875, charityRoundUp: true },
      { subtotal: 0.99, tipPercent: 0, taxRate: 0.0625, charityRoundUp: true },
      { subtotal: 250.0, tipPercent: 20, taxRate: 0.10, charityRoundUp: false },
      { subtotal: 1.11, tipPercent: 25, taxRate: 0.055, charityRoundUp: true },
    ];

    for (const tc of testCases) {
      const totals = computeOrderTotals(tc);
      const sum = totals.subtotal + totals.tip + totals.tax + totals.charity;
      expect(totals.total).toBe(sum);
    }
  });
});
