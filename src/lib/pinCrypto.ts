/**
 * PIN hashing and verification using Web Crypto API.
 *
 * Zero external dependencies — uses browser-native crypto.subtle.digest('SHA-256')
 * with a random 16-byte salt generated via crypto.getRandomValues.
 */

const ENCODER = new TextEncoder();
const HEX = '0123456789abcdef';

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let hex = '';
  for (let i = 0; i < view.length; i++) {
    const c = view[i];
    hex += HEX[(c >> 4) & 0xf] + HEX[c & 0xf];
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Generate a cryptographically random 16-byte salt as a hex string. */
export function generateSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bytesToHex(salt);
}

/**
 * Hash a PIN with SHA-256 + salt.
 *
 * Returns the hex-encoded hash and salt for storage.
 */
export async function hashPin(pin: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const usedSalt = salt ?? generateSalt();
  const saltedPin = pin + usedSalt;
  const data = ENCODER.encode(saltedPin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  return { hash: bytesToHex(hashBuffer), salt: usedSalt };
}

/**
 * Verify a PIN against a stored hash and salt.
 */
export async function verifyPin(
  pin: string,
  storedHash: string,
  storedSalt: string,
): Promise<boolean> {
  const { hash } = await hashPin(pin, storedSalt);
  // Constant-time-ish comparison
  if (hash.length !== storedHash.length) return false;
  let equal = true;
  for (let i = 0; i < hash.length; i++) {
    if (hash[i] !== storedHash[i]) equal = false;
  }
  return equal;
}

/** Validate PIN format: 4-6 numeric digits. */
export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}
