# Non-functional requirements

IDs `NFR-<AREA>-nnn`. Targets reference [constants.md](constants.md). Verification maps to Plan §11.

## 1. Security

| ID | Requirement | Verification |
|---|---|---|
| NFR-SEC-001 | Tenant isolation is enforced by forced row-level security on every tenant table; with no organisation context a query returns no rows. The application database role must not own tables or hold `BYPASSRLS`. | DB tests: every table, cross-organisation reads/writes, no-context queries (spike in S0) |
| NFR-SEC-002 | Private content (notes, reflections, messages) is protected by a second database-level rule: readable only by relationship members, private notes only by their author. No admin role has a read policy. | DB privacy matrix |
| NFR-SEC-003 | Secrets never reach the browser bundle or logs. | Build scan; log-redaction unit tests |
| NFR-SEC-004 | Security headers on all routes (CSP, HSTS, frame-ancestors, referrer-policy, permissions-policy, nosniff). | Automated header test |
| NFR-SEC-005 | Rate limits do not lock out a shared office network (C-045). | k6 + unit |
| NFR-SEC-006 | Secrets stored in the database (e.g. TOTP seeds) are encrypted at rest with a key held outside the database. | Unit + review |
| NFR-SEC-007 | Dependency and container security scan before each release. | S14 gate |
| NFR-SEC-008 | A failed migration aborts the deployment (fail closed); start-up refuses to run if required configuration is missing. | Deploy test |
| NFR-SEC-009 | Uploaded images are validated by content, not by extension. File attachments stay off until storage and antivirus are approved. | Unit |
| NFR-SEC-011 | Sensitive admin actions require step-up TOTP verification at the moment of the action; four-eyes approvals require the approver's own TOTP. | Unit + e2e |
| NFR-SEC-010 | Every id-taking page and action returns "not found" and changes nothing when called with ids from another organisation, another relationship or the same programme but without rights (the **access sweep**). | Generated test over the route table |

## 2. Privacy and data protection

| ID | Requirement |
|---|---|
| NFR-PRV-001 | Hosting in the EU (Render, Frankfurt) with S3-compatible storage in the EU; data-residency and DPIA sign-off recorded in the system before real HR data is imported (Principle 8). |
| NFR-PRV-002 | Retention per [constants §7](constants.md); jobs run daily; each run is audit-logged by counts. |
| NFR-PRV-003 | No third-party analytics, tracking pixels or external fonts that leak requests to third parties (self-host Manrope/Noto Sans). |
| NFR-PRV-004 | The audit log never contains free text; a test inserts sentinel strings through every audited action and fails if one appears. |
| NFR-PRV-005 | Personal data export and erasure/anonymisation available (S13); manual procedure documented before pilot. |
| NFR-PRV-006 | AI provider receives only the requester's own text; provider choice (Anthropic directly or Azure OpenAI EU) is part of the DPIA. |

## 3. Accessibility

| ID | Requirement |
|---|---|
| NFR-A11Y-001 | WCAG 2.2 AA across all screens: large targets, no drag-only interaction, dialog focus management, visible focus, status not by colour alone. |
| NFR-A11Y-002 | Correct `lang` attributes for Azerbaijani and Russian content, including mixed-language pages. |
| NFR-A11Y-003 | Every admin action works at 320 px width and 400% zoom. |
| NFR-A11Y-004 | Every chart has a table view. |
| NFR-A11Y-005 | Brand palette contrast is verified by a build gate (primary `#0F3C76` on canvas `#E7EEF8`, leaf green `#356D1B`, and all derived tokens). |
| NFR-A11Y-006 | Notes, reports and assessments autosave and recover after connection loss. |
| NFR-A11Y-007 | Automated axe-core checks on every screen in CI; manual keyboard and screen-reader audit each release. |
| NFR-A11Y-008 | Light and dark themes: every colour-token pair in both themes passes the contrast gate; status is never colour alone in either theme. |
| NFR-A11Y-009 | Dense tables: fully keyboard-operable (arrow-key navigation, sort, column chooser), accessible names on every control, reflow without loss at 400% zoom. |

## 4. Internationalisation

