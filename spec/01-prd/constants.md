# Constants table

**Single source of truth for every number, threshold and default in the specification.** Stories, acceptance criteria, code and tests must reference a constant by its ID (`C-014`), never restate its value. The implementation reads these from one configuration module, and a test fails if the module and this table disagree.

**Status column**

| Status | Meaning |
|---|---|
| **FIXED** | Stated as a decision or invariant in the Plan; changing it needs a decision-log entry |
| **DEFAULT** | Stated in the Plan as a default; configurable per programme/organisation where noted |
| **PROPOSED** | Not in the Plan. The value is the **starting default** of an admin-managed setting (see §0); each has an entry in [open-questions-batch1.md](open-questions-batch1.md) |

---

## 0. Admin-configurable settings

**Decision (2 October 2026): every PROPOSED value below is an *admin-managed setting*, not a hard-coded constant.** The value in the table is only the **starting default** installed when a programme or organisation is created. Administrators change it in the product (no code release), within the bounds below. FIXED values and values stated as decisions in the Plan stay fixed; changing them needs a decision-log entry.

| Setting group | Constants | Scope | Editable by | Bounds (enforced on save) |
|---|---|---|---|---|
| Meeting cadence | C-020 | programme | PM (own programme), org admin | 1–90 days per programme; drives health rules (C-014) |
| Mentor capacity | C-021 | programme (default and maximum); each mentor sets their own value up to the maximum | PM, org admin; mentor (own value) | default 1–10, maximum ≥ default and ≤ 20; SparkLab counts teams (C-022 stays fixed) |
| Open-request reminder | C-003 | programme | PM, org admin | strictly before expiry C-002; ≥ 1 day |
| Matching factors | C-050, C-051, C-052 | programme | PM, org admin | depth factors in (0, 1], ordered working ≤ advanced ≤ expert; primary multiplier integer 1–5; parent/child credit in [0, 1] |
| Matching sub-scores | C-053, C-054, C-055, C-056 | programme | PM, org admin | availability saturation integer 1–7; every band score in [0, 1]; career bands must cover every gap value without overlap; language scores in [0, 1] with fluent ≥ working |
| Scoring and explanation thresholds | C-057, C-059, C-060 | programme | PM, org admin | neutral score in [0, 1]; reason threshold in (0, 1]; "applies to nearly everyone" cut-off in (0, 1] |
| Matching weights | C-070, C-071, C-072 (per programme) | programme | PM, org admin | non-negative integers totalling exactly 100 |
| Exclusion switches | C-083 … C-092 (never C-080 … C-082) | programme | PM, org admin | the three "Never" exclusions cannot be switched off |
| Matching timing | C-150 (availability horizon) | programme | PM, org admin | 1–12 weeks |
| Reasons and cool-offs | C-151 (re-application cool-off), C-152 (minimum override/decision reason length) | programme / organisation | PM, org admin | cool-off 0–730 days; reason length 0–200 characters |
| Reminder and nudge timings | C-153 … C-157 | programme | PM, org admin | each must be before the event it relates to |
| Session timing | C-158 (no-show grace), C-159 (Home "about to start" window) | organisation | org admin | grace 5–60 minutes; window 5–60 minutes |
| Sign-in security | C-041, C-042, C-046 | organisation | org admin, within platform minimums | link lifetime 5–30 minutes; code attempts 3–10; request limits may not be set so low that C-045 fails |
| Session lifetime | C-043 | organisation | org admin, within platform maximums | idle 15 min–24 h; absolute 1–90 days |
| Admin operations | C-160, C-164, C-165, C-166, C-167 | organisation | org admin | approval lifetime 1–30 days; announcement length 100–2,000 characters; bounce threshold 1–50% with at least 10 sends; response target 1–90 days; due-soon lead 1–30 days |

