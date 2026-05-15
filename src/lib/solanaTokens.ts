import { type Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';

export interface KnownToken {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoURI?: string;
  verified: boolean;
}

export interface MintValidationResult {
  valid: boolean;
  error?: string;
  decimals?: number;
  knownToken?: KnownToken;
}

const DEVNET_TOKENS: KnownToken[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin (Devnet)',
    mint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
    decimals: 6,
    verified: true,
  },
];

const MAINNET_TOKENS: KnownToken[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    verified: true,
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    verified: true,
  },
  {
    symbol: 'PYUSD',
    name: 'PayPal USD',
    mint: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
    decimals: 6,
    verified: true,
  },
  {
    symbol: 'SAMO',
    name: 'Samoyed Coin',
    mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    decimals: 9,
    verified: false,
  },
  {
    symbol: 'BONK',
    name: 'Bonk',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    decimals: 5,
    verified: false,
  },
  {
    symbol: 'JitoSOL',
    name: 'Jito Staked SOL',
    mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
    decimals: 9,
    verified: false,
  },
  {
    symbol: 'mSOL',
    name: 'Marinade Staked SOL',
    mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    decimals: 9,
    verified: false,
  },
];

const REGISTRY: Record<string, KnownToken[]> = {
  devnet: DEVNET_TOKENS,
  'devnet-solana': DEVNET_TOKENS,
  testnet: DEVNET_TOKENS,
  'mainnet-beta': MAINNET_TOKENS,
  mainnet: MAINNET_TOKENS,
};

const MINT_LOOKUP: Map<string, KnownToken> = new Map();
for (const tokens of Object.values(REGISTRY)) {
  for (const t of tokens) {
    if (!MINT_LOOKUP.has(t.mint)) MINT_LOOKUP.set(t.mint, t);
  }
}

export function getKnownTokens(cluster: string): KnownToken[] {
  return REGISTRY[cluster] ?? DEVNET_TOKENS;
}
export function getTokenByMint(mint: string): KnownToken | undefined {
  return MINT_LOOKUP.get(mint);
}

export function searchKnownTokens(query: string, cluster: string): KnownToken[] {
  const all = getKnownTokens(cluster);
  if (!query.trim()) return all;
  const q = query.trim().toLowerCase();
  const scored = all
    .map((t) => {
      const sym = t.symbol.toLowerCase(),
        mint = t.mint.toLowerCase(),
        name = t.name.toLowerCase();
      let s = 0;
      if (sym === q) s = 3;
      else if (sym.startsWith(q)) s = 2;
      else if (sym.includes(q) || mint.includes(q) || name.includes(q)) s = 1;
      return { token: t, score: s };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((e) => e.token);
}

export function searchKnownTokens(query: string, cluster: string): KnownToken[] {
  const tokens = getKnownTokens(cluster);
  const q = query.toLowerCase();
  return tokens.filter(
    (t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
  );
}

export function getTokenByMint(mint: string): KnownToken | undefined {
  for (const tokens of Object.values(REGISTRY)) {
    const found = tokens.find((t) => t.mint === mint);
    if (found) return found;
  }
  return undefined;
}

export async function validateMint(
  mintAddress: string,
  connection: Connection,
): Promise<MintValidationResult> {
  try {
    new PublicKey(mintAddress);
  } catch {
    return { valid: false, error: 'Invalid Solana address format.' };
  }
  const known = getTokenByMint(mintAddress);
  try {
    const mint = new PublicKey(mintAddress);
    const mintInfo = await getMint(connection, mint);
    return { valid: true, decimals: mintInfo.decimals, knownToken: known };
  } catch {
    return {
      valid: false,
      error: 'Mint not found on-chain. Verify the address is a valid SPL token mint.',
    };
  }
}
