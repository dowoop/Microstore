// Debug: test DER-to-raw conversion
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PUBLIC_KEY_B64 =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENcg2xRynZb5Y8nADAeVOX3JkVieHzqdnsIod0VH9VWSkFb7ElWXkva+fdB5704q89sSrBCZZ3NIi5e0CGXLqLQ==';

const FIXTURES = resolve(__dirname, '..', '__tests__', 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES, name), 'utf-8').trim();
}

function base64urlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(b64 + padding);
  return Uint8Array.from(binary, (c: string) => c.charCodeAt(0));
}

function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length < 8 || der[0] !== 0x30) {
    throw new Error('Invalid DER signature');
  }
  // Read r
  const rLen = der[3];
  let rStart = 4;
  if (der[rStart] === 0 && rLen > 32) {
    rStart++;
  }
  // Read s — use 4+rLen (fixed DER offset), not rStart+rLen (rStart may have been bumped past leading zero)
  const sMarker = 4 + rLen;
  if (der[sMarker] !== 0x02) {
    throw new Error('Invalid DER signature: expected 0x02 before s');
  }
  const sLen = der[sMarker + 1];
  let sStart = sMarker + 2;
  if (der[sStart] === 0 && sLen > 32) {
    sStart++;
  }
  // Build raw
  const raw = new Uint8Array(64);
  const rBytes = der.slice(rStart, rStart + Math.min(rLen, 32));
  const sBytes = der.slice(sStart, sStart + Math.min(sLen, 32));
  raw.set(rBytes, 32 - rBytes.length);
  raw.set(sBytes, 64 - sBytes.length);
  return raw;
}

describe('DER debug', () => {
  it('converts DER and verifies', async () => {
    const key = loadFixture('valid-license.key');
    const parts = key.split('.');
    const payloadBytes = base64urlDecode(parts[0]);
    const sigBytes = base64urlDecode(parts[1]);

    console.log('sig length:', sigBytes.length);
    console.log('sig hex:', Buffer.from(sigBytes).toString('hex'));

    // Show DER structure
    console.log('der[0]:', '0x' + sigBytes[0].toString(16)); // should be 30
    console.log('der[1]:', sigBytes[1]); // total len
    console.log('der[2]:', '0x' + sigBytes[2].toString(16)); // should be 02
    console.log('der[3]:', sigBytes[3]); // r_len

    const raw = derToRaw(sigBytes);
    console.log('raw length:', raw.length);
    console.log('raw hex:', Buffer.from(raw).toString('hex'));

    // Import key
    const keyBytes = Uint8Array.from(atob(PUBLIC_KEY_B64), (c) => c.charCodeAt(0));
    const pubKey = await crypto.subtle.importKey(
      'spki',
      keyBytes,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );

    // Verify
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pubKey,
      raw.buffer as ArrayBuffer,
      payloadBytes.buffer as ArrayBuffer,
    );
    console.log('verify result:', valid);
    expect(valid).toBe(true);
  });
});
