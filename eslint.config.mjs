import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  {
    // INV-1.5 / T-INV1-05: the raw pool may only be imported by the database-client module.
    files: ["src/**/*.{ts,tsx}", "worker/**/*.ts"],
    ignores: ["src/lib/db.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "pg", message: "Use the tenant-scoped client in src/lib/db.ts (INV-1.5)." },
          ],
        },
      ],
    },
  },
];

export default config;
