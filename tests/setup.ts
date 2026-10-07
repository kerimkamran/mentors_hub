import { existsSync } from "node:fs";

// Load .env for local runs; CI provides real environment variables.
if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
