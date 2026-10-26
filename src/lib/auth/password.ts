/**
 * Password hashing and policy. scrypt (Node built-in, memory-hard, no extra dependency), per-password random salt,
 * parameters stored with the hash so they can be raised later. Only the hash is ever stored (INV-8.4 as amended).
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * 1024 * 1024;

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

function derive(password: string, salt: Buffer, n: number, r: number, p: number, len: number): Promise<Buffer> {
  const opts: ScryptOptions = { N: n, r, p, maxmem: MAXMEM };
  return new Promise((resolve, reject) => scrypt(password.normalize("NFKC"), salt, len, opts, (e, key) => (e ? reject(e) : resolve(key))));
}

/** `scrypt$v1$N$r$p$salt$hash` (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P, KEYLEN);
  return ["scrypt", "v1", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 7 || parts[0] !== "scrypt" || parts[1] !== "v1") return false;
  const [n, r, p] = [Number(parts[2]), Number(parts[3]), Number(parts[4])];
  if (![n, r, p].every((x) => Number.isInteger(x) && x > 0)) return false;
  const salt = Buffer.from(parts[5]!, "base64url");
  const expected = Buffer.from(parts[6]!, "base64url");
  try {
    const actual = await derive(password, salt, n, r, p, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | null = null;
/** Spends the same time as a real check, so an unknown address costs what a known one does. */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummy ??= hashPassword(randomBytes(12).toString("base64url"));
  await verifyPassword(password, await dummy);
  return false;
}

export type PasswordProblem = "too_short" | "too_long" | "weak";

const COMMON = new Set(["password1234", "123456789012", "qwertyuiop12", "administrator", "welcome12345", "changeme1234", "mentorshiphub", "azerconnect12"]);

/** Length first (NIST-style); no composition rules, but obvious choices are refused. */
export function checkPassword(password: string, email?: string): PasswordProblem | null {
  if ([...password].length < PASSWORD_MIN) return "too_short";
  if (password.length > PASSWORD_MAX) return "too_long";
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "weak";
  if (new Set(lower).size < 5) return "weak";
  if (email) {
    const local = email.toLowerCase().split("@")[0] ?? "";
    if (lower === email.toLowerCase() || (local.length >= 6 && lower.includes(local))) return "weak";
  }
  return null;
}

export class PasswordError extends Error {
  constructor(readonly reason: PasswordProblem) {
    super(`password refused: ${reason}`);
  }
}
