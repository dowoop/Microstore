// ---------------------------------------------------------------------------
// Known SPL Token Registry
// Central source of truth for supported tokens in Microstore.
// ---------------------------------------------------------------------------

import { PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import type { Connection } from '@solana/web3.js';

// ---------------------------------------------------------------------------
// Token definition
// ---------------------------------------------------------------------------

export interface KnownToken {
  symbol: string;           // e.g. "USDC"
  name: string;             // e.g. "USD Coin"
  mint: string;             // base58 mint address
  decimals: number;         // token decimals (USDC = 6)
  cluster: 'devnet' | 'mainnet-beta';
  logoURI?: string;         // optional icon URL
}

// ---------------------------------------------------------------------------
// Preset tokens
// ---------------------------------------------------------------------------

export const KNOWN_TOKENS: Record<string, KnownToken[]> = {
  mainnet: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      cluster: 'mainnet-beta',
      logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    },
  ],
  devnet: [
    {
      symbol: 'USDC',
      name: 'USD Coin (Devnet)',
      mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      decimals: 6,
      cluster: 'devnet',
    },
  ],
};

/**
 * Returns the list of known tokens for a given network.
 */
export function getKnownTokens(cluster: 'devnet' | 'mainnet-beta' = 'devnet'): KnownToken[] {
  const key = cluster === 'mainnet-beta' ? 'mainnet' : 'devnet';
  return KNOWN_TOKENS[key] ?? [];
}

/**
 * Looks up a known token by symbol (case-insensitive) for a given cluster.
 */
export function lookupKnownToken(
  symbol: string,
  cluster: 'devnet' | 'mainnet-beta' = 'devnet',
): KnownToken | undefined {
  const upper = symbol.trim().toUpperCase();
  return getKnownTokens(cluster).find((t) => t.symbol.toUpperCase() === upper);
}

/**
 * Checks whether a mint address belongs to a known token on any cluster.
 */
export function isKnownMint(mint: string): KnownToken | undefined {
  for (const tokens of Object.values(KNOWN_TOKENS)) {
    const found = tokens.find((t) => t.mint === mint);
    if (found) return found;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Mint validation
// ---------------------------------------------------------------------------

export interface MintValidationResult {
  valid: boolean;
  mint: string;
  error?: string;
  decimals?: number;
  isTokenProgram: boolean;
  known?: KnownToken;
}

/**
 * Validates an SPL token mint address end-to-end.
 * 1. Checks it's a valid base58 public key.
 * 2. Calls getMint on-chain to verify existence and fetch metadata.
 * Pass connection = null to skip on-chain checks.
 */
export async function validateMint(
  mintAddress: string,
  connection: Connection | null,
): Promise<MintValidationResult> {
  const known = isKnownMint(mintAddress.trim());

  let mintPubkey: PublicKey;
  try {
    mintPubkey = new PublicKey(mintAddress.trim());
  } catch {
    return {
      valid: false,
      mint: mintAddress.trim(),
      error: 'Invalid Solana address: not a valid base58 public key.',
      isTokenProgram: false,
    };
  }

  if (connection) {
    try {
      const mintInfo = await getMint(connection, mintPubkey);
      return {
        valid: true,
        mint: mintAddress.trim(),
        decimals: mintInfo.decimals,
        isTokenProgram: true,
        known,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        valid: false,
        mint: mintAddress.trim(),
        error: `Mint not found on-chain: ${message}`,
        isTokenProgram: false,
      };
    }
  }

  return {
    valid: true,
    mint: mintAddress.trim(),
    isTokenProgram: true,
    known,
  };
}

// ---------------------------------------------------------------------------
// Amount validation
// ---------------------------------------------------------------------------

export interface AmountValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  amount: number;
}

const MAX_REASONABLE_AMOUNT = 1_000_000;
const MAX_AMOUNT = 1_000_000_000;

export function validateAmount(
  amount: number,
  tokenSymbol?: string,
): AmountValidationResult {
  const sym = tokenSymbol ?? 'SPL';

  if (amount <= 0) {
    return {
      valid: false,
      error: `Amount must be greater than zero ${sym}.`,
      amount,
    };
  }

  if (!Number.isFinite(amount) || Number.isNaN(amount)) {
    return {
      valid: false,
      error: 'Amount must be a valid number.',
      amount,
    };
  }

  if (amount > MAX_AMOUNT) {
    return {
      valid: false,
      error: `Amount exceeds maximum allowed (${MAX_AMOUNT.toLocaleString()} ${sym}).`,
      amount,
    };
  }

  if (amount > MAX_REASONABLE_AMOUNT) {
    return {
      valid: true,
      warning: `Amount is very large (${amount.toLocaleString()} ${sym}). Please verify.`,
      amount,
    };
  }

  return { valid: true, amount };
}

// ---------------------------------------------------------------------------
// Memo sanitization (Solana Memo program limits)
// ---------------------------------------------------------------------------

const MAX_MEMO_BYTES = 256;

export function sanitizeMemo(memo: string): string | null {
  if (!memo) return null;

  const cleaned = memo.replace(/[^\x20-\x7E]/g, '').trim();

  if (cleaned.length === 0) return null;

  const encoder = new TextEncoder();
  let bytes = encoder.encode(cleaned);
  if (bytes.length > MAX_MEMO_BYTES) {
    bytes = bytes.slice(0, MAX_MEMO_BYTES);
    const decoder = new TextDecoder();
    const truncated = decoder.decode(bytes);
    return truncated || null;
  }

  return cleaned;
}

// ---------------------------------------------------------------------------
// Token decimal display helpers
// ---------------------------------------------------------------------------

export function formatTokenAmount(rawAmount: number, decimals: number): string {
  const divisor = Math.pow(10, decimals);
  const human = rawAmount / divisor;
  const maxDecimals = Math.min(decimals, 6);
  return human.toFixed(maxDecimals);
}

export function humanToRaw(humanAmount: number, decimals: number): number {
  return Math.round(humanAmount * Math.pow(10, decimals));
}
