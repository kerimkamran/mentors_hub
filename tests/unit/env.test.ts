import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "../../src/lib/env";

const good = {
  DATABASE_URL: "postgres://mh_app:x@localhost:5432/mentors_hub",
  MIGRATION_DATABASE_URL: "postgres://mh_owner:x@localhost:5432/mentors_hub",
  APP_BASE_URL: "http://localhost:3000",
  SESSION_SECRET: "a".repeat(32),
  MAIL_FROM: "Hub <no-reply@example.test>",
  SMTP_URL: "smtp://localhost:1025",
  DEFAULT_TIME_ZONE: "Asia/Baku",
};

describe("T-INV8-02 · missing or bad environment fails closed", () => {
  it("accepts a complete environment", () => {
    expect(parseEnv(good).DEFAULT_TIME_ZONE).toBe("Asia/Baku");
  });

  for (const key of Object.keys(good)) {
    it(`refuses to start without ${key}`, () => {
      const env: Record<string, string | undefined> = { ...good };
      delete env[key];
      expect(() => parseEnv(env)).toThrow(EnvError);
    });
  }

  it("rejects a short session secret and an invalid time zone, and never echoes values", () => {
    expect(() => parseEnv({ ...good, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
    expect(() => parseEnv({ ...good, DEFAULT_TIME_ZONE: "Mars/Olympus" })).toThrow(/time zone/);
    try {
      parseEnv({ ...good, SESSION_SECRET: "topsecret" });
    } catch (e) {
      expect((e as Error).message).not.toContain("topsecret");
      expect((e as EnvError).refCode).toBe("ENV-001");
    }
  });

  it("the boot hook exits non-zero with a reference code when the environment is incomplete", () => {
    const r = spawnSync("npx", ["tsx", "-e", 'import { parseEnv, EnvError } from "./src/lib/env.ts"; try { parseEnv({}); } catch (e) { if (e instanceof EnvError) { console.error(e.message); process.exit(1); } }'], {
      env: { PATH: process.env.PATH ?? "" } as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("[ENV-001]");
  });
});
