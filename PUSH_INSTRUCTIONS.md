# Pushing Mentorship Hub (specification + slice S0 foundation) to kerimkamran/mentors_hub

This package supersedes all earlier zips. Unzip it into the root of the repository; it adds:

```
spec/                 specification, Batches 1, 2 and 3A (admin panel)
src/ db/ worker/ scripts/ tests/ docs/    slice S0 code
package.json, tsconfig.json, next.config.ts, eslint.config.mjs, vitest.config.ts, render.yaml, docker-compose.yml, .env.example, .gitignore
.github/workflows/ci.yml          build + tests on a real PostgreSQL
.github/workflows/spec-check.yml  specification consistency
README.md                         REPLACES the repository's current README (it was nearly empty)
```

## On the other device

```bash
git clone https://github.com/kerimkamran/mentors_hub.git && cd mentors_hub
unzip -o /path/to/mentors_hub_S0_foundation.zip -d .

# verify (needs Node 22 and PostgreSQL 16; or Docker)
docker compose up -d
cp .env.example .env
npm ci
npm run db:migrate
npm run check            # lint, typecheck, 51 unit + database tests
python3 spec/tools/check_spec.py && python3 spec/tools/gen_traceability.py --check

git checkout -b s0/foundation
git add -A
git commit -m "Add specification (Batches 1-3A) and slice S0 foundation"
git push -u origin s0/foundation
```

Open a pull request into `main`; CI runs both workflows.

## Before staging deploy
1. Push the branch, then open `docs/DEPLOY_RENDER.md`.
2. Create the database roles `mh_owner` and `mh_app` with generated passwords (see comments in `render.yaml` and `db/bootstrap.sql`) and set the three secrets.
3. Follow `docs/DEPLOY_RENDER.md` step by step.
4. Do the manual Outlook invite check in `docs/spikes.md`.