**Not admin-settings** (stay fixed or are operational targets): session-usefulness scale C-033 (1–5; success metric depends on it), score precision C-061 (technical), engine version format C-062, reliability targets C-140–C-142 (set by IT with the hosting plan), operational log retention C-161 and C-162 (platform-wide, Legal to confirm), the minimum number of org admins C-163, export frequencies C-168, and every FIXED/DEFAULT value taken from the Plan decisions (e.g. C-001, C-004, C-023, C-025, C-027, C-028, C-100…C-104).

**Rules for every admin setting**

1. **Validated.** A value outside its bounds is rejected with the reason, and nothing is saved. A set of values is validated as a whole (e.g. weights total 100).
2. **Versioned.** Saving creates a new immutable **settings version** for the programme or organisation; the previous version is kept. The history shows who changed what and when, and can **restore a previous version** (which saves as a new version).
3. **Never rewrites the past.** A change applies from the next action that reads it. Matches already made keep the settings version they were scored with (INV-7.4); health flags are recomputed with the current cadence; reminders already scheduled keep their time.
4. **Audited without free text.** The audit log records who, which setting group, the programme and the new settings-version id — never free text (INV-3.3).
5. **Authorised.** Only the roles in the table; a PM can edit only programmes in their scope (INV-4.5). Participants, mentors, assessors, content managers and safeguarding cannot read or edit settings; participants see the *effects* (e.g. their rules) but not the weights or factors.
6. **Defaults are restorable.** "Restore defaults" returns a group to the starting values in this document.
7. **Live consistency check.** A programme cannot be activated unless all its settings are valid; changing settings on an active programme requires confirmation showing a plain-language impact summary (see US-PRG-02).
8. **Test.** The application's default-settings module is asserted equal to the defaults in this document, and every setting has a bounds test (NFR-MNT-004).

---

## 1. Time windows and deadlines

| ID | Constant | Value | Scope | Status | Source |
|---|---|---|---|---|---|
| C-001 | Leadership proposal acceptance window | 7 days | Leadership, SparkLab | FIXED | D13 |
| C-002 | Open request expiry | 7 days | Open | DEFAULT | §7 |
| C-003 | Open request reminder (one only) | at 4 days after request (3 days left) | Open | PROPOSED | §7 says "one reminder", no timing |
| C-004 | Decline cooldown for the same pair | 90 days | all | DEFAULT | §7 |
| C-005 | "Accepted, no session yet" — health rule I2 | 21 days after acceptance | all | DEFAULT | §6 |
| C-006 | "No first session" — intervene-list item 3 | 14 days after match acceptance | all | DEFAULT | §6 |
| C-007 | Cancellation / no-show window — health rule A4 | 60 days | all | DEFAULT | §6 |
| C-008 | Cancellations/no-shows to trigger A4 | 2 or more | all | DEFAULT | §6 |
| C-009 | Report overdue grace — health rule A5 | more than 7 days past due date | all | DEFAULT | §6 |
| C-010 | Session reminder lead time | 24 hours before start | all | FIXED | S7 |
| C-011 | "Prepare for session" Home card window | within 24 hours before start | all | FIXED | §8 |
| C-012 | Pilot duration, Leadership W1 | 12 weeks | pilot | FIXED | §12 |
| C-013 | Leadership minimum relationship length | 3 months | Leadership | FIXED | §2 |
| C-014 | Inactivity multiplier — health rule I1 | 2 × programme cadence with no session | all | DEFAULT | §6 |

## 2. Cadence, capacity and counts

