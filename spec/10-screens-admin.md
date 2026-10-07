# Admin screen specifications (part A)

**Batch 3, part A · DRAFT.** Screens of the advanced admin panel. Participant screens are in [07-screens-participant.md](07-screens-participant.md); overview and decisions in [09-admin-panel.md](09-admin-panel.md). Screen IDs continue from SCR-18.

## 1. Cross-cutting rules for every admin screen

| # | Rule | Source |
|---|---|---|
| A1 | **Layout:** persistent left navigation (collapsible), top bar with organisation name, theme toggle, language switcher, command-palette button (Ctrl/Cmd+K), alert bell and account menu. Navigation items follow [09-admin-panel.md §2](09-admin-panel.md) and are trimmed to the viewer's role and scope. | FR-ADM-001 |
| A2 | **Themes:** light, dark, and follow-device; every token pair passes the contrast gate in both. | FR-ADM-029, NFR-A11Y-008 |
| A3 | **Tables:** sortable columns, column chooser, density toggle (comfortable/dense), sticky header, keyboard navigation (arrows, Enter to open, Space to select), row count and filter chips, empty/loading/error states. | NFR-A11Y-009 |
| A4 | **Privacy:** no screen shows private content or free text; lists show names, ids, statuses, counts, timestamps and error codes. Where an admin-authored reason exists (override, decision), it appears only in its own admin-only view. | FR-ADM-030, INV-3.10 |
| A5 | **Forbidden or missing objects** show one generic "Not found" page; navigation never shows items the viewer cannot use. | INV-4.3 |
| A6 | **Confirmation pattern for changes:** change → validation → *impact summary in plain language* → confirm (step-up authenticator code for sensitive groups) → success toast with link to the new version. Nothing is saved on validation failure. | FR-PRG-014, 015 |
| A7 | **Audit link:** every change screen shows "Last changed by {name} on {date}" linking to the audit entry or settings version. | FR-PRG-014 |
| A8 | **Responsive:** every admin action works at 320 px and 400% zoom; tables reflow into labelled cards at narrow widths with the same actions. | NFR-A11Y-003 |
| A9 | **Language:** all text EN/AZ/RU; layouts tolerate +35% text (C-112); dates in the viewer's zone, 24-hour clock. | NFR-I18N |
| A10 | **Charts always offer a table view;** status is text + icon, never colour only. | FR-HLT-009 |
| A11 | **Exports** (CSV/PDF) use field allowlists, neutralise formula-start characters, and are logged with the exporter's id and filters. | INV-3.10 |
| A12 | **Bulk selection** shows a count, the preview pattern from US-ADM-15, and the result summary. | FR-ADM-020 |

---

### SCR-19 · Admin home (Dashboard, Intervene list, Alert centre)

**Route:** `/manage` · **Audience:** org admin, PM · **Stories:** US-HLT-02, US-HLT-03, US-ADM-09, US-ADM-23

| Area | Specification |
|---|---|
| **Layout** | Three regions: **KPIs vs targets** (six tiles for C-130 … C-135 with target, current, trend and a table-view toggle), **Where should I intervene?** (ordered list, six tiers, oldest first inside a tier), **Alert centre** (prioritised alerts with link and age). |
| **Health breakdown** | A bar per rule (I1, I2, A2, A4, A5) with counts; click opens a list of relationships (names, status, code, timestamp). A table view is always available. |
| **Scope** | A programme/cohort selector filters everything; PMs see only their scope; org admins see organisation-wide aggregates. |
| **Intervene item** | Names of the pair or team, what is needed in a verb phrase ("Answer support request"), age, and a link to the relationship (PM view: statuses and dates only). |
| **States** | Loading skeleton; "Nothing needs you" with a quiet confirmation; error with reference code. |
| **Rules** | Suppressed values (< C-028 respondents) show "Hidden: too few responses". No content, ever (A4). |

### SCR-20 · Programme settings

**Route:** `/manage/programmes/{id}/settings` · **Audience:** org admin, PM (own programmes) · **Stories:** US-PRG-01, 02, 03, 04, 05, 06

| Area | Specification |
|---|---|
| **Tabs** | **General** (name, type, cadence, mentor capacity default/maximum, sponsors) · **Matching** (weights, depth factors, primary multiplier, parent/child credit, sub-score tables, thresholds) · **Exclusions** (switches, locked-on rows marked "always on") · **Timings** (reminders, nudges, horizon, cool-off, reason length) · **Flags** · **History** (versions, diff, restore) · **Templates & files** (save as template, export, import/clone). |
| **Field pattern** | Label, input, bounds shown beneath ("1–90 days"), default value chip, "Changed from default" marker, inline validation message. |
| **Weights editor** | Seven numeric fields with a live total and a visible "must total 100" state; Save disabled until valid. |
| **Impact summary** | Before confirming a change on an active programme: plain-language list ("Recommendations for 14 of 40 mentees would change. 2 draft pairs would change. Existing matches are unaffected."). |
| **Diff view** | Two version pickers; table of changed rows: setting, old, new, changed by, when. Unchanged rows collapsed. |
| **Restore** | "Restore this version" and "Restore defaults" both show the diff first, then confirm; each saves a new version. |
| **Rules** | Immutable versions; PM edits only in scope; participants never see this screen (A5). |

