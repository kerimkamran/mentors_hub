# Open questions raised in Batch 1

Every item the Plan leaves undefined, or where two parts of the Plan need reconciling, is listed here rather than decided silently. Each has a **proposal** (what the specification currently assumes), an **owner** and a **needed-by milestone**. Calendar dates are to be set by the programme owner; the Plan asks for an owner and due date per item in Batch 3, so this file seeds that log.

**Milestones:** B1 = Batch 1 sign-off · B2 = Batch 2 sign-off · S*n* = start of slice *n* · Gate = Leadership pilot gate.
**Owner "Programme owner"** = the person accountable for Mentorship Hub delivery (Plan §13). Update the owner column with names at review.

Status: **Open** unless marked **Resolved**.

> **Decision, 2 October 2026 (programme owner):** the proposed numeric values are *not* to be fixed by the specification — they become **admin-managed settings** that administrators can change in the product, with the proposal as the starting default ([constants §0](constants.md), FR-PRG-013…016). Items marked Resolved below are settled this way. Items about behaviour, ownership or external dependencies stay Open.

## A. Constants proposed (not in the Plan)

| ID | Question | Current proposal | Constants | Owner | Needed by |
|---|---|---|---|---|---|
| OQ-B1-01 | What is the meeting cadence per programme? Health rules are relative to it but the Plan gives no value. **Resolved: admin-managed setting; default = proposal.**| Leadership 14 days · SparkLab 14 days · Open 30 days | C-020 (drives C-014) | Programme owner, L&D | B1 |
| OQ-B1-02 | Default mentor capacity for Leadership and Open (SparkLab = 2 teams is in the Plan). **Resolved: admin-managed setting; default = proposal.**| Leadership 2 mentees · Open 3 mentees | C-021 | Programme owner | B1 |
| OQ-B1-03 | When does the single Open-request reminder go out? **Resolved: admin-managed setting; default = proposal.**| After 4 days (3 days left) | C-003 | Programme owner | B2 |
| OQ-B1-04 | Magic-link/code lifetime, attempt limit and per-identity/browser rate limits. **Resolved: admin-managed setting; default = proposal.**| 15 min single use · 5 attempts · 5 requests/15 min per email, 30/15 min per browser | C-041, C-042, C-046 | IT Security | S1 |
| OQ-B1-05 | Application session idle and absolute lifetimes. **Resolved: admin-managed setting; default = proposal.**| 8 h idle · 30 days absolute | C-043 | IT Security | S1 |
| OQ-B1-06 | Numeric factors for expertise depth, primary-goal weighting and taxonomy partial credit. **Resolved: admin-managed setting; default = proposal.**| working 0.50 / advanced 0.75 / expert 1.00; primary goal ×2; parent/child 0.5 | C-050, C-051, C-052 | Programme owner, L&D | B1 (before S6) |
| OQ-B1-07 | Sub-score tables for availability, career level and language. **Resolved: admin-managed setting; default = proposal.**| Availability saturates at 3 days; career ahead 1.0 / peer 0.6 / far 0.4 / junior 0.3; language fluent 1.0 / working 0.7; "ahead" = 1–2 buckets | C-053, C-054, C-055, C-056 | Programme owner, HR | B1 (before S6) |
| OQ-B1-08 | Neutral score, explanation thresholds and score precision. **Resolved: admin-managed setting; default = proposal.**| Neutral 0.50; reason shown if sub-score ≥ 0.60; dropped if true for ≥ 90% of pool; 2 decimals | C-057, C-059, C-060, C-061 | Programme owner | B1 (before S6) |
| OQ-B1-09 | Session usefulness scale (Plan implies "x / 5"). | Integer 1–5 | C-033 | Programme owner | B2 |
| OQ-B1-10 | Recovery objectives for production. | RPO ≤ 5 min · RTO ≤ 4 h · restore drill before RC and 6-monthly | C-140, C-141, C-142 | IT | S0 |
| OQ-B1-41 | How long after a session starts before a no-show can be recorded? **Resolved: admin-managed setting; default = proposal.** | 15 minutes | C-158 | Programme owner | B2 |
| OQ-B1-42 | How far ahead of a session's start does Home treat it as "about to start"? **Resolved: admin-managed setting; default = proposal.** | 15 minutes | C-159 | Programme owner | B2 |
| OQ-B1-43 | How long is a four-eyes approval request valid? **Resolved: admin-managed setting; default = proposal.** | 7 days | C-160 | Programme owner | B2 |
| OQ-B1-44 | Retention of operational logs (email delivery status, job history). Legal to confirm. | 30 days each, status and error codes only | C-161, C-162 | Legal, IT | Gate |
| OQ-B1-45 | Announcement length, bounce-spike and data-request alert thresholds, and the data-request response target. **Resolved: admin-managed settings; defaults = proposal (Legal to confirm the 30-day target).** | 600 characters · 5% of 20 sends / 24 h · 30 days, due-soon at 7 days | C-164, C-165, C-166, C-167 | Programme owner, Legal | B2 |
| OQ-B1-46 | Compare the admin capability list with SparkLab, Vantage, AI Hub and other internal tools once accessible; add anything missing. | Interview-built list in 09-admin-panel.md | FR-ADM | Programme owner | B2 |
| OQ-B1-47 | The limited brand editor is an exception to the Plan's "no white-label self-service" (§14). Confirm it is acceptable. | Logo + six tokens only, contrast-gated | FR-ADM-028 | Programme owner, IT | B2 |
| OQ-B1-48 | Four-eyes actions are blocked until two org admins exist. Who will the two org admins be before the pilot gate? | Named at set-up; pilot-gate checklist verifies | FR-ADM-016, FR-ADM-024 | Programme owner, IT | Gate |
| OQ-B1-49 | Plan §8 says search treats ə/e as the same, but its example says "mammadov" must find Məmmədov, which needs ə↔a (the usual Latin spelling of Azerbaijani names, e.g. Əliyev ↔ Aliyev). S0 implements the written rule (ə→e). Proposal: also match ə as a, so either spelling finds the name. | Match both ə→e and ə→a (query expands to both) | FR-PRV-006 | Programme owner, L&D | S4 |

