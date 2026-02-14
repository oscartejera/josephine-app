/**
 * Runtime detection + env/crypto wrappers for Node ↔ Deno portability.
 *
 * Provides:
 *   getEnv(key)         — reads env vars in both runtimes
 *   generateUUID()      — crypto.randomUUID() (Web standard)
 *   sha256Hex(input)    — SHA-256 hash → hex string (Web Crypto)
 *   btoa64url / atob64url — base64url encode/decode (Web standard)
 */

const isDeno = "Deno" in globalThis;

export function getEnv(key: string): string | undefined {
  if (isDeno) {
    return (globalThis as any).Deno.env.get(key);
  }
  return (globalThis as any).process?.env?.[key];
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export function toBase64Url(obj: unknown): string {
  const json = JSON.stringify(obj);
  // btoa is available in both Node 16+ and Deno
  const b64 = btoa(json);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(encoded: string): unknown {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
