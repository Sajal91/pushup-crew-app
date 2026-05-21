import * as Crypto from 'expo-crypto';

/** Cryptographically random hex string (expo-crypto `getRandomValues`). */
export async function generateOAuthState(byteLength = 32): Promise<string> {
  const bytes = Crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 hex digest for nonce / PKCE helpers. */
export async function sha256Hex(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}
