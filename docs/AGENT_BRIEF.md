# Brief for build agents (parallel slices)

You are implementing one part of the Mentorship Hub in your own git worktree. Several agents work at the same time on different areas; stay inside your area.

## Setup (do first)
1. `cd` into your worktree. Run `./scripts/agent-db.sh <your-area-name>` (creates your own database, `.env`, applies migrations). Never use another agent's database.
2. Read `docs/ARCHITECTURE.md` completely, then your spec files (listed in your task). Skim `src/lib/auth/core.ts`, `src/lib/permissions/`, `tests/db/factory.ts`, `src/domain/roles.ts` and `src/app/admin/roles/` as the reference for style.

## Rules for working
- The spec is the source of truth: implement every acceptance criterion (AC) of your stories, positive and negative. If the spec is ambiguous or inconsistent, choose the safest reading, implement it, and list it under "Deviations / decisions" in your report. Do not stop to ask questions.
- Numbers marked admin-managed in `spec/01-prd/constants.md` §0 are **starting defaults**, read through settings accessors (see ARCHITECTURE rule 9). Until the settings registry (S3) exists, call `src/lib/settings.ts`-style accessors you add yourself in your area with defaults from `src/lib/constants.ts`; keep each in a single function so S3 can swap the source.
- Stay in your lane: create files in your own directories; edit shared files only to **register** your pieces (permissions index, i18n CATALOGUES, worker taskList, `GLOBAL_TABLES`, nav in `Shell.tsx`, `package.json` scripts/deps). Keep those edits minimal and one line each so merges are trivial.
- Migrations only inside your number range, forward-only, each tenant table per ARCHITECTURE rule 2. Never edit migrations 0001–0012.
- Every user-facing string in en/az/ru. Real Azerbaijani and Russian, not placeholders. Server components + server actions; accessible forms; no client JS unless needed.
- Tests: for every AC write a test whose name starts with the AC id. Use `tests/db/factory.ts`; each test file creates its own organisation. Pure logic gets unit tests (add property tests where the spec lists them).
- Before finishing run `npm run check` (lint, typecheck, all tests) AND `npx next build`. Both must pass with no skipped/ignored tests. Fix everything you broke.
- Commit your work on your branch with clear messages (`git add -A && git commit`). Do not push, rebase or touch other branches.

## Final report (your last message) must contain
1. Stories/ACs fully done, and any AC not done (with reason).
2. New migrations, tables, permission actions, message areas, worker tasks, routes.
3. Registrations you added in shared files.
4. Deviations / decisions / spec ambiguities.
5. Interfaces other slices will call (function signatures, file paths).
6. Anything the integrator must do after merging.
