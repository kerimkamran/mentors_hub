import { parseEnv, EnvError } from "./lib/env";

/** Node-runtime boot check: a bad environment stops the server before it serves anything (T-INV8-02). */
export function bootCheck() {
  try {
    parseEnv(process.env);
  } catch (e) {
    if (e instanceof EnvError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
}
