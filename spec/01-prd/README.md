# Mentorship Hub — Product Requirements Document (Batch 1)

| | |
|---|---|
| **Document** | `spec/01-prd/README.md` |
| **Version** | 1.0-draft · 2 October 2026 |
| **Source** | *Mentorship Hub — Product & Delivery Plan v1.0* (the "Plan"), decisions D1–D16 |
| **Status** | Draft for Batch 1 review |
| **Companion files** | [constants.md](constants.md) · [matching-spec.md](matching-spec.md) · [notification-catalogue.md](notification-catalogue.md) · [nfr.md](nfr.md) · [open-questions-batch1.md](open-questions-batch1.md) |
| **Sibling documents** | [Glossary](../02-glossary.md) · [Invariants](../03-invariants.md) · [Permission matrix](../04-permission-matrix.md) · [Domain model](../05-domain-model.md) |

**How to read this document.** Every requirement has a stable ID of the form `FR-<AREA>-<nnn>`. Requirement IDs are never reused or renumbered. Stories and acceptance criteria (Batches 2 and 3) reference these IDs, and the traceability matrix is generated from them. A requirement that cites a decision (`D7`) or a Plan section (`§7`) is traced to the Plan. A requirement marked **[PROPOSED]** is not stated in the Plan; it is the specification author's proposal and needs confirmation at review (each is listed in [open-questions-batch1.md](open-questions-batch1.md)).

Normative wording follows RFC 2119: *must* is mandatory, *should* is a strong default, *may* is optional.

---

## 1. Purpose and context

Azerconnect already mentors, but it depends on slide decks, Excel rubrics and goodwill. Leadership mentors write reports with no structured tool, SparkLab mentors are vetted in Word and Excel, and employee-initiated mentoring has no home.

The Mentorship Hub is one web platform for three programmes:

- **Leadership** — one-to-one, organisation-curated pairs, at least three months, three SMART goals, monthly structured reports to leadership.
- **SparkLab** — one mentor to an *idea team* (a "spark"), phase milestones (develop, design, test), a report per phase.
- **Open** — self-service, employee-initiated one-to-one mentoring with no admin step.

Product promise: **simple for users, powerful for administrators.** Employees find (or are matched with) a mentor and are told *why*; pairs and teams meet, set goals and track progress in a shared workspace; programme managers see where to intervene without reading anyone's private conversations.

## 2. Goals and non-goals

### 2.1 Goals

| ID | Goal | Measured by (Plan §12) |
|---|---|---|
| G1 | Pairs start meeting quickly | ≥ 80% of pairs meet within 14 days of matching |
| G2 | Meetings produce reflection | ≥ 70% of sessions have a check-in |
| G3 | Sessions are useful | Median session usefulness ≥ 4 / 5 |
| G4 | People can get in | ≥ 95% successful sign-ins |
| G5 | Private content stays private | Zero privacy incidents |
| G6 | The programme is cheap to run | PM time ≤ 2 hours a week |

### 2.2 Non-goals (MVP)

Taken verbatim from Plan §14: external or university participants; group mentoring beyond SparkLab teams; line-manager views; in-app sponsor access; communities, events, gamification, LMS integration; SparkLab idea submission; one-off "book an expert" sessions before a match; star ratings on mentor cards; fully automatic matching optimisation; multi-assessor calibration; fairness cross-tab reporting; Microsoft Graph, non-Entra SSO, Oracle HCM sync; real-time chat, native video, native mobile apps, push notifications, SMS; tenant self-signup, billing, white-label self-service, marketplace, payments; any AI in matching; an AI coach.

> **Acknowledged gap.** Protected attributes are not stored, so the platform cannot measure fairness against them. The MVP reports exclusion counts and an override log instead (Plan §14).

## 3. Users and roles

Being a mentor or mentee is a **programme participation**, not a role (Plan §6). Roles are scoped to an organisation, a programme or a cohort.

| Persona | Held as | Primary need |
|---|---|---|
| **Mentee** | Participation | Find or be given a mentor, understand why, set goals, book and attend sessions |
| **Mentor** | Participation (after vetting, D9) | Be discoverable only when approved; manage availability and capacity; report progress |
| **Team lead (SparkLab)** | Participation attribute | Accept on behalf of the team; confirm availability quorum |
| **Programme manager (PM)** | Role, scoped to programme/cohort | Configure, match, monitor health, decide vetting, publish reports |
| **Assessor** | Role | Score mentor applications blind |
| **Content manager** | Role | Maintain taxonomy, templates, resources, translations |
| **Safeguarding contact** | Role | Receive and handle concerns (D16) |
| **Organisation admin** | Role | Organisation settings, people, roles. Reads reports only with a PM role on that programme (D15) |
| **Platform admin** | Role (global) | Create organisations; no content access |
| **Sponsor** | Named recipient, not a user | Receives the exported final-evaluation pack (D15) |
| **Line manager** | None | **No view at all** (D3) |

