# Participant screen specifications

**Batch 2 · DRAFT, pending Batch 1 sign-off.** Screen-by-screen UX contract for everything a participant (mentee, mentor, team lead, applicant) sees. Admin screens come in Batch 3.

**Conventions.** Screen IDs are `SCR-nn`. Routes are indicative (`/…`), final paths are set in implementation; **ids in routes are opaque and the organisation never appears in a route** (INV-1.5). Every screen obeys the cross-cutting rules in §1. "Stories" lists the user stories whose acceptance criteria this screen satisfies.

## 1. Cross-cutting rules (apply to every screen)

| # | Rule | Source |
|---|---|---|
| X1 | **Navigation:** the *Participate* area contains Home · Discover (or Mentees, or My Team, by role/programme) · My Mentoring · Goals · Messages · Profile. Admin items never appear for participants. | Plan §8 |
| X2 | **Forbidden or missing objects** show one generic "Not found" page with a link to Home. No hint that the object exists. | INV-4.3 |
| X3 | **Language:** all text in the user's locale; layouts tolerate 35% expansion (C-112) without clipping or overlap; `lang` attribute set on mixed-language content. | NFR-I18N |
| X4 | **Time:** shown in the user's zone, 24-hour clock, Monday-first calendars. | C-110, C-111 |
| X5 | **Accessibility:** WCAG 2.2 AA; targets large; nothing requires dragging; dialogs trap and restore focus; status is never colour alone (icon + text); visible focus; works at 320 px width and 400% zoom. | NFR-A11Y |
| X6 | **Autosave** for notes, reports, assessments, profile edits and agenda items, with a visible "Saved" / "Saving…" / "Not saved — retrying" status announced politely to screen readers. | §8 |
| X7 | **Loading, empty and error states** are specified per screen; errors show a reference code, never stack traces or object details. | NFR-OBS-003 |
| X8 | **Privacy cues:** private content is labelled "Only you" or "You and {names}" next to the field; the PM and admins are never shown as readers of notes or messages. | INV-2 |
| X9 | **Neutral wording** for any case where an object is unavailable or excluded: "Not available for requests in this programme." (GL-057). | INV-3.8 |
| X10 | **Charts** (if any) always have a table view. | FR-HLT-009 |
| X11 | **AI controls** are not rendered at all unless all four switches allow them. | INV-6.2 |
| X12 | **Brand:** Manrope with Noto Sans fallback, primary `#0F3C76`, leaf green `#356D1B`, canvas `#E7EEF8`, 4 px radius, 2 px borders (C-114). Contrast verified by a build gate. | NFR-A11Y-005 |

---

### SCR-01 · Sign-in and first-run

**Route:** `/sign-in`, `/sign-in/continue`, `/welcome` · **Audience:** anyone · **Stories:** US-TEN-01, US-TEN-03, US-RPT-02

| Area | Specification |
|---|---|
| **Purpose** | Get an allowed person in without a password; show privacy notice and consent on first run. |
| **Layout** | Single column. Email field, "Send me a link" button. After submit: neutral confirmation, code field ("Enter the 6-digit code from the email"), "Resend" (rate-limited). |
| **Link landing page** | Shows "Continue to Mentorship Hub" with one button. No state change on load (INV-5.1). |
| **States** | *Sending* (button disabled with text), *Sent* (neutral text, identical for any address), *Expired link* ("This link has expired — send a new one"), *Wrong browser for code* (neutral failure). |
| **First-run** | Privacy notice (current version) → required acceptance → optional consents (AI assistance) → enrolment summary naming **sponsors** for the programme (FR-PRG-007). |
| **Rules** | Never reveals whether an address exists (FR-TEN-006). No username or password fields anywhere. |
| **A11y/i18n** | Code input accepts paste and is announced as "6-digit code"; error messages tied to fields; language switcher on this page (US-TEN-02). |

### SCR-02 · Home

**Route:** `/` · **Audience:** all signed-in users · **Stories:** US-HOME-01, US-SCH-04, US-PRF-04, US-VET-01, US-GOL-02, US-GOL-03

