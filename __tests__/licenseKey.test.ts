import { describe, it, expect, beforeEach } from 'vitest';
import { verifyAndActivateLicense, deactivateLicense, base64urlEncode } from '@/lib/licenseKey';
import { getActiveTier, Tier, isPro } from '@/lib/featureFlags';
const VALID_KEY = 'eyJ0aWVyIjoicHJvIiwic2hvcElkIjoidGVzdC1zaG9wLTEiLCJsaWNlbnNlZSI6IlRlc3QgVXNlciIsImlhdCI6MTc3ODgyNzA4NCwiZXhwIjoxODEwMzYzMDg0fQ.MEUCIHY_8thd_z4FDlxC1GgJ6pGW4lsz9rL39Wfl5tXAmNYlAiEA9lmM77nEe-eEpq3Cn1BCnI_fmepVPiPEsPOrs2-tJ6s';
beforeEach(() => { deactivateLicense(); });
describe('base64urlEncode', () => {
  it('encodes hello', () => { expect(base64urlEncode(new TextEncoder().encode('hello'))).toBe('aGVsbG8'); });
  it('URL-safe', () => {
    const e = base64urlEncode(new Uint8Array([0xfb, 0xff, 0xfe]));
    expect(e).not.toContain('+'); expect(e).not.toContain('/'); expect(e).not.toContain('=');
  });
});
describe('verifyAndActivateLicense', () => {
  it('validates valid key and activates Pro', async () => {
    const r = await verifyAndActivateLicense(VALID_KEY);
    expect(r.valid).toBe(true);
    expect(r.payload!.tier).toBe('pro');
    expect(r.payload!.shopId).toBe('test-shop-1');
    expect(r.payload!.licensee).toBe('Test User');
    expect(isPro()).toBe(true);
    expect(getActiveTier()).toBe(Tier.Pro);
  });
  it('rejects empty', async () => { expect((await verifyAndActivateLicense('')).valid).toBe(false); });
  it('rejects bad format', async () => { expect((await verifyAndActivateLicense('bad')).valid).toBe(false); });
  it('rejects bad base64', async () => { expect((await verifyAndActivateLicense('!!!.!!!')).valid).toBe(false); });
  it('rejects bad JSON', async () => {
    const p = base64urlEncode(new TextEncoder().encode('nope'));
    const s = base64urlEncode(new Uint8Array(64));
    expect((await verifyAndActivateLicense(p + '.' + s)).valid).toBe(false);
  });
  it('rejects unknown tier', async () => {
    const p = base64urlEncode(new TextEncoder().encode(JSON.stringify({tier:'enterprise',shopId:'x',iat:1,exp:0})));
    const s = base64urlEncode(new Uint8Array(64));
    expect((await verifyAndActivateLicense(p + '.' + s)).valid).toBe(false);
  });
  it('rejects missing fields', async () => {
    const p = base64urlEncode(new TextEncoder().encode(JSON.stringify({foo:'bar'})));
    const s = base64urlEncode(new Uint8Array(64));
    expect((await verifyAndActivateLicense(p + '.' + s)).valid).toBe(false);
  });
  it('rejects tampered signature', async () => {
    const parts = VALID_KEY.split('.');
    const tampered = parts[0].slice(0, -1) + (parts[0].slice(-1) === 'A' ? 'B' : 'A') + '.' + parts[1];
    expect((await verifyAndActivateLicense(tampered)).valid).toBe(false);
  });
});
describe('deactivateLicense', () => {
  it('reverts to Free', async () => {
    await verifyAndActivateLicense(VALID_KEY);
    expect(isPro()).toBe(true);
    deactivateLicense();
    expect(isPro()).toBe(false);
    expect(getActiveTier()).toBe(Tier.Free);
  });
});