| ID | Constant | Value | Scope | Status | Source |
|---|---|---|---|---|---|
| C-020 | Meeting cadence | Leadership 14 days · SparkLab 14 days · Open 30 days | per programme | PROPOSED | §6 says thresholds are relative to cadence but gives no values |
| C-021 | Mentor capacity default | Leadership 2 mentees · Open 3 mentees · SparkLab 2 teams | per programme | SparkLab DEFAULT (§7); others PROPOSED | §7 |
| C-022 | Capacity units per SparkLab team | 1 | SparkLab | FIXED | §7 |
| C-023 | Open: maximum open requests per mentee | 2 | Open | FIXED | §7 |
| C-024 | Open: recommended list size | 5 | Open | FIXED | §7 |
| C-025 | Leadership: SMART goals per mentee | 3 | Leadership | FIXED | §2 |
| C-026 | Assessors per application | default 1, maximum 2; scores averaged | vetting | DEFAULT | §6 |
| C-027 | Team slot quorum | team lead **and** ≥ 60% of members free | SparkLab | FIXED | §7 |
| C-028 | Aggregated feedback minimum respondents | 5 | all | FIXED | Principle 3 |
| C-029 | Home screen: also-due items shown | up to 2 (plus 1 main card) | all | FIXED | §8 |
| C-030 | Check-in questions | 3 | all | FIXED | S9 |
| C-031 | Progress report amendments | 1 | reports | FIXED | §6 |
| C-032 | Mentor minimum profile | ≥ 1 topic **and** ≥ 1 expertise area | all | FIXED | §7 |
| C-033 | Session usefulness rating scale | integer 1–5 | all | PROPOSED | §12 gives "≥ 4 / 5" |
| C-034 | Maximum reasons shown in an explanation | 3 | all | FIXED | §7 |

## 3. Sign-in and security

| ID | Constant | Value | Status | Source |
|---|---|---|---|---|
| C-040 | Sign-in code length | 6 digits | DEFAULT | §4 |
| C-041 | Magic-link and code lifetime | 15 minutes, single use | PROPOSED | — |
| C-042 | Code attempts before the request is voided | 5 | PROPOSED | — |
| C-043 | Session idle timeout / absolute lifetime | 8 hours idle / 30 days absolute | PROPOSED | — |
| C-044 | Admin TOTP requirement | required for org admin and platform admin until Entra ID is live | DEFAULT | §4 |
| C-045 | Rate-limit design target | 100 colleagues behind one IP can all sign in | FIXED | §11 |
| C-046 | Per-identity sign-in request limit | 5 per 15 minutes per email; 30 per 15 minutes per browser | PROPOSED | — |

## 4. Matching constants

Algorithm: [matching-spec.md](matching-spec.md). Values below are consumed by the scorer.

| ID | Constant | Value | Status | Source |
|---|---|---|---|---|
| C-050 | Expertise depth factors | working 0.50 · advanced 0.75 · expert 1.00 | PROPOSED | §7 names the levels only |
| C-051 | Primary-goal weight multiplier | 2 (non-primary = 1) | PROPOSED | §7 says "weighted higher" |
| C-052 | Parent/child taxonomy partial-credit | 0.5 | PROPOSED | — |
| C-053 | Availability saturation | 3 overlapping days per week = full score | PROPOSED | §7 example shows "3 days" |
| C-054 | Career-level band scores | ahead 1.00 · peer 0.60 · far 0.40 · mentor-junior 0.30 | PROPOSED | §7 names bands only |
| C-055 | Career-level band definition | ahead = mentor 1–2 buckets above · peer = same bucket · far = 3+ buckets above | PROPOSED | — |
| C-056 | Language sub-scores | both fluent 1.00 · otherwise working 0.70 | PROPOSED | — |
| C-057 | Neutral score for a missing mentee answer | 0.50 | PROPOSED | §7 says "neutral" |
| C-058 | Score for a missing mentor answer | 0.00 | FIXED | §7 |
| C-059 | Reason inclusion threshold (criterion sub-score) | ≥ 0.60 | PROPOSED | — |
| C-060 | "Applies to nearly every candidate" cut-off | reason true for ≥ 90% of the scored candidate pool is dropped | PROPOSED | §7 gives the rule, not a number |
| C-061 | Score precision | 2 decimals stored; ranking compares stored values | PROPOSED | — |
| C-062 | Engine version format | semantic version string stored with each match | FIXED | Principle 7 |

## 5. Matching weights (per programme; each column totals 100)

