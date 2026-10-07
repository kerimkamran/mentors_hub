import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");

/** URL-safe random token (default 256 bits). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Zero-padded numeric code, uniformly random. */
export function randomCode(digits = 6): string {
  return String(randomInt(0, 10 ** digits)).padStart(digits, "0");
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

function key(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "mentors-hub", "totp-secret-v1", 32));
}

/** AES-256-GCM; output `v1.<iv>.<tag>.<ciphertext>` (base64url). */
export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptSecret(blob: string, secret: string): string {
  const [v, iv, tag, enc] = blob.split(".");
  if (v !== "v1" || !iv || !tag || !enc) throw new Error("bad secret blob");
  const d = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
}