| Area | Specification |
|---|---|
| **Purpose** | Answer "What should I do next?". |
| **Layout** | One **main card** (title, one sentence, one primary button), up to **two** "also due" rows (C-029), and, below, a compact "My mentoring" strip (next session per relationship). |
| **Logic** | The 17-step priority list in [domain model §8](05-domain-model.md). First applicable = main card; next two = also due; none = "You're up to date". Pure function. |
| **Cards** | Each card has a verb title ("Answer your proposal", "Prepare for Thursday's session"), the due date/time in the user's zone, and links to the correct screen (SCR-07, SCR-10, SCR-14, SCR-13, …). |
| **States** | *Loading* skeleton; *Up to date* with a friendly sentence and links to Profile/Discover; *Error* with reference code. |
| **Rules** | A card is never produced for an object the user cannot see (AC-HOME-01.4). No counts of other people's items. |
| **A11y** | Main card is the first landmark after the header; the primary action has a descriptive accessible name; focus lands on it on page load only when navigating from the nav. |

### SCR-03 · Profile and settings

**Route:** `/profile` · **Audience:** all · **Stories:** US-TEN-02, US-PRF-01, US-PRF-02, US-PRF-04

| Area | Specification |
|---|---|
| **Sections** | Basics (name, department — from HR, read-only), Language & time zone, Topics I offer (with depth) / Topics I want to learn, Languages (with level), Interests, About me, **Visibility** per field, **What matching can see**, Notification preferences (link to SCR-18). |
| **Topic picker** | Searchable taxonomy in the user's language with synonyms; ə/e, ı/i, ö/o, ü/u, ç/c, ş/s, ğ/g, ё/е folding (C-115). Free text not allowed. |
| **Visibility control** | A select next to each field: *Only me* (default, except name and department), *Mentors in my programme / Mentees in my programme*, *People I request or match with*. |
| **"What matching can see"** | Read-only list of the fields currently visible to the engine and who can see each. Never lists grade or reporting line. |
| **Mentor completeness** | For approved mentors: checklist "Topics ✓ / Expertise area ✓" explaining recommendability. |
| **States** | *Saved/Saving/Not saved* status (X6); validation inline. |
| **Rules** | HR fields (grade, manager) are never displayed. Changing visibility takes effect immediately for new reads. |

### SCR-04 · Availability

**Route:** `/profile/availability` · **Audience:** mentors, mentees · **Stories:** US-PRF-03

| Area | Specification |
|---|---|
| **Mentor view** | Weekly rules (weekday, start, end), capacity field (C-021 default shown), preview of the next two weeks of generated slots in the viewer's zone. |
| **Mentee view** | Windows ("I'm usually free…"), preview. |
| **Rules** | Lowering capacity below current load shows a warning that the PM will be notified. Existing sessions are untouched when rules change. |
| **A11y** | Time inputs have text alternatives to pickers; no drag-to-select grids. |

### SCR-05 · Discover (Recommended / Browse) — plus Mentees and My Team variants

**Route:** `/discover` · **Audience:** mentees (Open); mentors see **Mentees** (requests inbox); SparkLab leads see **My Team** · **Stories:** US-MAT-01, US-MAT-02

| Area | Specification |
|---|---|
| **Tabs** | *Recommended* (top C-024) · *Browse* (all non-excluded, filters: topic, language, available this week). |
| **Mentor card** | Name, headline, up to three topic chips, languages, **sessions completed**, **"available this week"** badge, and up to C-034 reasons ("Why Rauf?"). **No stars, scores, percentages or ranks shown.** Actions: *View profile*, *Request*. |
| **Excluded candidates** | Absent from lists. If a person opens a direct address, they see "Not available for requests in this programme." (X9). |
| **Empty states** | No goals shared → prompt to set a goal (links to SCR-11) and Browse remains available. No candidates → neutral text, no cause. |
| **Open requests** | A strip shows my open requests (max C-023), expiry, and "Withdraw". |
| **Mentor/team-lead variant** | *Mentees* lists incoming requests (SCR-07 link). *My Team* shows the team's mentor and phase. |
| **Performance** | Search under C-122; list virtualised only if it keeps keyboard order intact. |

### SCR-06 · Mentor profile and request

**Route:** `/mentors/{id}` · **Audience:** mentees in the programme · **Stories:** US-MAT-02, US-MAT-03, US-GOL-01

| Area | Specification |
|---|---|
| **Content** | Fields the mentor chose to show to mentees; reasons ("Why {name}?"); availability summary in my zone. |
| **Request dialog** | Optional message (text only), and a choice "Share one of my goals" (shows goal titles that I can include). Clear statement of what the mentor will see ("topic labels, plus the goal you choose to share"). |
| **Rules** | Blocked if I already hold C-023 open requests or am matched. Sending never changes anything via a link (button only). |
| **A11y** | Dialog with focus trap, labelled controls, Escape closes. |

