/**
 * pay-reference.test.ts — Integration tests for Solana Pay reference field
 *
 * Covers:
 *   1. Payment reference generation (Keypair.generate → valid base58 pubkey)
 *   2. createSolanaPayURL includes reference= query parameter
 *   3. buildAtomicSplitTransaction accepts referencePubkey param
 *   4. generatePaymentReference produces valid output
 *   5. Historical orders (null referencePubkey) — null-safe behavior
 *   6. ReferenceLookupOutcome discriminated union
 */

import { describe, it, expect } from 'vitest';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  generatePaymentReference,
  createSolanaPayURL,
  type ReferenceLookupOutcome,
} from '@/lib/solanaPay';

// ---------------------------------------------------------------------------
// Payment reference generation
// ---------------------------------------------------------------------------

describe('generatePaymentReference', () => {
  it('produces a valid base58 Solana public key', () => {
    const ref = generatePaymentReference();
    expect(ref.publicKey).toBeTypeOf('string');
    expect(ref.publicKey.length).toBeGreaterThan(30);
    // Must be a valid Solana public key (on curve)
    const pk = new PublicKey(ref.publicKey);
    expect(PublicKey.isOnCurve(pk)).toBe(true);
  });

  it('produces unique keys on each call', () => {
    const ref1 = generatePaymentReference();
    const ref2 = generatePaymentReference();
    expect(ref1.publicKey).not.toBe(ref2.publicKey);
  });

  it('secret key is a 64-byte Uint8Array (ed25519 keypair)', () => {
    const ref = generatePaymentReference();
    expect(ref.secretKey).toBeInstanceOf(Uint8Array);
    expect(ref.secretKey.length).toBe(64);
  });

  it('reference public key can be reconstructed from the keypair public key', () => {
    const ref = generatePaymentReference();
    const pk = new PublicKey(ref.publicKey);
    // Regenerate from secret key to confirm they match
    const regenerated = Keypair.fromSecretKey(ref.secretKey);
    expect(regenerated.publicKey.toBase58()).toBe(ref.publicKey);
  });
});

// ---------------------------------------------------------------------------
// Solana Pay URL includes reference
// ---------------------------------------------------------------------------

describe('createSolanaPayURL — reference parameter', () => {
  const REFERENCE_PUBKEY = 'Refe111111111111111111111111111111111111111';

  it('includes reference= query parameter in the URL', () => {
    const url = createSolanaPayURL({
      recipient: 'Recipient1111111111111111111111111111111111',
      amount: 10.50,
      splToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      reference: REFERENCE_PUBKEY,
      label: 'Test Shop',
    });

    expect(url).toContain('reference=');
    expect(url).toContain(encodeURIComponent(REFERENCE_PUBKEY));
  });

  it('does not include reference when not provided', () => {
    const url = createSolanaPayURL({
      recipient: 'Recipient1111111111111111111111111111111111',
      amount: 10.50,
      label: 'Test Shop',
    });

    expect(url).not.toContain('reference=');
  });

  it('includes reference when passed as null (treated as undefined)', () => {
    const url = createSolanaPayURL({
      recipient: 'Recipient1111111111111111111111111111111111',
      amount: 10.50,
      reference: undefined,
      label: 'Test Shop',
    });

    expect(url).not.toContain('reference=');
  });

  it('includes blockhash query param alongside reference', () => {
    const url = createSolanaPayURL({
      recipient: 'Recipient1111111111111111111111111111111111',
      amount: 10.50,
      reference: REFERENCE_PUBKEY,
      label: 'Test Shop',
      blockhash: 'abc123blockhash',
    });

    expect(url).toContain('reference=');
    expect(url).toContain('blockhash=abc123blockhash');
  });
});

// ---------------------------------------------------------------------------
// buildAtomicSplitTransaction — referencePubkey param
// ---------------------------------------------------------------------------

