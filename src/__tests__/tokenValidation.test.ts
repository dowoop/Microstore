import { describe, it, expect, vi } from 'vitest';
import { getKnownTokens, validateMint, type KnownToken, type MintValidationResult } from '@/lib/solanaTokens';

// Mock @solana/spl-token getMint
vi.mock('@solana/spl-token', () => ({
  getMint: vi.fn(),
}));

// Mock @solana/web3.js PublicKey
vi.mock('@solana/web3.js', () => ({
  PublicKey: vi.fn().mockImplementation((addr: string) => {
    // Valid base58 addresses are 32-44 chars
    if (addr.length >= 32 && addr.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(addr)) {
      return { _isValid: true };
    }
    throw new Error('Invalid public key');
  }),
  Connection: vi.fn(),
}));

import { getMint } from '@solana/spl-token';

describe('getKnownTokens', () => {
  it('returns devnet tokens for "devnet" cluster', () => {
    const tokens = getKnownTokens('devnet');
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0].symbol).toBe('USDC');
    expect(tokens[0].mint).toBe('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
    expect(tokens[0].decimals).toBe(6);
  });

  it('returns mainnet tokens for "mainnet-beta" cluster', () => {
    const tokens = getKnownTokens('mainnet-beta');
    expect(tokens.length).toBe(3);
    const symbols = tokens.map((t) => t.symbol);
    expect(symbols).toContain('USDC');
    expect(symbols).toContain('USDT');
    expect(symbols).toContain('PYUSD');
  });

  it('returns mainnet tokens for "mainnet" cluster', () => {
    const tokens = getKnownTokens('mainnet');
    expect(tokens.length).toBe(3);
  });

  it('falls back to devnet tokens for unknown cluster', () => {
    const tokens = getKnownTokens('unknown-cluster');
    expect(tokens.length).toBe(1);
    expect(tokens[0].symbol).toBe('USDC');
  });
});

describe('validateMint', () => {
  it('rejects invalid address format', async () => {
    const mockConnection = {} as any;
    const result = await validateMint('not-a-valid-key', mockConnection);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid Solana address format');
  });

  it('accepts valid base58 mint address and returns decimals from chain', async () => {
    const mockConnection = {} as any;
    // Use a valid-length base58 string (32-44 chars)
    const validMint = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';
    const mockGetMint = vi.mocked(getMint);
    mockGetMint.mockResolvedValueOnce({ decimals: 6 } as any);

    const result = await validateMint(validMint, mockConnection);
    expect(result.valid).toBe(true);
    expect(result.decimals).toBe(6);
  });

  it('rejects when mint not found on chain', async () => {
    const mockConnection = {} as any;
    const validMint = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';
    const mockGetMint = vi.mocked(getMint);
    mockGetMint.mockRejectedValueOnce(new Error('Account not found'));

    const result = await validateMint(validMint, mockConnection);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found on-chain');
  });
});
