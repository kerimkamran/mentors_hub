# Participant stories — relationships, scheduling, sessions, check-ins

**Batch 2 · DRAFT, pending Batch 1 sign-off · covers Epics 7, 8 and 9 (and the check-in part of 12)**
Format and conventions: see [01-access-and-profile.md](01-access-and-profile.md).

---

## Relationships

### US-REL-01 · See my mentoring relationships

**As a** participant, **I want** one place for my relationships and teams, **so that** I can find everything about them.
**Requirements:** FR-REL-001, FR-REL-008 · **Screens:** SCR-08 · **Slice:** S6

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-REL-01.1 | **Given** I have relationships, **when** I open My Mentoring, **then** I see each with counterpart name(s), status, next session and open actions. | P |
| AC-REL-01.2 | **Given** I open a relationship workspace, **when** it loads, **then** I see sessions, goals, shared notes, messages and (if applicable) reports for that relationship only. | P |
| AC-REL-01.3 | **Given** I am the PM or an org admin but not a member, **when** I open another pair's workspace by its address, **then** I get "not found". | N |
| AC-REL-01.4 | **Given** I am a line manager of a participant, **when** I try to see their relationship, **then** I see nothing and no hint that it exists. | N |

### US-REL-02 · Pause or leave a relationship

**As a** member, **I want** to pause or leave immediately, **so that** nobody can be stuck.
**Requirements:** FR-REL-006 · **Screens:** SCR-08 · **Slice:** S6

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-REL-02.1 | **Given** an active relationship, **when** I choose "Pause" and confirm, **then** the state becomes `paused` immediately without approval and the PM and my counterpart are notified with status only (N-040, N-041). | P |
| AC-REL-02.2 | **Given** a paused relationship, **when** I choose "Resume", **then** it becomes `active` again. | P |
| AC-REL-02.3 | **Given** I choose "Leave", **when** I confirm, **then** a 1:1 relationship becomes `closed` immediately and no reason text is required or included in any notification. | N |
| AC-REL-02.4 | **Given** a SparkLab team and I am a team member (not mentor or lead), **when** I leave, **then** I leave the team and the relationship continues (OQ-B1-21). | P |
| AC-REL-02.5 | **Given** a relationship that is `paused`, **when** health rules run, **then** inactivity rules I1 and I2 do not fire for it. | N |

---

## Scheduling

### US-SCH-01 · Book a session

**As a** member, **I want** to pick a time that suits both of us, **so that** we can meet without email ping-pong.
**Requirements:** FR-SCH-001, FR-SCH-002, FR-SCH-003, FR-SCH-007, FR-SCH-008 · **Screens:** SCR-09 · **Slice:** S7

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-SCH-01.1 | **Given** both of us have availability, **when** I open Book a session, **then** I see slots that suit both, in my own time zone. | P |
| AC-SCH-01.2 | **Given** I choose a slot, **when** I confirm, **then** a session is created as `scheduled` and both receive an email with an .ics invite carrying a Teams link (N-050). | P |
| AC-SCH-01.3 | **Given** a slot that another booking just took, **when** I confirm, **then** the booking fails with "that time is no longer free" and nothing is created (database exclusion constraint, FR-SCH-003). | N |
| AC-SCH-01.4 | **Given** the invite, **when** it is opened in Outlook (classic, new, web, mobile) or Google Calendar, **then** Accept/Decline is available and the invite contains names, time and link only. | N |
| AC-SCH-01.5 | **Given** I have no relationship with this person, **when** I request a booking by address, **then** I get "not found". | N |

### US-SCH-02 · Reschedule or cancel

**As a** member, **I want** to change or cancel a session, **so that** plans can change.
**Requirements:** FR-SCH-005, FR-SES-001 · **Screens:** SCR-09, SCR-10 · **Slice:** S7

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-SCH-02.1 | **Given** a `scheduled` session, **when** I reschedule to a free slot, **then** the session stays `scheduled`, invites update (same UID, sequence incremented) and everyone is notified (N-051). | P |
| AC-SCH-02.2 | **Given** a `scheduled` session, **when** I cancel, **then** its state becomes `cancelled`, a cancel invite is sent (N-052), and it counts toward health rule A4. | P |
| AC-SCH-02.3 | **Given** a session that has already started or is `completed`, **when** I try to reschedule, **then** it is rejected. | N |
| AC-SCH-02.4 | **Given** the cancellation email or invite, **when** it is generated, **then** it contains no reason text. | N |

### US-SCH-03 · Book a session for a team

**As a** SparkLab team lead, **I want** only times when the lead and most of the team are free, **so that** sessions are well attended.
**Requirements:** FR-SCH-004 · **Screens:** SCR-09 · **Slice:** S7

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-SCH-03.1 | **Given** team availability, **when** slots are shown, **then** a slot appears only if the team lead and at least the share of members in C-027 are free. | P |
| AC-SCH-03.2 | **Given** a slot where the lead is busy, **when** the grid is built, **then** it is not offered even if most members are free. | N |
| AC-SCH-03.3 | **Given** a slot with the lead free but fewer members free than C-027, **when** the grid is built, **then** it is not offered. | N |
| AC-SCH-03.4 | **Given** a booked team session, **when** invites are sent, **then** every member receives one. | P |

### US-SCH-04 · Be reminded before a session

