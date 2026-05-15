import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';

// Mock getMint from @solana/spl-token before importing the module under test
vi.mock('@solana/spl-token', () => ({
  getMint: vi.fn(),
}));

import { getMint } from '@solana/spl-token';
import {
  getKnownTokens,
  validateMint,
  searchKnownTokens,
  getTokenByMint,
} from '@/lib/solanaTokens';

// ---------------------------------------------------------------------------
// getKnownTokens
// ---------------------------------------------------------------------------

describe('getKnownTokens', () => {
  it('returns devnet tokens for devnet cluster', () => {
    const tokens = getKnownTokens('devnet');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].symbol).toBe('USDC');
    expect(tokens[0].name).toBe('USD Coin (Devnet)');
    expect(tokens[0].mint).toBe('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
    expect(tokens[0].decimals).toBe(6);
    expect(tokens[0].verified).toBe(true);
  });

  it('returns devnet tokens for devnet-solana cluster', () => {
    const tokens = getKnownTokens('devnet-solana');
    expect(tokens).toHaveLength(1);
  });

  it('returns devnet tokens for testnet cluster', () => {
    const tokens = getKnownTokens('testnet');
    expect(tokens).toHaveLength(1);
  });

  it('returns mainnet tokens for mainnet-beta cluster', () => {
    const tokens = getKnownTokens('mainnet-beta');
    expect(tokens.length).toBeGreaterThanOrEqual(3);
    expect(tokens[0].symbol).toBe('USDC');
    expect(tokens[1].symbol).toBe('USDT');
    expect(tokens[2].symbol).toBe('PYUSD');
  });

  it('returns mainnet tokens for mainnet cluster', () => {
    const tokens = getKnownTokens('mainnet');
    expect(tokens.length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to devnet tokens for unknown clusters', () => {
    const tokens = getKnownTokens('super-unknown-cluster');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].symbol).toBe('USDC');
  });

  it('mainnet USDC mint is correct', () => {
    const tokens = getKnownTokens('mainnet-beta');
    const usdc = tokens.find((t) => t.symbol === 'USDC')!;
    expect(usdc.mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    expect(usdc.decimals).toBe(6);
  });

  it('mainnet includes SAMO, BONK, JitoSOL, mSOL', () => {
    const tokens = getKnownTokens('mainnet-beta');
    const symbols = tokens.map((t) => t.symbol);
    expect(symbols).toContain('SAMO');
    expect(symbols).toContain('BONK');
    expect(symbols).toContain('JitoSOL');
    expect(symbols).toContain('mSOL');
  });

  it('stablecoins are verified, community tokens are not', () => {
    const tokens = getKnownTokens('mainnet-beta');
    const usdc = tokens.find((t) => t.symbol === 'USDC')!;
    const usdt = tokens.find((t) => t.symbol === 'USDT')!;
    const pyusd = tokens.find((t) => t.symbol === 'PYUSD')!;
    const samo = tokens.find((t) => t.symbol === 'SAMO')!;
    const bonk = tokens.find((t) => t.symbol === 'BONK')!;

    expect(usdc.verified).toBe(true);
    expect(usdt.verified).toBe(true);
    expect(pyusd.verified).toBe(true);
    expect(samo.verified).toBe(false);
    expect(bonk.verified).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// searchKnownTokens
// ---------------------------------------------------------------------------

describe('searchKnownTokens', () => {
  const mainnetTokens = getKnownTokens('mainnet-beta');

  it('returns all tokens for empty query', () => {
    const results = searchKnownTokens('', 'mainnet-beta');
    expect(results).toEqual(mainnetTokens);
  });

  it('finds by exact symbol match first', () => {
    const results = searchKnownTokens('USDC', 'mainnet-beta');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].symbol).toBe('USDC');
  });

  it('finds by prefix match', () => {
    const results = searchKnownTokens('BON', 'mainnet-beta');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].symbol).toBe('BONK');
  });

  it('finds by substring in name', () => {
    const results = searchKnownTokens('PayPal', 'mainnet-beta');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].symbol).toBe('PYUSD');
  });

  it('finds by mint address substring', () => {
    const usdc = mainnetTokens.find((t) => t.symbol === 'USDC')!;
    const mintPrefix = usdc.mint.slice(0, 8);
    const results = searchKnownTokens(mintPrefix, 'mainnet-beta');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].symbol).toBe('USDC');
  });

  it('is case-insensitive', () => {
    const results1 = searchKnownTokens('usdc', 'mainnet-beta');
    const results2 = searchKnownTokens('USDC', 'mainnet-beta');
    expect(results1.length).toBe(results2.length);
    expect(results1[0].symbol).toBe('USDC');
  });

  it('returns empty for no match', () => {
    const results = searchKnownTokens('ZZZZNOTEXIST', 'mainnet-beta');
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getTokenByMint
// ---------------------------------------------------------------------------

describe('getTokenByMint', () => {
  it('returns known token for valid mint', () => {
    const usdc = getTokenByMint('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    expect(usdc).toBeDefined();
    expect(usdc!.symbol).toBe('USDC');
  });

  it('returns undefined for unknown mint', () => {
    const unknown = getTokenByMint('UnknownMintAddressHere123456789');
    expect(unknown).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateMint
// ---------------------------------------------------------------------------

describe('validateMint', () => {
  const mockConnection = {} as any; // minimal mock — only need the shape

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns invalid for malformed address', async () => {
    const result = await validateMint('not-a-valid-base58-address!!!', mockConnection);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid Solana address format');
  });

  it('returns invalid for wrong-length base58 string', async () => {
    const result = await validateMint('abc123', mockConnection);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid Solana address format');
  });

  it('returns valid when getMint succeeds', async () => {
    vi.mocked(getMint).mockResolvedValue({ decimals: 6 } as any);

    const validMint = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';
    const result = await validateMint(validMint, mockConnection);

    expect(result.valid).toBe(true);
    expect(result.decimals).toBe(6);
    expect(getMint).toHaveBeenCalledWith(mockConnection, expect.any(PublicKey));
  });

  it('returns valid with 9 decimals', async () => {
    vi.mocked(getMint).mockResolvedValue({ decimals: 9 } as any);

    const validMint = 'So11111111111111111111111111111111111111112';
    const result = await validateMint(validMint, mockConnection);

    expect(result.valid).toBe(true);
    expect(result.decimals).toBe(9);
  });

  it('returns invalid when getMint throws (mint not found on-chain)', async () => {
    vi.mocked(getMint).mockRejectedValue(new Error('Account not found'));

    const validButNonExistent = '4zMMC9srt5Aw9sZtzRnJfcRQPFbMDPiFHmWpGVvTeHWT';
    const result = await validateMint(validButNonExistent, mockConnection);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Mint not found on-chain');
  });

  it('passes the correct PublicKey to getMint', async () => {
    vi.mocked(getMint).mockResolvedValue({ decimals: 6 } as any);

    const mintAddress = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';
    await validateMint(mintAddress, mockConnection);

    const callArg = vi.mocked(getMint).mock.calls[0][1];
    expect(callArg).toBeInstanceOf(PublicKey);
    expect(callArg.toBase58()).toBe(mintAddress);
  });

  it('returns knownToken metadata when mint is in registry', async () => {
    vi.mocked(getMint).mockResolvedValue({ decimals: 6 } as any);

    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const result = await validateMint(usdcMint, mockConnection);
    expect(result.valid).toBe(true);
    expect(result.knownToken).toBeDefined();
    expect(result.knownToken!.symbol).toBe('USDC');
    expect(result.knownToken!.verified).toBe(true);
  });
});