| ID | Requirement |
|---|---|
| NFR-I18N-001 | Interface in English, Azerbaijani, Russian; per-user locale from profile (D8). |
| NFR-I18N-002 | Translation completeness gate: build fails if any key is missing in any locale. |
| NFR-I18N-003 | ICU message format with correct plural rules (Russian one/few/many). |
| NFR-I18N-004 | Text expansion up to 35% without clipping or overlap. |
| NFR-I18N-005 | Search folding pairs (C-115) identical in database (immutable function) and application, proven by a shared test vector file. |
| NFR-I18N-006 | Sorting uses a collation that orders Azerbaijani (ç, ğ, ı, ö, ş, ü, ə) and Cyrillic correctly (S0 spike). |
| NFR-I18N-007 | Capital Ə renders (Noto Sans fallback); Russian copy uses gender-neutral phrasing; AZ/RU reviewed by native speakers before release candidate. |

## 5. Performance and scale

| ID | Requirement | Constant |
|---|---|---|
| NFR-PERF-001 | Reference scale: 2,000 users; a 500-participant programme. | C-120 |
| NFR-PERF-002 | 95th-percentile page response under 0.5 s at reference scale. | C-121 |
| NFR-PERF-003 | 95th-percentile search under 0.3 s. | C-122 |
| NFR-PERF-004 | 1,000 reminders processed in under one minute. | C-123 |
| NFR-PERF-005 | Matching a 500-seeker draft completes in under 10 s **[PROPOSED]** | — |

## 6. Reliability and operations

| ID | Requirement | Constant |
|---|---|---|
| NFR-REL-001 | Point-in-time recovery enabled on the production database. | C-140 |
| NFR-REL-002 | Backup-restore drill performed before release candidate. | C-142 |
| NFR-REL-003 | Background jobs (email, reminders, retention, imports) run in a separate worker, are idempotent and retry safely. | — |
| NFR-REL-004 | Health endpoint and basic alerting on failed jobs, failed migrations and email bounce spikes. | — |
| NFR-REL-005 | Two simultaneous accepts at capacity: exactly one succeeds (database constraint or lock), never both. | MT-P4 |
| NFR-REL-006 | Double-booking is impossible by a database exclusion constraint on (person, time range). | FR-SCH-003 |

## 7. Compatibility

| ID | Requirement |
|---|---|
| NFR-CMP-001 | Current and previous major versions of Chrome, Edge, Firefox, Safari; iOS Safari and Android Chrome. |
| NFR-CMP-002 | Calendar invites verified in Outlook classic, new, web and mobile, and Google Calendar; reference `.ics` files stored in the repository. |
| NFR-CMP-003 | Email renders in Outlook (Word engine), Gmail and Apple Mail; plain-text alternative provided. |

## 8. Maintainability and delivery

| ID | Requirement |
|---|---|
| NFR-MNT-001 | Stack: Next.js 16, React 19, PostgreSQL with plain SQL migrations, zod, Tailwind 4 (D5). |
| NFR-MNT-002 | Every slice passes the gate: lint, type check, unit tests, database tests, end-to-end journeys, automated accessibility, **specification coverage**, staging deploy. |
| NFR-MNT-003 | Every acceptance criterion has an ID; at least one test references it; the traceability matrix is generated and never edited by hand. |
| NFR-MNT-004 | Constants live in one module and a test asserts equality with [constants.md](constants.md). |
| NFR-MNT-005 | A build check fails if any server action does not pass through the permission gate (FR-TEN-011). |
| NFR-MNT-006 | New runtime components are limited to those listed in Plan §10 (graphile-worker, nodemailer, exceljs, AWS S3 client when needed); dev/test only: Playwright, axe-core, ical.js, Mailpit, k6. |

## 9. Observability without leakage

| ID | Requirement |
|---|---|
| NFR-OBS-001 | Application logs carry ids and error codes only; log-redaction module (copied from One.Simple, Plan Appendix A) is applied on every log call. |
| NFR-OBS-002 | AI use is logged by user id, assistant, timestamp and outcome — never the prompt or response. |
| NFR-OBS-003 | Error pages show a reference code, never stack traces or object details. |
| NFR-OBS-004 | Job history and email delivery logs hold ids, statuses and error codes only, retained per C-161 and C-162, and are purged by a retention job. |
