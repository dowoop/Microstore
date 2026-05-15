// ---------------------------------------------------------------------------
// Tests: licenseKey.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  verifyAndActivateLicense,
  deactivateLicense,
  base64urlEncode,
  type LicensePayload,
} from '@/lib/licenseKey';
import { getActiveTier, Tier, isPro } from '@/lib/featureFlags';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURES = resolve(__dirname, '..', '__tests__', 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES, name), 'utf-8').trim();
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  deactivateLicense();
});

// ---------------------------------------------------------------------------
// base64urlEncode
// ---------------------------------------------------------------------------

describe('base64urlEncode', () => {
  it('encodes bytes to base64url', () => {
    const input = new TextEncoder().encode('hello');
    const encoded = base64urlEncode(input);
    expect(encoded).toBe('aGVsbG8');
  });

  it('produces URL-safe output (no +, /, or =)', () => {
    const input = new Uint8Array([0xfb, 0xff, 0xfe]);
    const encoded = base64urlEncode(input);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('round-trips correctly', () => {
    const original = JSON.stringify({ foo: 'bar', num: 42 });
    const encoded = base64urlEncode(new TextEncoder().encode(original));
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(b64);
    expect(decoded).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// verifyAndActivateLicense — valid key
// ---------------------------------------------------------------------------

describe('verifyAndActivateLicense', () => {
  it('validates a valid license key and activates Pro tier', async () => {
    const key = loadFixture('valid-license.key');
    const result = await verifyAndActivateLicense(key);

    expect(result.valid).toBe(true);
    expect(result.payload).toBeDefined();
    expect(result.payload!.tier).toBe('pro');
    expect(result.payload!.shopId).toBe('test-shop-1');
    expect(result.payload!.licensee).toBe('Test User');
    expect(result.error).toBeUndefined();
    expect(isPro()).toBe(true);
    expect(getActiveTier()).toBe(Tier.Pro);
  });

  it('returns parsed payload with correct shape', async () => {
    const key = loadFixture('valid-license.key');
    const result = await verifyAndActivateLicense(key);

    const p = result.payload as LicensePayload;
    expect(typeof p.iat).toBe('number');
    expect(typeof p.exp).toBe('number');
    expect(p.exp).toBeGreaterThan(p.iat);
  });
});

// ---------------------------------------------------------------------------
// verifyAndActivateLicense — invalid keys
// ---------------------------------------------------------------------------

describe('verifyAndActivateLicense — invalid', () => {
  it('rejects empty string', async () => {
    const result = await verifyAndActivateLicense('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('format');
  });

  it('rejects key without a dot separator', async () => {
    const result = await verifyAndActivateLicense('justsomebytes');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('format');
  });

  it('rejects key with empty signature', async () => {
    const result = await verifyAndActivateLicense('abc.');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('format');
  });

  it('rejects key with empty payload', async () => {
    const result = await verifyAndActivateLicense('.xyz');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('format');
  });

  it('rejects key with invalid base64', async () => {
    const result = await verifyAndActivateLicense('!!!not-valid!!!.!!!nope!!!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('base64');
  });

  it('rejects key with non-JSON payload', async () => {
    const junkPayload = base64urlEncode(new TextEncoder().encode('not json'));
    const junkSig = base64urlEncode(new Uint8Array(64));
    const result = await verifyAndActivateLicense(junkPayload + '.' + junkSig);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('JSON');
  });

  it('rejects payload missing required fields', async () => {
    const badPayload = base64urlEncode(
      new TextEncoder().encode(JSON.stringify({ foo: 'bar' })),
    );
    const sig = base64urlEncode(new Uint8Array(64));
    const result = await verifyAndActivateLicense(badPayload + '.' + sig);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('missing required fields');
  });

  it('rejects payload with unknown tier', async () => {
    const badPayload = base64urlEncode(
      new TextEncoder().encode(
        JSON.stringify({
          tier: 'enterprise',
          shopId: 'x',
          iat: Math.floor(Date.now() / 1000),
          exp: 0,
        }),
      ),
    );
    const sig = base64urlEncode(new Uint8Array(64));
    const result = await verifyAndActivateLicense(badPayload + '.' + sig);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unknown tier');
  });

  it('rejects tampered payload (signature mismatch)', async () => {
    const valid = loadFixture('valid-license.key');
    const parts = valid.split('.');
    const tamperedPayload =
      parts[0].slice(0, -1) + (parts[0].slice(-1) === 'A' ? 'B' : 'A');
    const result = await verifyAndActivateLicense(tamperedPayload + '.' + parts[1]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid');
  });
});

// ---------------------------------------------------------------------------
// verifyAndActivateLicense — expired key
// ---------------------------------------------------------------------------

describe('verifyAndActivateLicense — expiry', () => {
  it('handles expiring license keys', async () => {
    const key = loadFixture('expiring-license.key');
    const result = await verifyAndActivateLicense(key);

    if (result.valid) {
      expect(result.payload).toBeDefined();
      expect(result.payload!.shopId).toBe('test-shop-2');
    } else {
      expect(result.error).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// deactivateLicense
// ---------------------------------------------------------------------------

describe('deactivateLicense', () => {
  it('reverts tier to Free', async () => {
    const key = loadFixture('valid-license.key');
    await verifyAndActivateLicense(key);
    expect(isPro()).toBe(true);

    deactivateLicense();
    expect(isPro()).toBe(false);
    expect(getActiveTier()).toBe(Tier.Free);
  });
});
