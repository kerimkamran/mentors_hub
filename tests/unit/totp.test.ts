import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, totpAt, verifyTotp } from "../../src/lib/totp";
import { decryptSecret, encryptSecret } from "../../src/lib/crypto";

describe("TOTP (RFC 6238) and secret encryption", () => {
  const rfcSecret = base32Encode(Buffer.from("12345678901234567890"));
  it("matches the RFC 6238 SHA-1 test vectors (6 digits)", () => {
    expect(totpAt(rfcSecret, Math.floor(59 / 30))).toBe("287082");
    expect(totpAt(rfcSecret, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpAt(rfcSecret, Math.floor(2000000000 / 30))).toBe("279037");
  });
  it("accepts ±1 step of clock drift and rejects further", () => {
    const now = 1_700_000_000_000;
    const c = Math.floor(now / 30000);
    expect(verifyTotp(rfcSecret, totpAt(rfcSecret, c), now)).toBe(c);
    expect(verifyTotp(rfcSecret, totpAt(rfcSecret, c + 1), now)).toBe(c + 1);
    expect(verifyTotp(rfcSecret, totpAt(rfcSecret, c + 3), now)).toBeNull();
    expect(verifyTotp(rfcSecret, "abc123", now)).toBeNull();
  });
  it("base32 round-trips", () => {
    const s = generateTotpSecret();
    expect(base32Encode(base32Decode(s))).toBe(s);
  });
  it("secrets are encrypted, never stored in plain text, and tampering is detected", () => {
    const key = "x".repeat(32);
    const blob = encryptSecret("JBSWY3DPEHPK3PXP", key);
    expect(blob).not.toContain("JBSWY3DP");
    expect(decryptSecret(blob, key)).toBe("JBSWY3DPEHPK3PXP");
    expect(() => decryptSecret(blob.slice(0, -2) + "AA", key)).toThrow();
    expect(() => decryptSecret(blob, "y".repeat(32))).toThrow();
  });
});
