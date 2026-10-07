# Notification catalogue

**Applies to:** FR-MSG-003 to FR-MSG-008 · Plan §5 principles 3 and 5 · decisions D3, D7, D15, D16

## 1. Rules that apply to every notification

| # | Rule | Source |
|---|---|---|
| R1 | A notification record stores **ids only** (recipient, subject object, template code). The visible text is rendered at display time in the recipient's language and time zone. | Principle 3 |
| R2 | Emails, in-app items and calendar invites contain **names and links only** — never goal text, note text, message text, concern text, decline reasons, assessment scores, or free text of any kind. | Principle 3 |
| R3 | Every link opens a **page**. No link performs an action (accept, decline, confirm, sign in, cancel). The user clicks a button on the page. Pre-fetching by a mail scanner changes nothing. | Principle 5 |
| R4 | Subject lines are generic ("You have a mentoring request") and never contain names of third parties or sensitive terms (concern, support, decline). | Principle 3 **[PROPOSED]** |
| R5 | Language = recipient's profile language; time = recipient's time zone, 24-hour clock. | D8 |
| R6 | A recipient who cannot see an object (permission map) never receives a notification about it. | Principle 4 |
| R7 | Delivery channel is **email + in-app** unless stated; in-app only items are marked. No SMS or push. | §14 |
| R8 | Critical notifications cannot be switched off; others respect user preferences (FR-MSG-007). | **[PROPOSED]** |
| R9 | Failures to send are retried by the background worker with back-off, and logged by id and error code only. | NFR |
| R10 | Notification text in the PM's or sponsors' view never contains the private reason for a decline or the content of a concern. | D13, D16 |

**Critical (cannot be disabled):** N-001, N-002, N-040, N-041, N-050, N-051, N-052, N-081.

## 2. Catalogue

Legend — **Rec.** recipient; **Ch.** channel (E = email, A = in-app); **Link** destination page; **Trigger** system event.

### 2.1 Sign-in and access

| ID | Name | Trigger | Rec. | Ch. | Content (names + link only) | Link opens |
|---|---|---|---|---|---|---|
| N-001 | Sign-in link and code | Sign-in requested by an allowed identity | Requester | E | Link + 6-digit code. Sent **only** if the identity is allowed; the screen response is identical either way (FR-TEN-006) | Page with a "Continue" button; code usable only in requesting browser |
| N-002 | Invitation | PM explicitly invites a person | Invitee | E | Organisation, programme, inviter name, link | Welcome page |
| N-003 | TOTP enrolment reminder | Admin without TOTP signs in | Admin | A | Prompt only | TOTP setup |

### 2.2 People and programme administration

| ID | Name | Trigger | Rec. | Ch. | Content | Link opens |
|---|---|---|---|---|---|---|
| N-010 | Import finished | Import confirmed and processed | Importing PM/admin | E, A | Counts (created/updated/rejected), link | Import result page (error file download) |
| N-011 | Enrolment confirmation | Person enrolled in a programme | Participant | E, A | Programme name, **sponsors' names** (FR-PRG-007), link | Programme page |
| N-012 | Programme activated | PM activates a programme | PMs of the programme | A | Programme name | Programme page |

### 2.3 Mentor vetting

| ID | Name | Trigger | Rec. | Ch. | Content | Link opens |
|---|---|---|---|---|---|---|
| N-020 | Nomination received | PM nominates a person | Nominee | E, A | Programme, nominator = "the programme team" | Application (draft) |
| N-021 | Application submitted | Applicant submits | PMs | A | Applicant name, programme | Application |
| N-022 | Assessment assigned | PM assigns assessor | Assessor | E, A | Applicant name, programme, due date | Assessment form (blind) |
| N-023 | Assessment reminder | C-153 before due date | Assessor | E | Same | Assessment form |
| N-024 | Assessments complete | All assessors submitted | PM | A | Applicant name | Decision page |
| N-025 | Decision released | PM releases decision | Applicant | E, A | Programme, outcome word (approved / not approved), link to feedback page. **No scores** | Decision page |

### 2.4 Matching and relationships

| ID | Name | Trigger | Rec. | Ch. | Content | Link opens |
|---|---|---|---|---|---|---|
| N-030 | Request received (Open) | Mentee requests a mentor | Mentor | E, A | Mentee name, link. Topic labels allowed only in-app and only as visible to the mentor | Request page |
| N-031 | Request reminder (Open) | C-003 reached, no reply | Mentor | E | Mentee name, expiry date | Request page |
| N-032 | Request expired | C-002 reached | Mentee, mentor | A (mentee also E) | Names only, neutral wording ("The request is no longer open") | Discover / requests |
| N-033 | Request accepted | Mentor accepts | Mentee | E, A | Mentor name, link to book | Booking page |
| N-034 | Request not taken forward | Mentor declines | Mentee | A | **Neutral wording only**: "This request was not taken forward." No reason | Discover |
| N-035 | Proposal awaiting you | PM publishes a Leadership/SparkLab proposal | Mentor and mentee (or mentor and team lead) | E, A | Counterpart's name, acceptance deadline (C-001) | Proposal page |
| N-036 | Proposal reminder | C-154 before deadline | Party who has not answered | E | Counterpart's name, deadline | Proposal page |
| N-037 | Proposal accepted by counterpart | One party accepts | Other party | A | "{name} accepted — your answer is needed" | Proposal page |
| N-038 | Match confirmed | Both accepted | Both (SparkLab: also all team members) | E, A | Names, link. Team members receive "your team has a mentor" | Relationship workspace |
| N-039 | Proposal declined or expired | Either declines, or C-001 passes | PM | E, A | Names, status only. **The private reason is in-app on the PM's decision page only, never in email** (D13) | PM decision page |
| N-040 | Relationship paused or left | Any member pauses/leaves | PM | E, A | Names, status, date. **No reason text** | Relationship (PM view) |
| N-041 | Other member informed of pause/leave | Same | Remaining member(s) | A | "{name} paused/left" — status only | Relationship workspace |
| N-042 | Rematch started | PM or mentee starts rematch | PM; previous mentor informed neutrally | A | "This relationship has closed" — no reason | — |
| N-043 | Draft published | PM publishes draft | PM (confirmation) | A | Counts | Matching page |

