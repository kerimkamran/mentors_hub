/**
 * Single-container start for hosted platforms without a separate pre-deploy step or worker service (AWS Lightsail).
 * Order: database roles -> migrations -> demo data (staging only) -> background worker + web server.
 * Any setup failure exits non-zero, so the container never serves traffic on a half-prepared database (INV-8).
 * If either the worker or the web server stops, the container stops and the platform restarts it.
 */
import { spawn, spawnSync } from "node:child_process";
import { applyDerivedEnv } from "../src/lib/derive-env";

applyDerivedEnv();

function step(name: string, args: string[], extraEnv: Record<string, string> = {}) {
  console.log(`[start] ${name}`);
  const r = spawnSync("npx", ["tsx", ...args], { stdio: "inherit", env: { ...process.env, ...extraEnv } });
  if (r.status !== 0) {
    console.error(`[start] ${name} failed (exit ${r.status}); not starting`);
    process.exit(r.status ?? 1);
  }
}

if (process.env.ADMIN_DATABASE_URL) step("database roles", ["scripts/render-prepare.ts"]);
step("migrations", ["scripts/migrate.ts"]);
if (process.env.DEMO_SEED === "1") step("demo organisation", ["scripts/seed-demo.ts"]);

const port = process.env.PORT || "3000";
const children = [
  spawn("npx", ["tsx", "worker/index.ts"], { stdio: "inherit", env: process.env }),
  spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], { stdio: "inherit", env: process.env }),
];
let stopping = false;
const stop = (code: number) => {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill("SIGTERM");
  setTimeout(() => process.exit(code), 5000).unref();
};
for (const c of children) c.on("exit", (code) => stop(code ?? 1));
process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));