| Criterion | Open | Leadership | SparkLab | Status |
|---|---|---|---|---|
| Goal alignment | 30 | 25 | 35 | DEFAULT |
| Expertise | 25 | 25 | 30 | DEFAULT |
| Availability | 15 | 5 | 15 | DEFAULT |
| Career level | 10 | 15 | 10 | DEFAULT |
| Language | 10 | 10 | 10 | DEFAULT |
| Interests | 5 | 0 | 0 | DEFAULT |
| Other (compatibility questionnaire) | 5 | 20 | 0 | DEFAULT |
| **Total** | **100** | **100** | **100** | — |

IDs: `C-070` (Open column), `C-071` (Leadership), `C-072` (SparkLab). Validation: a programme cannot be activated unless its weights are non-negative integers totalling 100 (FR-PRG-009).

## 6. Exclusion switches (defaults)

| ID | Exclusion | Overridable | Open | Leadership | SparkLab | Source |
|---|---|---|---|---|---|---|
| C-080 | Same person | Never | on | on | on | §7 |
| C-081 | Blocked | Never | on | on | on | §7 |
| C-082 | Mentor not approved | Never | on | on | on | §7 |
| C-083 | Eligibility rule | PM | on | on | on | §7 |
| C-084 | Existing or previous incompatible relationship | PM | on | on | on | §7 |
| C-085 | Declined in last 90 days (C-004) | PM | on | on | on | §7 |
| C-086 | Reporting line (direct manager, skip-level) | PM | on | on | on | §7 |
| C-087 | Reporting line — peers sharing a manager | PM | off | **on** | off | §7 "In Leadership…" |
| C-088 | Mentor junior to mentee | PM | off | **on** | off | §4 |
| C-089 | No common language | PM | on | on | on | §7 |
| C-090 | No availability | PM | on | on | on | §7 |
| C-091 | Capacity full | PM | on | on | on | §7 |
| C-092 | Mentee already matched | PM | on | on | on | §7 |

## 7. Retention (pending Legal sign-off)

| ID | Data | Kept for | Then |
|---|---|---|---|
| C-100 | Relationship content (notes, reflections, messages) | 12 months after close | deleted |
| C-101 | Structured records | 36 months | anonymised |
| C-102 | Assessments | 24 months | deleted |
| C-103 | Audit log | 24 months | deleted |
| C-104 | Raw import rows | 30 days | deleted |

All DEFAULT; source Plan §6.

## 8. Localisation and brand

| ID | Constant | Value | Status | Source |
|---|---|---|---|---|
| C-110 | Default time zone | Asia/Baku | FIXED | D8 |
| C-111 | Clock / week start | 24-hour / Monday | FIXED | §8 |
| C-112 | Text expansion allowance | 35% over English | FIXED | §8 |
| C-113 | Locales | `en`, `az`, `ru` | FIXED | D8 |
| C-114 | Brand tokens | font Manrope (fallback Noto Sans) · primary `#0F3C76` · leaf green `#356D1B` · canvas `#E7EEF8` · radius 4 px · border 2 px | DEFAULT | §4 |
| C-115 | Search folding pairs | ə/e ı/i ö/o ü/u ç/c ş/s ğ/g ё/е | FIXED | §8 |

## 9. Performance and scale targets

| ID | Target | Value | Source |
|---|---|---|---|
| C-120 | Reference scale | 2,000 users; 500-participant programme | §11 |
| C-121 | Page response, 95th percentile | < 0.5 s | §11 |
| C-122 | Search response, 95th percentile | < 0.3 s | §11 |
| C-123 | Reminder throughput | 1,000 reminders in < 60 s | §11 |

## 10. Pilot and scale-up criteria

