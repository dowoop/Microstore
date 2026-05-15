import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { verifyAndActivateLicense, deactivateLicense, base64urlEncode } from '@/lib/licenseKey';
import { getActiveTier, Tier, isPro } from '@/lib/featureFlags';

const FIXTURES = resolve('/home/alex', '..', '..', '..', 'Workstation', 'Microstore', '__tests__', 'fixtures');
function loadFixture(name: string) { return readFileSync(resolve(FIXTURES, name), 'utf-8').trim(); }
beforeEach(() => { deactivateLicense(); });

describe('base64urlEncode', () => {
  it('encodes hello', () => { expect(base64urlEncode(new TextEncoder().encode('hello'))).toBe('aGVsbG8'); });
});

describe('verifyAndActivateLicense', () => {
  it('validates valid key', async () => {
    const key = loadFixture('valid-license.key');
    const r = await verifyAndActivateLicense(key);
    expect(r.valid).toBe(true);
    expect(r.payload!.tier).toBe('pro');
    expect(isPro()).toBe(true);
  });
  it('rejects empty', async () => { expect((await verifyAndActivateLicense('')).valid).toBe(false); });
  it('rejects bad format', async () => { expect((await verifyAndActivateLicense('bad')).valid).toBe(false); });
  it('rejects bad base64', async () => { expect((await verifyAndActivateLicense('!!!.!!!')).valid).toBe(false); });
  it('rejects bad JSON', async () => {
    const p = base64urlEncode(new TextEncoder().encode('nope'));
    const s = base64urlEncode(new Uint8Array(64));
    expect((await verifyAndActivateLicense(p + '.' + s)).valid).toBe(false);
  });
});

describe('deactivateLicense', () => {
  it('reverts to Free', async () => {
    await verifyAndActivateLicense(loadFixture('valid-license.key'));
    deactivateLicense();
    expect(isPro()).toBe(false);
  });
});