Full action-by-role rules are in [the permission matrix](../04-permission-matrix.md).

## 4. Programme types at a glance

| | Leadership | SparkLab | Open |
|---|---|---|---|
| Relationship shape | 1 mentor : 1 mentee | 1 mentor : 1 team | 1 mentor : 1 mentee |
| Who starts it | Organisation (PM curates pairs) | PM creates the team around an idea | Mentee requests |
| Matching mode | Admin matching + "Generate draft" | Admin matching + "Generate draft" | Recommended (top 5) + Browse |
| Acceptance | Mentor **and** mentee, within 7 days (D13) | Mentor **and** team lead; members notified (D13) | Mentor accepts; request expires in 7 days |
| Vetting rubric | 35-item | 20-item | PM approval only (recorded exception to D9) |
| Progress reports | Mandatory: monthly + final | Mandatory: per phase | Optional, **off by default** (D14) |
| Minimum duration | 3 months | Per phase plan | None |
| Goals | 3 SMART goals | Phase milestones | Any number, optional |
| "Mentor not junior to mentee" | **On** | Off | Off |
| Default mentor capacity | 2 mentees **[PROPOSED]** (C-021) | 2 teams, 1 unit per team (C-021, C-022) | 3 mentees **[PROPOSED]** (C-021) |

## 5. Functional requirements

Areas map to the Plan's 15 epics. Each requirement is deliberately one testable behaviour; detailed behaviour, screens and edge cases are specified in Batches 2 and 3.

### 5.1 Tenancy, sign-in and roles — `TEN` (Epic 1)

| ID | Requirement | Source |
|---|---|---|
| FR-TEN-001 | Every tenant record carries `organisation_id`; the organisation always comes from the signed-in session, never from a URL, form or header. | D4, §5.1 |
| FR-TEN-002 | A person has one global sign-in identity and one profile/HR record **per organisation**. Joining another organisation needs no schema change. | §6 |
| FR-TEN-003 | Sign-in is by emailed magic link. No passwords exist anywhere in the system. | D6 |
| FR-TEN-004 | The sign-in email also carries a 6-digit code. The code works only in the browser that requested the sign-in. | §4 |
| FR-TEN-005 | Only people who are **active in the HR import**, or whom a PM has explicitly invited, can sign in. | §4 |
| FR-TEN-006 | Any email address — known, unknown, inactive — receives the same neutral on-screen response and the same response time class, so addresses cannot be probed. | §4 |
| FR-TEN-007 | Opening a magic link shows a page; sign-in completes only when the user clicks a button on that page. A pre-fetch by a mail scanner changes nothing. | Principle 5 |
| FR-TEN-008 | Sign-in rate limits are per identity and per browser, and must not lock out 100 colleagues behind one office IP address. | §11 |
| FR-TEN-009 | Organisation admins and platform admins must enrol an authenticator app (TOTP) and use it until Entra ID SSO is live. | §4 |
| FR-TEN-010 | Roles are scoped to the organisation, a programme or a cohort. A scoped role grants nothing outside its scope. | §6 |
| FR-TEN-011 | One permission map decides every action; every server action must pass through it. A build check fails if any action skips authorisation. | Principle 4 |
| FR-TEN-012 | Anything a user may not see returns "not found", identically to a record that does not exist. | Principle 4 |
| FR-TEN-013 | A user chooses their interface language (EN / AZ / RU); the default time zone is Asia/Baku. | D8 |
| FR-TEN-014 | A privacy notice and consent are presented at first sign-in; consent state is stored and versioned. | S1 |
| FR-TEN-015 | Entra ID SSO is a later per-organisation switch (L1). Magic link remains as fallback. | D6, L1 |
| FR-TEN-016 | Magic-link lifetime, code-attempt limit, sign-in request limits, session idle timeout and absolute lifetime are **organisation settings** managed by the org admin within platform-enforced bounds ([constants §0](constants.md)). | **[PROPOSED]** |

### 5.2 People import — `IMP` (Epic 2)

| ID | Requirement | Source |
|---|---|---|
| FR-IMP-001 | People data enters by CSV/Excel import; Oracle HCM sync is out of scope. | D11 |
| FR-IMP-002 | The import accepts a published template and recognises documented header aliases (e.g. localised column names). | S2 |
| FR-IMP-003 | Every import first produces a **dry-run preview** showing rows to create, update, deactivate and reject. Nothing is written until the PM confirms. | S2 |
| FR-IMP-004 | Re-running the same file changes nothing (idempotent upsert keyed on a stable employee identifier). | D11 |
| FR-IMP-005 | Manager chains are resolved from the file; cycles and missing managers are reported, not silently accepted. | S2 |
| FR-IMP-006 | The grade ladder is defined from the import and mapped to **grade buckets**. Raw grade numbers are never displayed to users. | §7 |
| FR-IMP-007 | Rows that fail validation are returned in a downloadable error file with the reason per row. | S2 |
| FR-IMP-008 | Cell values beginning with `=`, `+`, `-`, `@` (or tab/CR) are neutralised on import and on any export, to prevent spreadsheet formula injection. | S2 |
| FR-IMP-009 | Real HR data cannot be imported until the data-residency sign-off is recorded in the system; until then only synthetic or pseudonymised data is accepted. | Principle 8, S2 |
| FR-IMP-010 | Raw import rows are deleted after 30 days; the resulting person records follow normal retention. | §6 |
| FR-IMP-011 | People absent from a later import are marked inactive (not deleted); relationships in progress are flagged for the PM. | **[PROPOSED]** |

