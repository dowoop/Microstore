import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isStablecoin,
  formatUsd,
  fetchPricesFromJupiter,
  getTokenPrice,
  getTokenPrices,
} from '@/lib/priceOracle';

// Mock global fetch for Jupiter API
const mockFetch = vi.fn();

describe('priceOracle', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // isStablecoin
  // -----------------------------------------------------------------------

  describe('isStablecoin', () => {
    it('returns true for USDC (any case)', () => {
      expect(isStablecoin('USDC')).toBe(true);
      expect(isStablecoin('usdc')).toBe(true);
      expect(isStablecoin('Usdc')).toBe(true);
    });

    it('returns true for USDT', () => {
      expect(isStablecoin('USDT')).toBe(true);
    });

    it('returns true for PYUSD', () => {
      expect(isStablecoin('PYUSD')).toBe(true);
    });

    it('returns false for non-stablecoins', () => {
      expect(isStablecoin('SOL')).toBe(false);
      expect(isStablecoin('SAMO')).toBe(false);
      expect(isStablecoin('BONK')).toBe(false);
      expect(isStablecoin('')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // formatUsd
  // -----------------------------------------------------------------------

  describe('formatUsd', () => {
    it('formats zero', () => {
      expect(formatUsd(0)).toBe('$0.00');
    });

    it('formats normal values with 2 decimals', () => {
      expect(formatUsd(1.0)).toBe('$1.00');
      expect(formatUsd(42.5)).toBe('$42.50');
      expect(formatUsd(0.99)).toBe('$0.99');
    });

    it('formats small values with 4 decimals', () => {
      expect(formatUsd(0.001)).toBe('$0.0010');
    });

    it('formats very small values with 6 decimals', () => {
      expect(formatUsd(0.00001)).toBe('$0.000010');
    });
  });

  // -----------------------------------------------------------------------
  // fetchPricesFromJupiter
  // -----------------------------------------------------------------------

  describe('fetchPricesFromJupiter', () => {
    it('returns empty map for empty input', async () => {
      const result = await fetchPricesFromJupiter([]);
      expect(result.size).toBe(0);
    });

    it('fetches and parses Jupiter API response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            'So11111111111111111111111111111111111111112': {
              id: 'So11111111111111111111111111111111111111112',
              mintSymbol: 'SOL',
              vsToken: 'USDC',
              vsTokenSymbol: 'USDC',
              price: 140.5,
            },
          },
        }),
      });

      const result = await fetchPricesFromJupiter([
        'So11111111111111111111111111111111111111112',
      ]);
      expect(result.size).toBe(1);
      expect(result.get('So11111111111111111111111111111111111111112')).toBe(140.5);
    });

    it('handles missing price in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const result = await fetchPricesFromJupiter([
        'SomeMint1234567890123456789012345678901',
      ]);
      expect(result.size).toBe(0);
    });

    it('returns empty map on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const result = await fetchPricesFromJupiter(['So1111']);
      expect(result.size).toBe(0);
    });

    it('returns empty map on non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const result = await fetchPricesFromJupiter(['So1111']);
      expect(result.size).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // getTokenPrice
  // -----------------------------------------------------------------------

  describe('getTokenPrice', () => {
    it('returns 1.00 immediately for stablecoins (no network)', async () => {
      const price = await getTokenPrice(
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'USDC',
      );
      expect(price).toBe(1.0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches from Jupiter for non-stablecoins', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU': {
              id: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
              mintSymbol: 'SAMO',
              vsToken: 'USDC',
              vsTokenSymbol: 'USDC',
              price: 0.005,
            },
          },
        }),
      });

      const price = await getTokenPrice(
        '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        'SAMO',
      );
      expect(price).toBe(0.005);
    });

    it('returns 0 when Jupiter fails and no cache', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const price = await getTokenPrice(
        'UnknownMint12345678901234567890123456',
        'UNKNOWN',
      );
      expect(price).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // getTokenPrices (batch)
  // -----------------------------------------------------------------------

  describe('getTokenPrices', () => {
    it('returns 1.00 for stablecoins without network', async () => {
      const result = await getTokenPrices([
        { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
        { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT' },
      ]);
      expect(result.get('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(1.0);
      expect(result.get('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')).toBe(1.0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('batches non-stablecoin lookups into single Jupiter call', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU': {
              id: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
              mintSymbol: 'SAMO',
              vsToken: 'USDC',
              vsTokenSymbol: 'USDC',
              price: 0.005,
            },
            'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
              id: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
              mintSymbol: 'BONK',
              vsToken: 'USDC',
              vsTokenSymbol: 'USDC',
              price: 0.00002,
            },
          },
        }),
      });

      const result = await getTokenPrices([
        { mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', symbol: 'SAMO' },
        { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK' },
      ]);
      expect(result.get('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')).toBe(0.005);
      expect(result.get('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')).toBe(0.00002);
      // Should be a single API call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