### SCR-21 · Matching what-if preview

**Route:** `/manage/programmes/{id}/settings/matching/preview` (also opens as a panel from SCR-20) · **Audience:** org admin, PM · **Stories:** US-PRG-02

| Area | Specification |
|---|---|
| **Inputs** | The unsaved edited values (not yet a version) and the current cohort snapshot. |
| **Output** | Counts: candidate lists changed, top-5 changed, draft pairs changed, unmatched seekers before/after; a table of the most-changed lists (names and rank movement only, no scores for participants beyond what PMs already see). |
| **Rules** | Read-only; nothing stored; engine run with the same purity rules; shows "Preview uses the current people data and does not change any match". A button "Save these settings" returns to SCR-20's confirm pattern. |
| **States** | Running (progress), Done, Too large (suggest narrowing to a cohort), Error. |

### SCR-22 · Organisation settings

**Route:** `/manage/settings` · **Audience:** org admin · **Stories:** US-TEN-04, US-TEN-05, US-PRG-05

| Area | Specification |
|---|---|
| **Security** | Link/code lifetime, attempts, request limits, session idle/absolute lifetimes, with platform bounds shown; step-up authenticator code on save (A6). |
| **Flags** | Organisation-level flags with prerequisite status ("Needs DPIA sign-off recorded"); AI kill switch at the top with last-changed info. |
| **Brand and theme** | Logo upload (validated by content), six colour tokens with live contrast results in light and dark, preview of three sample screens, Save/Restore previous. Font, radius and border width shown as fixed. |
| **Safeguarding contact, residency sign-off, org-admin list** | Show current state; changes start a four-eyes approval (SCR-29). |
| **Rules** | Every group is versioned (A7); PMs do not see this screen. |

### SCR-23 · Audit log and override log

**Route:** `/manage/compliance/audit`, `/manage/compliance/overrides` · **Audience:** org admin (PM: own programmes, read-only) · **Stories:** US-ADM-01, US-ADM-02

| Area | Specification |
|---|---|
| **Audit table** | Time, actor, action code (translated), object type and id, status. Filters: actor, action, programme, object type, date range. Quick ranges. Export CSV (org admin). |
| **Entry detail** | Side panel: all fields of the entry, including the settings version id for settings changes. No free text exists to show. |
| **Overrides tab** | Per override: programme, pair (names), exclusion code (translated), who, when, reason (admin-only). Counts view: exclusion codes × programme × period, with "overridden" column and the acknowledged-gap note. |
| **Rules** | Exports are logged; large exports require a narrower date range (US-ADM-01.6). |

### SCR-24 · Data requests, consent and retention

**Route:** `/manage/compliance/data` · **Audience:** org admin · **Stories:** US-ADM-03, US-ADM-04

| Area | Specification |
|---|---|
| **Queue** | Table: type (export/erasure), requester, received, target date (C-166), status (new, in progress, due soon, overdue, done, refused with code). |
| **Request detail** | Checklist (verify identity → run → confirm delivery), each step stamped with who and when; no personal content shown. Bulk erasure routes to approval (SCR-29). |
| **Consent tab** | Per notice version: accepted, pending; list of people yet to accept the current version. |
| **Retention tab** | Runs: date, data class (C-100 … C-104), counts, next run. |

### SCR-25 · Operations (jobs, email delivery, imports, status)

**Route:** `/manage/operations/{jobs|email|imports|status}` · **Audience:** org admin; PM (imports, email status in scope); platform admin (status, platform job health) · **Stories:** US-ADM-05, 06, 07, 08

| Area | Specification |
|---|---|
| **Jobs** | Queue summary tiles; table: job id, type, status, attempts, last error code, times; Retry on failed rows. No payloads. |
| **Email delivery** | Table: template code, recipient name, status, error code, time. Resend on bounced/failed. Bounce-spike banner when C-165 is crossed. No subjects or bodies. |
| **Imports** | Table of runs; error-file download; header banner with residency sign-off state. |
| **Status** | Cards for database, worker, mail sender, storage, migrations: state text + icon, last checked, reference code. |
| **Rules** | A4 applies; history purged per C-161 and C-162. |

### SCR-26 · Pilot-gate checklist

**Route:** `/manage/operations/pilot-gate` · **Audience:** org admin (edit), PM (read) · **Stories:** US-ADM-10

