// PBKDF2-SHA256 via WebCrypto — available in Node ≥ 19 and every modern browser.
const ITERATIONS = 120_000;

function hex(buf: ArrayBuffer | Uint8Array) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function newSalt() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return hex(bytes);
}

export function newToken() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return hex(bytes);
}

export async function hashPassword(password: string, salt: string) {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await globalThis.crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: ITERATIONS }, key, 256);
  return hex(bits);
}

export async function verifyPassword(password: string, salt: string, hash: string) {
  const got = await hashPassword(password, salt);
  if (got.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}
