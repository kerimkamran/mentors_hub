# Mentorship Hub

Mentoring platform for Azerconnect Group. Specification: [`spec/`](spec/README.md). Build plan: slices S0–S14 in the Product & Delivery Plan v1.0.

**Current state: slice S0 — foundation and spikes.** No user-facing features yet (sign-in is slice S1).

## What S0 contains

| Area | Where |
|---|---|
| Next.js 16 / React 19 / Tailwind 4 app, security headers, `/api/health` | `src/` |
| Fail-closed environment check (refuses to boot, reference code ENV-001) | `src/lib/env.ts`, `src/instrumentation*.ts` |
| Tenant-scoped database client — the only code allowed to import `pg` | `src/lib/db.ts` |
| Plain-SQL migrations, owner/app roles, forced row-level security, append-only audit log | `db/`, `scripts/migrate.ts` |
| Migration lint (every tenant table has `organisation_id` + forced RLS; no password columns) | `scripts/lint-migrations.ts` |
| Background worker (graphile-worker) running as the least-privilege role | `worker/` |
| Calendar-invite builder and mail helper (for slice S7) | `src/lib/ics.ts`, `src/lib/mail.ts` |
| Language support: search normalisation (SQL + TS, tested identical), az/ru collations | `src/lib/search.ts`, migration 0002 |
| Tests on a real PostgreSQL | `tests/` |
| CI, Render blueprint, local dev services | `.github/workflows/ci.yml`, `render.yaml`, `docker-compose.yml` |
| Spike results and what is still manual | [`docs/spikes.md`](docs/spikes.md) |
| Staging deployment guide (Render, Frankfurt) | [`docs/DEPLOY_RENDER.md`](docs/DEPLOY_RENDER.md) |

## Run it locally

Requires Node 22 and PostgreSQL 16 (or Docker).

```bash
npm ci
docker compose up -d                 # PostgreSQL + Mailpit (or use your own PostgreSQL: ./scripts/dev-db.sh)
cp .env.example .env
npm run db:migrate                   # applies db/migrations as the owner role
npm run check                        # lint, typecheck, unit + database tests
npm run dev                          # http://localhost:3000   (health: /api/health)
npm run worker                       # background worker, in a second terminal
```

## Rules the code already enforces

- **Tenant isolation is the database's job** (INV-1): the app role cannot own tables or bypass RLS; the organisation context is set per transaction by `withOrg` only.
- **Fail closed** (INV-8): a missing environment variable stops the server; a failing migration aborts the release.
- **Audit log has no free text** (INV-3): `action` is a code, the table is append-only.
- No passwords exist anywhere in the schema (INV-8.4).

## Next slice

S1 — tenancy, sign-in and roles (magic link bound to the requesting browser, rate limits, sessions, admin TOTP, permission system, audit viewer foundations). Spec: `spec/06-stories-participant/01-access-and-profile.md`, `spec/04-permission-matrix.md`, `spec/03-invariants.md`.