| ID | Metric | Target | Source |
|---|---|---|---|
| C-130 | Pairs meeting within 14 days of matching | ≥ 80% | §12 |
| C-131 | Sessions with a check-in | ≥ 70% | §12 |
| C-132 | Median session usefulness | ≥ 4 / 5 | §12 |
| C-133 | Successful sign-ins | ≥ 95% | §12 |
| C-134 | Privacy incidents | 0 | §12 |
| C-135 | PM time | ≤ 2 hours / week | §12 |
| C-136 | Leadership pilot size | 12–15 pairs | §12 |
| C-137 | SparkLab pilot size | 3–4 teams | §12 |
| C-138 | Open pilot size | 1–2 departments | §12 |

## 11. Reliability (proposed)

| ID | Constant | Value | Status |
|---|---|---|---|
| C-140 | Recovery point objective | ≤ 5 minutes (point-in-time recovery) | PROPOSED |
| C-141 | Recovery time objective | ≤ 4 hours | PROPOSED |
| C-142 | Backup-restore drill | before release candidate (S14) and then each 6 months | PROPOSED |

---

## 12. Admin-managed timing and behaviour parameters (introduced with §0)

Values that earlier appeared only in prose are now explicit settings so administrators can manage them.

| ID | Constant | Starting default | Scope | Status | Source |
|---|---|---|---|---|---|
| C-150 | Availability horizon for the `NO_AVAILABILITY` exclusion | 4 weeks from the match date | programme | PROPOSED | matching-spec §3 |
| C-151 | Cool-off before re-applying after a rejected or withdrawn mentor application | 180 days | programme | PROPOSED | domain model §4.1 |
| C-152 | Minimum length of an override or decision reason | 10 characters | programme | PROPOSED | matching-spec §3 |
| C-153 | Assessment reminder lead time | 3 days before due | programme | PROPOSED | N-023 |
| C-154 | Proposal reminder lead time | 2 days before deadline | programme | PROPOSED | N-036 |
| C-155 | Session wrap-up nudge | 2 hours after the session ends | programme | PROPOSED | N-054 |
| C-156 | "No goal set" nudge | 7 days after acceptance | programme | PROPOSED | N-062 |
| C-157 | Progress-report reminder lead time | 3 days before due | programme | PROPOSED | N-070 |
| C-158 | No-show grace period | 15 minutes after session start | organisation | PROPOSED | domain model §4.4 |
| C-159 | Home "session about to start" window | 15 minutes before start | organisation | PROPOSED | domain model §8 |

---

## 12a. Admin-panel parameters

| ID | Constant | Value | Scope | Status | Source |
|---|---|---|---|---|---|
| C-160 | Four-eyes approval request lifetime | 7 days | organisation | PROPOSED | FR-ADM-024 |
| C-161 | Email delivery log retention (status and error codes only) | 30 days | platform | PROPOSED | FR-ADM-012 |
| C-162 | Job history retention (status and error codes only) | 30 days | platform | PROPOSED | FR-ADM-011 |
| C-163 | Minimum org admins before any four-eyes action can run | 2 | organisation | FIXED | Decision 2 Oct 2026 |
| C-164 | Announcement maximum length | 600 characters, end date required | organisation | PROPOSED | FR-ADM-023 |
| C-165 | Email bounce-spike alert | ≥ 5% bounced of ≥ 20 sends within 24 hours | organisation | PROPOSED | FR-ADM-012 |
| C-166 | Data-request response target | 30 days from receipt (Legal to confirm) | organisation | PROPOSED | FR-ADM-009 |
| C-167 | Data-request "due soon" alert lead time | 7 days before the target | organisation | PROPOSED | FR-ADM-015 |
| C-168 | Scheduled-export frequencies | weekly or monthly | — | FIXED | FR-ADM-018 |

---

## 13. Integrity checks

These are enforced by `spec/tools/check_spec.py` and by a unit test in the application:

1. Each weights column in §5 sums to exactly 100.
2. Every `C-nnn` ID appears once as a definition.
3. Every `C-nnn` referenced anywhere in `spec/` exists here.
4. Every PROPOSED constant has a matching entry in `open-questions-batch1.md`.
5. Every constant named in §0 exists in this table, and every PROPOSED constant is named in §0 (so none is left as a hard-coded value).