### 5.3 Programmes — `PRG` (Epic 3)

| ID | Requirement | Source |
|---|---|---|
| FR-PRG-001 | The hierarchy is Organisation → Programme → Cohort → Participants. | §6 |
| FR-PRG-002 | Programme types are exactly Leadership, SparkLab and Open at launch. The type drives matching mode, templates, journey, defaults and required reports. | D2, §2 |
| FR-PRG-003 | A PM creates a programme from a type template, which pre-fills weights, rubric, cadence, report schedule and exclusion switches; all are editable except where this PRD marks a value fixed. | S3 |
| FR-PRG-004 | Eligibility rules (e.g. tenure, grade bucket, department) are defined per programme and show a **live count** of eligible people. | S3 |
| FR-PRG-005 | Enrolment mode is configurable: invite-only, rule-based automatic (Open), or nomination. | S3 |
| FR-PRG-006 | The PM configures **sponsors** (named recipients) for the final-evaluation pack. | D15 |
| FR-PRG-007 | Mentees are told who the sponsors are when they enrol and again when the final report is produced. | D15 |
| FR-PRG-008 | Leadership programmes can include a compatibility questionnaire (character, field, experience) that feeds the "Other" criterion. | §7 |
| FR-PRG-009 | Matching weights are configurable per programme and must total 100; a programme cannot be activated otherwise. | §7 |
| FR-PRG-010 | Each programme defines a **meeting cadence** (an admin-managed setting, C-020); health-rule thresholds are relative to it. | §6 |
| FR-PRG-011 | Each programme can switch on or off each overridable hard exclusion, within the limits of [matching-spec §3](matching-spec.md). Never-overridable exclusions cannot be switched off. | §7 |
| FR-PRG-012 | Each programme has an AI flag, off by default, subordinate to the organisation kill switch. | Principle 6 |
| FR-PRG-013 | Every parameter listed in [constants §0](constants.md) — cadence, mentor capacity (default and maximum), matching factors, sub-scores, thresholds, weights, exclusion switches, timings, reminder lead times, cool-offs and sign-in/session security — is an **admin-managed setting** edited in the product by the roles named there, with no code release. | Decision 2 Oct 2026 |
| FR-PRG-014 | Settings are validated against their bounds on save (individually and as a set); saving creates an immutable **settings version**; the history shows who changed what and when, and any earlier version can be restored as a new version. | Decision 2 Oct 2026 |
| FR-PRG-015 | A settings change never rewrites the past: existing matches keep the settings version they were scored with; changes apply from the next action. Changing an active programme shows a plain-language impact summary and needs confirmation; audit entries carry ids only. | Decision 2 Oct 2026, INV-7.4 |
| FR-PRG-016 | Administrators can restore any settings group to its starting defaults and see which values differ from the defaults. | Decision 2 Oct 2026 |

### 5.4 Profiles, goals and availability — `PRF` (Epic 4)

| ID | Requirement | Source |
|---|---|---|
| FR-PRF-001 | Each profile field has its own visibility setting, chosen by the user, from the options in [permission matrix §5](../04-permission-matrix.md). | S4 |
| FR-PRF-002 | Skills/topics come from a curated, translated taxonomy (EN/AZ/RU) with synonyms. Free-text topics are not matched. | §6 |
| FR-PRF-003 | Each mentor topic carries an **expertise depth**: working, advanced or expert. | §7 |
| FR-PRF-004 | Each person records languages with proficiency (working or fluent). | §7 |
| FR-PRF-005 | Interests are chosen from a curated tag list. | §7 |
| FR-PRF-006 | A mentor must have a minimum profile — at least one topic and at least one expertise area — before they can be recommended or discovered. | §7 |
| FR-PRF-007 | Mentors set recurring availability rules and a capacity; mentees set availability windows. Slots are generated in the viewer's time zone. | S4, S7 |
| FR-PRF-008 | Goals carry taxonomy tags, a visibility setting, and (in Leadership) the SMART structure. | S4 |
| FR-PRF-009 | Profile edits autosave. | §8 |
| FR-PRF-010 | Users can see exactly which profile fields the matching engine reads and who sees each field. | Principle 7 **[PROPOSED]** |
| FR-PRF-011 | Search treats ə/e, ı/i, ö/o, ü/u, ç/c, ş/s, ğ/g and ё/е as equivalent, identically in database and application. | §8 |

