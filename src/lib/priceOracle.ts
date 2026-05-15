/**
 * Lightweight price oracle for SPL tokens.
 *
 * - Stablecoins (USDC, USDT, PYUSD) are hardcoded to $1.00.
 * - Other tokens are priced via Jupiter's public price API.
 * - Results are cached in-memory with a 60-second TTL.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenPrice {
  mint: string;
  symbol: string;
  priceUsd: number;
  fetchedAt: number; // Date.now()
}

// ---------------------------------------------------------------------------
// Stablecoin mapping — always $1.00
// ---------------------------------------------------------------------------

const STABLECOIN_SYMBOLS = new Set(['USDC', 'USDT', 'PYUSD']);

export function isStablecoin(symbol: string): boolean {
  return STABLECOIN_SYMBOLS.has(symbol.toUpperCase());
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

const priceCache = new Map<string, TokenPrice>();
const CACHE_TTL_MS = 60_000; // 60 seconds

// ---------------------------------------------------------------------------
// Jupiter price API
// ---------------------------------------------------------------------------

interface JupiterPriceResponse {
  data: Record<string, { id: string; mintSymbol: string; vsToken: string; vsTokenSymbol: string; price: number }>;
}

/**
 * Fetch USD prices for a set of token mint addresses from Jupiter.
 * Returns a Map of mint → price in USD.
 */
export async function fetchPricesFromJupiter(
  mintAddresses: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  if (mintAddresses.length === 0) return result;

  const ids = mintAddresses.join(',');
  const url = `https://price.jup.ag/v6/price?ids=${encodeURIComponent(ids)}&vsToken=USDC`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) return result;

    const json: JupiterPriceResponse = await resp.json();

    for (const mint of mintAddresses) {
      const entry = json.data?.[mint];
      if (entry?.price != null) {
        result.set(mint, entry.price);
      }
    }
  } catch {
    // Network error — caller handles empty map gracefully
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get USD price for a single token.
 *
 * - Stablecoins return 1.00 immediately (no network).
 * - Other tokens check cache, then fall back to Jupiter API.
 */
export async function getTokenPrice(
  mint: string,
  symbol: string,
): Promise<number> {
  // Stablecoins: always $1
  if (isStablecoin(symbol)) return 1.0;

  // Cache hit?
  const cached = priceCache.get(mint);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.priceUsd;
  }

  // Fetch from Jupiter
  const prices = await fetchPricesFromJupiter([mint]);
  const price = prices.get(mint);

  if (price != null) {
    priceCache.set(mint, {
      mint,
      symbol,
      priceUsd: price,
      fetchedAt: Date.now(),
    });
    return price;
  }

  // If Jupiter fails and we have a stale cache entry, return it
  if (cached) return cached.priceUsd;

  // No price available
  return 0;
}

/**
 * Get USD prices for multiple tokens in a single Jupiter call.
 */
export async function getTokenPrices(
  tokens: { mint: string; symbol: string }[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  // Split: stablecoins are always $1, others need Jupiter
  const stableMints: string[] = [];
  const queryMints: string[] = [];

  for (const t of tokens) {
    if (isStablecoin(t.symbol)) {
      stableMints.push(t.mint);
    } else {
      // Check cache first
      const cached = priceCache.get(t.mint);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        result.set(t.mint, cached.priceUsd);
      } else {
        queryMints.push(t.mint);
      }
    }
  }

  // Stablecoins
  for (const mint of stableMints) {
    result.set(mint, 1.0);
  }

  // Fetch from Jupiter for non-stable, non-cached tokens
  if (queryMints.length > 0) {
    const jupiterPrices = await fetchPricesFromJupiter(queryMints);

    for (const t of tokens) {
      if (queryMints.includes(t.mint)) {
        const price = jupiterPrices.get(t.mint);
        if (price != null) {
          result.set(t.mint, price);
          priceCache.set(t.mint, {
            mint: t.mint,
            symbol: t.symbol,
            priceUsd: price,
            fetchedAt: Date.now(),
          });
        } else {
          // Fall back to stale cache
          const stale = priceCache.get(t.mint);
          if (stale) result.set(t.mint, stale.priceUsd);
        }
      }
    }
  }

  return result;
}

/**
 * Format a USD value for display. Returns e.g. "$1.00", "$0.00014".
 * Very small values use scientific-like precision.
 */
export function formatUsd(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  if (usd >= 0.0001) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(6)}`;
}