**As a** member, **I want** a reminder the day before, **so that** I come prepared.
**Requirements:** FR-SCH-006, FR-MSG-006 · **Screens:** SCR-02, SCR-10 · **Slice:** S7

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-SCH-04.1 | **Given** a `scheduled` session, **when** C-010 before its start is reached, **then** every attendee gets an email and in-app reminder (N-053). | P |
| AC-SCH-04.2 | **Given** the reminder email, **when** a mail scanner fetches its link, **then** the session is unchanged; the link only opens the session's Prepare tab. | N |
| AC-SCH-04.3 | **Given** the session was cancelled before the reminder time, **when** the job runs, **then** no reminder is sent. | N |
| AC-SCH-04.4 | **Given** within C-011 of the start, **when** I open Home, **then** my main card is "Prepare for a session" (unless a higher-priority card applies). | P |

---

## Sessions

### US-SES-01 · Prepare for a session

**As a** member, **I want** an agenda and context before we meet, **so that** the time is well used.
**Requirements:** FR-SES-002, FR-SES-003 · **Screens:** SCR-10 · **Slice:** S8

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-SES-01.1 | **Given** an upcoming session, **when** I open its Prepare tab, **then** I see the agenda items, the open actions and the last session's decisions. | P |
| AC-SES-01.2 | **Given** I add an agenda item, **when** I save, **then** the other member(s) see it and it autosaves. | P |
| AC-SES-01.3 | **Given** a Leadership first session, **when** I open Prepare, **then** I see the initial-meeting template (expectations, values, challenges). | P |
| AC-SES-01.4 | **Given** I am not a member of the relationship, **when** I open the session by its address, **then** I get "not found". | N |

### US-SES-02 · Take notes during a session

**As a** member, **I want** shared and private notes, **so that** I can record what matters without exposing it.
**Requirements:** FR-SES-003, FR-SES-004 · **Screens:** SCR-10 · **Slice:** S8

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-SES-02.1 | **Given** a session in progress, **when** I type a shared note, **then** it is visible to every member and autosaves. | P |
| AC-SES-02.2 | **Given** I write a private note, **when** another member (including my counterpart) opens the session, **then** they cannot see it, count it, or find it through search. | N |
| AC-SES-02.3 | **Given** a PM, org admin, assessor, content manager or safeguarding user, **when** they query notes, **then** zero rows are returned (INV-2.3). | N |
| AC-SES-02.4 | **Given** I lose connectivity while typing, **when** I reconnect, **then** my text is not lost. | P |

### US-SES-03 · Wrap up a session

**As a** member, **I want** to mark a session done and record decisions and actions, **so that** we leave with next steps.
**Requirements:** FR-SES-001, FR-SES-005, FR-SES-007 · **Screens:** SCR-10 · **Slice:** S8

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-SES-03.1 | **Given** a session that has ended and is still `scheduled`, **when** I open Home, **then** my main card is "Wrap up a finished session". | P |
| AC-SES-03.2 | **Given** I mark it completed, **when** I confirm, **then** the state is `completed`, the activity timestamp updates, and each member gets a check-in request (N-060). | P |
| AC-SES-03.3 | **Given** a session has not yet started, **when** I try to mark it completed, **then** it is rejected. | N |
| AC-SES-03.4 | **Given** my counterpart did not appear, **when** I mark a no-show after the grace time, **then** the session becomes `no-show` and counts toward health rule A4. | P |
| AC-SES-03.5 | **Given** I record a decision or action, **when** I save, **then** it is visible to members only and never in any notification text. | N |

### US-SES-04 · Complete a check-in

**As a** member, **I want** a short check-in after each session, **so that** I can say how it went and ask for support if I need it.
**Requirements:** FR-HLT-001, FR-HLT-002, FR-SES-007, FR-HLT-008 · **Screens:** SCR-14 · **Slice:** S9

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-SES-04.1 | **Given** a completed session, **when** I open the check-in, **then** I see C-030 short questions including usefulness on the scale in C-033, and an optional "I'd like support" tick. | P |
| AC-SES-04.2 | **Given** I tick "I'd like support", **when** I submit, **then** the PM is notified with names and status only (N-063) and the PM cannot read any of my answers or text. | N |
| AC-SES-04.3 | **Given** my answers, **when** the PM views the dashboard, **then** usefulness appears only as an aggregate when at least C-028 respondents contributed. | N |
| AC-SES-04.4 | **Given** I skip the check-in, **when** I do nothing, **then** nothing is blocked and the session stays `completed`. | P |
| AC-SES-04.5 | **Given** a check-in for a session I did not attend, **when** I try to submit, **then** it is "not found". | N |

### US-SES-05 · Use the mentoring resources

**As a** mentor or mentee, **I want** short practical guides inside the session workspace, **so that** I can handle common situations well.
**Requirements:** FR-SES-006, FR-PRV-006 · **Screens:** SCR-10 · **Slice:** S8

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-SES-05.1 | **Given** resources have been published by the content manager after L&D sign-off, **when** I open a session's Prepare tab, **then** I see a "Resources" list (e.g. difficult mentee types, active listening, paraphrasing, the 6C communication rule) in my language. | P |
| AC-SES-05.2 | **Given** a resource has no translation in my language, **when** the list loads, **then** it is hidden from me rather than shown with a missing-text placeholder (and a completeness warning is raised for the content manager). | N |
| AC-SES-05.3 | **Given** a resource is still a draft or L&D has not signed it off, **when** I open the list or its address, **then** I do not see it ("not found"). | N |
| AC-SES-05.4 | **Given** I open a resource, **when** I finish reading, **then** nothing is recorded about which resources I opened that any PM or admin can see. | N |
