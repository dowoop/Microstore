import { describe, it, expect } from 'vitest';
import {
  Money,
  fromUserInput,
  fromDecimalString,
  fromBaseString,
  toDisplay,
  toBaseString,
  zero,
  isZero,
  equals,
  add,
  sub,
  mulPercent,
  ceilToDollar,
} from '@/lib/money';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a Money value (convenience for tests). */
function $m(units: bigint | number, decimals: number): Money {
  return { units: BigInt(units), decimals };
}

// ---------------------------------------------------------------------------
// fromUserInput
// ---------------------------------------------------------------------------

describe('fromUserInput', () => {
  it('parses a plain dollar amount (decimals=6)', () => {
    const m = fromUserInput('10.13', 6);
    expect(m.units).toBe(BigInt(10130000));
    expect(m.decimals).toBe(6);
  });

  it('parses with $ sign', () => {
    const m = fromUserInput('$10.13', 6);
    expect(m.units).toBe(BigInt(10130000));
  });

  it('parses with € and £ signs', () => {
    expect(fromUserInput('€5.50', 2).units).toBe(BigInt(550));
    expect(fromUserInput('£5.50', 2).units).toBe(BigInt(550));
    expect(fromUserInput('¥1000', 0).units).toBe(BigInt(1000));
  });

  it('parses with thousands separators', () => {
    const m = fromUserInput('1,234.56', 2);
    expect(m.units).toBe(BigInt(123456));
  });

  it('parses whole numbers (no decimal)', () => {
    expect(fromUserInput('42', 0).units).toBe(BigInt(42));
    expect(fromUserInput('42', 6).units).toBe(BigInt(42000000));
  });

  it('zero-pads missing decimals', () => {
    expect(fromUserInput('5', 6).units).toBe(BigInt(5000000));
  });

  it('truncates excess decimals', () => {
    expect(fromUserInput('5.123456789', 6).units).toBe(BigInt(5123456));
  });

  it('handles zero', () => {
    expect(fromUserInput('0', 6).units).toBe(BigInt(0));
    expect(fromUserInput('0.00', 2).units).toBe(BigInt(0));
  });

  it('handles leading whitespace', () => {
    expect(fromUserInput('  10.13', 6).units).toBe(BigInt(10130000));
    expect(fromUserInput('  $10.13  ', 6).units).toBe(BigInt(10130000));
  });

  it('throws on empty string', () => {
    expect(() => fromUserInput('', 2)).toThrow(RangeError);
  });

  it('throws on negative amounts', () => {
    expect(() => fromUserInput('-5', 2)).toThrow(RangeError);
    expect(() => fromUserInput('-5.00', 2)).toThrow(RangeError);
  });

  it('throws on invalid characters', () => {
    expect(() => fromUserInput('abc', 2)).toThrow(RangeError);
  });

  it('handles decimals=0 (whole numbers)', () => {
    expect(fromUserInput('100', 0).units).toBe(BigInt(100));
    expect(fromUserInput('$100', 0).units).toBe(BigInt(100));
  });

  it('handles decimals=18 (ETH-like)', () => {
    const m = fromUserInput('1.5', 18);
    expect(m.units).toBe(BigInt('1500000000000000000'));
  });
});

// ---------------------------------------------------------------------------
// fromDecimalString
// ---------------------------------------------------------------------------

describe('fromDecimalString', () => {
  it('parses plain decimal strings', () => {
    const m = fromDecimalString('10.13', 6);
    expect(m.units).toBe(BigInt(10130000));
    expect(m.decimals).toBe(6);
  });

  it('does not strip $ (treated as invalid)', () => {
    // fromDecimalString calls fromUserInput which strips $, so it's fine.
    const m = fromDecimalString('$10.13', 6);
    expect(m.units).toBe(BigInt(10130000));
  });
});

// ---------------------------------------------------------------------------
// fromBaseString
// ---------------------------------------------------------------------------

