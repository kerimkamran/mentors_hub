import { describe, expect, it } from "vitest";
import { checkPassword, hashPassword, verifyPassword } from "../../src/lib/auth/password";

describe("password hashing and policy", () => {
  it("round-trips, salts every hash and rejects a wrong password", async () => {
    const a = await hashPassword("correct horse battery staple");
    const b = await hashPassword("correct horse battery staple");
    expect(a).not.toBe(b);
    expect(a).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery staple", a)).toBe(true);
    expect(await verifyPassword("correct horse battery stapler", a)).toBe(false);
  });
  it("treats malformed stored values as a failed check, not an error", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "scrypt$v1$bad")).toBe(false);
    expect(await verifyPassword("x", "scrypt$v1$0$0$0$AAAA$AAAA")).toBe(false);
  });
  it("enforces length and refuses obvious choices", () => {
    expect(checkPassword("short")).toBe("too_short");
    expect(checkPassword("x".repeat(129) + "abcde")).toBe("too_long");
    expect(checkPassword("password1234")).toBe("weak");
    expect(checkPassword("aaaaaaaaaaaaaaaa")).toBe("weak");
    expect(checkPassword("kamran.karimli-2026", "kamran.karimli@azerconnect.az")).toBe("weak");
    expect(checkPassword("correct horse battery staple", "a@b.example")).toBeNull();
  });
});