## B. Reconciliations and gaps in the Plan

| ID | Question | Current proposal | Affects | Owner | Needed by |
|---|---|---|---|---|---|
| OQ-B1-11 | The PM list flags "no first session after **14 days**" but health rule I2 fires at **21 days**. Are both intended? | Yes: list = early nudge, I2 = health state | domain model §6 | Programme owner | B1 |
| OQ-B1-12 | Health codes are I1, I2, A2, A4, A5. Are I3, A1, A3 reserved, dropped, or missing? | Not allocated; reserved | domain model §6.1 | Programme owner | B1 |
| OQ-B1-13 | Ordering inside each tier of the "Where should I intervene?" list. | Oldest item first | domain model §6.3 | Programme owner | B2 |
| OQ-B1-14 | Can a PM match a mentor who lacks the minimum profile (topics + one expertise)? | Not recommended/browsable; PM may match manually with audited reason | matching §2 | Programme owner | B1 |
| OQ-B1-15 | Horizon for the `NO_AVAILABILITY` exclusion. **Resolved: admin-managed setting; default = proposal.**| 4 weeks from the match date | matching §3 (C-150) | Programme owner | B1 |
| OQ-B1-16 | How is the Leadership "Other" criterion (character, field, experience) scored? | Each question is `similar` or `complementary`; section mean; overall mean | matching §4.7 | Programme owner, L&D | B2 |
| OQ-B1-17 | SparkLab phase-experience effect. | Expertise ×1.0 if the mentor has the team's phase, ×0.8 otherwise | matching §4.8 | Programme owner | B2 |
| OQ-B1-18 | "Generate draft" algorithm for Leadership/SparkLab. | Deterministic greedy: fewest-options seekers first, top-ranked mentor with capacity | matching §5 | Programme owner | B2 |
| OQ-B1-19 | Default visibility of profile fields. | "Only me" for everything except name and department | permission matrix §5 | Programme owner, Legal | B1 |
| OQ-B1-20 | Cool-off before re-applying after a rejected/withdrawn mentor application. **Resolved: admin-managed setting; default = proposal.**| 180 days | domain model §4.1 (C-151) | Programme owner | B2 |
| OQ-B1-21 | What happens when a SparkLab *team member* leaves? | Member leaves the team; relationship stays if mentor and team lead remain; mentor or team lead leaving closes it | domain model §4.3 | Programme owner | B2 |
| OQ-B1-22 | How is the sponsor pack delivered (file attachment, expiring link, or manual hand-off by the PM)? | PM downloads the pack and sends it, or the app emails an expiring authenticated link; both logged with recipients | N-077, FR-RPT-004 | Programme owner, IT Security | B2 |
| OQ-B1-23 | Are check-in answers private to their author, with only the support flag and ≥ 5-respondent aggregates visible to the PM? | Yes | permission matrix §4.7 | Programme owner, Legal | B1 |
| OQ-B1-24 | Who creates a programme: only the org admin, or also a PM? | Org admin creates; PM edits | permission matrix §4.3 | Programme owner | B1 |
| OQ-B1-25 | Are SparkLab goals team-level, individual, or both? | Team-level goals plus phase milestones; individual goals optional | FR-GOL-004 | Programme owner | B2 |
| OQ-B1-26 | What happens to in-progress relationships when a person disappears from a later HR import? | Person becomes inactive; PM flagged; relationship not auto-closed | FR-IMP-011 | HR data, Programme owner | S2 |
| OQ-B1-27 | Minimum length of an override or decision reason. **Resolved: admin-managed setting; default = proposal.**| 10 characters; stored for PM only | matching §3 (C-152) | Programme owner | B2 |
| OQ-B1-28 | Who is the safeguarding contact if they are the subject of a concern (conflict)? | Org admin fallback | FR-HLT-003/004 | HR | Gate |
| OQ-B1-29 | Teams meeting link until Graph integration: static room per pair, per-organisation link, or entered by mentor? | Mentor/PM enters a Teams link per relationship; invite carries it | FR-SCH-009 | IT | S7 |
| OQ-B1-30 | A Leadership relationship cannot complete with fewer than 3 goals without a PM reason. Confirm. | Yes | FR-GOL-007 | Programme owner | B2 |
| OQ-B1-31 | Notification timings not in the Plan (assessment reminder, proposal reminder, wrap-up nudge, no-goal nudge, report reminder) and the user-preference model. **Resolved: admin-managed setting; default = proposal.**| 3 d before due · 2 d before deadline · 2 h after end · 7 d after acceptance · 3 d before due; non-critical categories can be switched off | notification catalogue (C-153, C-154, C-155, C-156, C-157) | Programme owner | B2 |

