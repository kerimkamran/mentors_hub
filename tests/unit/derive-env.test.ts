import { describe, expect, it } from "vitest";
import { deriveEnv } from "../../src/lib/derive-env";
import { EnvError, parseEnv } from "../../src/lib/env";

const hosted = {
  DB_HOST: "dpg-abc123-a",
  DB_PORT: "5432",
  DB_NAME: "mentors_hub",
  OWNER_PASSWORD: "o/w+n=er-Pass word#1",
  APP_PASSWORD: "a/p+p=App-Pass word#2",
  APP_BASE_URL: "https://example.onrender.com",
  SESSION_SECRET: "s".repeat(40),
  MAIL_FROM: "Hub <no-reply@example.test>",
  SMTP_URL: "smtp://mail.invalid:25",
  DEFAULT_TIME_ZONE: "Asia/Baku",
};

describe("hosted deployment · connection URLs are derived from host, name and generated passwords", () => {
  it("builds both URLs with the right roles and escapes special characters in passwords", () => {
    const e = parseEnv(hosted);
    expect(new URL(e.DATABASE_URL).username).toBe("mh_app");
    expect(decodeURIComponent(new URL(e.DATABASE_URL).password)).toBe(hosted.APP_PASSWORD);
    expect(new URL(e.MIGRATION_DATABASE_URL).username).toBe("mh_owner");
    expect(decodeURIComponent(new URL(e.MIGRATION_DATABASE_URL).password)).toBe(hosted.OWNER_PASSWORD);
    expect(new URL(e.DATABASE_URL).host).toBe("dpg-abc123-a:5432");
  });

  it("explicit URLs win over derived ones", () => {
    const d = deriveEnv({ ...hosted, DATABASE_URL: "postgres://x:y@h:1/d" });
    expect(d.DATABASE_URL).toBe("postgres://x:y@h:1/d");
  });

  it("fails closed when a password is missing: no URL is guessed", () => {
    const { APP_PASSWORD: _a, ...rest } = hosted;
    expect(() => parseEnv(rest)).toThrow(EnvError);
    expect(deriveEnv(rest).DATABASE_URL).toBeUndefined();
  });
});
