import { type Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';

export interface KnownToken {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoURI?: string;
  verified: boolean;
  /** Chain discriminator: 'solana' (default) or 'tari'. */
  chain?: 'solana' | 'tari';
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

/** Tari-native tokens (available when Tari wallet is configured). */
export const TARI_TOKENS: KnownToken[] = [
  {
    symbol: 'XTM',
    name: 'Tari Native Token',
    mint: 'tari:resource_0101010101010101010101010101010101010101010101010101010101010101',
    decimals: 6,
    verified: true,
    chain: 'tari',
  },
  {
    symbol: 'OOTLE',
    name: 'Ootle Token (Testnet)',
    mint: 'tari:ootle_default',
    decimals: 6,
    verified: false,
    chain: 'tari',
  },
  {
    symbol: 'EsmTLD',
    name: 'Esmeralda Test Token (TLD)',
    mint: 'tari:resource_1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
    decimals: 6,
    verified: false,
    chain: 'tari',
    logoURI: undefined,
  },
  {
    symbol: 'EsmUSDC',
    name: 'Esmeralda USDC (Testnet)',
    mint: 'tari:resource_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    decimals: 6,
    verified: false,
    chain: 'tari',
    logoURI: undefined,
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
