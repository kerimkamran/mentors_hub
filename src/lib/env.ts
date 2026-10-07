import { z } from "zod";

/**
 * Environment contract (INV-8 fail closed, T-INV8-02).
 * Every variable is required. If any is missing or malformed the process must refuse to
 * start and report a reference code — it never falls back to a default that weakens security.
 */
const schema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  MIGRATION_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  APP_BASE_URL: z.url(),
  SESSION_SECRET: z.string().min(32, "must be at least 32 characters"),
  MAIL_FROM: z.string().min(3),
  SMTP_URL: z.string().min(3),
  DEFAULT_TIME_ZONE: z.string().min(3),
});

export type Env = z.infer<typeof schema>;

export class EnvError extends Error {
  readonly refCode = "ENV-001";
  constructor(readonly problems: string[]) {
    super(`[ENV-001] invalid environment: ${problems.join("; ")}`);
  }
}

/** Parse the environment. Reports variable NAMES only — never values (secrets stay out of logs). */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new EnvError(problems);
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: result.data.DEFAULT_TIME_ZONE });
  } catch {
    throw new EnvError(["DEFAULT_TIME_ZONE: not a valid IANA time zone"]);
  }
  return result.data;
}

let cached: Env | undefined;
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