### SCR-07 · Proposal or request response

**Route:** `/requests/{id}`, `/proposals/{id}` · **Audience:** parties of the match · **Stories:** US-MAT-04, US-MAT-05, US-MAT-06

| Area | Specification |
|---|---|
| **Content** | Counterpart name(s), deadline (C-001 or C-002), what each party has answered ("waiting for {name}"), the programme summary. Mentors see mentee **topic labels** only unless a goal was shared. |
| **Actions** | *Accept*, *Decline*. Decline in Leadership asks for a **private reason** (visible only to the PM; stated on screen). In Open, no reason is requested. |
| **Rules** | The page itself changes nothing when opened from an email (INV-5.1). A SparkLab team member who is not the lead or mentor sees no actions. A race at capacity shows "This can no longer be accepted". |
| **States** | *Pending*, *Waiting for others*, *Accepted* (links to workspace), *Declined/Expired* (neutral wording). |

### SCR-08 · My Mentoring (list and relationship workspace)

**Route:** `/mentoring`, `/mentoring/{relationshipId}` · **Audience:** members · **Stories:** US-REL-01, US-REL-02, US-MAT-07

| Area | Specification |
|---|---|
| **List** | One row per relationship or team: counterpart(s), programme, status (`active`/`paused`/`completed`/`closed` with icon and text), next session, open actions. |
| **Workspace tabs** | *Overview* · *Sessions* · *Goals* (SCR-11) · *Messages* (SCR-12) · *Reports* (SCR-13, if applicable) · *Notes* (shared and mine). |
| **Overview** | Counterpart info per their visibility, goals summary, next steps, **who can see what** note ("Only you and {names} can read notes and messages. The programme team sees dates and status."). |
| **Actions menu** | *Pause / Resume*, *Leave*, *Ask for a different mentor* (rematch wizard with goal carry-over preview), *Report a concern* (SCR-15). |
| **Rules** | Leave and Pause need only a confirmation (no approval, no reason text). The rematch preview lists only goals; notes/messages never offered. |

### SCR-09 · Book a session

**Route:** `/mentoring/{id}/book` · **Audience:** members · **Stories:** US-SCH-01, US-SCH-02, US-SCH-03

| Area | Specification |
|---|---|
| **Slot grid** | Slots that suit all attendees, grouped by day, in the viewer's zone; for teams only slots satisfying the quorum (C-027). Alternative list view (no drag, no hover-only). |
| **Confirm** | Shows date/time in my zone and counterpart's zone label, Teams link note, and "An invite will be emailed". |
| **Conflict** | If the slot is taken meanwhile: "That time is no longer free" and the grid refreshes. |
| **Reschedule / cancel** | Reached from the session; cancel confirms and notes it may affect the relationship's health indicators for the programme team (status only). |
| **A11y** | Slots are buttons with full accessible names ("Thursday 9 October, 14:00 to 14:45"). |

### SCR-10 · Session workspace (Prepare / During / After)

**Route:** `/mentoring/{id}/sessions/{sid}` · **Audience:** attendees · **Stories:** US-SES-01…04, US-SCH-02, US-SCH-04, US-AIA-02

| Area | Specification |
|---|---|
| **Prepare** | Agenda (shared, autosave), open actions, previous decisions, (Leadership first session) initial-meeting template, optional "Suggest an agenda" (X11). |
| **During** | Shared notes and **My private notes** side by side with labels "You and {names}" / "Only you" (X8). Timer optional. |
| **After** | Decisions, actions (owner, due, difficulty rating for Leadership), "Mark completed" / "Mark no-show", link to check-in (SCR-14). |
| **Rules** | A session not yet started cannot be marked completed. A completed session cannot be rescheduled. Private notes never appear in search, exports to others, or PM views. |
| **A11y** | Autosave status live region (X6); tabs follow the ARIA tabs pattern. |

### SCR-11 · Goals

**Route:** `/goals`, `/mentoring/{id}/goals` · **Audience:** mentees; mentors read in-relationship · **Stories:** US-GOL-01…04, US-AIA-01