### 5.5 Mentor vetting — `VET` (Epic 5)

| ID | Requirement | Source |
|---|---|---|
| FR-VET-001 | A person becomes a mentor by applying or being nominated, being assessed on a rubric, and being approved. Only approved mentors are discoverable or matchable. | D9 |
| FR-VET-002 | Mentor application states: draft · nominated · submitted · in review · approved · rejected · withdrawn · suspended. | §6 |
| FR-VET-003 | Rubrics are versioned and immutable once used; sections, items and score bands map to an **advisory** outcome. | §6 |
| FR-VET-004 | Both rubrics are seeded: 35-item (Leadership) and 20-item (SparkLab). Open uses simple PM approval, recorded as an exception to D9. | §4 |
| FR-VET-005 | Each application has one assessor by default and at most two; scores are averaged. | §6 |
| FR-VET-006 | Assessors score blind: they cannot see another assessor's scores until they submit their own. | §7 |
| FR-VET-007 | Assessors cannot assess themselves, their direct manager or their direct report. The system blocks the assignment. | §7 |
| FR-VET-008 | The PM records the decision and must give a reason when it differs from the advisory band. | §6 |
| FR-VET-009 | Applicants see the decision and any feedback the PM chooses to release. Item-level scores are hidden by default but included in the applicant's personal data export. | §7 |
| FR-VET-010 | Assessments are kept for 24 months. | §6 |
| FR-VET-011 | A suspended mentor disappears from discovery and matching immediately; existing relationships are flagged to the PM, not terminated. | **[PROPOSED]** |
| FR-VET-012 | Assessment forms autosave. | §8 |
| FR-VET-013 | The cool-off before re-applying after a rejected or withdrawn application (C-151) and the minimum length of a decision reason (C-152) are admin-managed settings. | Decision 2 Oct 2026 |

### 5.6 Matching — `MAT` (Epic 6)

Detailed algorithm, formulas and test scenarios: [matching-spec.md](matching-spec.md).

| ID | Requirement | Source |
|---|---|---|
| FR-MAT-001 | Matching is deterministic and explainable; no AI is involved. Identical inputs always give identical output. | D10, Principle 7 |
| FR-MAT-002 | Hard exclusions are evaluated before scoring. "Never" exclusions cannot be overridden; the rest may be overridden only by a PM with an audited reason. | §7 |
| FR-MAT-003 | Users never see why a candidate is excluded; every such case shows the same neutral line. | §7 |
| FR-MAT-004 | Seven criteria are scored with the per-programme default weights in [constants §5](constants.md). | §7 |
| FR-MAT-005 | A missing mentee answer scores neutral; a missing mentor answer scores zero. | §7 |
| FR-MAT-006 | The engine reads only fields people chose to make visible, plus two declared HR inputs (grade bucket, reporting line) that are never displayed. Private fields cannot change output. | Principle 7 |
| FR-MAT-007 | Engine version and full reasoning are stored with every match. | Principle 7 |
| FR-MAT-008 | Open: **Recommended** (top 5) plus **Browse**; at most 2 open requests per mentee; requests expire after 7 days with one reminder. | §7 |
| FR-MAT-009 | Leadership and SparkLab: **admin matching** with a "Generate draft" button. A person always reviews and publishes; publishing re-checks every pair. | §4, §7 |
| FR-MAT-010 | Mentees see up to three plain-language reasons, no percentages. Reasons that apply to nearly every candidate are dropped. | §7 |
| FR-MAT-011 | Mentors see topic labels only — never the mentee's goal titles — unless the mentee shares a goal in a request. | §7 |
| FR-MAT-012 | PMs see the full score breakdown, weights and engine version. | §7 |
| FR-MAT-013 | Rematch requires a reason. Goals move to the new mentor only if the mentee ticks them, after a preview. Old notes never move. | §7, §6 |
| FR-MAT-014 | Mentor capacity is never exceeded, including under simultaneous accepts. | §7, §11 |
| FR-MAT-015 | Mentor cards show sessions completed and "available this week"; **never** star ratings. | §4 |
| FR-MAT-016 | SparkLab matching scores against the team's needed expertise and the mentor's experience of the team's phase; a team consumes one unit of capacity. | §7 |
| FR-MAT-017 | Explanations are produced in the viewer's language, with correct Russian plural forms. | §7 |
| FR-MAT-018 | All numeric matching parameters (factors, sub-scores, thresholds, weights, exclusion switches, horizon) are read from the programme's matching settings version, supplied to the engine inside the input snapshot; the version id and values are stored with every match. | Principle 7, Decision 2 Oct 2026 |

### 5.7 Relationships — `REL` (Epic 7)