| Area | Specification |
|---|---|
| **Items** | Slices S0–S10 complete · Data-residency sign-off recorded · Safeguarding contact named · Manual data-request procedure documented · At least C-163 org admins. Each: status, who/when, evidence link. |
| **Behaviour** | Items the product can detect are read-only and update automatically; others need an evidence link when marked. An open item blocks real HR import and pilot invitations with a message pointing here. |

### SCR-27 · Insights (funnel and scheduled exports)

**Route:** `/manage/insights/funnel`, `/manage/insights/exports` · **Audience:** org admin, PM (own programmes) · **Stories:** US-ADM-12, US-ADM-13

| Area | Specification |
|---|---|
| **Funnel** | Horizontal stage bars with counts and drop-off percentages, cohort selector, table-view toggle; clicking a drop-off opens a names-and-status list. Suppression note for feedback-derived stages. |
| **Scheduled exports** | List with programme, report, frequency, format, recipients, last/next run, status. Create/edit form with recipient picker restricted to people holding admin or PM roles. |

### SCR-28 · People directory and bulk actions

**Route:** `/manage/people` · **Audience:** org admin, PM (own programmes) · **Stories:** US-ADM-15, US-ADM-22, US-ADM-23

| Area | Specification |
|---|---|
| **Directory** | Search with AZ/RU folding, filters (department, programme, participation status), dense table, column chooser, saved nothing (saved views are out of scope). |
| **Person record** | Basics, participations, status; grade bucket and reporting line only for org admins. |
| **Bulk** | Row selection → action menu (invite, nominate, withdraw, send reminder, erase [four-eyes]) → preview dialog (changes / skipped with reasons) → confirm → result summary. |
| **Export** | CSV with allowlisted columns per role; logged. |

### SCR-29 · Roles, permissions and approvals

**Route:** `/manage/governance/roles`, `/manage/governance/approvals` · **Audience:** org admin (PM: read-only roles in scope) · **Stories:** US-ADM-16, US-ADM-19

| Area | Specification |
|---|---|
| **Roles** | Table of roles with holders, scope, granted by/when; "What can this role do?" panel generated from the permission map; "Effective access" lookup for a person. |
| **Approvals inbox** | Pending requests (action, subject ids, requested by, age, expires); approve/reject with authenticator code; history of decisions. Requester sees "Waiting for a second org admin". |
| **Blocked state** | When fewer than C-163 org admins exist, the Request button explains why and links to adding an admin. |

### SCR-30 · Announcements

**Route:** `/manage/governance/announcements` · **Audience:** org admin, PM (own programme) · **Stories:** US-ADM-18

| Area | Specification |
|---|---|
| **List** | Scope, text snippet, start/end, status (scheduled, active, ended), author. |
| **Editor** | Scope selector, per-language text (≤ C-164), start and required end date, live preview as a participant banner, optional "also notify" with a warning that it sends emails. |

### SCR-31 · Email template preview

**Route:** `/manage/governance/templates` · **Audience:** org admin, content manager · **Stories:** US-ADM-17

| Area | Specification |
|---|---|
| **Picker** | Notification (from the catalogue), language, plural-case sample (1, 2, 5, 11, 21). |
| **Preview** | Rendered email and plain-text alternative using synthetic fixtures; viewport toggle (320 px, desktop) and "+35% text" toggle; translation-completeness status. |
| **Rules** | No real data is read; no send-test-to-real-people function. |

### SCR-32 · My sessions and devices

**Route:** `/account/sessions` · **Audience:** all signed-in users with an admin role; org admin on a user record · **Stories:** US-ADM-20

| Area | Specification |
|---|---|
| **List** | Browser, approximate location, last active, "this device" mark, Sign out. |
| **Org admin on a user** | "Sign out everywhere" with authenticator code; audited. |

### SCR-33 · Tenant console (platform admin)

**Route:** `/platform/organisations` · **Audience:** platform admin · **Stories:** US-ADM-21

| Area | Specification |
|---|---|
| **Organisations** | Table: name, status, created, counts (people, programmes, active relationships). Create (name, locales, time zone, email domains, first org admin email) and Disable. |
| **Isolation self-check** | Run button; list of checks with pass/fail and run time; failure raises an alert. |
| **Rules** | Counts only. No navigation into tenant content exists. |

### SCR-34 · Command palette

**Route:** overlay on any admin page · **Audience:** admin roles · **Stories:** US-ADM-14

| Area | Specification |
|---|---|
| **Behaviour** | Opens with Ctrl/Cmd+K; a single input; grouped results: Pages, Programmes, People, Actions; recent items first; arrows + Enter; Escape closes and restores focus. |
| **Rules** | Permission-trimmed; AZ/RU folding; actions open their screen, never execute from the palette. |
| **A11y** | Combobox/listbox pattern; results announced politely. |
