import { quickAddJob } from "graphile-worker";
import { env } from "./env";

/**
 * Enqueue a background job. Payloads must be small and short-lived; completed jobs are removed by
 * graphile-worker. Never put message content, notes or free text in a payload (INV-2/INV-3).
 */
export async function enqueue(task: string, payload: Record<string, unknown>, opts: { runAt?: Date; jobKey?: string; maxAttempts?: number } = {}): Promise<void> {
  await quickAddJob({ connectionString: env().DATABASE_URL }, task, payload, {
    runAt: opts.runAt,
    jobKey: opts.jobKey,
    maxAttempts: opts.maxAttempts ?? 5,
  });
}

export interface SignInMail {
  to: string;
  locale: "en" | "az" | "ru";
  token: string;
  code: string;
  minutes: number;
}
export const enqueueSignInMail = (m: SignInMail) => enqueue("mail.signin", { ...m });
