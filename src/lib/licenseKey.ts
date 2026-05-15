import { Tier, setActiveTier } from '@/lib/featureFlags';
const PUBLIC_KEY_B64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENcg2xRynZb5Y8nADAeVOX3JkVieHzqdnsIod0VH9VWSkFb7ElWXkva+fdB5704q89sSrBCZZ3NIi5e0CGXLqLQ==';
export interface LicensePayload { tier: 'pro'; shopId: string; licensee?: string; iat: number; exp: number; }
export interface LicenseValidationResult { valid: boolean; payload?: LicensePayload; error?: string; }
function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length < 8 || der[0] !== 0x30) throw new Error('Invalid DER');
  const rLen = der[3]; let rStart = 4;
  if (der[rStart] === 0 && rLen > 32) rStart++;
  const sMarker = 4 + rLen;
  if (der[sMarker] !== 0x02) throw new Error('Invalid DER: expected 0x02');
  const sLen = der[sMarker + 1]; let sStart = sMarker + 2;
  if (der[sStart] === 0 && sLen > 32) sStart++;
  const raw = new Uint8Array(64);
  const rBytes = der.slice(rStart, rStart + Math.min(rLen, 32));
  const sBytes = der.slice(sStart, sStart + Math.min(sLen, 32));
  raw.set(rBytes, 32 - rBytes.length); raw.set(sBytes, 64 - sBytes.length);
  return raw;
}
let cachedCryptoKey: CryptoKey | null = null;
async function getPublicKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;
  const keyBytes = Uint8Array.from(atob(PUBLIC_KEY_B64), c => c.charCodeAt(0));
  cachedCryptoKey = await crypto.subtle.importKey('spki', keyBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return cachedCryptoKey;
}
function base64urlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(b64 + padding), c => c.charCodeAt(0));
}
export function base64urlEncode(input: Uint8Array): string {
  return btoa(Array.from(input, b => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function verifyAndActivateLicense(licenseKey: string): Promise<LicenseValidationResult> {
  const dotIndex = licenseKey.indexOf('.');
  if (dotIndex <= 0 || dotIndex === licenseKey.length - 1) return { valid: false, error: 'Invalid format' };
  let payloadBytes: Uint8Array, signatureBytes: Uint8Array;
  try { payloadBytes = base64urlDecode(licenseKey.slice(0, dotIndex)); signatureBytes = base64urlDecode(licenseKey.slice(dotIndex + 1)); }
  catch { return { valid: false, error: 'Invalid base64' }; }
  let payload: LicensePayload;
  try { payload = JSON.parse(new TextDecoder().decode(payloadBytes)); }
  catch { return { valid: false, error: 'Invalid JSON' }; }
  if (!payload.tier || !payload.shopId || typeof payload.iat !== 'number') return { valid: false, error: 'Missing required fields' };
  if (payload.tier !== 'pro') return { valid: false, error: 'Unknown tier' };
  if (payload.exp !== 0 && payload.exp < Math.floor(Date.now() / 1000)) return { valid: false, error: 'Expired' };
  let rawSignature: Uint8Array;
  try { rawSignature = derToRaw(signatureBytes); } catch { return { valid: false, error: 'Bad signature format' }; }
  try {
    const pubKey = await getPublicKey();
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, rawSignature.buffer as ArrayBuffer, payloadBytes.buffer as ArrayBuffer);
    if (!valid) return { valid: false, error: 'Invalid signature' };
  } catch (err) { return { valid: false, error: 'Verify failed' }; }
  setActiveTier(Tier.Pro);
  return { valid: true, payload };
}
export function deactivateLicense(): void { setActiveTier(Tier.Free); }