| ID | Requirement | Source |
|---|---|---|
| FR-REL-001 | A **match** links a mentor to either a person or a team; it stores its explanation and engine version. | §6 |
| FR-REL-002 | Leadership: a proposal is accepted by the mentor **and** the mentee within 7 days. | D13 |
| FR-REL-003 | A decline in Leadership goes back to the PM with a **private reason**; the other party sees only that the proposal was not taken forward. | D13 |
| FR-REL-004 | SparkLab: the mentor and the team lead accept; other members are notified. | D13 |
| FR-REL-005 | Match states: requested / proposed / draft → accepted · declined · withdrawn · expired · discarded. Relationship states: active · paused · completed · closed. | §6 |
| FR-REL-006 | Any member can pause or leave a relationship immediately; the PM is notified. Nobody needs HR approval to exit. | §6 |
| FR-REL-007 | A declined match blocks the same pair for 90 days (PM-overridable). | §7 |
| FR-REL-008 | When a match is accepted, a relationship workspace is created, visible only to its members (and, for aggregate fields, to the PM). | §5.2 |
| FR-REL-009 | Rematch closes the old relationship, preserves history for its members, and starts a new match with the same exclusions applied. | §7 |

### 5.8 Scheduling — `SCH` (Epic 8)

| ID | Requirement | Source |
|---|---|---|
| FR-SCH-001 | Availability lives inside the platform. No calendar integration reads or writes external calendars in the MVP. | D7 |
| FR-SCH-002 | Booking shows slots in the viewer's time zone and sends a standards-compliant calendar invite (.ics) carrying a Teams link. | D7, S7 |
| FR-SCH-003 | Double-booking is blocked in the database, not only in the application. | §6 |
| FR-SCH-004 | For a team, a slot is offered only if the team lead and at least 60% of members are free. | §7 |
| FR-SCH-005 | Sessions can be rescheduled and cancelled by any participant; invites are updated or cancelled accordingly. | S7 |
| FR-SCH-006 | A reminder is sent 24 hours before each session. | S7 |
| FR-SCH-007 | Invites must display Accept/Decline in Outlook (classic, new, web, mobile) and Google Calendar. | §11 |
| FR-SCH-008 | Invites carry names, times and a link only — no goal, note or topic text. | Principle 3 |
| FR-SCH-009 | The Teams link is a configured static or per-pair meeting URL until Graph integration (L2). | D7 **[PROPOSED]** |

### 5.9 Sessions and resources — `SES` (Epic 9)

| ID | Requirement | Source |
|---|---|---|
| FR-SES-001 | Session states: scheduled · completed · cancelled · no-show. | §6 |
| FR-SES-002 | Each session has a before / during / after workspace (agenda, notes, decisions, actions). | S8 |
| FR-SES-003 | Session notes, decisions and reflections are readable only by members of the relationship; **private notes** are readable only by their author. | D3, Principle 2 |
| FR-SES-004 | Notes autosave. | §8 |
| FR-SES-005 | Actions have an owner and due date; in Leadership an action records a **difficulty rating**. | S8 |
| FR-SES-006 | A resource library is seeded from the leadership training deck (difficult mentee types, active listening, paraphrasing, the 6C communication rule), after L&D sign-off. | §12 |
| FR-SES-007 | After a session, the usefulness rating (1–5) is recorded privately; the PM sees only aggregates meeting the respondent threshold. | Principle 3 |
| FR-SES-008 | File attachments are disabled until storage and antivirus scanning are approved. | S13 |

### 5.10 Goals — `GOL` (Epic 10)

| ID | Requirement | Source |
|---|---|---|
| FR-GOL-001 | Goal states: draft · active · achieved · dropped. | §6 |
| FR-GOL-002 | Goals have milestones and actions. | §6 |
| FR-GOL-003 | Leadership uses a 3-goal SMART template with tasks. | §2, S8 |
| FR-GOL-004 | SparkLab uses phase milestones: develop, design, test. | S8 |
| FR-GOL-005 | Goal visibility is per goal; only tags and shared goals feed matching. | §7 |
| FR-GOL-006 | Goals can carry over to a new mentor on rematch if the mentee ticks them. | §7 |
| FR-GOL-007 | A Leadership relationship cannot be marked completed with fewer than 3 goals unless the PM records a reason. | **[PROPOSED]** |

### 5.11 Reports and the sponsor pack — `RPT` (Epic 11)

| ID | Requirement | Source |
|---|---|---|
| FR-RPT-001 | Progress reports are structured, versioned, and go to the PM and the mentee. Session notes, reflections and messages never appear in a report. | D3 |
| FR-RPT-002 | Report states: due → submitted (one amendment allowed) · waived by the PM with a reason. | §6 |
| FR-RPT-003 | Reports are mandatory in Leadership (monthly + final) and SparkLab (per phase); optional and off by default in Open. | D14 |
| FR-RPT-004 | The PM exports the final-evaluation pack to the configured sponsors; every export is logged with its recipients. | D15 |
| FR-RPT-005 | Mentees are told who will see the pack at enrolment and again on the final report. | D15 |
| FR-RPT-006 | Org admins read reports only if they also hold a PM role on that programme. | D15 |
| FR-RPT-007 | Line managers have no access to any report. | D3 |
| FR-RPT-008 | Reports autosave. | §8 |
| FR-RPT-009 | The sponsor pack is composed only from the final report and programme-level result fields (see [domain model §7](../05-domain-model.md)); never from session notes, reflections or messages. | D3, D15 **[PROPOSED]** |

