# Invariants

**The eight design principles that are never compromised (Plan §5), each with its rules, the mechanism that enforces it, and the automated tests that prove it.** Anything in this document that is not enforced by a test is a defect in this document.

## How to read

- `INV-n` is the principle; `INV-n.m` is a numbered rule within it. Rules are what acceptance criteria and tests cite.
- **Mechanism** says *where* the rule is enforced. Application code is the weakest place; the database and the build are stronger and are preferred.
- **Tests** are named by ID. Each test ID is registered in the test plan (Batch 3) and in the generated traceability matrix. A test is allowed to be implemented later than the spec, but never later than the slice in which the rule first matters (column "From slice").
- **Violation looks like** is a short description of the failure, used to write negative tests.

---

## INV-1 — Tenant isolation is enforced by the database

| Rule | Statement | Mechanism | From slice |
|---|---|---|---|
| INV-1.1 | Every tenant table has an `organisation_id` column, `NOT NULL`, with a foreign key to `organisation`. | Migration lint (build) | S1 |
| INV-1.2 | Every tenant table has `ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY`. | Migration lint + DB catalogue test | S1 |
| INV-1.3 | Policies compare `organisation_id` to a per-transaction setting (e.g. `current_setting('app.org_id', true)`); when the setting is unset the policy returns no rows and permits no writes. | RLS policy | S1 |
| INV-1.4 | The application connects with a role that does **not** own the tables, is not a superuser and lacks `BYPASSRLS`. Migrations run as a separate owner role. | DB role setup; S0 spike | S0 |
| INV-1.5 | The organisation context is set **only** from the signed-in session, inside the database-client wrapper. No code path reads an organisation from a URL, query string, form field or header. | Database-client API (no raw connection exported); ESLint ban on direct pool use | S1 |
| INV-1.6 | Global tables (identity, organisation list, taxonomy defaults, platform admins) are an explicit allowlist; any other table lacking RLS fails the build. | Migration lint with allowlist | S1 |
| INV-1.7 | Cross-organisation foreign keys are impossible: composite foreign keys include `organisation_id`. | Schema constraint | S1 |

**Violation looks like:** a query run with organisation A's context returns a row of organisation B; or runs with no context and returns anything; or an update changes a row's `organisation_id`.

**Tests**

| ID | Test |
|---|---|
| T-INV1-01 | Catalogue test: every non-allowlisted table has `relrowsecurity` and `relforcerowsecurity` |
| T-INV1-02 | For every tenant table: with context A, insert/select/update/delete of B's rows affects 0 rows |
| T-INV1-03 | For every tenant table: with no context, select returns 0 rows and insert fails |
| T-INV1-04 | Application role has no `BYPASSRLS`, no superuser, and owns no tables |
| T-INV1-05 | Static check: no import of the raw pool outside the database-client module |
| T-INV1-06 | "Demo Telecom" organisation on staging: cross-org smoke test through the UI |
| T-INV1-07 | `organisation_id` cannot be updated (trigger or policy `WITH CHECK`) |

---

## INV-2 — Private content has no admin read path

| Rule | Statement | Mechanism | From slice |
|---|---|---|---|
| INV-2.1 | Session notes, reflections and messages are readable only by members of the relationship (or team) they belong to. | Second RLS policy keyed on relationship membership | S8 |
| INV-2.2 | A **private note** is readable only by its author. | Policy on `author_person_id` | S8 |
| INV-2.3 | No role — platform admin, org admin, PM, assessor, content manager, safeguarding — has a read policy on these tables. | Policy has no role branch for them | S8 |
| INV-2.4 | Dashboards, health rules and jobs read **activity timestamps and statuses** from separate columns/views that contain no content. | Views; separate tables | S9, S10 |
| INV-2.5 | Progress reports are structured; a report cannot embed or quote notes, reflections or messages. | Report schema (typed fields); no foreign key to private content | S9 |
| INV-2.6 | Line managers have **no** view, in any table or screen. | Permission map; absence of policy | S1 |
| INV-2.7 | On rematch, goals may carry over; notes, reflections and messages **never** do. | Copy routine copies only goals; test | S6 |
| INV-2.8 | Concerns are readable only by safeguarding (with the org admin as fallback when the contact is unset or conflicted). | Policy | S9 |

