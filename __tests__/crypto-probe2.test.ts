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

describe('license verify probe', () => {
  it('imports public key', async () => {
    const keyBytes = Uint8Array.from(atob(PUBLIC_KEY_B64), (c) =>
      c.charCodeAt(0),
    );
    console.log('keyBytes length:', keyBytes.length);

    const pubKey = await crypto.subtle.importKey(
      'spki',
      keyBytes,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    console.log('importKey: OK, type:', pubKey.type);
    expect(pubKey).toBeDefined();
  });

  it('verifies a valid license key', async () => {
    const key = loadFixture('valid-license.key');
    console.log('License key length:', key.length);
    const dotIndex = key.indexOf('.');
    console.log('Dot at:', dotIndex);

    const payloadB64 = key.slice(0, dotIndex);
    const signatureB64 = key.slice(dotIndex + 1);
    console.log('Payload b64 length:', payloadB64.length);
    console.log('Signature b64 length:', signatureB64.length);

    const payloadBytes = base64urlDecode(payloadB64);
    const signatureBytes = base64urlDecode(signatureB64);
    console.log('Payload bytes length:', payloadBytes.length);
    console.log('Signature bytes length:', signatureBytes.length);

    const text = new TextDecoder().decode(payloadBytes);
    console.log('Payload text:', text);

    // Import public key
    const keyBytes = Uint8Array.from(atob(PUBLIC_KEY_B64), (c) =>
      c.charCodeAt(0),
    );
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
      signatureBytes.buffer as ArrayBuffer,
      payloadBytes.buffer as ArrayBuffer,
    );
    console.log('Verify result:', valid);
    expect(valid).toBe(true);
  });
});