## C. Dependencies from Plan §13 that block sign-off or later work

| ID | Item | Owner | Blocks |
|---|---|---|---|
| OQ-B1-32 | Group email domains: one organisation or several (azerconnect.az, uninet.az, goldenpay.az …)? Determines organisation records and tenant-isolation scenarios. | Programme owner, IT | B1 (affects FR-TEN-001/005) |
| OQ-B1-33 | HR export contents: hire date and grade-ladder order. | HR data | S2; tenure eligibility, career-level matching |
| OQ-B1-34 | Data residency and DPIA covering hosting, email, storage and the AI provider (Anthropic directly or Azure OpenAI EU). | IT, Legal | Gate (real HR import and pilot) |
| OQ-B1-35 | Sending subdomain with SPF/DKIM/DMARC; Defender Safe Links behaviour. | IT | Real email |
| OQ-B1-36 | Named safeguarding contact and concern procedure. | HR | Gate |
| OQ-B1-37 | Retention periods, legal basis, privacy-notice wording. | Legal | Gate |
| OQ-B1-38 | Native Azerbaijani and Russian reviewers for glossary, explanations, interface. | L&D | Release candidate (glossary draft needed by B1) |
| OQ-B1-39 | Render paid plan (background worker, pre-deploy migrations, point-in-time recovery). | Programme owner | S0 deployment |
| OQ-B1-40 | Mentor resources from the leadership training deck need L&D sign-off. | L&D | Pilot |
