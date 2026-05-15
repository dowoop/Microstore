import { type Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KnownToken {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoURI?: string;
}

export interface MintValidationResult {
  valid: boolean;
  error?: string;
  decimals?: number;
}

// ---------------------------------------------------------------------------
// Known token registry
// ---------------------------------------------------------------------------

// Devnet tokens
const DEVNET_TOKENS: KnownToken[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin (Devnet)',
    mint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
    decimals: 6,
  },
];

// Mainnet tokens
const MAINNET_TOKENS: KnownToken[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
  },
  {
    symbol: 'PYUSD',
    name: 'PayPal USD',
    mint: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
    decimals: 6,
  },
];

const REGISTRY: Record<string, KnownToken[]> = {
  devnet: DEVNET_TOKENS,
  'devnet-solana': DEVNET_TOKENS,
  testnet: DEVNET_TOKENS,
  'mainnet-beta': MAINNET_TOKENS,
  mainnet: MAINNET_TOKENS,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getKnownTokens(cluster: string): KnownToken[] {
  return REGISTRY[cluster] ?? DEVNET_TOKENS;
}

export async function validateMint(
  mintAddress: string,
  connection: Connection,
): Promise<MintValidationResult> {
  // Basic address validation
  try {
    new PublicKey(mintAddress);
  } catch {
    return { valid: false, error: 'Invalid Solana address format.' };
  }

  // On-chain validation via SPL token mint lookup
  try {
    const mint = new PublicKey(mintAddress);
    const mintInfo = await getMint(connection, mint);
    return { valid: true, decimals: mintInfo.decimals };
  } catch {
    return { valid: false, error: 'Mint not found on-chain. Verify the address is a valid SPL token mint.' };
  }
}