### 5.12 Feedback, health, concerns and dashboard — `HLT` (Epic 12)

| ID | Requirement | Source |
|---|---|---|
| FR-HLT-001 | A 3-question check-in follows each session. | S9 |
| FR-HLT-002 | The "I'd like support" check-in flag is routed to the PM. | D16 |
| FR-HLT-003 | "Report a concern" is routed to the safeguarding contact — never the PM — with the org admin as fallback. | D16 |
| FR-HLT-004 | Concerns are readable only by safeguarding (and the fallback admin when the contact is unset or conflicted). | §6 |
| FR-HLT-005 | Relationship health is computed by the five rules I1, I2, A2, A4, A5 (see [domain model §6](../05-domain-model.md)); thresholds scale with cadence. | §6 |
| FR-HLT-006 | The PM sees a "Where should I intervene?" list in a fixed priority order (see [domain model §6.3](../05-domain-model.md)). | §6 |
| FR-HLT-007 | The dashboard and background jobs see only activity **timestamps** and statuses, never content. | Principle 2 |
| FR-HLT-008 | Aggregated feedback is hidden when fewer than 5 respondents. | Principle 3 |
| FR-HLT-009 | Every chart has a table view. | §8 |
| FR-HLT-010 | Success metrics (G1–G6) are computed from the platform's own records. No third-party analytics. | §12 |
| FR-HLT-011 | The fairness view in the MVP shows exclusion counts and the override log only. | §14 |

### 5.13 Messaging and notifications — `MSG` (Epic 13)

| ID | Requirement | Source |
|---|---|---|
| FR-MSG-001 | Text-only messaging between members of a relationship or team. No real-time chat, attachments or push in the MVP. | §14 |
| FR-MSG-002 | Messages are readable only by relationship members; no admin read path exists. | Principle 2 |
| FR-MSG-003 | Notifications are delivered by email and in-app according to [the catalogue](notification-catalogue.md). | S3 |
| FR-MSG-004 | A notification stores ids only and renders its text at display time in the recipient's language. | Principle 3 |
| FR-MSG-005 | Emails, notifications and invites contain names and links only — no goal text, note text, concern text or decline reasons. | Principle 3 |
| FR-MSG-006 | Every link in an email opens a page; any change requires a click on that page. | Principle 5 |
| FR-MSG-007 | Users can set notification preferences for non-critical categories; critical categories (see catalogue) cannot be switched off. | **[PROPOSED]** |
| FR-MSG-008 | Email is sent from a dedicated subdomain with SPF, DKIM and DMARC. | §13 |
| FR-MSG-009 | Reminder and nudge lead times (C-003, C-153 … C-157) and session timings (C-158, C-159) are admin-managed settings; each must fall before the event it relates to. | Decision 2 Oct 2026 |

### 5.14 AI assistants — `AIA` (Epic 14)

| ID | Requirement | Source |
|---|---|---|
| FR-AIA-001 | Exactly two opt-in assistants at launch: SMART-goal drafting and session-agenda drafting. | D10 |
| FR-AIA-002 | An assistant runs only if **all four** allow it: the org kill switch, the per-assistant flag, the programme flag and the user's consent. | Principle 6 |
| FR-AIA-003 | AI only suggests; nothing is saved until the user accepts. | Principle 6 |
| FR-AIA-004 | The assistant receives only the requester's own text — no other person's data, notes or messages. | Principle 6 |
| FR-AIA-005 | Use is logged (who, when, assistant, outcome) without the text. | Principle 6 |
| FR-AIA-006 | Admin-triggered machine translation of admin-written content is item by item, under the same kill switch, off by default. | §4 |
| FR-AIA-007 | Prompt-injection tests are part of the release gate. | S12 |
| FR-AIA-008 | AI is never used in matching, vetting scores, health rules or reports. | D10, §14 |

### 5.15 Privacy, internationalisation, accessibility — `PRV` (Epic 15)

