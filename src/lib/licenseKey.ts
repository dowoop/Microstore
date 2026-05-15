// ---------------------------------------------------------------------------
// License key validation — privacy-first, no phone-home
// ---------------------------------------------------------------------------
//
// Architecture:
//   A P-256 ECDSA key pair is used. The public key is embedded here.
//   The private key is held offline — used only to sign license payloads
//   via `scripts/sign-license.js`.
//
//   A license key is a base64url-encoded JSON payload + base64url-encoded
//   signature, separated by a dot:  <payload>.<signature>
//
//   Validation:
//     1. Decode payload and signature from base64url.
//     2. Verify ECDSA signature using embedded public key.
//     3. Check expiry (exp field is a Unix timestamp in seconds).
//     4. On success, activate Pro tier via featureFlags.setActiveTier().
//
//   No server. No tracking. No telemetry. Works fully offline.
// ---------------------------------------------------------------------------

import { Tier, setActiveTier } from '@/lib/featureFlags';

// ---------------------------------------------------------------------------
// Embedded public key (SPKI DER → base64)
// Generated via: node scripts/generate-keys.js
// ---------------------------------------------------------------------------

const PUBLIC_KEY_B64 =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENcg2xRynZb5Y8nADAeVOX3JkVieHzqdnsIod0VH9VWSkFb7ElWXkva+fdB5704q89sSrBCZZ3NIi5e0CGXLqLQ==';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Payload embedded in a license key. */
export interface LicensePayload {
  /** License tier. Currently only 'pro' is valid. */
  tier: 'pro';
  /** Shop identifier this license is bound to. */
  shopId: string;
  /** Licensee name or identifier (optional, for display). */
  licensee?: string;
  /** Issued-at timestamp (Unix seconds). */
  iat: number;
  /** Expiration timestamp (Unix seconds). 0 = perpetual. */
  exp: number;
}

export interface LicenseValidationResult {
  valid: boolean;
  payload?: LicensePayload;
  error?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

let cachedCryptoKey: CryptoKey | null = null;

/**
 * Import the embedded SPKI public key into a CryptoKey.
 * Cached after first call so we only import once per session.
 */
async function getPublicKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;

  const keyBytes = Uint8Array.from(atob(PUBLIC_KEY_B64), (c) =>
    c.charCodeAt(0),
  );

  cachedCryptoKey = await crypto.subtle.importKey(
    'spki',
    keyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );

  return cachedCryptoKey;
}

/**
 * Base64url-decode a string into a Uint8Array.
 */
function base64urlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(b64 + padding);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Base64url-encode a Uint8Array into a string.
 */
export function base64urlEncode(input: Uint8Array): string {
  const chars = Array.from(input, (b) => String.fromCharCode(b));
  const binary = chars.join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify and activate a license key.
 *
 * @param licenseKey  The full key string: "<payload-b64>.<sig-b64>"
 * @returns Validation result with parsed payload on success.
 */
export async function verifyAndActivateLicense(
  licenseKey: string,
): Promise<LicenseValidationResult> {
  // -- 1. Parse key format ------------------------------------------------
  const dotIndex = licenseKey.indexOf('.');
  if (dotIndex === -1 || dotIndex === 0 || dotIndex === licenseKey.length - 1) {
    return { valid: false, error: 'Invalid license key format. Expected <payload>.<signature>.' };
  }

  const payloadB64 = licenseKey.slice(0, dotIndex);
  const signatureB64 = licenseKey.slice(dotIndex + 1);

  // -- 2. Decode payload --------------------------------------------------
  let payloadBytes: Uint8Array;
  let signatureBytes: Uint8Array;
  try {
    payloadBytes = base64urlDecode(payloadB64);
    signatureBytes = base64urlDecode(signatureB64);
  } catch {
    return { valid: false, error: 'License key contains invalid base64.' };
  }

  // -- 3. Parse JSON payload ----------------------------------------------
  let payload: LicensePayload;
  try {
    const text = new TextDecoder().decode(payloadBytes);
    payload = JSON.parse(text);
  } catch {
    return { valid: false, error: 'License payload is not valid JSON.' };
  }

  // -- 4. Validate payload shape ------------------------------------------
  if (!payload.tier || !payload.shopId || typeof payload.iat !== 'number') {
    return { valid: false, error: 'License payload missing required fields (tier, shopId, iat).' };
  }
  if (payload.tier !== 'pro') {
    return { valid: false, error: 'Unknown tier "' + payload.tier + '".' };
  }

  // -- 5. Check expiry ----------------------------------------------------
  if (payload.exp !== 0 && payload.exp < Math.floor(Date.now() / 1000)) {
    return { valid: false, error: 'License has expired.', payload };
  }

  // -- 6. Verify ECDSA signature ------------------------------------------
  try {
    const pubKey = await getPublicKey();
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pubKey,
      signatureBytes.buffer as ArrayBuffer,
      payloadBytes.buffer as ArrayBuffer,
    );

    if (!valid) {
      return { valid: false, error: 'License signature is invalid. The key may be tampered.' };
    }
  } catch (err) {
    return {
      valid: false,
      error: 'Signature verification failed: ' + (err instanceof Error ? err.message : 'unknown error'),
    };
  }

  // -- 7. Activate Pro tier -----------------------------------------------
  setActiveTier(Tier.Pro);

  return { valid: true, payload };
}

/**
 * Deactivate the current license, reverting to Free tier.
 */
export function deactivateLicense(): void {
  setActiveTier(Tier.Free);
}