### 2.5 Scheduling and sessions

| ID | Name | Trigger | Rec. | Ch. | Content | Link opens |
|---|---|---|---|---|---|---|
| N-050 | Session booked | Booking confirmed | All attendees | E (+ .ics) | Names, date/time in recipient zone, **Teams link** (D7). Calendar invite displays Accept/Decline | Session page |
| N-051 | Session rescheduled | Time changed | Attendees | E (+ updated .ics) | Names, old/new time | Session page |
| N-052 | Session cancelled | Cancelled | Attendees | E (+ cancel .ics) | Names, time. No reason text | Relationships |
| N-053 | Session reminder | C-010 (24 h before) | Attendees | E, A | Names, time, link | Session page — Prepare tab |
| N-054 | Wrap-up nudge | C-155 after end if still "scheduled" | Mentor (or both) | A | "Wrap up your session" | Session page — After tab |
| N-055 | Book first session | C-006 reached with no session | Both members | E, A | Names, link | Booking page |

### 2.6 Goals, actions, check-ins

| ID | Name | Trigger | Rec. | Ch. | Content | Link opens |
|---|---|---|---|---|---|---|
| N-060 | Check-in due | Session completed | Each member | E, A | "How was your session?" — no content | Check-in (3 questions) |
| N-061 | Action overdue | Action past due | Action owner | A | Count only | Actions list |
| N-062 | Goals not set | C-156 after match acceptance with no goal | Mentee | A | — | Goals |
| N-063 | Support requested | Check-in "I'd like support" ticked | PM | E, A | Names, relationship, date. **No text from the check-in** (D16) | Relationship (PM view) |

### 2.7 Reports

| ID | Name | Trigger | Rec. | Ch. | Content | Link opens |
|---|---|---|---|---|---|---|
| N-070 | Report due | Report due date reached; one reminder C-157 earlier | Mentor | E, A | Programme, period | Report form (autosaves) |
| N-071 | Report overdue | C-009 exceeded | Mentor; PM | E, A | Names, period | Report / PM list |
| N-072 | Report submitted | Mentor submits | Mentee; PM | E, A | Mentor name, period | Report page |
| N-073 | Report amended | Single amendment made | Mentee; PM | A | Names, version | Report page |
| N-074 | Report waived | PM waives | Mentor | A | "Not required for this period" — reason shown in-app to mentor only if PM releases it | Report |
| N-075 | Final report ready | Final report submitted | Mentee | E, A | **Sponsors' names** (D15), link | Report page |
| N-076 | Sponsor pack exported | PM exports | PM (confirmation) | A | Recipients list; logged | Export log |
| N-077 | Pack delivered to sponsor | Export triggered | Sponsor (external to the app) | E | Mentee and programme names, link or attached file per export mode **[PROPOSED]** (OQ-B1-22) | — |

### 2.8 Safeguarding, privacy, system

| ID | Name | Trigger | Rec. | Ch. | Content | Link opens |
|---|---|---|---|---|---|---|
| N-080 | Concern received | "Report a concern" submitted | **Safeguarding contact only**; org admin if none/conflicted (D16). **Never the PM** | E, A | "A concern needs your attention." No names beyond the relationship id in-app; **no text** | Concern page (safeguarding-only) |
| N-081 | Concern acknowledged | Safeguarding opens it | Reporter | A | "Your report was received" | — |
| N-082 | Data export ready | Export job done | Requester | E | Link | Download page (authenticated) |
| N-083 | Erasure completed | Job done | Requester | E | Link | — |
| N-084 | AI assistant switched off/on | Org kill switch changed | Org admin | A | Status | Settings |
| N-085 | Consent changed | Consent version updated | Users affected | A | Link | Consent page |

## 3. Per-language email requirements

- Each email has a snapshot test per language (EN, AZ, RU) including plural forms (Plan §11).
- Calendar invites: UTF-8, correct `DTSTART` with time zone, `METHOD:REQUEST`/`CANCEL`, stable `UID` per session, incrementing `SEQUENCE`, `ORGANIZER` as the platform sender, no description text beyond names and link (FR-SCH-008).
- Layout allows 35% text expansion (C-112).

## 4. Tests that reference this catalogue

| ID | Test |
|---|---|
| NT-1 | Render every notification with fixtures containing sentinel free-text values (e.g. `SECRET-NOTE-123`); the sentinel must never appear in any rendered email, in-app text, or invite |
| NT-2 | Pre-fetch every link as a mail scanner would (GET); assert no state change |
| NT-3 | For each notification, a recipient lacking permission to the object receives nothing |
| NT-4 | N-080 is never sent to a PM-role-only user |
| NT-5 | N-039 and N-063 emails contain no reason/check-in text |
| NT-6 | Every template has EN/AZ/RU translations (completeness gate) |
| NT-7 | Subject lines contain none of the words in the sensitive-term list in any language |