| ID | Requirement | Source |
|---|---|---|
| FR-PRV-001 | The audit log is append-only and records ids, statuses and dates, never free text. | Principle 3 |
| FR-PRV-002 | Application logs carry ids and error codes, never personal or free text. | Principle 3 |
| FR-PRV-003 | Retention follows [constants §7](constants.md): relationship content 12 months after close; structured records 36 months then anonymised; assessments 24; audit log 24; raw import rows 30 days. Pending Legal sign-off. | §6 |
| FR-PRV-004 | A user can export their personal data (including their own item-level assessment scores) and request erasure/anonymisation. | S13 |
| FR-PRV-005 | Before the self-service flow (S13) exists, a documented manual data-request procedure is a pilot gate. | §10 |
| FR-PRV-006 | The interface is available in EN, AZ and RU; layouts allow text up to 35% longer than English. | §8 |
| FR-PRV-007 | Dates use the 24-hour clock; weeks start on Monday; Russian copy uses gender-neutral phrasing. | §8 |
| FR-PRV-008 | The product meets WCAG 2.2 AA; every admin action works at 320 px and 400% zoom; status is never conveyed by colour alone. | §8 |
| FR-PRV-009 | Consents, data-subject requests and exports are recorded. | §6 |
| FR-PRV-010 | Fonts: Manrope with Noto Sans fallback (Manrope lacks capital Ə). | §4 |
| FR-PRV-011 | The platform is hosted on Render (EU) with S3-compatible storage. IT/Legal data-residency sign-off must be recorded in the system before any real personal data is used. | D12, Principle 8 |

### 5.16 Home — `HOM` (cross-cutting, Plan §8)

| ID | Requirement | Source |
|---|---|---|
| FR-HOM-001 | Home always answers "What should I do next?" with one **main card** chosen from the fixed priority list in [domain model §8](../05-domain-model.md). | §8 |
| FR-HOM-002 | Up to two further applicable items appear as "also due" (C-029); if nothing applies Home shows "You're up to date". | §8 |
| FR-HOM-003 | Card selection is a pure function of the user's state; a card is never produced for an object the user may not see. | §8, Principle 4 |

### 5.17 Advanced admin panel — `ADM` (decisions of 2 October 2026)

The admin area ("Manage") is an advanced operations console, modelled on the organisation's other tools. Capabilities were chosen one by one by the programme owner (see [admin panel overview](../09-admin-panel.md)). Every admin view obeys INV-2 and INV-3: **no admin view ever shows private content or free text.**

