/**
 * Token encryption/decryption using AES-256-GCM (Web Crypto API).
 *
 * Encryption key is derived from the SQUARE_TOKEN_ENCRYPTION_KEY env var
 * via PBKDF2. If the env var is missing, falls back to SUPABASE_SERVICE_ROLE_KEY.
 *
 * Ciphertext format:  base64(iv || ciphertext || tag)
 * iv = 12 bytes, tag = appended by AES-GCM automatically.
 */

const SALT = new TextEncoder().encode('josephine-square-token-v1');

async function deriveKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('SQUARE_TOKEN_ENCRYPTION_KEY')
    || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!secret) {
    throw new Error('No encryption key available (set SQUARE_TOKEN_ENCRYPTION_KEY)');
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptToken(plaintext: string): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );

  // Concatenate iv + ciphertext (tag is appended by AES-GCM)
  const combined = new Uint8Array(iv.length + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

export async function decryptToken(ciphertext: string): Promise<string> {
  const key = await deriveKey();

  // Decode base64
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );

  return new TextDecoder().decode(plainBuf);
}

/**
 * Verify Square webhook HMAC-SHA256 signature.
 *
 * Square computes: HMAC-SHA256(signingKey, notificationUrl + body)
 * and sends the result base64-encoded in x-square-hmacsha256-signature.
 */
export async function verifySquareWebhookSignature(
  body: string,
  signature: string,
  signingKey: string,
  notificationUrl: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const payload = new TextEncoder().encode(notificationUrl + body);
  const mac = await crypto.subtle.sign('HMAC', key, payload);
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}