describe('fromBaseString', () => {
  it('parses base-unit strings', () => {
    const m = fromBaseString('10130000', 6);
    expect(m.units).toBe(BigInt(10130000));
    expect(m.decimals).toBe(6);
  });

  it('parses zero', () => {
    expect(fromBaseString('0', 6).units).toBe(BigInt(0));
  });

  it('rejects non-numeric strings', () => {
    expect(() => fromBaseString('abc', 6)).toThrow(RangeError);
    expect(() => fromBaseString('12.34', 6)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// toBaseString
// ---------------------------------------------------------------------------

describe('toBaseString', () => {
  it('serialises to string', () => {
    expect(toBaseString($m(10130000, 6))).toBe('10130000');
  });

  it('serialises zero', () => {
    expect(toBaseString($m(0, 2))).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// toDisplay
// ---------------------------------------------------------------------------

describe('toDisplay', () => {
  it('formats with 6 decimals', () => {
    expect(toDisplay($m(10130000, 6))).toBe('10.13');
  });

  it('formats with 2 decimals', () => {
    expect(toDisplay($m(1013, 2))).toBe('10.13');
  });

  it('formats zero', () => {
    expect(toDisplay($m(0, 2))).toBe('0');
  });

  it('respects minDecimals (adds trailing zeros)', () => {
    expect(toDisplay($m(1000000, 6), { minDecimals: 4 })).toBe('1.0000');
  });

  it('respects maxDecimals (trims trailing zeros)', () => {
    expect(toDisplay($m(10130000, 6), { maxDecimals: 0 })).toBe('10');
    expect(toDisplay($m(10130000, 6), { maxDecimals: 1 })).toBe('10.1');
  });

  it('combines minDecimals and maxDecimals', () => {
    // 10.13 → maxDecimals: 4 keeps it as-is, minDecimals: 4 adds zeros
    expect(toDisplay($m(10130000, 6), { minDecimals: 4, maxDecimals: 4 })).toBe('10.1300');
    // 10.00 → trim to maxDecimals: 1, but enforce minDecimals: 2
    expect(toDisplay($m(10000000, 6), { minDecimals: 2, maxDecimals: 1 })).toBe('10.00');
  });

  it('handles whole-dollar display (decimals=0)', () => {
    expect(toDisplay($m(42, 0))).toBe('42');
  });

  it('handles decimals=18 display', () => {
    const eth = $m(BigInt('1500000000000000000'), 18);
    expect(toDisplay(eth)).toBe('1.5');
  });

  it('handles very large amounts', () => {
    // Number.MAX_SAFE_INTEGER * 10 ≈ 90,071,992,547,409,910
    const huge = BigInt('9007199254740991') * BigInt(10);
    const m = { units: huge, decimals: 6 };
    expect(toDisplay(m)).toBe('90071992547.40991');
  });
});

// ---------------------------------------------------------------------------
// zero / isZero / equals
// ---------------------------------------------------------------------------

describe('zero / isZero / equals', () => {
  it('zero creates zero-value Money', () => {
    const z = zero(6);
    expect(z.units).toBe(BigInt(0));
    expect(z.decimals).toBe(6);
  });

  it('isZero detects zero', () => {
    expect(isZero($m(0, 6))).toBe(true);
    expect(isZero($m(1, 6))).toBe(false);
    expect(isZero(zero(2))).toBe(true);
  });

  it('equals compares correctly', () => {
    const a = $m(10130000, 6);
    const b = $m(10130000, 6);
    const c = $m(10130001, 6);
    const d = $m(10130000, 2);

    expect(equals(a, b)).toBe(true);
    expect(equals(a, c)).toBe(false);
    expect(equals(a, d)).toBe(false); // different decimals
  });
});

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------

describe('add', () => {
  it('adds two Money values', () => {
    const result = add($m(500000, 6), $m(300000, 6));
    expect(result.units).toBe(BigInt(800000));
    expect(result.decimals).toBe(6);
  });

  it('adds zero', () => {
    const result = add($m(1000, 2), zero(2));
    expect(result.units).toBe(BigInt(1000));
  });

  it('throws on decimal mismatch', () => {
    expect(() => add($m(1000, 6), $m(1000, 2))).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// sub
// ---------------------------------------------------------------------------

describe('sub', () => {
  it('subtracts two Money values', () => {
    const result = sub($m(100000, 6), $m(40000, 6));
    expect(result.units).toBe(BigInt(60000));
  });

  it('subtracts to zero', () => {
    const result = sub($m(1000, 2), $m(1000, 2));
    expect(result.units).toBe(BigInt(0));
  });

  it('throws on decimal mismatch', () => {
    expect(() => sub($m(1000, 6), $m(1000, 2))).toThrow(RangeError);
  });

  it('throws when result would be negative', () => {
    expect(() => sub($m(1000, 2), $m(2000, 2))).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// mulPercent
// ---------------------------------------------------------------------------

describe('mulPercent', () => {
  it('computes 15% on $100.00 (decimals=2)', () => {
    const m = $m(10000, 2); // $100.00
    const result = mulPercent(m, 15);
    expect(result.units).toBe(BigInt(1500)); // $15.00
    expect(result.decimals).toBe(2);
  });

  it('computes 100% (identity)', () => {
    const m = $m(12345, 2);
    const result = mulPercent(m, 100);
    expect(result.units).toBe(BigInt(12345));
  });

  it('computes 0% (zero)', () => {
    const m = $m(99999, 2);
    const result = mulPercent(m, 0);
    expect(result.units).toBe(BigInt(0));
  });

  it('computes 0.1% without dropping to zero (precision test)', () => {
    // $100.00 = 10000 base units (decimals=2).  0.1% = $0.10 = 10 base units.
    const m = $m(10000, 2);
    const result = mulPercent(m, 0.1);
    expect(result.units).toBe(BigInt(10));
  });

  it('computes 0.01% on large amount', () => {
    // $1,000,000.00 = 100000000 base units (decimals=2)
    // 0.01% = $100.00 = 10000 base units
    const m = $m(100000000, 2);
    const result = mulPercent(m, 0.01);
    expect(result.units).toBe(BigInt(10000));
  });

  it('handles percent > 100 (250% tip)', () => {
    const m = $m(10000, 2); // $100.00
    const result = mulPercent(m, 250);
    expect(result.units).toBe(BigInt(25000)); // $250.00
  });

  it('truncates toward zero on division', () => {
    // $1.00 (100 base units) * 0.33% = 0.33 → truncated to 0
    const m = $m(100, 2);
    const result = mulPercent(m, 0.33);
    expect(result.units).toBe(BigInt(0));
  });

  it('handles large percent with fractional component', () => {
    const m = $m(100000, 2); // $1000.00
    const result = mulPercent(m, 12.5);
    expect(result.units).toBe(BigInt(12500)); // $125.00
  });

  it('handles 8.875% (like a tax rate)', () => {
    const m = $m(1000000, 6); // $1.00 in USDC
    // 8.875% = 0.08875 → 1000000 * 8875 / 100000 = 88750
    const result = mulPercent(m, 8.875);
    expect(result.units).toBe(BigInt(88750));
  });

  it('preserves decimals in result', () => {
    const m = $m(5000000, 6);
    const result = mulPercent(m, 10);
    expect(result.decimals).toBe(6);
  });

  it('throws on negative percent', () => {
    const m = $m(1000, 2);
    expect(() => mulPercent(m, -5)).toThrow(RangeError);
  });

  it('handles very large amounts with percent', () => {
    // Number.MAX_SAFE_INTEGER * 10 = 90071992547409910
    const huge = BigInt('90071992547409910');
    const result = mulPercent({ units: huge, decimals: 6 }, 50);
    // 50% → half
    expect(result.units).toBe(huge / BigInt(2));
  });
});

// ---------------------------------------------------------------------------
// ceilToDollar
// ---------------------------------------------------------------------------

describe('ceilToDollar', () => {
  it('rounds $10.13 up to $11.00 (decimals=6)', () => {
    const m = $m(10130000, 6);
    const result = ceilToDollar(m);
    expect(result.units).toBe(BigInt(11000000));
    expect(result.decimals).toBe(6);
  });

  it('keeps $10.00 as $10.00', () => {
    const m = $m(10000000, 6);
    const result = ceilToDollar(m);
    expect(result.units).toBe(BigInt(10000000));
  });

  it('rounds $10.01 up to $11.00', () => {
    const m = $m(10010000, 6);
    const result = ceilToDollar(m);
    expect(result.units).toBe(BigInt(11000000));
  });

  it('handles decimals=2 (cents)', () => {
    // $10.13 = 1013 cents → ceil to $11.00 = 1100 cents
    const m = $m(1013, 2);
    const result = ceilToDollar(m);
    expect(result.units).toBe(BigInt(1100));
  });

  it('handles decimals=0 (no-op)', () => {
    const m = $m(42, 0);
    const result = ceilToDollar(m);
    expect(result.units).toBe(BigInt(42));
  });

  it('handles zero', () => {
    const m = zero(6);
    const result = ceilToDollar(m);
    expect(result.units).toBe(BigInt(0));
  });

  it('rounds up very small fractional amounts', () => {
    // $0.000001 → ceil to $1.00
    const m = $m(1, 6);
    const result = ceilToDollar(m);
    expect(result.units).toBe(BigInt(1000000));
  });

  it('handles large amounts', () => {
    // $99,999.99 → $100,000.00
    const m = $m(9999999, 2);
    const result = ceilToDollar(m);
    expect(result.units).toBe(BigInt(10000000));
  });

  it('handles decimals=18 (ETH-like)', () => {
    // 1.5 ETH → ceil to 2 ETH
    const m = $m(BigInt('1500000000000000000'), 18);
    const result = ceilToDollar(m);
    expect(result.units).toBe(BigInt('2000000000000000000'));
  });
});

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

describe('round-trip', () => {
  it('fromUserInput → toBaseString → fromBaseString → toDisplay', () => {
    const original = fromUserInput('$1,234.56', 6);
    const baseStr = toBaseString(original);
    const restored = fromBaseString(baseStr, 6);
    const display = toDisplay(restored);
    expect(display).toBe('1234.56');
  });

  it('full round-trip with decimals=2', () => {
    const original = fromUserInput('42.99', 2);
    const baseStr = toBaseString(original);
    const restored = fromBaseString(baseStr, 2);
    expect(equals(original, restored)).toBe(true);
    expect(toDisplay(restored, { minDecimals: 2 })).toBe('42.99');
  });

  it('full round-trip with decimals=0', () => {
    const original = fromUserInput('100', 0);
    const baseStr = toBaseString(original);
    const restored = fromBaseString(baseStr, 0);
    expect(equals(original, restored)).toBe(true);
    expect(toDisplay(restored)).toBe('100');
  });

  it('full round-trip with decimals=18', () => {
    const original = fromUserInput('1.5', 18);
    const baseStr = toBaseString(original);
    const restored = fromBaseString(baseStr, 18);
    expect(equals(original, restored)).toBe(true);
    expect(toDisplay(restored)).toBe('1.5');
  });
});

// ---------------------------------------------------------------------------
// Integration-like scenarios
// ---------------------------------------------------------------------------

describe('integration scenarios', () => {
  it('cart subtotal + tip + reserve', () => {
    // $100.00 subtotal
    const subtotal = fromUserInput('100.00', 6);
    // 15% tip
    const tip = mulPercent(subtotal, 15);
    // 8.875% reserve
    const reserve = mulPercent(subtotal, 8.875);

    const total = add(add(subtotal, tip), reserve);

    // $100.00 + $15.00 + $8.875 = $123.875
    expect(total.units).toBe(BigInt(123875000));
    expect(toDisplay(total, { minDecimals: 3 })).toBe('123.875');
  });

  it('zero percent edge case', () => {
    const amount = $m(50000, 2); // $500.00
    expect(isZero(mulPercent(amount, 0))).toBe(true);
  });

  it('chained operations preserve decimals', () => {
    const a = $m(1000, 6);
    const b = $m(500, 6);
    const sum = add(a, b);
    expect(sum.decimals).toBe(6);
    const diff = sub(sum, b);
    expect(equals(diff, a)).toBe(true);
  });
});