**Violation looks like:** an admin-context query returns a note; a dashboard query's text column contains content; a report row includes copied note text.

**Tests**

| ID | Test |
|---|---|
| T-INV2-01 | Privacy matrix: for each role in {platform admin, org admin, PM, assessor, content manager, safeguarding, sponsor-export job}, `SELECT` on notes/reflections/messages returns 0 rows |
| T-INV2-02 | Private note: a second member of the relationship reads 0 rows |
| T-INV2-03 | A non-member of the relationship reads 0 rows from every private table |
| T-INV2-04 | Dashboard and health queries are executed under a restricted role that has no `SELECT` on private tables; they still work |
| T-INV2-05 | Schema test: report tables have no free-text columns referencing private content; structured fields only |
| T-INV2-06 | Rematch: after carry-over, the new relationship has 0 notes/reflections/messages |
| T-INV2-07 | Concern read: PM-only context reads 0 rows |

---

## INV-3 — Nothing private leaks through side channels

| Rule | Statement | Mechanism | From slice |
|---|---|---|---|
| INV-3.1 | Emails, in-app notifications and calendar invites carry **names and links only**. | Notification catalogue R1–R2; renderers accept only typed parameters | S3, S7 |
| INV-3.2 | Notification rows store ids only; text is rendered at display time. | Schema (no text column) | S3 |
| INV-3.3 | Audit-log entries record ids, statuses and dates; the column set contains no free-text field. | Field allowlist per action; schema | S1 |
| INV-3.4 | Application logs carry ids and error codes; the redaction module runs on every log call. | Logger wrapper | S0 |
| INV-3.5 | Aggregated feedback is hidden below C-028 (5) respondents. | Query layer returns `null` | S9, S10 |
| INV-3.6 | Search results, autocomplete, error messages and "not found" pages reveal nothing about objects the user cannot see. | Permission gate | S1 |
| INV-3.7 | Decline reasons (D13), check-in text and concern text never appear in any email or notification. | Catalogue R10, N-039, N-063, N-080 | S6, S9 |
| INV-3.8 | Exclusion reasons are never shown to users; the neutral line (GL-057) is shown instead. | Presentation layer receives no code | S6 |
| INV-3.9 | URLs never contain personal or free text (ids are opaque). | Route design | S1 |
| INV-3.10 | No admin view — audit viewer, job queue, email delivery log, status page, alert centre, funnel, scheduled and CSV exports, template previews — shows private content or free text; they read ids, statuses, counts, timestamps and error codes only. | Read models without content columns; export field allowlists | S3+ |

**Violation looks like:** a note's text appears in a notification email; an audit row holds a decline reason; a team of 3 respondents shows an average; the UI says "excluded because of reporting line".

**Tests**

| ID | Test |
|---|---|
| T-INV3-01 | Sentinel test: submit `SECRET-<uuid>` through every free-text field; assert it appears in no email, notification, ICS, audit row or log line |
| T-INV3-02 | Audit schema: no column of type text beyond the allowlist; per-action field allowlist asserted |
| T-INV3-03 | Notification table has no text/jsonb-with-free-text column |
| T-INV3-04 | Feedback aggregate with 4 respondents returns hidden; with 5 returns value |
| T-INV3-05 | Visibility query sweep: search/autocomplete with another organisation's or relationship's data returns nothing |
| T-INV3-06 | UI: for every excluded pair, the displayed text equals GL-057 exactly, in all three locales |
| T-INV3-07 | Log redaction: logger given an object with `email`, `note`, `message` keys emits only ids |
| T-INV3-08 | Admin read models (delivery log, job runs, audit, alerts, exports) have no text content columns; sentinel text submitted through the app never appears in any of them |
| T-INV3-09 | Scheduled export and CSV export field allowlists: only allowlisted columns appear; aggregates below C-028 are suppressed; cells starting `=`, `+`, `-`, `@` are neutralised |
| T-INV3-10 | Email template preview renders only synthetic fixtures; no database read of real personal data |

---

## INV-4 — One authorisation system

