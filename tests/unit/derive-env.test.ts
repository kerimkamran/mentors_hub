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

  it("fails closed when neither a password nor a secret to derive one from is present: no URL is guessed", () => {
    const { APP_PASSWORD: _a, SESSION_SECRET: _s, ...rest } = hosted;
    expect(() => parseEnv(rest)).toThrow(EnvError);
    expect(deriveEnv(rest).DATABASE_URL).toBeUndefined();
  });
});

describe("managed database (AWS Lightsail): admin URL, derived role passwords, encrypted transport", () => {
  const managed = {
    DB_HOST: "ls-abc.cxyz.eu-central-1.rds.amazonaws.com",
    DB_NAME: "mentors_hub",
    DB_SSL: "1",
    ADMIN_USER: "dbmasteruser",
    ADMIN_PASSWORD: "p@ss/word#1",
    SESSION_SECRET: "m".repeat(48),
    APP_BASE_URL: "https://mh.example.test",
    MAIL_FROM: "Hub <no-reply@example.test>",
    SMTP_URL: "smtp://mail.invalid:25",
    DEFAULT_TIME_ZONE: "Asia/Baku",
  };

  it("needs only the database host, the master login and one long secret", () => {
    const e = parseEnv(managed);
    expect(new URL(e.DATABASE_URL).username).toBe("mh_app");
    expect(new URL(e.DATABASE_URL).searchParams.get("sslmode")).toBe("no-verify");
    expect(new URL(e.MIGRATION_DATABASE_URL).username).toBe("mh_owner");
    const admin = deriveEnv(managed).ADMIN_DATABASE_URL!;
    expect(new URL(admin).username).toBe("dbmasteruser");
    expect(decodeURIComponent(new URL(admin).password)).toBe("p@ss/word#1");
    expect(new URL(admin).pathname).toBe("/postgres");
  });

  it("derives different, stable passwords per role, at least 16 characters, and changes them with the secret", async () => {
    const { derivedPassword } = await import("../../src/lib/derive-env");
    const a = derivedPassword("m".repeat(48), "app");
    expect(a).toBe(derivedPassword("m".repeat(48), "app"));
    expect(a).not.toBe(derivedPassword("m".repeat(48), "owner"));
    expect(a.length).toBeGreaterThanOrEqual(16);
    expect(derivedPassword("n".repeat(48), "app")).not.toBe(a);
  });

  it("fails closed with a short secret: no passwords are derived from it", () => {
    const d = deriveEnv({ ...managed, SESSION_SECRET: "short" });
    expect(d.DATABASE_URL).toBeUndefined();
    expect(() => parseEnv({ ...managed, SESSION_SECRET: "short" })).toThrow(EnvError);
  });
});
