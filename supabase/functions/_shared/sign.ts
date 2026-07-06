// HMAC-SHA256 via Web Crypto — voor tick-auth en het signen van track/unsub-links.
const enc = new TextEncoder();

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function hmacHex(secret: string, msg: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await key(secret), enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyHmac(secret: string, msg: string, sig: string): Promise<boolean> {
  const expected = await hmacHex(secret, msg);
  if (expected.length !== sig.length) return false;
  let res = 0;
  for (let i = 0; i < expected.length; i++) {
    res |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return res === 0;
}