| ID | Requirement | Source |
|---|---|---|
| FR-ADM-001 | The *Manage* area extends the Plan's navigation (Dashboard · Programmes · People · Vetting · Matching · Relationships · Reports · Content · Settings) with **Insights**, **Compliance** and **Operations** sections, and a **Platform** section for platform admins. Each admin sees only the items their role and scope allow. | §8, Decision 2 Oct 2026 |
| FR-ADM-002 | Admin Home shows KPIs against targets, relationship health, the "Where should I intervene?" list and the admin alert centre. | §6, S10 |
| FR-ADM-003 | **What-if impact preview:** before saving matching settings on a programme, the admin can re-run the engine read-only on the current cohort and see how many top-5 lists, rankings and drafts would change, without storing anything. | Decision 2 Oct 2026 |
| FR-ADM-004 | **Settings version diff:** any two settings versions can be compared side by side, showing every changed value, who changed it and when. | Decision 2 Oct 2026 |
| FR-ADM-005 | **Feature flags** per organisation and per programme (AI assistants individually, attachments, Open mentoring, optional Open reports, AI translation), each with change history and prerequisites (e.g. attachments need recorded storage approval; AI needs recorded DPIA sign-off). | Decision 2 Oct 2026, Principle 6 |
| FR-ADM-006 | **Export, import and clone settings:** a programme's settings can be exported to a file and imported or cloned into another programme or organisation; files carry settings only, never people data. A programme can be saved as a reusable **template** (settings, rubric reference, report schedule). | Decision 2 Oct 2026 |
| FR-ADM-007 | **Audit log search** with filters (actor, action, programme, date) and CSV export; entries hold ids and statuses only. | Principle 3 |
| FR-ADM-008 | **Override and exclusion log:** every PM override with its reason (admin-visible) and exclusion counts per programme and code. | §14 |
| FR-ADM-009 | **Data-request queue** for export and erasure requests with status, response target, and a manual-procedure checklist. | S13, §10 |
| FR-ADM-010 | **Consent and retention view:** who accepted which notice version; retention job runs, counts and next run. | §6 |
| FR-ADM-011 | **Job queue viewer** for background jobs (email, reminders, retention, imports) with status, attempts, error codes by id, and a retry action. | NFR-REL-003 |
| FR-ADM-012 | **Email delivery log:** per notification, delivery status (queued, sent, deferred, bounced, failed) and error code — never content — with resend and a bounce-spike alert. | Principle 3 |
| FR-ADM-013 | **Import run history** with counts, dry-run versus confirmed, error-file download and the residency sign-off state. | S2 |
| FR-ADM-014 | **System status page:** database, worker, mail sender, storage and migration status with last-checked time. | NFR-REL-004 |
| FR-ADM-015 | **Admin alert centre:** one prioritised list of failed jobs, bounce spike, overdue or due-soon data requests, mentors over capacity, unanswered proposals and pending approvals. | Decision 2 Oct 2026 |
| FR-ADM-016 | **Pilot-gate checklist** tracking the Leadership pilot gate: slices S0–S10, data-residency sign-off, named safeguarding contact, documented manual data-request procedure, and at least C-163 org admins. | §10 |
| FR-ADM-017 | **Programme funnel:** enrolled → matched → first session → check-in → report, per cohort, with drop-off counts (aggregates only; hidden below C-028 respondents where it derives from feedback). | Decision 2 Oct 2026 |
| FR-ADM-018 | **Scheduled exports:** weekly or monthly CSV/PDF summaries of aggregates delivered to chosen PMs as an authenticated link (never an attachment); every chart has a table view. | Decision 2 Oct 2026, FR-HLT-009 |
| FR-ADM-019 | **Command palette** (Ctrl+K / Cmd+K): jump to any programme, person, page or permitted action by typing; results are permission-trimmed and search folds Azerbaijani/Russian letters. | Decision 2 Oct 2026 |
| FR-ADM-020 | **Bulk actions with preview:** selecting many rows (invite, nominate, withdraw, send reminder) shows exactly what will change and what will be skipped, then needs an audited confirmation; each row is permission-checked individually. | Decision 2 Oct 2026 |
| FR-ADM-021 | **Role and permission explorer:** shows who holds which role and scope, and what each role can do, generated from the permission map. | Decision 2 Oct 2026, Principle 4 |
| FR-ADM-022 | **Email template preview:** every notification can be previewed in EN, AZ and RU with synthetic sample data before release; real personal data is never used. | Decision 2 Oct 2026 |
| FR-ADM-023 | **Announcements:** an admin posts a banner or message to a programme or the organisation for a date range; text-only, length limited (C-164), no private content. | Decision 2 Oct 2026 |
| FR-ADM-024 | **Four-eyes approval:** residency sign-off, safeguarding-contact change, granting the org-admin role and bulk erasure take effect only after a *different* org admin approves; blocked until at least C-163 org admins exist; requests expire (C-160). | Decision 2 Oct 2026 |
| FR-ADM-025 | **Session and device manager:** every user with an admin role sees their own active sessions and can revoke them; an org admin can force sign-out of a user (step-up TOTP, audited). | Decision 2 Oct 2026 |
| FR-ADM-026 | **Tenant console** (platform admin only): create and disable organisations, view per-organisation usage counts and the isolation self-check result; no access to tenant content. | Decision 2 Oct 2026, INV-1 |
| FR-ADM-027 | **People directory** with search, filters and participation status, and a permission-limited CSV export that is logged with its recipient. | Decision 2 Oct 2026 |
| FR-ADM-028 | **Limited brand/theme editor** (org admin): logo and the brand tokens only; a change is rejected unless contrast checks pass; no custom CSS, fonts or domains. This is a recorded limited exception to the Plan's "no white-label self-service". | Decision 2 Oct 2026, §14 |
| FR-ADM-029 | Admin screens offer light and dark themes with verified contrast, dense sortable tables with column chooser and keyboard navigation, and a mobile-friendly layout; every admin action works at 320 px and 400% zoom. | Decision 2 Oct 2026, §8 |
| FR-ADM-030 | No admin view (including logs, exports, previews and alerts) shows notes, reflections, messages, concern text, decline reasons, check-in text or any free text; admin actions are audited by id. | INV-2, INV-3 |

## 6. Programme journeys (requirement-level)

Journeys are the product-level sequence. Screens and stories come in Batch 2.

**Leadership.** Import people → create from template → nominate and assess mentors → invite mentees → compatibility questionnaire → draft and publish pairs → both accept → initial meeting (expectations, values, challenges) → three SMART goals with tasks → sessions and check-ins → monthly reports → final evaluation → sponsor pack.

**SparkLab.** PM creates the team around an idea → mentor and team lead accept → phase milestones (develop, design, test) → a report per phase.

**Open.** Sign in → automatically enrolled → set a goal (optional AI help) → see suggestions → request a mentor → mentor accepts → book → meet → add an action → check in. No admin step.

**Home — "What should I do next?"** One main card chosen by the fixed priority list in [domain model §8](../05-domain-model.md), plus up to two "also due" items.

## 7. Release scope and slices

Slices S0–S10 form the Leadership pilot; S11–S14 and L1–L2 follow (Plan §10). The pilot gate requires S0–S10, data-residency sign-off, a named safeguarding contact, and a documented manual data-request procedure. Each slice passes the same gate (lint, types, unit and database tests, end-to-end journeys, automated accessibility checks, **specification coverage**, staging deploy) before its demo.

**Specification coverage rule:** every acceptance criterion in a slice must be referenced by a named test. The traceability matrix (BRD requirement → story → criterion → screen → test) is generated, never hand-edited.

## 8. Dependencies

See Plan §13. The ones that block specification sign-off are tracked in [open-questions-batch1.md](open-questions-batch1.md).

## 9. Change control

This PRD is stored in the repository under `spec/`. Changes follow the normal pull-request flow; a change to any constant, invariant or permission rule must update the corresponding test reference in the same pull request.