| Rule | Statement | Mechanism | From slice |
|---|---|---|---|
| INV-4.1 | A single **permission map** (action × role × scope × relationship condition) decides every action; see [permission matrix](04-permission-matrix.md). | Central module | S1 |
| INV-4.2 | Every server action and route handler is wrapped by the gate; a build check fails if one is not. | Static analysis over the route/action manifest | S1 |
| INV-4.3 | If a user may not see an object, the response is "not found" — the same as for a non-existent id, with the same status, shape and (to within normal variance) timing. | Gate returns `NotFound` | S1 |
| INV-4.4 | Permission checks run **in addition to** RLS, not instead of it. | Defence in depth | S1 |
| INV-4.5 | Roles are scoped (organisation / programme / cohort); a scoped role grants nothing outside its scope. | Gate input includes scope | S1 |
| INV-4.6 | Any state-changing action records an audit entry (ids and status only). | Gate wrapper | S1 |
| INV-4.7 | **Four-eyes:** residency sign-off, safeguarding-contact change, granting the org-admin role and bulk erasure execute only after a different org admin approves; the requester can never approve; fewer than C-163 org admins blocks the action. | Approval service; DB check requester ≠ approver | S1 |
| INV-4.8 | **Bulk actions** show a preview of what will change and what will be skipped, and each row is permission-checked individually at execution, not only at preview. | Bulk service | S3 |

**Tests**

| ID | Test |
|---|---|
| T-INV4-01 | Build gate: enumerate all server actions/route handlers; fail if any lacks the gate wrapper |
| T-INV4-02 | **Access sweep**: generated from the route table; each id-taking page/action is called with ids from (a) another organisation, (b) another relationship, (c) same programme without rights — each returns "not found" and changes nothing |
| T-INV4-03 | Response equality: "not found" for a forbidden id equals response for an id that does not exist (status, body shape) |
| T-INV4-04 | Permission-matrix test: every cell of the matrix is asserted for allow/deny |
| T-INV4-05 | Scoped role: a PM of programme X cannot act on programme Y |
| T-INV4-06 | Four-eyes: requester cannot approve own request (database check); approval by a second org admin executes it; expired requests do nothing; with fewer than C-163 org admins the request is refused |
| T-INV4-07 | Bulk action: a row the actor may not act on is skipped and reported as "not found", and nothing is changed for it, even if it was in the preview selection |

---

## INV-5 — Links in emails never change anything by themselves

| Rule | Statement | Mechanism | From slice |
|---|---|---|---|
| INV-5.1 | Every email link is a `GET` that renders a page. Any state change requires a user-initiated `POST` from that page. | Route design; no state-changing `GET` | S1 |
| INV-5.2 | Magic-link sign-in completes only after the user clicks a button on the landing page. | Two-step flow | S1 |
| INV-5.3 | The 6-digit code works only in the browser that requested the sign-in. | Binding to a browser secret (cookie) | S1 |
| INV-5.4 | Tokens are single-use, short-lived (C-041) and invalidated after use or after C-042 failures. | Token store | S1 |
| INV-5.5 | No state-changing `GET` anywhere in the application. | Lint on route methods | S1 |

**Tests**

| ID | Test |
|---|---|
| T-INV5-01 | E2E: fetch every link from every email as a mail scanner would (`GET`, follow redirects, no cookies); assert database unchanged |
| T-INV5-02 | Magic link opened in browser B after being requested in browser A: no session |
| T-INV5-03 | Code entered in a different browser is rejected |
| T-INV5-04 | Token reuse and expiry rejected |
| T-INV5-05 | Static check: no handler for `GET` calls a mutating service |

---

## INV-6 — AI never acts on its own

| Rule | Statement | Mechanism | From slice |
|---|---|---|---|
| INV-6.1 | AI output is a suggestion shown to the user; nothing is saved until the user accepts. | UI contract; API returns text only | S12 |
| INV-6.2 | An assistant runs only if the **org kill switch**, the **per-assistant flag**, the **programme flag** and the **user's consent** all allow it. | Single guard function | S12 |
| INV-6.3 | The AI call receives only the requester's own text for that request: no other participant's data, no notes, no messages. | Typed request builder | S12 |
| INV-6.4 | AI use is logged (user id, assistant, time, outcome, token counts) **without** the text. | Logger | S12 |
| INV-6.5 | AI is never used in matching, vetting scores, health rules or reports. | Import boundary (lint) | S6 |
| INV-6.6 | Admin-triggered translation follows the same guard and is item by item. | Guard | S12 |
| INV-6.7 | Prompt injection in a user's text cannot cause any action or data access beyond returning text. | Tool-less call; output rendered as text | S12 |