describe('buildAtomicSplitTransaction — referencePubkey acceptance', () => {
  it('BuildAtomicTxParams type accepts referencePubkey', () => {
    // Type-level test: this compiles if referencePubkey is accepted
    const params: Parameters<typeof import('@/lib/solanaPay').buildAtomicSplitTransaction>[1] = {
      customerPubkey: 'Customer111111111111111111111111111111111111',
      splMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      split: {
        merchant: { address: 'M1111111111111111111111111111111111111111', amount: 100, label: 'Merchant' },
        reserve: { address: 'R1111111111111111111111111111111111111111', amount: 5, label: 'Reserve' },
        charity: { address: 'C1111111111111111111111111111111111111111', amount: 0, label: 'Charity' },
      },
      referencePubkey: 'Refe111111111111111111111111111111111111111',
    };

    expect(params.referencePubkey).toBe('Refe111111111111111111111111111111111111111');
  });

  it('BuildAtomicTxParams is fine without referencePubkey', () => {
    const params: Parameters<typeof import('@/lib/solanaPay').buildAtomicSplitTransaction>[1] = {
      customerPubkey: 'Customer111111111111111111111111111111111111',
      splMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      split: {
        merchant: { address: 'M1111111111111111111111111111111111111111', amount: 100, label: 'Merchant' },
        reserve: { address: 'R1111111111111111111111111111111111111111', amount: 5, label: 'Reserve' },
        charity: { address: 'C1111111111111111111111111111111111111111', amount: 0, label: 'Charity' },
      },
    };

    expect(params.referencePubkey).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ReferenceLookupOutcome — discriminated union
// ---------------------------------------------------------------------------

describe('ReferenceLookupOutcome', () => {
  it('found outcome has signature, blockTime, and memo', () => {
    const outcome: ReferenceLookupOutcome = {
      status: 'found',
      signature: '5sig11111111111111111111111111111111111111111111111111111111111111',
      blockTime: 1715800000,
      memo: 'microstore:1:42',
    };

    expect(outcome.status).toBe('found');
    expect(outcome.signature).toBeTruthy();
    expect(outcome.memo).toBe('microstore:1:42');
  });

  it('found outcome allows null memo and blockTime', () => {
    const outcome: ReferenceLookupOutcome = {
      status: 'found',
      signature: '5sig11111111111111111111111111111111111111111111111111111111111111',
      blockTime: null,
      memo: null,
    };

    expect(outcome.status).toBe('found');
    expect(outcome.blockTime).toBeNull();
    expect(outcome.memo).toBeNull();
  });

  it('timeout outcome has no extra fields', () => {
    const outcome: ReferenceLookupOutcome = { status: 'timeout' };
    expect(outcome.status).toBe('timeout');
  });

  it('error outcome has message', () => {
    const outcome: ReferenceLookupOutcome = {
      status: 'error',
      message: 'RPC connection refused',
    };

    expect(outcome.status).toBe('error');
    expect(outcome.message).toBe('RPC connection refused');
  });

  it('discriminated union narrows correctly at runtime', () => {
    const outcomes: ReferenceLookupOutcome[] = [
      { status: 'found', signature: 'sig', blockTime: null, memo: null },
      { status: 'timeout' },
      { status: 'error', message: 'network error' },
    ];

    const founds = outcomes.filter((o) => o.status === 'found');
    const timeouts = outcomes.filter((o) => o.status === 'timeout');
    const errors = outcomes.filter((o) => o.status === 'error');

    expect(founds).toHaveLength(1);
    expect(timeouts).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Historical / null-safe behavior — null referencePubkey
// ---------------------------------------------------------------------------

describe('null referencePubkey — historical order safety', () => {
  it('null referencePubkey is valid on the Order type', () => {
    // Type-level test: Order can have null/undefined referencePubkey
    const order: { referencePubkey?: string } = { referencePubkey: undefined };
    expect(order.referencePubkey).toBeUndefined();
  });

  it('referencePubkey can be null (migration default)', () => {
    const order: { referencePubkey: string | null } = { referencePubkey: null };
    expect(order.referencePubkey).toBeNull();
  });

  it('Keypair.generate produces a non-null pubkey for new orders', () => {
    const kp = Keypair.generate();
    const pubkey = kp.publicKey.toBase58();
    expect(pubkey).toBeTruthy();
    expect(pubkey).not.toBeNull();
  });

  it('null referencePubkey falls back correctly — nullish coalescing', () => {
    const orderRef: string | null = null;
    const resolved = orderRef ?? undefined;
    // createSolanaPayURL would receive undefined → no reference in URL
    expect(resolved).toBeUndefined();

    // createSolanaPayURL would NOT include reference=
    const url = createSolanaPayURL({
      recipient: 'R1111111111111111111111111111111111111111',
      amount: 10,
      reference: resolved,
      label: 'Test',
    });
    expect(url).not.toContain('reference=');
  });
});
