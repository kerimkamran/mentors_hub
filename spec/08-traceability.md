# Traceability matrix

> **GENERATED FILE — do not edit by hand.** Regenerate with `python3 spec/tools/gen_traceability.py`; CI runs it with `--check`.

| Measure | Count |
|---|---|
| Functional requirements | 199 |
| …covered by at least one story (participant or admin) | 164 |
| …not yet covered (system behaviour, Batch 3 part B, or later) | 35 |
| Stories (participant + admin) | 72 |
| Acceptance criteria | 346 |
| Screens (participant + admin) | 34 |

Chain: **BRD/Plan requirement → FR → story → acceptance criteria → screen → test**. The test column is empty until the test suite exists; each test cites AC ids.

## 1. Requirement → story → criteria → screens

| FR | Requirement | Stories | Acceptance criteria | Screens | Tests |
|---|---|---|---|---|---|
| FR-TEN-001 | Every tenant record carries `organisation_id`; the organisation always comes from the signed-in session, neve… | US-ADM-21 | 6 (AC-ADM-21.1…) | SCR-33 | — |
| FR-TEN-002 | A person has one global sign-in identity and one profile/HR record per organisation. Joining another organisa… | US-ADM-21 | 6 (AC-ADM-21.1…) | SCR-33 | — |
| FR-TEN-003 | Sign-in is by emailed magic link. No passwords exist anywhere in the system. | US-TEN-01 | 6 (AC-TEN-01.1…) | SCR-01 | — |
| FR-TEN-004 | The sign-in email also carries a 6-digit code. The code works only in the browser that requested the sign-in. | US-TEN-01 | 6 (AC-TEN-01.1…) | SCR-01 | — |
| FR-TEN-005 | Only people who are active in the HR import, or whom a PM has explicitly invited, can sign in. | US-TEN-01 | 6 (AC-TEN-01.1…) | SCR-01 | — |
| FR-TEN-006 | Any email address — known, unknown, inactive — receives the same neutral on-screen response and the same resp… | US-TEN-01 | 6 (AC-TEN-01.1…) | SCR-01 | — |
| FR-TEN-007 | Opening a magic link shows a page; sign-in completes only when the user clicks a button on that page. A pre-f… | US-TEN-01 | 6 (AC-TEN-01.1…) | SCR-01 | — |
| FR-TEN-008 | Sign-in rate limits are per identity and per browser, and must not lock out 100 colleagues behind one office… | US-TEN-01, US-TEN-04 | 11 (AC-TEN-01.1…) | SCR-01, SCR-22 | — |
| FR-TEN-009 | Organisation admins and platform admins must enrol an authenticator app (TOTP) and use it until Entra ID SSO… | US-ADM-19, US-ADM-20 | 11 (AC-ADM-19.1…) | SCR-29, SCR-32 | — |
| FR-TEN-010 | Roles are scoped to the organisation, a programme or a cohort. A scoped role grants nothing outside its scope. | US-ADM-16 | 5 (AC-ADM-16.1…) | SCR-29 | — |
| FR-TEN-011 | One permission map decides every action; every server action must pass through it. A build check fails if any… | US-ADM-16 | 5 (AC-ADM-16.1…) | SCR-29 | — |
| FR-TEN-012 | Anything a user may not see returns "not found", identically to a record that does not exist. | — | — | — | — |
| FR-TEN-013 | A user chooses their interface language (EN / AZ / RU); the default time zone is Asia/Baku. | US-TEN-02 | 4 (AC-TEN-02.1…) | SCR-03 | — |
| FR-TEN-014 | A privacy notice and consent are presented at first sign-in; consent state is stored and versioned. | US-TEN-03 | 4 (AC-TEN-03.1…) | SCR-01, SCR-17 | — |
| FR-TEN-015 | Entra ID SSO is a later per-organisation switch (L1). Magic link remains as fallback. | — | — | — | — |
| FR-TEN-016 | Magic-link lifetime, code-attempt limit, sign-in request limits, session idle timeout and absolute lifetime a… | US-TEN-04 | 5 (AC-TEN-04.1…) | SCR-22 | — |
| FR-IMP-001 | People data enters by CSV/Excel import; Oracle HCM sync is out of scope. | — | — | — | — |
| FR-IMP-002 | The import accepts a published template and recognises documented header aliases (e.g. localised column names… | — | — | — | — |
| FR-IMP-003 | Every import first produces a dry-run preview showing rows to create, update, deactivate and reject. Nothing… | US-ADM-07 | 5 (AC-ADM-07.1…) | SCR-25 | — |
| FR-IMP-004 | Re-running the same file changes nothing (idempotent upsert keyed on a stable employee identifier). | — | — | — | — |
| FR-IMP-005 | Manager chains are resolved from the file; cycles and missing managers are reported, not silently accepted. | — | — | — | — |
| FR-IMP-006 | The grade ladder is defined from the import and mapped to grade buckets. Raw grade numbers are never displaye… | — | — | — | — |
| FR-IMP-007 | Rows that fail validation are returned in a downloadable error file with the reason per row. | US-ADM-07 | 5 (AC-ADM-07.1…) | SCR-25 | — |
| FR-IMP-008 | Cell values beginning with `=`, `+`, `-`, `@` (or tab/CR) are neutralised on import and on any export, to pre… | US-ADM-22 | 5 (AC-ADM-22.1…) | SCR-28 | — |
| FR-IMP-009 | Real HR data cannot be imported until the data-residency sign-off is recorded in the system; until then only… | US-ADM-07, US-ADM-10, US-ADM-19 | 16 (AC-ADM-07.1…) | SCR-25, SCR-26, SCR-29 | — |
| FR-IMP-010 | Raw import rows are deleted after 30 days; the resulting person records follow normal retention. | US-ADM-07 | 5 (AC-ADM-07.1…) | SCR-25 | — |
| FR-IMP-011 | People absent from a later import are marked inactive (not deleted); relationships in progress are flagged fo… | — | — | — | — |
| FR-PRG-001 | The hierarchy is Organisation → Programme → Cohort → Participants. | — | — | — | — |
| FR-PRG-002 | Programme types are exactly Leadership, SparkLab and Open at launch. The type drives matching mode, templates… | — | — | — | — |
| FR-PRG-003 | A PM creates a programme from a type template, which pre-fills weights, rubric, cadence, report schedule and… | US-PRG-06 | 5 (AC-PRG-06.1…) | SCR-20 | — |
| FR-PRG-004 | Eligibility rules (e.g. tenure, grade bucket, department) are defined per programme and show a live count of… | — | — | — | — |
| FR-PRG-005 | Enrolment mode is configurable: invite-only, rule-based automatic (Open), or nomination. | — | — | — | — |
| FR-PRG-006 | The PM configures sponsors (named recipients) for the final-evaluation pack. | — | — | — | — |
| FR-PRG-007 | Mentees are told who the sponsors are when they enrol and again when the final report is produced. | US-RPT-02 | 4 (AC-RPT-02.1…) | SCR-01, SCR-13 | — |
| FR-PRG-008 | Leadership programmes can include a compatibility questionnaire (character, field, experience) that feeds the… | — | — | — | — |
| FR-PRG-009 | Matching weights are configurable per programme and must total 100; a programme cannot be activated otherwise. | US-PRG-02 | 6 (AC-PRG-02.1…) | SCR-20, SCR-21 | — |
| FR-PRG-010 | Each programme defines a meeting cadence (an admin-managed setting, C-020); health-rule thresholds are relati… | US-PRG-01 | 5 (AC-PRG-01.1…) | SCR-20 | — |
| FR-PRG-011 | Each programme can switch on or off each overridable hard exclusion, within the limits of [matching-spec §3](… | — | — | — | — |
| FR-PRG-012 | Each programme has an AI flag, off by default, subordinate to the organisation kill switch. | US-PRG-05 | 5 (AC-PRG-05.1…) | SCR-20, SCR-22 | — |
| FR-PRG-013 | Every parameter listed in [constants §0](constants.md) — cadence, mentor capacity (default and maximum), matc… | US-PRG-01, US-PRG-02, US-PRG-03 | 16 (AC-PRG-01.1…) | SCR-20, SCR-21 | — |
| FR-PRG-014 | Settings are validated against their bounds on save (individually and as a set); saving creates an immutable… | US-PRG-01, US-PRG-02, US-PRG-04, US-PRG-06, US-TEN-04 | 27 (AC-PRG-01.1…) | SCR-20, SCR-21, SCR-22 | — |
| FR-PRG-015 | A settings change never rewrites the past: existing matches keep the settings version they were scored with;… | US-PRG-02 | 6 (AC-PRG-02.1…) | SCR-20, SCR-21 | — |
| FR-PRG-016 | Administrators can restore any settings group to its starting defaults and see which values differ from the d… | US-PRG-04 | 6 (AC-PRG-04.1…) | SCR-20 | — |
| FR-PRF-001 | Each profile field has its own visibility setting, chosen by the user, from the options in [permission matrix… | US-PRF-02 | 5 (AC-PRF-02.1…) | SCR-03 | — |
| FR-PRF-002 | Skills/topics come from a curated, translated taxonomy (EN/AZ/RU) with synonyms. Free-text topics are not mat… | US-PRF-01 | 5 (AC-PRF-01.1…) | SCR-03 | — |
| FR-PRF-003 | Each mentor topic carries an expertise depth: working, advanced or expert. | US-PRF-01 | 5 (AC-PRF-01.1…) | SCR-03 | — |
| FR-PRF-004 | Each person records languages with proficiency (working or fluent). | US-PRF-01 | 5 (AC-PRF-01.1…) | SCR-03 | — |
| FR-PRF-005 | Interests are chosen from a curated tag list. | US-PRF-01 | 5 (AC-PRF-01.1…) | SCR-03 | — |
| FR-PRF-006 | A mentor must have a minimum profile — at least one topic and at least one expertise area — before they can b… | US-PRF-04 | 3 (AC-PRF-04.1…) | SCR-02, SCR-03 | — |
| FR-PRF-007 | Mentors set recurring availability rules and a capacity; mentees set availability windows. Slots are generate… | US-PRF-03 | 4 (AC-PRF-03.1…) | SCR-04 | — |
| FR-PRF-008 | Goals carry taxonomy tags, a visibility setting, and (in Leadership) the SMART structure. | US-GOL-01 | 4 (AC-GOL-01.1…) | SCR-11 | — |
| FR-PRF-009 | Profile edits autosave. | US-PRF-01 | 5 (AC-PRF-01.1…) | SCR-03 | — |
| FR-PRF-010 | Users can see exactly which profile fields the matching engine reads and who sees each field. | US-PRF-02 | 5 (AC-PRF-02.1…) | SCR-03 | — |
| FR-PRF-011 | Search treats ə/e, ı/i, ö/o, ü/u, ç/c, ş/s, ğ/g and ё/е as equivalent, identically in database and applicatio… | US-MAT-02, US-ADM-14 | 10 (AC-MAT-02.1…) | SCR-05, SCR-06, SCR-34 | — |
| FR-VET-001 | A person becomes a mentor by applying or being nominated, being assessed on a rubric, and being approved. Onl… | US-PRF-04, US-VET-01 | 8 (AC-PRF-04.1…) | SCR-02, SCR-03, SCR-16 | — |
| FR-VET-002 | Mentor application states: draft · nominated · submitted · in review · approved · rejected · withdrawn · susp… | US-VET-01 | 5 (AC-VET-01.1…) | SCR-16 | — |
| FR-VET-003 | Rubrics are versioned and immutable once used; sections, items and score bands map to an advisory outcome. | — | — | — | — |
| FR-VET-004 | Both rubrics are seeded: 35-item (Leadership) and 20-item (SparkLab). Open uses simple PM approval, recorded… | — | — | — | — |
| FR-VET-005 | Each application has one assessor by default and at most two; scores are averaged. | — | — | — | — |
| FR-VET-006 | Assessors score blind: they cannot see another assessor's scores until they submit their own. | — | — | — | — |
| FR-VET-007 | Assessors cannot assess themselves, their direct manager or their direct report. The system blocks the assign… | — | — | — | — |
| FR-VET-008 | The PM records the decision and must give a reason when it differs from the advisory band. | US-VET-02 | 4 (AC-VET-02.1…) | SCR-16 | — |
| FR-VET-009 | Applicants see the decision and any feedback the PM chooses to release. Item-level scores are hidden by defau… | US-VET-02, US-PRV-01 | 9 (AC-VET-02.1…) | SCR-16, SCR-17 | — |
| FR-VET-010 | Assessments are kept for 24 months. | — | — | — | — |
| FR-VET-011 | A suspended mentor disappears from discovery and matching immediately; existing relationships are flagged to… | — | — | — | — |
| FR-VET-012 | Assessment forms autosave. | US-VET-01 | 5 (AC-VET-01.1…) | SCR-16 | — |
| FR-VET-013 | The cool-off before re-applying after a rejected or withdrawn application (C-151) and the minimum length of a… | US-PRG-03 | 5 (AC-PRG-03.1…) | SCR-20 | — |
| FR-MAT-001 | Matching is deterministic and explainable; no AI is involved. Identical inputs always give identical output. | US-MAT-01 | 5 (AC-MAT-01.1…) | SCR-05 | — |
| FR-MAT-002 | Hard exclusions are evaluated before scoring. "Never" exclusions cannot be overridden; the rest may be overri… | US-ADM-02 | 5 (AC-ADM-02.1…) | SCR-23 | — |
| FR-MAT-003 | Users never see why a candidate is excluded; every such case shows the same neutral line. | US-MAT-01 | 5 (AC-MAT-01.1…) | SCR-05 | — |
| FR-MAT-004 | Seven criteria are scored with the per-programme default weights in [constants §5](constants.md). | — | — | — | — |
| FR-MAT-005 | A missing mentee answer scores neutral; a missing mentor answer scores zero. | US-PRF-04 | 3 (AC-PRF-04.1…) | SCR-02, SCR-03 | — |
| FR-MAT-006 | The engine reads only fields people chose to make visible, plus two declared HR inputs (grade bucket, reporti… | US-PRF-02 | 5 (AC-PRF-02.1…) | SCR-03 | — |
| FR-MAT-007 | Engine version and full reasoning are stored with every match. | — | — | — | — |
| FR-MAT-008 | Open: Recommended (top 5) plus Browse; at most 2 open requests per mentee; requests expire after 7 days with… | US-MAT-01, US-MAT-02, US-MAT-03 | 15 (AC-MAT-01.1…) | SCR-05, SCR-06 | — |
| FR-MAT-009 | Leadership and SparkLab: admin matching with a "Generate draft" button. A person always reviews and publishes… | — | — | — | — |
| FR-MAT-010 | Mentees see up to three plain-language reasons, no percentages. Reasons that apply to nearly every candidate… | US-MAT-01 | 5 (AC-MAT-01.1…) | SCR-05 | — |
| FR-MAT-011 | Mentors see topic labels only — never the mentee's goal titles — unless the mentee shares a goal in a request. | US-GOL-01, US-MAT-04 | 9 (AC-GOL-01.1…) | SCR-07, SCR-11 | — |
| FR-MAT-012 | PMs see the full score breakdown, weights and engine version. | US-MAT-05 | 6 (AC-MAT-05.1…) | SCR-07 | — |
| FR-MAT-013 | Rematch requires a reason. Goals move to the new mentor only if the mentee ticks them, after a preview. Old n… | US-MAT-07 | 4 (AC-MAT-07.1…) | SCR-08 | — |
| FR-MAT-014 | Mentor capacity is never exceeded, including under simultaneous accepts. | US-MAT-04 | 5 (AC-MAT-04.1…) | SCR-07 | — |
| FR-MAT-015 | Mentor cards show sessions completed and "available this week"; never star ratings. | US-MAT-02 | 4 (AC-MAT-02.1…) | SCR-05, SCR-06 | — |
| FR-MAT-016 | SparkLab matching scores against the team's needed expertise and the mentor's experience of the team's phase;… | US-MAT-06 | 4 (AC-MAT-06.1…) | SCR-07 | — |
| FR-MAT-017 | Explanations are produced in the viewer's language, with correct Russian plural forms. | US-MAT-01 | 5 (AC-MAT-01.1…) | SCR-05 | — |
| FR-MAT-018 | All numeric matching parameters (factors, sub-scores, thresholds, weights, exclusion switches, horizon) are r… | US-PRG-02 | 6 (AC-PRG-02.1…) | SCR-20, SCR-21 | — |
| FR-REL-001 | A match links a mentor to either a person or a team; it stores its explanation and engine version. | US-REL-01 | 4 (AC-REL-01.1…) | SCR-08 | — |
| FR-REL-002 | Leadership: a proposal is accepted by the mentor and the mentee within 7 days. | US-MAT-05 | 6 (AC-MAT-05.1…) | SCR-07 | — |
| FR-REL-003 | A decline in Leadership goes back to the PM with a private reason; the other party sees only that the proposa… | US-MAT-05 | 6 (AC-MAT-05.1…) | SCR-07 | — |
| FR-REL-004 | SparkLab: the mentor and the team lead accept; other members are notified. | US-MAT-06 | 4 (AC-MAT-06.1…) | SCR-07 | — |
| FR-REL-005 | Match states: requested / proposed / draft → accepted · declined · withdrawn · expired · discarded. Relations… | US-MAT-03, US-MAT-04 | 11 (AC-MAT-03.1…) | SCR-06, SCR-07 | — |
| FR-REL-006 | Any member can pause or leave a relationship immediately; the PM is notified. Nobody needs HR approval to exi… | US-REL-02 | 5 (AC-REL-02.1…) | SCR-08 | — |
| FR-REL-007 | A declined match blocks the same pair for 90 days (PM-overridable). | US-MAT-04 | 5 (AC-MAT-04.1…) | SCR-07 | — |
| FR-REL-008 | When a match is accepted, a relationship workspace is created, visible only to its members (and, for aggregat… | US-REL-01 | 4 (AC-REL-01.1…) | SCR-08 | — |
| FR-REL-009 | Rematch closes the old relationship, preserves history for its members, and starts a new match with the same… | US-MAT-07 | 4 (AC-MAT-07.1…) | SCR-08 | — |
| FR-SCH-001 | Availability lives inside the platform. No calendar integration reads or writes external calendars in the MVP. | US-PRF-03, US-SCH-01 | 9 (AC-PRF-03.1…) | SCR-04, SCR-09 | — |
| FR-SCH-002 | Booking shows slots in the viewer's time zone and sends a standards-compliant calendar invite (.ics) carrying… | US-SCH-01 | 5 (AC-SCH-01.1…) | SCR-09 | — |
| FR-SCH-003 | Double-booking is blocked in the database, not only in the application. | US-SCH-01 | 5 (AC-SCH-01.1…) | SCR-09 | — |
| FR-SCH-004 | For a team, a slot is offered only if the team lead and at least 60% of members are free. | US-SCH-03 | 4 (AC-SCH-03.1…) | SCR-09 | — |
| FR-SCH-005 | Sessions can be rescheduled and cancelled by any participant; invites are updated or cancelled accordingly. | US-SCH-02 | 4 (AC-SCH-02.1…) | SCR-09, SCR-10 | — |
| FR-SCH-006 | A reminder is sent 24 hours before each session. | US-SCH-04 | 4 (AC-SCH-04.1…) | SCR-02, SCR-10 | — |
| FR-SCH-007 | Invites must display Accept/Decline in Outlook (classic, new, web, mobile) and Google Calendar. | US-SCH-01 | 5 (AC-SCH-01.1…) | SCR-09 | — |
| FR-SCH-008 | Invites carry names, times and a link only — no goal, note or topic text. | US-SCH-01 | 5 (AC-SCH-01.1…) | SCR-09 | — |
| FR-SCH-009 | The Teams link is a configured static or per-pair meeting URL until Graph integration (L2). | — | — | — | — |
| FR-SES-001 | Session states: scheduled · completed · cancelled · no-show. | US-SCH-02, US-SES-03 | 9 (AC-SCH-02.1…) | SCR-09, SCR-10 | — |
| FR-SES-002 | Each session has a before / during / after workspace (agenda, notes, decisions, actions). | US-SES-01 | 4 (AC-SES-01.1…) | SCR-10 | — |
| FR-SES-003 | Session notes, decisions and reflections are readable only by members of the relationship; private notes are… | US-SES-01, US-SES-02, US-RPT-01 | 14 (AC-SES-01.1…) | SCR-10, SCR-13 | — |
| FR-SES-004 | Notes autosave. | US-SES-02 | 4 (AC-SES-02.1…) | SCR-10 | — |
| FR-SES-005 | Actions have an owner and due date; in Leadership an action records a difficulty rating. | US-GOL-03, US-SES-03 | 10 (AC-GOL-03.1…) | SCR-10, SCR-11 | — |
| FR-SES-006 | A resource library is seeded from the leadership training deck (difficult mentee types, active listening, par… | US-SES-05 | 4 (AC-SES-05.1…) | SCR-10 | — |
| FR-SES-007 | After a session, the usefulness rating (1–5) is recorded privately; the PM sees only aggregates meeting the r… | US-SES-03, US-SES-04 | 10 (AC-SES-03.1…) | SCR-10, SCR-14 | — |
| FR-SES-008 | File attachments are disabled until storage and antivirus scanning are approved. | — | — | — | — |
| FR-GOL-001 | Goal states: draft · active · achieved · dropped. | US-GOL-01, US-GOL-03 | 9 (AC-GOL-01.1…) | SCR-11 | — |
| FR-GOL-002 | Goals have milestones and actions. | US-GOL-02, US-GOL-03 | 9 (AC-GOL-02.1…) | SCR-11 | — |
| FR-GOL-003 | Leadership uses a 3-goal SMART template with tasks. | US-GOL-02 | 4 (AC-GOL-02.1…) | SCR-11 | — |
| FR-GOL-004 | SparkLab uses phase milestones: develop, design, test. | US-GOL-04 | 3 (AC-GOL-04.1…) | SCR-11 | — |
| FR-GOL-005 | Goal visibility is per goal; only tags and shared goals feed matching. | US-GOL-01 | 4 (AC-GOL-01.1…) | SCR-11 | — |
| FR-GOL-006 | Goals can carry over to a new mentor on rematch if the mentee ticks them. | US-MAT-07 | 4 (AC-MAT-07.1…) | SCR-08 | — |
| FR-GOL-007 | A Leadership relationship cannot be marked completed with fewer than 3 goals unless the PM records a reason. | US-GOL-02 | 4 (AC-GOL-02.1…) | SCR-11 | — |
| FR-RPT-001 | Progress reports are structured, versioned, and go to the PM and the mentee. Session notes, reflections and m… | US-RPT-01, US-RPT-02 | 10 (AC-RPT-01.1…) | SCR-01, SCR-13 | — |
| FR-RPT-002 | Report states: due → submitted (one amendment allowed) · waived by the PM with a reason. | US-RPT-01 | 6 (AC-RPT-01.1…) | SCR-13 | — |
| FR-RPT-003 | Reports are mandatory in Leadership (monthly + final) and SparkLab (per phase); optional and off by default i… | US-GOL-04, US-RPT-01, US-PRG-05 | 14 (AC-GOL-04.1…) | SCR-11, SCR-13, SCR-20, SCR-22 | — |
| FR-RPT-004 | The PM exports the final-evaluation pack to the configured sponsors; every export is logged with its recipien… | — | — | — | — |
| FR-RPT-005 | Mentees are told who will see the pack at enrolment and again on the final report. | US-RPT-02 | 4 (AC-RPT-02.1…) | SCR-01, SCR-13 | — |
| FR-RPT-006 | Org admins read reports only if they also hold a PM role on that programme. | US-RPT-02 | 4 (AC-RPT-02.1…) | SCR-01, SCR-13 | — |
| FR-RPT-007 | Line managers have no access to any report. | US-RPT-02 | 4 (AC-RPT-02.1…) | SCR-01, SCR-13 | — |
| FR-RPT-008 | Reports autosave. | US-RPT-01 | 6 (AC-RPT-01.1…) | SCR-13 | — |
| FR-RPT-009 | The sponsor pack is composed only from the final report and programme-level result fields (see [domain model… | — | — | — | — |
| FR-HLT-001 | A 3-question check-in follows each session. | US-SES-04 | 5 (AC-SES-04.1…) | SCR-14 | — |
| FR-HLT-002 | The "I'd like support" check-in flag is routed to the PM. | US-SES-04, US-HLT-03 | 10 (AC-SES-04.1…) | SCR-14, SCR-19 | — |
| FR-HLT-003 | "Report a concern" is routed to the safeguarding contact — never the PM — with the org admin as fallback. | US-HLT-01 | 5 (AC-HLT-01.1…) | SCR-15 | — |
| FR-HLT-004 | Concerns are readable only by safeguarding (and the fallback admin when the contact is unset or conflicted). | US-HLT-01 | 5 (AC-HLT-01.1…) | SCR-15 | — |
| FR-HLT-005 | Relationship health is computed by the five rules I1, I2, A2, A4, A5 (see [domain model §6](../05-domain-mode… | US-HLT-02 | 5 (AC-HLT-02.1…) | SCR-19 | — |
| FR-HLT-006 | The PM sees a "Where should I intervene?" list in a fixed priority order (see [domain model §6.3](../05-domai… | US-ADM-09, US-HLT-03 | 9 (AC-ADM-09.1…) | SCR-19 | — |
| FR-HLT-007 | The dashboard and background jobs see only activity timestamps and statuses, never content. | US-HLT-02 | 5 (AC-HLT-02.1…) | SCR-19 | — |
| FR-HLT-008 | Aggregated feedback is hidden when fewer than 5 respondents. | US-SES-04, US-HLT-02, US-ADM-12 | 15 (AC-SES-04.1…) | SCR-14, SCR-19, SCR-27 | — |
| FR-HLT-009 | Every chart has a table view. | US-HLT-02, US-ADM-12, US-ADM-13 | 16 (AC-HLT-02.1…) | SCR-19, SCR-27 | — |
| FR-HLT-010 | Success metrics (G1–G6) are computed from the platform's own records. No third-party analytics. | US-HLT-02 | 5 (AC-HLT-02.1…) | SCR-19 | — |
| FR-HLT-011 | The fairness view in the MVP shows exclusion counts and the override log only. | US-ADM-02 | 5 (AC-ADM-02.1…) | SCR-23 | — |
| FR-MSG-001 | Text-only messaging between members of a relationship or team. No real-time chat, attachments or push in the… | US-MSG-01 | 4 (AC-MSG-01.1…) | SCR-12 | — |
| FR-MSG-002 | Messages are readable only by relationship members; no admin read path exists. | US-MSG-01 | 4 (AC-MSG-01.1…) | SCR-12 | — |
| FR-MSG-003 | Notifications are delivered by email and in-app according to [the catalogue](notification-catalogue.md). | US-MSG-02 | 4 (AC-MSG-02.1…) | SCR-18 | — |
| FR-MSG-004 | A notification stores ids only and renders its text at display time in the recipient's language. | US-MSG-02 | 4 (AC-MSG-02.1…) | SCR-18 | — |
| FR-MSG-005 | Emails, notifications and invites contain names and links only — no goal text, note text, concern text or dec… | US-MAT-03, US-HLT-01, US-ADM-17, US-ADM-18 | 21 (AC-MAT-03.1…) | SCR-06, SCR-15, SCR-30, SCR-31 | — |
| FR-MSG-006 | Every link in an email opens a page; any change requires a click on that page. | US-SCH-04 | 4 (AC-SCH-04.1…) | SCR-02, SCR-10 | — |
| FR-MSG-007 | Users can set notification preferences for non-critical categories; critical categories (see catalogue) canno… | US-MSG-02 | 4 (AC-MSG-02.1…) | SCR-18 | — |
| FR-MSG-008 | Email is sent from a dedicated subdomain with SPF, DKIM and DMARC. | US-ADM-06 | 5 (AC-ADM-06.1…) | SCR-25 | — |
| FR-MSG-009 | Reminder and nudge lead times (C-003, C-153 … C-157) and session timings (C-158, C-159) are admin-managed set… | US-PRG-03 | 5 (AC-PRG-03.1…) | SCR-20 | — |
| FR-AIA-001 | Exactly two opt-in assistants at launch: SMART-goal drafting and session-agenda drafting. | US-AIA-01, US-AIA-02 | 9 (AC-AIA-01.1…) | SCR-10, SCR-11 | — |
| FR-AIA-002 | An assistant runs only if all four allow it: the org kill switch, the per-assistant flag, the programme flag… | US-AIA-01, US-AIA-02, US-PRG-05 | 14 (AC-AIA-01.1…) | SCR-10, SCR-11, SCR-20, SCR-22 | — |
| FR-AIA-003 | AI only suggests; nothing is saved until the user accepts. | US-AIA-01, US-AIA-02 | 9 (AC-AIA-01.1…) | SCR-10, SCR-11 | — |
| FR-AIA-004 | The assistant receives only the requester's own text — no other person's data, notes or messages. | US-AIA-01, US-AIA-02 | 9 (AC-AIA-01.1…) | SCR-10, SCR-11 | — |
| FR-AIA-005 | Use is logged (who, when, assistant, outcome) without the text. | US-AIA-01 | 5 (AC-AIA-01.1…) | SCR-11 | — |
| FR-AIA-006 | Admin-triggered machine translation of admin-written content is item by item, under the same kill switch, off… | — | — | — | — |
| FR-AIA-007 | Prompt-injection tests are part of the release gate. | — | — | — | — |
| FR-AIA-008 | AI is never used in matching, vetting scores, health rules or reports. | — | — | — | — |
| FR-PRV-001 | The audit log is append-only and records ids, statuses and dates, never free text. | US-ADM-01, US-ADM-22 | 11 (AC-ADM-01.1…) | SCR-23, SCR-28 | — |
| FR-PRV-002 | Application logs carry ids and error codes, never personal or free text. | — | — | — | — |
| FR-PRV-003 | Retention follows [constants §7](constants.md): relationship content 12 months after close; structured record… | US-ADM-04 | 4 (AC-ADM-04.1…) | SCR-24 | — |
| FR-PRV-004 | A user can export their personal data (including their own item-level assessment scores) and request erasure/… | US-PRV-01, US-ADM-03 | 11 (AC-PRV-01.1…) | SCR-17, SCR-24 | — |
| FR-PRV-005 | Before the self-service flow (S13) exists, a documented manual data-request procedure is a pilot gate. | US-PRV-01, US-ADM-03, US-ADM-10 | 16 (AC-PRV-01.1…) | SCR-17, SCR-24, SCR-26 | — |
| FR-PRV-006 | The interface is available in EN, AZ and RU; layouts allow text up to 35% longer than English. | US-TEN-02, US-SES-05, US-ADM-17 | 13 (AC-TEN-02.1…) | SCR-03, SCR-10, SCR-31 | — |
| FR-PRV-007 | Dates use the 24-hour clock; weeks start on Monday; Russian copy uses gender-neutral phrasing. | US-TEN-02 | 4 (AC-TEN-02.1…) | SCR-03 | — |
| FR-PRV-008 | The product meets WCAG 2.2 AA; every admin action works at 320 px and 400% zoom; status is never conveyed by… | US-ADM-23 | 5 (AC-ADM-23.1…) | SCR-19, SCR-28 | — |
| FR-PRV-009 | Consents, data-subject requests and exports are recorded. | US-TEN-03, US-PRV-01, US-ADM-04 | 13 (AC-TEN-03.1…) | SCR-01, SCR-17, SCR-24 | — |
| FR-PRV-010 | Fonts: Manrope with Noto Sans fallback (Manrope lacks capital Ə). | US-TEN-05 | 5 (AC-TEN-05.1…) | SCR-22 | — |
| FR-PRV-011 | The platform is hosted on Render (EU) with S3-compatible storage. IT/Legal data-residency sign-off must be re… | — | — | — | — |
| FR-HOM-001 | Home always answers "What should I do next?" with one main card chosen from the fixed priority list in [domai… | US-HOME-01 | 5 (AC-HOME-01.1…) | SCR-02 | — |
| FR-HOM-002 | Up to two further applicable items appear as "also due" (C-029); if nothing applies Home shows "You're up to… | US-HOME-01 | 5 (AC-HOME-01.1…) | SCR-02 | — |
| FR-HOM-003 | Card selection is a pure function of the user's state; a card is never produced for an object the user may no… | US-HOME-01 | 5 (AC-HOME-01.1…) | SCR-02 | — |
| FR-ADM-001 | The *Manage* area extends the Plan's navigation (Dashboard · Programmes · People · Vetting · Matching · Relat… | — | — | — | — |
| FR-ADM-002 | Admin Home shows KPIs against targets, relationship health, the "Where should I intervene?" list and the admi… | US-HLT-02 | 5 (AC-HLT-02.1…) | SCR-19 | — |
| FR-ADM-003 | What-if impact preview: before saving matching settings on a programme, the admin can re-run the engine read-… | US-PRG-02 | 6 (AC-PRG-02.1…) | SCR-20, SCR-21 | — |
| FR-ADM-004 | Settings version diff: any two settings versions can be compared side by side, showing every changed value, w… | US-PRG-04 | 6 (AC-PRG-04.1…) | SCR-20 | — |
| FR-ADM-005 | Feature flags per organisation and per programme (AI assistants individually, attachments, Open mentoring, op… | US-PRG-05 | 5 (AC-PRG-05.1…) | SCR-20, SCR-22 | — |
| FR-ADM-006 | Export, import and clone settings: a programme's settings can be exported to a file and imported or cloned in… | US-PRG-06 | 5 (AC-PRG-06.1…) | SCR-20 | — |
| FR-ADM-007 | Audit log search with filters (actor, action, programme, date) and CSV export; entries hold ids and statuses… | US-ADM-01 | 6 (AC-ADM-01.1…) | SCR-23 | — |
| FR-ADM-008 | Override and exclusion log: every PM override with its reason (admin-visible) and exclusion counts per progra… | US-ADM-02 | 5 (AC-ADM-02.1…) | SCR-23 | — |
| FR-ADM-009 | Data-request queue for export and erasure requests with status, response target, and a manual-procedure check… | US-ADM-03 | 6 (AC-ADM-03.1…) | SCR-24 | — |
| FR-ADM-010 | Consent and retention view: who accepted which notice version; retention job runs, counts and next run. | US-ADM-04 | 4 (AC-ADM-04.1…) | SCR-24 | — |
| FR-ADM-011 | Job queue viewer for background jobs (email, reminders, retention, imports) with status, attempts, error code… | US-ADM-05 | 5 (AC-ADM-05.1…) | SCR-25 | — |
| FR-ADM-012 | Email delivery log: per notification, delivery status (queued, sent, deferred, bounced, failed) and error cod… | US-ADM-06 | 5 (AC-ADM-06.1…) | SCR-25 | — |
| FR-ADM-013 | Import run history with counts, dry-run versus confirmed, error-file download and the residency sign-off stat… | US-ADM-07 | 5 (AC-ADM-07.1…) | SCR-25 | — |
| FR-ADM-014 | System status page: database, worker, mail sender, storage and migration status with last-checked time. | US-ADM-08 | 4 (AC-ADM-08.1…) | SCR-25 | — |
| FR-ADM-015 | Admin alert centre: one prioritised list of failed jobs, bounce spike, overdue or due-soon data requests, men… | US-ADM-09 | 4 (AC-ADM-09.1…) | SCR-19 | — |
| FR-ADM-016 | Pilot-gate checklist tracking the Leadership pilot gate: slices S0–S10, data-residency sign-off, named safegu… | US-ADM-10 | 5 (AC-ADM-10.1…) | SCR-26 | — |
| FR-ADM-017 | Programme funnel: enrolled → matched → first session → check-in → report, per cohort, with drop-off counts (a… | US-ADM-12 | 5 (AC-ADM-12.1…) | SCR-27 | — |
| FR-ADM-018 | Scheduled exports: weekly or monthly CSV/PDF summaries of aggregates delivered to chosen PMs as an authentica… | US-ADM-13 | 6 (AC-ADM-13.1…) | SCR-27 | — |
| FR-ADM-019 | Command palette (Ctrl+K / Cmd+K): jump to any programme, person, page or permitted action by typing; results… | US-ADM-14 | 6 (AC-ADM-14.1…) | SCR-34 | — |
| FR-ADM-020 | Bulk actions with preview: selecting many rows (invite, nominate, withdraw, send reminder) shows exactly what… | US-ADM-15 | 6 (AC-ADM-15.1…) | SCR-28 | — |
| FR-ADM-021 | Role and permission explorer: shows who holds which role and scope, and what each role can do, generated from… | US-ADM-16 | 5 (AC-ADM-16.1…) | SCR-29 | — |
| FR-ADM-022 | Email template preview: every notification can be previewed in EN, AZ and RU with synthetic sample data befor… | US-ADM-17 | 5 (AC-ADM-17.1…) | SCR-31 | — |
| FR-ADM-023 | Announcements: an admin posts a banner or message to a programme or the organisation for a date range; text-o… | US-ADM-18 | 5 (AC-ADM-18.1…) | SCR-30 | — |
| FR-ADM-024 | Four-eyes approval: residency sign-off, safeguarding-contact change, granting the org-admin role and bulk era… | US-ADM-19 | 6 (AC-ADM-19.1…) | SCR-29 | — |
| FR-ADM-025 | Session and device manager: every user with an admin role sees their own active sessions and can revoke them;… | US-ADM-20 | 5 (AC-ADM-20.1…) | SCR-32 | — |
| FR-ADM-026 | Tenant console (platform admin only): create and disable organisations, view per-organisation usage counts an… | US-ADM-21 | 6 (AC-ADM-21.1…) | SCR-33 | — |
| FR-ADM-027 | People directory with search, filters and participation status, and a permission-limited CSV export that is l… | US-ADM-15, US-ADM-22 | 11 (AC-ADM-15.1…) | SCR-28 | — |
| FR-ADM-028 | Limited brand/theme editor (org admin): logo and the brand tokens only; a change is rejected unless contrast… | US-TEN-05 | 5 (AC-TEN-05.1…) | SCR-22 | — |
| FR-ADM-029 | Admin screens offer light and dark themes with verified contrast, dense sortable tables with column chooser a… | US-ADM-23 | 5 (AC-ADM-23.1…) | SCR-19, SCR-28 | — |
| FR-ADM-030 | No admin view (including logs, exports, previews and alerts) shows notes, reflections, messages, concern text… | US-ADM-01 | 6 (AC-ADM-01.1…) | SCR-23 | — |

## 2. Stories

| Story | Title | Requirements | Screens | Slice | ACs |
|---|---|---|---|---|---|
| US-TEN-01 | Sign in with an emailed link | FR-TEN-003, FR-TEN-004, FR-TEN-005, FR-TEN-006, FR-TEN-007, FR-TEN-008 | SCR-01 | S1 | 6 |
| US-TEN-02 | Use the interface in my language and time zone | FR-TEN-013, FR-PRV-006, FR-PRV-007 | SCR-03 | S1 | 4 |
| US-TEN-03 | Give my consent and read the privacy notice | FR-TEN-014, FR-PRV-009 | SCR-01, SCR-17 | S1 | 4 |
| US-PRF-01 | Complete my profile | FR-PRF-002, FR-PRF-003, FR-PRF-004, FR-PRF-005, FR-PRF-009 | SCR-03 | S4 | 5 |
| US-PRF-02 | Control who sees each part of my profile | FR-PRF-001, FR-PRF-010, FR-MAT-006 | SCR-03 | S4 | 5 |
| US-PRF-03 | Set my availability | FR-PRF-007, FR-SCH-001 | SCR-04 | S4 | 4 |
| US-PRF-04 | Know whether I am recommendable as a mentor | FR-PRF-006, FR-VET-001, FR-MAT-005 | SCR-02, SCR-03 | S4 | 3 |
| US-VET-01 | Apply or accept a nomination to become a mentor | FR-VET-001, FR-VET-002, FR-VET-012 | SCR-16 | S5 | 5 |
| US-VET-02 | See the outcome of my application | FR-VET-009, FR-VET-008 | SCR-16 | S5 | 4 |
| US-GOL-01 | Set a goal (Open programme) | FR-GOL-001, FR-GOL-005, FR-PRF-008, FR-MAT-011 | SCR-11 | S4 | 4 |
| US-GOL-02 | Set three SMART goals (Leadership) | FR-GOL-003, FR-GOL-002, FR-GOL-007 | SCR-11 | S8 | 4 |
| US-GOL-03 | Track milestones and actions, and close a goal | FR-GOL-001, FR-GOL-002, FR-SES-005 | SCR-11 | S8 | 5 |
| US-GOL-04 | Follow phase milestones (SparkLab) | FR-GOL-004, FR-RPT-003 | SCR-11 | S8 | 3 |
| US-MAT-01 | See recommended mentors and why | FR-MAT-001, FR-MAT-003, FR-MAT-008, FR-MAT-010, FR-MAT-017 | SCR-05 | S11 | 5 |
| US-MAT-02 | Browse mentors | FR-MAT-008, FR-MAT-015, FR-PRF-011 | SCR-05, SCR-06 | S11 | 4 |
| US-MAT-03 | Request a mentor | FR-MAT-008, FR-REL-005, FR-MSG-005 | SCR-06 | S11 | 6 |
| US-MAT-04 | Answer a mentoring request (mentor) | FR-MAT-011, FR-MAT-014, FR-REL-005, FR-REL-007 | SCR-07 | S11 | 5 |
| US-MAT-05 | Accept a Leadership proposal | FR-REL-002, FR-REL-003, FR-MAT-012 | SCR-07 | S6 | 6 |
| US-MAT-06 | Accept a mentor for the team (SparkLab) | FR-REL-004, FR-MAT-016 | SCR-07 | S6 | 4 |
| US-MAT-07 | Ask for a different mentor (rematch) | FR-MAT-013, FR-REL-009, FR-GOL-006 | SCR-08 | S6 | 4 |
| US-REL-01 | See my mentoring relationships | FR-REL-001, FR-REL-008 | SCR-08 | S6 | 4 |
| US-REL-02 | Pause or leave a relationship | FR-REL-006 | SCR-08 | S6 | 5 |
| US-SCH-01 | Book a session | FR-SCH-001, FR-SCH-002, FR-SCH-003, FR-SCH-007, FR-SCH-008 | SCR-09 | S7 | 5 |
| US-SCH-02 | Reschedule or cancel | FR-SCH-005, FR-SES-001 | SCR-09, SCR-10 | S7 | 4 |
| US-SCH-03 | Book a session for a team | FR-SCH-004 | SCR-09 | S7 | 4 |
| US-SCH-04 | Be reminded before a session | FR-SCH-006, FR-MSG-006 | SCR-02, SCR-10 | S7 | 4 |
| US-SES-01 | Prepare for a session | FR-SES-002, FR-SES-003 | SCR-10 | S8 | 4 |
| US-SES-02 | Take notes during a session | FR-SES-003, FR-SES-004 | SCR-10 | S8 | 4 |
| US-SES-03 | Wrap up a session | FR-SES-001, FR-SES-005, FR-SES-007 | SCR-10 | S8 | 5 |
| US-SES-04 | Complete a check-in | FR-HLT-001, FR-HLT-002, FR-SES-007, FR-HLT-008 | SCR-14 | S9 | 5 |
| US-SES-05 | Use the mentoring resources | FR-SES-006, FR-PRV-006 | SCR-10 | S8 | 4 |
| US-RPT-01 | Write a progress report (mentor) | FR-RPT-001, FR-RPT-002, FR-RPT-003, FR-RPT-008, FR-SES-003 | SCR-13 | S9 | 6 |
| US-RPT-02 | Read my mentor's report and see who sees it (mentee) | FR-RPT-001, FR-RPT-005, FR-RPT-006, FR-RPT-007, FR-PRG-007 | SCR-13, SCR-01 | S9 | 4 |
| US-HLT-01 | Report a concern | FR-HLT-003, FR-HLT-004, FR-MSG-005 | SCR-15 | S9 | 5 |
| US-MSG-01 | Message my mentor, mentee or team | FR-MSG-001, FR-MSG-002 | SCR-12 | S8 | 4 |
| US-MSG-02 | See and control my notifications | FR-MSG-003, FR-MSG-004, FR-MSG-007 | SCR-18 | S3 | 4 |
| US-AIA-01 | Draft a SMART goal with AI help | FR-AIA-001, FR-AIA-002, FR-AIA-003, FR-AIA-004, FR-AIA-005 | SCR-11 | S12 | 5 |
| US-AIA-02 | Draft a session agenda with AI help | FR-AIA-001, FR-AIA-002, FR-AIA-003, FR-AIA-004 | SCR-10 | S12 | 4 |
| US-PRV-01 | Export my data and ask for erasure | FR-PRV-004, FR-PRV-005, FR-PRV-009, FR-VET-009 | SCR-17 | S13 | 5 |
| US-HOME-01 | See what I should do next | FR-HOM-001, FR-HOM-002, FR-HOM-003 | SCR-02 | S3 onwards (cards arrive with their sli… | 5 |
| US-PRG-01 | Set meeting cadence and mentor capacity | FR-PRG-010, FR-PRG-013, FR-PRG-014 | SCR-20 | S3 | 5 |
| US-PRG-02 | Tune matching settings with a what-if preview | FR-PRG-009, FR-PRG-013, FR-PRG-014, FR-PRG-015, FR-MAT-018, FR-ADM-003 | SCR-20, SCR-21 | S6 | 6 |
| US-PRG-03 | Configure timings, reminders and cool-offs | FR-MSG-009, FR-VET-013, FR-PRG-013 | SCR-20 | S3 | 5 |
| US-PRG-04 | Review history, compare versions, restore | FR-PRG-014, FR-PRG-016, FR-ADM-004 | SCR-20 | S3 | 6 |
| US-PRG-05 | Switch features on and off with feature flags | FR-ADM-005, FR-PRG-012, FR-AIA-002, FR-RPT-003 | SCR-20, SCR-22 | S3 (framework), flags land with their s… | 5 |
| US-PRG-06 | Export, import and clone settings; programme templates | FR-ADM-006, FR-PRG-003, FR-PRG-014 | SCR-20 | S3 | 5 |
| US-TEN-04 | Manage organisation sign-in and session security | FR-TEN-016, FR-TEN-008, FR-PRG-014 | SCR-22 | S1 | 5 |
| US-TEN-05 | Adjust logo and brand within safe limits | FR-ADM-028, FR-PRV-010 | SCR-22 | S1 (theme), editor with S3 | 5 |
| US-ADM-01 | Search the audit log and export it | FR-ADM-007, FR-PRV-001, FR-ADM-030 | SCR-23 | S13 (viewer; log itself from S1) | 6 |
| US-ADM-02 | Review overrides and exclusion counts | FR-ADM-008, FR-HLT-011, FR-MAT-002 | SCR-23 | S6 | 5 |
| US-ADM-03 | Work the data-request queue | FR-ADM-009, FR-PRV-004, FR-PRV-005 | SCR-24 | S13 (manual checklist from pilot gate) | 6 |
| US-ADM-04 | See consents and retention runs | FR-ADM-010, FR-PRV-003, FR-PRV-009 | SCR-24 | S13 | 4 |
| US-ADM-05 | Watch and retry background jobs | FR-ADM-011 | SCR-25 | S3 | 5 |
| US-ADM-06 | Check email delivery | FR-ADM-012, FR-MSG-008 | SCR-25 | S3 | 5 |
| US-ADM-07 | Review import runs | FR-ADM-013, FR-IMP-003, FR-IMP-007, FR-IMP-009, FR-IMP-010 | SCR-25 | S2 | 5 |
| US-ADM-08 | See system status | FR-ADM-014 | SCR-25 | S0 (basic) → S14 | 4 |
| US-ADM-09 | Work from one alert centre | FR-ADM-015, FR-HLT-006 | SCR-19 | S10 | 4 |
| US-ADM-10 | Track the pilot gate | FR-ADM-016, FR-IMP-009, FR-PRV-005 | SCR-26 | S10 | 5 |
| US-HLT-02 | See programme health and KPIs on the dashboard (Plan S10) | FR-ADM-002, FR-HLT-005, FR-HLT-007, FR-HLT-008, FR-HLT-009, FR-HLT-010 | SCR-19 | S10 | 5 |
| US-HLT-03 | Know where to intervene (Plan S10) | FR-HLT-006, FR-HLT-002 | SCR-19 | S10 | 5 |
| US-ADM-12 | See the programme funnel | FR-ADM-017, FR-HLT-008, FR-HLT-009 | SCR-27 | S10 | 5 |
| US-ADM-13 | Schedule summary exports | FR-ADM-018, FR-HLT-009 | SCR-27 | S10 | 6 |
| US-ADM-14 | Jump anywhere with the command palette | FR-ADM-019, FR-PRF-011 | SCR-34 | S3 (grows with each slice) | 6 |
| US-ADM-15 | Act on many rows with a preview | FR-ADM-020, FR-ADM-027 | SCR-28 | S3 | 6 |
| US-ADM-16 | Explore roles and permissions | FR-ADM-021, FR-TEN-010, FR-TEN-011 | SCR-29 | S1 | 5 |
| US-ADM-17 | Preview emails in all languages | FR-ADM-022, FR-MSG-005, FR-PRV-006 | SCR-31 | S3 | 5 |
| US-ADM-18 | Post announcements | FR-ADM-023, FR-MSG-005 | SCR-30 | S3 | 5 |
| US-ADM-19 | Require a second admin for sensitive actions | FR-ADM-024, FR-TEN-009, FR-IMP-009 | SCR-29 | S1 | 6 |
| US-ADM-20 | Manage my sessions and sign users out | FR-ADM-025, FR-TEN-009 | SCR-32 | S1 | 5 |
| US-ADM-21 | Operate the tenant console (platform admin) | FR-ADM-026, FR-TEN-001, FR-TEN-002 | SCR-33 | S1 | 6 |
| US-ADM-22 | Browse the people directory and export it | FR-ADM-027, FR-IMP-008, FR-PRV-001 | SCR-28 | S2 | 5 |
| US-ADM-23 | Work comfortably in any theme, density and screen size | FR-ADM-029, FR-PRV-008 | SCR-19, SCR-28 | S3 | 5 |

## 3. Screens

| Screen | Name | Stories |
|---|---|---|
| SCR-01 | Sign-in and first-run | US-TEN-01, US-TEN-03, US-RPT-02 |
| SCR-02 | Home | US-PRF-04, US-SCH-04, US-HOME-01 |
| SCR-03 | Profile and settings | US-TEN-02, US-PRF-01, US-PRF-02, US-PRF-04 |
| SCR-04 | Availability | US-PRF-03 |
| SCR-05 | Discover (Recommended / Browse) — plus Mentees and My Team variants | US-MAT-01, US-MAT-02 |
| SCR-06 | Mentor profile and request | US-MAT-02, US-MAT-03 |
| SCR-07 | Proposal or request response | US-MAT-04, US-MAT-05, US-MAT-06 |
| SCR-08 | My Mentoring (list and relationship workspace) | US-MAT-07, US-REL-01, US-REL-02 |
| SCR-09 | Book a session | US-SCH-01, US-SCH-02, US-SCH-03 |
| SCR-10 | Session workspace (Prepare / During / After) | US-SCH-02, US-SCH-04, US-SES-01, US-SES-02, US-SES-03, US-SES-05, US-AIA-02 |
| SCR-11 | Goals | US-GOL-01, US-GOL-02, US-GOL-03, US-GOL-04, US-AIA-01 |
| SCR-12 | Messages | US-MSG-01 |
| SCR-13 | Progress report | US-RPT-01, US-RPT-02 |
| SCR-14 | Check-in | US-SES-04 |
| SCR-15 | Report a concern | US-HLT-01 |
| SCR-16 | Mentor application | US-VET-01, US-VET-02 |
| SCR-17 | Privacy and data | US-TEN-03, US-PRV-01 |
| SCR-18 | Notifications | US-MSG-02 |
| SCR-19 | Admin home (Dashboard, Intervene list, Alert centre) | US-ADM-09, US-HLT-02, US-HLT-03, US-ADM-23 |
| SCR-20 | Programme settings | US-PRG-01, US-PRG-02, US-PRG-03, US-PRG-04, US-PRG-05, US-PRG-06 |
| SCR-21 | Matching what-if preview | US-PRG-02 |
| SCR-22 | Organisation settings | US-PRG-05, US-TEN-04, US-TEN-05 |
| SCR-23 | Audit log and override log | US-ADM-01, US-ADM-02 |
| SCR-24 | Data requests, consent and retention | US-ADM-03, US-ADM-04 |
| SCR-25 | Operations (jobs, email delivery, imports, status) | US-ADM-05, US-ADM-06, US-ADM-07, US-ADM-08 |
| SCR-26 | Pilot-gate checklist | US-ADM-10 |
| SCR-27 | Insights (funnel and scheduled exports) | US-ADM-12, US-ADM-13 |
| SCR-28 | People directory and bulk actions | US-ADM-15, US-ADM-22, US-ADM-23 |
| SCR-29 | Roles, permissions and approvals | US-ADM-16, US-ADM-19 |
| SCR-30 | Announcements | US-ADM-18 |
| SCR-31 | Email template preview | US-ADM-17 |
| SCR-32 | My sessions and devices | US-ADM-20 |
| SCR-33 | Tenant console (platform admin) | US-ADM-21 |
| SCR-34 | Command palette | US-ADM-14 |

## 4. Requirements without a story yet

Expected: Batch 3 part B (programme creation, people import admin, vetting, matching admin, safeguarding, content), system rules enforced by invariants, and NFR-like requirements. Each must be covered by a story, an invariant test, or an NFR check before its slice's gate.

- **TEN** (Tenancy, sign-in and roles): FR-TEN-012, FR-TEN-015
- **IMP** (People import): FR-IMP-001, FR-IMP-002, FR-IMP-004, FR-IMP-005, FR-IMP-006, FR-IMP-011
- **PRG** (Programmes): FR-PRG-001, FR-PRG-002, FR-PRG-004, FR-PRG-005, FR-PRG-006, FR-PRG-008, FR-PRG-011
- **VET** (Mentor vetting): FR-VET-003, FR-VET-004, FR-VET-005, FR-VET-006, FR-VET-007, FR-VET-010, FR-VET-011
- **MAT** (Matching): FR-MAT-004, FR-MAT-007, FR-MAT-009
- **SCH** (Scheduling): FR-SCH-009
- **SES** (Sessions and resources): FR-SES-008
- **RPT** (Reports and the sponsor pack): FR-RPT-004, FR-RPT-009
- **AIA** (AI assistants): FR-AIA-006, FR-AIA-007, FR-AIA-008
- **PRV** (Privacy, internationalisation, accessibility): FR-PRV-002, FR-PRV-011
- **ADM** (Advanced admin panel): FR-ADM-001

