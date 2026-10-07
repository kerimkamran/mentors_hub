# Architecture and conventions (read before adding code)

Specification: `spec/` (requirements `FR-*`, invariants `INV-*`, stories/ACs, screens `SCR-*`). **Every behaviour traces to a story and its acceptance criteria.** Test names must contain the AC id they prove, e.g. `it("AC-ATT-02.3 · …")`. `python3 spec/tools/gen_traceability.py` reports which ACs have tests.

## Layout

| Path | Purpose |
|---|---|
| `src/domain/<area>/` | Business logic. `commands.ts` (writes), `queries.ts` (reads), pure helpers in their own files. No React, no `next/*` imports. |
| `src/app/<route>/` | Next.js pages (`page.tsx`, read-only) and server actions (`actions.ts`, `"use server"`). Pages never mutate (INV-5.5). |
| `src/lib/` | Cross-cutting: `db.ts` (the only `pg` importer), `permissions/`, `audit.ts`, `i18n/`, `auth/`, `jobs.ts`, `mail.ts`, `settings.ts`. |
| `src/lib/permissions/<area>.ts` | Your permission rows (matrix cells). Register in `permissions/index.ts` `PERMISSION_SOURCES`. |
| `src/messages/<area>/index.ts` | Your UI strings via `defineMessages(en, az, ru)`. Register in `src/lib/i18n/index.ts` `CATALOGUES`. All three languages are mandatory; `az`/`ru` provisional but real translations. |
| `worker/tasks/` | Background tasks; register in `worker/index.ts` `taskList`. |
| `db/migrations/` | Plain SQL, forward-only, **numbered inside your assigned range**. Never edit an applied migration. |
| `tests/unit/` | Pure tests (no DB). `tests/db/` real-PostgreSQL tests. Use `tests/db/factory.ts` (createOrg, createPerson, actorFor, createProgramme). Each test file creates its OWN organisation. |

## Non-negotiable rules (INV-1…8)

1. **All tenant data goes through `withOrg(orgId, tx => …)`** with `orgId` from the signed-in `Actor` only. Never read an organisation from a URL/form/header. Never import `pg` outside `src/lib/db.ts`.
2. **Every tenant table** (a) has `organisation_id uuid NOT NULL REFERENCES organisation (id)`, (b) states `ALTER TABLE … ENABLE ROW LEVEL SECURITY; … FORCE ROW LEVEL SECURITY;` literally, (c) calls `SELECT mh_tenant_policy_only('<table>');` (isolation policy + immutable organisation trigger), (d) uses **composite foreign keys** `(x_id, organisation_id)` to other tenant tables (add `UNIQUE (id, organisation_id)` to referenced tables), (e) has explicit `GRANT`s to `mh_app` — only the privileges needed (no DELETE unless required). `npm run lint` and the generic isolation test enforce this.
3. **One authorisation system:** call `authorize(actor, "<action>", resource)` at the top of every command/query that takes an id or changes state; denial throws `NotFoundError` → pages call `notFound()`. Denied reads look identical to missing records. Add actions to your permissions file; unknown actions are denied. Compute `isMember`/`assigned`/`ownerMembershipId` from the database, never from the request.
4. **No private content to admins:** notes, messages, reflections, check-in text, concerns, decline reasons, assessor scores are never readable via admin/PM paths (INV-2). Dashboards/PM views read **timestamps and statuses only** (`activity_ts`). Notifications, audit rows, job payloads and logs carry **ids/codes only — no free text, no personal content** (INV-3).
5. **Audit** security-relevant actions with `audit(tx, {organisationId, actorId, action: "area.verb", objectType, objectId, status})` — `action` is a code, never a sentence.
6. **Links in emails never change state** (INV-5): email links are GET pages with a POST button.
7. **Matching is pure and explainable** (INV-7): the engine takes a snapshot and returns results; settings versions are passed in and stored with each match.
8. **Fail closed** (INV-8): if a gate throws, deny. Missing config stops the process.
9. **Admin-managed numbers:** numbers from the constants table that §0 marks admin-configurable are read through `src/lib/settings.ts` (never hard-coded in logic); defaults live in `src/lib/constants.ts`.
10. **i18n/a11y:** no raw strings in UI; labels for every input; status never by colour alone; targets ≥44px; tables have `<th scope>`; dates via `formatDateTime` (24 h, Monday-first, Asia/Baku default).
11. **Search normalisation:** identical in TS (`src/lib/search.ts`) and SQL (`mh_normalise`) — use them for every name/topic search.

## How to test

```bash
npm run check          # lint (+migration lint), typecheck, all tests
npx vitest run tests/db/<file>.test.ts
```
Tests run against the PostgreSQL from `.env` (`DATABASE_URL` = app role, `MIGRATION_DATABASE_URL` = owner). Apply new migrations with `npm run db:migrate`.

## Migration number ranges

| Range | Owner |
|---|---|
| 0010–0019 | S1 identity (done) |
| 0020–0029 | S2 people import |
| 0030–0049 | S3 programmes, settings registry, notifications, email delivery |
| 0050–0069 | S4 profiles, taxonomy, goals inputs, availability |
| 0070–0079 | S5 mentor vetting |
| 0080–0099 | S6 matching, proposals, relationships |
| 0100–0139 | S7/S8 booking, sessions, notes, actions, goals, messaging |
| 0140–0179 | S9 reports, check-ins, health, concerns |
| 0180–0189 | S10 dashboard |
| 0190–0199 | S11 Open mentoring |
| 0200–0209 | S12 AI assistants |
| 0210–0229 | S13 data rights, retention |
| 0230–0299 | Admin panel (Batch 3A) |