| Area | Specification |
|---|---|
| **List** | Goals with state (`draft`/`active`/`achieved`/`dropped`), tags, primary star (as a labelled toggle, not a rating), progress of milestones/actions. |
| **Editor** | Title, tags (taxonomy picker), visibility; Leadership: SMART fields and tasks; "AI suggestion" (X11). |
| **Leadership template** | Exactly three goal slots (C-025) with completion indicator. |
| **SparkLab view** | Three phases (develop/design/test) with milestones and current phase; phase completion by lead or mentor only. |
| **Rules** | Mentor can read and comment on in-relationship goals but cannot change a goal's state. A closed relationship's goals are read-only. |

### SCR-12 · Messages

**Route:** `/messages`, `/mentoring/{id}/messages` · **Audience:** members · **Stories:** US-MSG-01

| Area | Specification |
|---|---|
| **Content** | Threaded by relationship/team; text only; time stamps in user's zone; unread marker. |
| **Rules** | No attachments, no reactions, no real-time presence in the MVP. Notifications carry names and link only. Closed relationships are read-only. |
| **States** | *Empty* ("Say hello to {name}"), *Sending/failed/retry*. |

### SCR-13 · Progress report

**Route:** `/mentoring/{id}/reports/{rid}` · **Audience:** mentor (author), mentee, PM · **Stories:** US-RPT-01, US-RPT-02

| Area | Specification |
|---|---|
| **Mentor form** | System-filled counts, per-goal progress (1–5), topics (taxonomy), engagement (1–5), challenges (checklist + ≤ 1,000 characters), support needed, next focus. Autosave (X6). Statement "This report is shared with {PM role} and {mentee name}. Sponsors receive the final evaluation pack." |
| **Mentee view** | Read-only; shows version and "amended" label; for the final report, restates who will see the pack. |
| **Rules** | No control exists to paste or reference notes, reflections or messages. One amendment only. Not visible to line managers or org admins without a PM role. |
| **States** | *Due*, *Submitted v1*, *Amended v2*, *Waived* (reason shown only if the PM releases it). |

### SCR-14 · Check-in

**Route:** `/mentoring/{id}/sessions/{sid}/check-in` · **Audience:** attendees · **Stories:** US-SES-04

| Area | Specification |
|---|---|
| **Content** | C-030 short questions including usefulness (scale per C-033) and an optional "I'd like support" tick with explanation of who sees it. |
| **Rules** | Answers are visible only to me; PM sees only the support flag with names, and aggregated usefulness at ≥ C-028 respondents. Skipping blocks nothing. |
| **A11y** | Rating uses radio buttons with text labels, not colour or stars alone. |

### SCR-15 · Report a concern

**Route:** `/mentoring/{id}/concern` · **Audience:** members · **Stories:** US-HLT-01

| Area | Specification |
|---|---|
| **Content** | Plain-language explanation: "This goes to {safeguarding contact name or role}, not to your programme manager." Free-text box, optional "I'd like to be contacted" tick. |
| **Confirmation** | "We received your report" (N-081). No concern text appears anywhere else. |
| **Rules** | Routing per D16 (org admin fallback). Only safeguarding reads it. Text is never included in any notification or audit entry. |
| **Tone** | Calm, supportive, no jargon; an always-visible alternative route for urgent danger (organisation's emergency contact, configured text). |

### SCR-16 · Mentor application

**Route:** `/mentor-application` · **Audience:** applicants/nominees · **Stories:** US-VET-01, US-VET-02

| Area | Specification |
|---|---|
| **Content** | Application form (autosave), status stepper: *Draft → Submitted → In review → Decision*. Decision page shows outcome and any feedback released by the PM. |
| **Rules** | Assessors' identities and scores are never shown. Item-level scores are included only in the personal data export. Ineligible users see "Not found". |

### SCR-17 · Privacy and data

**Route:** `/privacy` · **Audience:** all · **Stories:** US-TEN-03, US-PRV-01

| Area | Specification |
|---|---|
| **Content** | Current privacy notice, consents with toggles (e.g. AI assistance), "Download my data", "Request erasure", contact for manual requests before S13. |
| **Rules** | Export includes only what I authored or may read; a link is useless to anyone else (X2). Erasure explains what is anonymised versus deleted (retention constants). |

### SCR-18 · Notifications

**Route:** `/notifications` · **Audience:** all · **Stories:** US-MSG-02

| Area | Specification |
|---|---|
| **Content** | Chronological list rendered from ids and templates in my language/zone; mark as read; per-category email preferences (non-critical only). |
| **Rules** | A notification about an object I can no longer see leads to X2 "Not found". Critical categories are shown without a switch (R8). |
