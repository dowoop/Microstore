import { describe, it, expect } from 'vitest';
import {
  computeAtomicSplit,
  formatWalletError,
  detectNetworkMismatch,
  networkName,
} from '@/lib/solanaPay';

// ---------------------------------------------------------------------------
// computeAtomicSplit
// ---------------------------------------------------------------------------

describe('computeAtomicSplit', () => {
  const baseParams = {
    subtotal: 100,
    tipPercent: 10,
    reserveRate: 0.08875,
    charityRoundUp: false,
    merchantWallet: 'Merch1111111111111111111111111111111111111111',
    reserveWallet: 'Tax2222222222222222222222222222222222222222',
    charityWallet: 'Char3333333333333333333333333333333333333333',
    charityPartners: [] as string[],
  };

  it('computes the basic split correctly', () => {
    const result = computeAtomicSplit(baseParams);

    // tip = 100 * 0.10 = 10
    // tax = 100 * 0.08875 = 8.875 -> rounded to 8.88
    // charity = 0 (round-up off)
    // merchant = 100 + 10 = 110

    expect(result.merchant.address).toBe('Merch1111111111111111111111111111111111111111');
    expect(result.merchant.amount).toBe(110);
    expect(result.merchant.label).toBe('Merchant + Tip');

    expect(result.reserve.address).toBe('Tax2222222222222222222222222222222222222222');
    expect(result.reserve.amount).toBe(8.88);
    expect(result.reserve.label).toBe('Reserve');

    expect(result.charity.address).toBe('Char3333333333333333333333333333333333333333');
    expect(result.charity.amount).toBe(0);
    expect(result.charity.label).toBe('Charity');
  });

  it('handles 0 tip', () => {
    const result = computeAtomicSplit({ ...baseParams, tipPercent: 0 });

    expect(result.merchant.amount).toBe(100); // subtotal only
    expect(result.reserve.amount).toBe(8.88);
  });

  it('handles 0 tax rate', () => {
    const result = computeAtomicSplit({ ...baseParams, reserveRate: 0 });

    expect(result.reserve.amount).toBe(0);
    expect(result.merchant.amount).toBe(110);
  });

  it('handles 100% tip', () => {
    const result = computeAtomicSplit({ ...baseParams, tipPercent: 100 });

    expect(result.merchant.amount).toBe(200); // 100 subtotal + 100 tip
  });

  it('handles charity round-up enabled', () => {
    const result = computeAtomicSplit({ ...baseParams, charityRoundUp: true });

    // subtotal 100, tip 10, tax 8.875
    // Tip = 100 * 0.10 = 10. Tax (unrounded) = 100 * 0.08875 = 8.875
    // preCharity = 100 + 10 + 8.875 = 118.875
    // charity = ceil(118.875) - 118.875 = 119 - 118.875 = 0.125 → round2 = 0.13
    expect(result.charity.amount).toBe(0.13);
    expect(result.merchant.amount).toBe(110);
    expect(result.reserve.amount).toBe(8.88);
  });

  it('charity amount is 0 when round-up is disabled', () => {
    // Already a round number: 100 + 10 + 8.875 = 118.875
    // ceil(118.875) - 118.875 = 0.125
    const resultOn = computeAtomicSplit({ ...baseParams, charityRoundUp: true });
    expect(resultOn.charity.amount).toBeGreaterThan(0);

    const resultOff = computeAtomicSplit({ ...baseParams, charityRoundUp: false });
    expect(resultOff.charity.amount).toBe(0);
  });

  it('handles exactly round subtotal with charity', () => {
    const result = computeAtomicSplit({
      ...baseParams,
      subtotal: 100,
      tipPercent: 0,
      reserveRate: 0,
      charityRoundUp: true,
    });

    // preCharity = 100 + 0 + 0 = 100
    // ceil(100) - 100 = 0
    expect(result.charity.amount).toBe(0);
  });

  it('includes charity partners in the label', () => {
    const result = computeAtomicSplit({
      ...baseParams,
      charityRoundUp: true,
      charityPartners: ['GiveDirectly', 'Red Cross'],
    });

    expect(result.charity.label).toBe('GiveDirectly & Red Cross');
  });

  it('defaults charity label when no partners', () => {
    const result = computeAtomicSplit({
      ...baseParams,
      charityRoundUp: true,
      charityPartners: [],
    });

    expect(result.charity.label).toBe('Charity');
  });

  it('handles fractional subtotal with charity round-up', () => {
    const result = computeAtomicSplit({
      ...baseParams,
      subtotal: 9.99,
      tipPercent: 0,
      reserveRate: 0,
      charityRoundUp: true,
    });

    // preCharity = 9.99
    // ceil(9.99) - 9.99 = 10 - 9.99 = 0.01
    expect(result.charity.amount).toBeCloseTo(0.01, 5);
  });

  it('handles very small subtotals', () => {
    const result = computeAtomicSplit({
      ...baseParams,
      subtotal: 0.01,
      tipPercent: 0,
      reserveRate: 0.08875,
      charityRoundUp: false,
    });

    expect(result.merchant.amount).toBe(0.01);
    expect(result.reserve.amount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Decimal to raw amount conversion
// ---------------------------------------------------------------------------

describe('decimal to raw amount conversion', () => {
  // The actual conversion happens inside buildAtomicSplitTransaction:
  //   Math.round(amount * Math.pow(10, decimals))
  // We test the math here because the async function requires a live connection.

  it('converts 6-decimal token amounts correctly', () => {
    const decimals = 6;
    const convert = (amount: number) => Math.round(amount * Math.pow(10, decimals));

    // USDC: 1.00 USDC -> 1,000,000 raw units
    expect(convert(1.00)).toBe(1_000_000);
    expect(convert(0.01)).toBe(10_000);
    expect(convert(0.000001)).toBe(1);
    expect(convert(10.50)).toBe(10_500_000);
    expect(convert(0)).toBe(0);
    expect(convert(9999.999999)).toBe(9_999_999_999);
  });

  it('converts 9-decimal token amounts correctly', () => {
    const decimals = 9;
    const convert = (amount: number) => Math.round(amount * Math.pow(10, decimals));

    // SOL: 1.00 SOL -> 1,000,000,000 lamports
    expect(convert(1.00)).toBe(1_000_000_000);
    expect(convert(0.000000001)).toBe(1);
    expect(convert(0.5)).toBe(500_000_000);
    expect(convert(100)).toBe(100_000_000_000);
    expect(convert(0)).toBe(0);
  });

  it('handles floating-point rounding at the boundary', () => {
    const decimals = 6;
    const convert = (amount: number) => Math.round(amount * Math.pow(10, decimals));

    // 0.0000005 -> 0.5 raw units, Math.round -> 1 (ties round up)
    expect(convert(0.0000005)).toBe(1);
    // 0.0000004999 -> 0.4999 raw units, Math.round -> 0
    expect(convert(0.000000499)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatWalletError
// ---------------------------------------------------------------------------

describe('formatWalletError', () => {
  it('formats WALLET_DISCONNECTED', () => {
    const err = formatWalletError('WALLET_DISCONNECTED');
    expect(err.code).toBe('WALLET_DISCONNECTED');
    expect(err.message).toContain('disconnected');
    expect(err.userMessage).toContain('reconnect');
  });

  it('formats WALLET_REJECTED', () => {
    const err = formatWalletError('WALLET_REJECTED');
    expect(err.code).toBe('WALLET_REJECTED');
    expect(err.userMessage).toContain('cancelled');
  });

  it('formats WRONG_NETWORK', () => {
    const err = formatWalletError('WRONG_NETWORK');
    expect(err.code).toBe('WRONG_NETWORK');
    expect(err.userMessage).toContain('different Solana network');
  });

  it('formats INSUFFICIENT_BALANCE', () => {
    const err = formatWalletError('INSUFFICIENT_BALANCE', 'Need 50 USDC, have 10 USDC');
    expect(err.code).toBe('INSUFFICIENT_BALANCE');
    expect(err.userMessage).toContain('Need 50 USDC, have 10 USDC');
  });

  it('formats MISSING_ATA', () => {
    const err = formatWalletError('MISSING_ATA');
    expect(err.code).toBe('MISSING_ATA');
    expect(err.userMessage).toContain('token account');
  });

  it('formats BLOCKHASH_EXPIRED', () => {
    const err = formatWalletError('BLOCKHASH_EXPIRED');
    expect(err.code).toBe('BLOCKHASH_EXPIRED');
    expect(err.userMessage).toContain('too long');
  });

  it('formats TX_TIMEOUT', () => {
    const err = formatWalletError('TX_TIMEOUT', 'Timed out after 30s');
    expect(err.code).toBe('TX_TIMEOUT');
    expect(err.userMessage).toContain('funds are safe');
  });

  it('formats TX_FAILED', () => {
    const err = formatWalletError('TX_FAILED', 'Transfer check failed');
    expect(err.code).toBe('TX_FAILED');
    expect(err.userMessage).toContain('Transfer check failed');
  });

  it('formats TX_FAILED without detail', () => {
    const err = formatWalletError('TX_FAILED');
    expect(err.userMessage).toContain('No funds were transferred');
  });
});

// ---------------------------------------------------------------------------
// detectNetworkMismatch
// ---------------------------------------------------------------------------

describe('detectNetworkMismatch', () => {
  it('detects no mismatch when networks match', () => {
    const result = detectNetworkMismatch('devnet', 'devnet');
    expect(result.mismatch).toBe(false);
  });

  it('detects mismatch when networks differ', () => {
    const result = detectNetworkMismatch('mainnet-beta', 'devnet');
    expect(result.mismatch).toBe(true);
    expect(result.walletCluster).toBe('mainnet-beta');
    expect(result.expectedCluster).toBe('devnet');
  });

  it('treats unknown wallet network as not a mismatch', () => {
    const result = detectNetworkMismatch('unknown', 'devnet');
    expect(result.mismatch).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// networkName
// ---------------------------------------------------------------------------

describe('networkName', () => {
  it('returns human-readable names', () => {
    expect(networkName('mainnet-beta')).toBe('Mainnet');
    expect(networkName('devnet')).toBe('Devnet');
    expect(networkName('testnet')).toBe('Testnet');
  });

  it('returns the input for unknown networks', () => {
    expect(networkName('localnet')).toBe('localnet');
  });
});