**Tests**

| ID | Test |
|---|---|
| T-INV6-01 | Matrix: 16 combinations of the four switches; AI runs only in the all-on case |
| T-INV6-02 | Accepting nothing persists nothing: after a suggestion with no accept, the goal/agenda table is unchanged |
| T-INV6-03 | Request builder snapshot: payload contains only the requester's text and a fixed instruction |
| T-INV6-04 | Log assertion: sentinel text absent from AI-use log |
| T-INV6-05 | Dependency lint: matching, vetting, health, reports modules do not import the AI client |
| T-INV6-06 | Prompt-injection corpus: responses are rendered as text; no side effects |

---

## INV-7 — Matching is pure and explainable

| Rule | Statement | Mechanism | From slice |
|---|---|---|---|
| INV-7.1 | The engine is a pure function: same inputs and same engine version ⇒ identical output. No clock, randomness, network or database access inside. | Module has no I/O imports (lint); input typed | S6 |
| INV-7.2 | The engine reads only fields people chose to make visible, plus **grade bucket** and **reporting line**; these two are never displayed. | Snapshot type | S6 |
| INV-7.3 | Private fields cannot change the output. | Snapshot type; MT-P5 | S6 |
| INV-7.4 | The engine version, the **matching settings version** and the full reasoning are stored with every match; matches are never recomputed in place. | Schema | S6 |
| INV-7.5 | A criterion with weight 0 has no effect. | MT-P2 | S6 |
| INV-7.6 | Input order does not affect output. | MT-P3 | S6 |
| INV-7.7 | Excluded pairs never appear. | MT-P1 | S6 |
| INV-7.8 | Capacity is never exceeded, even under simultaneous accepts. | DB constraint/lock; MT-P4 | S6 |
| INV-7.9 | Matching parameters are admin-managed settings that reach the engine only as part of the input snapshot; every settings change is validated, versioned (immutable) and audited by id; changing settings never alters stored matches. | Settings service; schema; MT-P11, MT-P12 | S3, S6 |

Full property and scenario list: [matching-spec §8](01-prd/matching-spec.md).

**Tests:** MT-P1 … MT-P10, MT-S1 … MT-S9; **T-INV7-01** (static: engine module has no I/O imports); **T-INV7-02** (match record contains version, snapshot hash, sub-scores); **T-INV7-03** (concurrency: two simultaneous accepts at capacity — exactly one succeeds); **T-INV7-04** (settings versions are immutable: update/delete of a saved version is rejected by the database); **T-INV7-05** (after a settings change, previously stored matches still show their original settings version and reasoning); **T-INV7-06** (audit entry for a settings change contains ids only).

---

## INV-8 — Fail closed

| Rule | Statement | Mechanism | From slice |
|---|---|---|---|
| INV-8.1 | A failed database migration aborts the deployment; the previous version keeps serving. | Pre-deploy migration step | S0 |
| INV-8.2 | Application start-up refuses to run with missing or invalid configuration (database, mail, secrets, organisation seeding). | Boot validation with zod | S0 |
| INV-8.3 | Real HR data cannot be imported until the data-residency sign-off is recorded in the system. | Import service checks a signed-off flag; flag settable only by org admin with TOTP and audit-logged | S2 |
| INV-8.4 | No default or backdoor credentials exist; the bootstrap creates no password accounts. | Rewritten bootstrap | S1 |
| INV-8.5 | If the permission gate cannot decide (error), it denies. | Gate default | S1 |
| INV-8.6 | If RLS context is missing, queries return nothing (INV-1.3). | RLS | S1 |

**Tests**

| ID | Test |
|---|---|
| T-INV8-01 | Deploy test: deliberately failing migration aborts the release |
| T-INV8-02 | Boot test: missing each required env var ⇒ process exits non-zero with a reference code, serves nothing |
| T-INV8-03 | Import with `residency_signoff = false` and non-synthetic marker ⇒ rejected |
| T-INV8-04 | Search the schema and seed for password columns/default accounts |
| T-INV8-05 | Gate throws ⇒ response is "not found"/deny, not allow |

---

## Cross-cutting: what makes a new invariant

A rule becomes an invariant (and gets an ID and test here) if a single violation would be a privacy incident, a cross-organisation leak, or an unauthorised action. Everything else is a requirement in the PRD.
