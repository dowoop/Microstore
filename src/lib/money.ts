/**
 * Money — BigInt-based monetary arithmetic.
 *
 * This module is the single source of truth for ALL monetary computation
 * in the app.  Every function operates on the `Money` opaque type and
 * uses **only** `bigint` arithmetic — no `number`, no `parseFloat`,
 * no `Math.round`, no `.toFixed()` appear anywhere in the arithmetic paths.
 *
 * ## Design
 *
 * ```ts
 * type Money = { units: bigint; decimals: number };
 * ```
 *
 * - `units` is the amount in the smallest denomination (e.g. cents for
 *   decimals=2, micro-dollars for decimals=6, wei for decimals=18).
 * - `decimals` records the precision so operations can verify
 *   compatibility.
 *
 * All arithmetic functions throw when the two operands have different
 * `decimals` because mixing precisions silently corrupts money.
 *
 * @module money
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An opaque monetary value: bigint units + decimal precision. */
export interface Money {
  readonly units: bigint;
  readonly decimals: number;
}

/** Display options for {@link toDisplay}. */
export interface DisplayOptions {
  /** Minimum number of decimal places to show (trailing zeros added). */
  minDecimals?: number;
  /** Maximum number of decimal places to show (trailing zeros trimmed). */
  maxDecimals?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Precomputed powers of ten as bigint — avoids `**` on bigint (ES2020+). */
function pow10(exp: number): bigint {
  let r = BigInt(1);
  for (let i = 0; i < exp; i++) r = r * BigInt(10);
  return r;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a user-facing monetary string into `Money`.
 *
 * Handles optional `$` / `€` / `£` / `¥` prefix, optional whitespace,
 * optional thousands separators (`,`), and arbitrary decimal places
 * (excess digits beyond `decimals` are truncated, missing digits are
 * zero-padded).
 *
 * **Negative amounts throw** — Money is always non-negative.
 *
 * @example
 * ```ts
 * fromUserInput("$10.13", 6)   // → Money(10130000n, 6)
 * fromUserInput("1,234.56", 2) // → Money(123456n, 2)
 * fromUserInput("42", 0)       // → Money(42n, 0)
 * ```
 */
export function fromUserInput(s: string, decimals: number): Money {
  const cleaned = s
    .replace(/^[\s$€£¥]+/, '')
    .replace(/,/g, '')
    .trim();

  if (cleaned === '' || cleaned === '-' || cleaned.startsWith('-')) {
    throw new RangeError(`money: negative or empty input "${s}"`);
  }

  const parts = cleaned.split('.');
  const integerPart = parts[0] || '0';
  let fractionalPart = parts[1] || '';

  // Validate only digits remain.
  if (!/^\d+$/.test(integerPart) || (fractionalPart && !/^\d+$/.test(fractionalPart))) {
    throw new RangeError(`money: invalid input "${s}"`);
  }

  fractionalPart = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
  const units = BigInt(integerPart + fractionalPart);

  return { units, decimals };
}

/**
 * Parse a decimal string (no currency symbol) into `Money`.
 *
 * Convenience wrapper around {@link fromUserInput} for programmatic use
 * when the input is already a plain decimal like `"10.13"`.
 */
export function fromDecimalString(s: string, decimals: number): Money {
  return fromUserInput(s, decimals);
}

/**
 * Parse a base-unit string into `Money`.
 *
 * `"10130000", 6` → `Money(10130000n, 6)`.
 *
 * Useful for round-tripping values stored in Dexie as strings.
 */
export function fromBaseString(s: string, decimals: number): Money {
  if (!/^\d+$/.test(s)) {
    throw new RangeError(`money: invalid base string "${s}"`);
  }
  return { units: BigInt(s), decimals };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/**
 * Format a `Money` value for human display.
 *
 * @example
 * ```ts
 * toDisplay({ units: BigInt(10130000), decimals: 6 })               // "10.13"
 * toDisplay({ units: BigInt(10130000), decimals: 6 }, { minDecimals: 2 }) // "10.13"
 * toDisplay({ units: BigInt(10000000), decimals: 6 }, { maxDecimals: 0 }) // "10"
 * ```
 *
 * @param opts.minDecimals — minimum decimal places (trailing zeros are
 *   added to reach this length). Default: 0.
 * @param opts.maxDecimals — maximum decimal places (trailing zeros are
 *   trimmed). Default: `decimals` (show full precision).
 */
export function toDisplay(m: Money, opts?: DisplayOptions): string {
  const { minDecimals = 0, maxDecimals = m.decimals } = opts ?? {};
  const str = m.units.toString().padStart(m.decimals + 1, '0');
  const integerPart = str.slice(0, str.length - m.decimals) || '0';
  let fractionalPart = str.slice(str.length - m.decimals);

  if (maxDecimals < m.decimals) {
    fractionalPart = fractionalPart.slice(0, maxDecimals);
  }
  // Trim trailing zeros but respect minDecimals.
  fractionalPart = fractionalPart.replace(/0+$/, '');
  if (fractionalPart.length < minDecimals) {
    fractionalPart = fractionalPart.padEnd(minDecimals, '0');
  }

  if (fractionalPart.length === 0) return integerPart;
  return `${integerPart}.${fractionalPart}`;
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

/**
 * Serialise to a plain base-unit string for Dexie storage.
 *
 * @example
 * ```ts
 * toBaseString({ units: BigInt(10130000), decimals: 6 }) // "10130000"
 * ```
 */
export function toBaseString(m: Money): string {
  return m.units.toString();
}

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

/**
 * Create a zero-value `Money` at the given precision.
 */
export function zero(decimals: number): Money {
  return { units: BigInt(0), decimals };
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

/** Returns `true` when the amount is exactly zero. */
export function isZero(m: Money): boolean {
  return m.units === BigInt(0);
}

/** Returns `true` when two `Money` values have the same units and decimals. */
export function equals(a: Money, b: Money): boolean {
  return a.units === b.units && a.decimals === b.decimals;
}

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

function assertSameDecimals(a: Money, b: Money): void {
  if (a.decimals !== b.decimals) {
    throw new RangeError(`money: decimal mismatch (${a.decimals} vs ${b.decimals})`);
  }
}

/**
 * Add two `Money` values.
 *
 * @throws {RangeError} if `decimals` differ.
 */
export function add(a: Money, b: Money): Money {
  assertSameDecimals(a, b);
  return { units: a.units + b.units, decimals: a.decimals };
}

/**
 * Subtract `b` from `a`.
 *
 * @throws {RangeError} if `decimals` differ.
 * @throws {RangeError} if the result would be negative (Money is non-negative).
 */
export function sub(a: Money, b: Money): Money {
  assertSameDecimals(a, b);
  if (b.units > a.units) {
    throw new RangeError(
      `money: subtraction would produce negative amount (${a.units} - ${b.units})`,
    );
  }
  return { units: a.units - b.units, decimals: a.decimals };
}

/**
 * Multiply a `Money` value by a percentage.
 *
 * `percent` is a human-scale value: `15` means 15 %, `0.1` means 0.1 %,
 * `250` means 250 %.  The implementation uses **only** bigint arithmetic —
 * the decimal percent is decomposed into integer + fraction, then scaled
 * so the entire operation stays in the integer domain.
 *
 * @example
 * ```ts
 * mulPercent({ units: BigInt(10000), decimals: 2 }, 15)    // 15 %   → units: BigInt(1500)
 * mulPercent({ units: BigInt(10000), decimals: 2 }, 0.1)   // 0.1 %  → units: BigInt(10)
 * ```
 */
export function mulPercent(m: Money, percent: number): Money {
  if (percent < 0) {
    throw new RangeError(`money: negative percent ${percent}`);
  }

  // Decompose percent into integer + fractional parts via string
  // to avoid any floating-point arithmetic.
  const percentStr = percent.toString();
  const dotIdx = percentStr.indexOf('.');

  let num: bigint;
  let den: bigint = BigInt(100); // percent is "per hundred"

  if (dotIdx === -1) {
    // Integer percent, e.g. "15".
    num = BigInt(percentStr);
  } else {
    const fracLen = percentStr.length - dotIdx - 1;
    // Shift decimal right by fracLen positions, scale divisor the same.
    const scaled = percentStr.replace('.', '');
    num = BigInt(scaled);
    const factor = pow10(fracLen);
    den = den * factor;
  }

  // (units * num) / den  — truncate toward zero (standard bigint).
  return { units: (m.units * num) / den, decimals: m.decimals };
}

/**
 * Round up to the next whole dollar (or whole unit when decimals=0).
 *
 * @example
 * ```ts
 * ceilToDollar({ units: BigInt(10130000), decimals: 6 }) // 10.13 → 11.00
 * ceilToDollar({ units: BigInt(10000000), decimals: 6 }) // 10.00 → 10.00
 * ```
 */
export function ceilToDollar(m: Money): Money {
  if (m.decimals === 0) return m;

  const oneDollar = pow10(m.decimals);
  const whole = m.units / oneDollar;
  const remainder = m.units % oneDollar;

  if (remainder === BigInt(0)) {
    return { units: whole * oneDollar, decimals: m.decimals };
  }
  return { units: (whole + BigInt(1)) * oneDollar, decimals: m.decimals };
}
