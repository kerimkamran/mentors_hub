# Participant stories — goals, discovery, requests, proposals, rematch

**Batch 2 · DRAFT, pending Batch 1 sign-off · covers Epics 4 (goals), 6, 7 (accept side) and 10**
Format and conventions: see [01-access-and-profile.md](01-access-and-profile.md).

---

## Goals

### US-GOL-01 · Set a goal (Open programme)

**As a** mentee in Open mentoring, **I want** to set a goal with topics, **so that** I get relevant suggestions.
**Requirements:** FR-GOL-001, FR-GOL-005, FR-PRF-008, FR-MAT-011 · **Screens:** SCR-11 · **Slice:** S4

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-GOL-01.1 | **Given** I open Goals, **when** I create a goal with a title and taxonomy tags, **then** it is saved as `draft` and I can mark one as primary. | P |
| AC-GOL-01.2 | **Given** a draft goal, **when** I activate it, **then** its state becomes `active` and it counts for recommendations if its visibility allows. | P |
| AC-GOL-01.3 | **Given** a goal visibility of "Only me", **when** matching, a mentor or a PM reads my goals, **then** the title and tags are not returned and do not affect matching. | N |
| AC-GOL-01.4 | **Given** I share a goal in a mentor request, **when** the mentor opens the request, **then** they see that goal's title; **given** I did not share it, **then** they see topic labels only. | N |

### US-GOL-02 · Set three SMART goals (Leadership)

**As a** Leadership mentee, **I want** to agree three SMART goals with tasks, **so that** the programme has clear outcomes.
**Requirements:** FR-GOL-003, FR-GOL-002, FR-GOL-007 · **Screens:** SCR-11 · **Slice:** S8

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-GOL-02.1 | **Given** I am in an active Leadership relationship, **when** I open Goals, **then** I see a three-goal template with the SMART fields (specific, measurable, achievable, relevant, time-bound) and a place for tasks. | P |
| AC-GOL-02.2 | **Given** a draft goal with an incomplete SMART field, **when** I try to activate it, **then** activation is blocked and the missing field is named. | N |
| AC-GOL-02.3 | **Given** I have fewer than C-025 active goals after the initial meeting, **when** I open Home, **then** my main card is "Missing goal" until I have them. | P |
| AC-GOL-02.4 | **Given** my mentor, **when** they open my goals, **then** they can read and comment on them as a member of the relationship but cannot change my goal's state. | N |

### US-GOL-03 · Track milestones and actions, and close a goal

**As a** member, **I want** to track milestones and actions, **so that** progress is visible to me and my mentor.
**Requirements:** FR-GOL-001, FR-GOL-002, FR-SES-005 · **Screens:** SCR-11 · **Slice:** S8

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-GOL-03.1 | **Given** an active goal, **when** I add a milestone or action with owner and due date, **then** it appears for both members. | P |
| AC-GOL-03.2 | **Given** a Leadership action, **when** I mark it done, **then** I am asked for a difficulty rating of 1–5. | P |
| AC-GOL-03.3 | **Given** I mark a goal as achieved in Leadership, **when** I confirm, **then** my mentor is asked to confirm before the state becomes `achieved`. | P |
| AC-GOL-03.4 | **Given** an action past its due date that I own, **when** I open Home, **then** it appears as "Overdue action" in the priority order. | P |
| AC-GOL-03.5 | **Given** a relationship that is `closed` or `completed`, **when** I try to reopen a goal, **then** it is rejected. | N |

### US-GOL-04 · Follow phase milestones (SparkLab)

**As a** SparkLab team member, **I want** phase milestones for develop, design and test, **so that** the mentor and the team share a plan.
**Requirements:** FR-GOL-004, FR-RPT-003 · **Screens:** SCR-11 · **Slice:** S8

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-GOL-04.1 | **Given** a SparkLab team relationship, **when** I open Goals, **then** I see the three phases with their milestones and the current phase. | P |
| AC-GOL-04.2 | **Given** I am the team lead or the mentor, **when** I mark a phase complete, **then** a progress report for that phase becomes due (D14). | P |
| AC-GOL-04.3 | **Given** I am a team member who is neither lead nor mentor, **when** I try to complete a phase, **then** the control is not offered and a direct request is "not found". | N |

---

## Discovery and matching

### US-MAT-01 · See recommended mentors and why

**As a** mentee in Open mentoring, **I want** the top suggestions with plain reasons, **so that** I can choose confidently.
**Requirements:** FR-MAT-001, FR-MAT-003, FR-MAT-008, FR-MAT-010, FR-MAT-017 · **Screens:** SCR-05 · **Slice:** S11

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-MAT-01.1 | **Given** I have a goal, **when** I open Discover, **then** I see at most C-024 recommended mentors, each with at most C-034 plain-language reasons in my language and no percentages or scores. | P |
| AC-MAT-01.2 | **Given** a reason would apply to ≥ C-060 of the candidate pool, **when** explanations are built, **then** it is not shown. | P |
| AC-MAT-01.3 | **Given** a mentor is excluded for any reason (e.g. my manager, no common language, capacity full), **when** I browse or look at recommendations, **then** that mentor is absent or shows only "Not available for requests in this programme." and never the cause. | N |
| AC-MAT-01.4 | **Given** a Russian-language user, **when** a reason contains a count, **then** the plural form is correct (1, 2, 5, 11, 21). | P |
| AC-MAT-01.5 | **Given** I have shared no goals, **when** I open Discover, **then** I see Browse and a prompt to set a goal; the recommended list is not shown empty without explanation. | N |

### US-MAT-02 · Browse mentors

**As a** mentee, **I want** to browse and filter mentors, **so that** I can explore beyond the top suggestions.
**Requirements:** FR-MAT-008, FR-MAT-015, FR-PRF-011 · **Screens:** SCR-05, SCR-06 · **Slice:** S11

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-MAT-02.1 | **Given** Browse, **when** I filter by topic, language or availability, **then** only matching non-excluded mentors are listed in default ranking order. | P |
| AC-MAT-02.2 | **Given** a mentor card, **when** it renders, **then** it shows sessions completed and "available this week" and **never** a star rating or score. | N |
| AC-MAT-02.3 | **Given** a mentor's field is "Only me" or not visible to mentees, **when** I open their profile, **then** it is not shown. | N |
| AC-MAT-02.4 | **Given** I search "Mammadov", **when** results load, **then** Məmmədov is found in under C-122 at the 95th percentile. | P |

### US-MAT-03 · Request a mentor

**As a** mentee, **I want** to send a request to a mentor, **so that** we can start mentoring.
**Requirements:** FR-MAT-008, FR-REL-005, FR-MSG-005 · **Screens:** SCR-06 · **Slice:** S11

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-MAT-03.1 | **Given** I have fewer than C-023 open requests, **when** I send one, **then** the mentor is notified (N-030) and the request shows as pending with its expiry (C-002). | P |
| AC-MAT-03.2 | **Given** I already have C-023 open requests, **when** I try to send another, **then** it is blocked with the reason in my language. | N |
| AC-MAT-03.3 | **Given** I am already matched in this programme, **when** I try to request another mentor, **then** it is blocked (exclusion ALREADY_MATCHED, shown neutrally). | N |
| AC-MAT-03.4 | **Given** the mentor has not replied by C-003, **when** the reminder time is reached, **then** one reminder is sent to the mentor (N-031) and no second reminder follows. | P |
| AC-MAT-03.5 | **Given** a request is not answered by C-002, **when** the time passes, **then** it expires, I am told neutrally (N-032), and the slot is freed. | P |
| AC-MAT-03.6 | **Given** I withdraw my request, **when** I confirm, **then** the mentor is no longer asked and the slot is freed. | P |

### US-MAT-04 · Answer a mentoring request (mentor)

**As a** mentor, **I want** to accept or decline a request, **so that** I stay in control of my capacity.
**Requirements:** FR-MAT-011, FR-MAT-014, FR-REL-005, FR-REL-007 · **Screens:** SCR-07 · **Slice:** S11

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-MAT-04.1 | **Given** I open a request, **when** it loads, **then** I see the mentee's name and topic labels only; goal titles only if the mentee shared them. | N |
| AC-MAT-04.2 | **Given** I have capacity, **when** I accept, **then** the match becomes `accepted`, a relationship is created and the mentee is notified (N-033). | P |
| AC-MAT-04.3 | **Given** two mentees' requests are accepted at the same moment and only one slot remains, **when** both accepts run, **then** exactly one succeeds and the other is told the request can no longer be accepted. | N |
| AC-MAT-04.4 | **Given** I decline, **when** I confirm, **then** the mentee sees only the neutral "not taken forward" (N-034), no reason is stored or shown to them, and the same pair is excluded for C-004. | N |
| AC-MAT-04.5 | **Given** the request has expired, **when** I try to accept, **then** it is rejected as no longer open. | N |

### US-MAT-05 · Accept a Leadership proposal

**As a** mentor or mentee in Leadership, **I want** to accept or decline the PM's proposed pairing, **so that** both of us agree before starting.
**Requirements:** FR-REL-002, FR-REL-003, FR-MAT-012 · **Screens:** SCR-07 · **Slice:** S6

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-MAT-05.1 | **Given** the PM published a proposal, **when** I open Home, **then** my main card is "A proposal waiting on me" with the deadline (C-001). | P |
| AC-MAT-05.2 | **Given** I accept and my counterpart has not yet answered, **when** I look at the proposal, **then** it shows "waiting for {name}" and nothing is created yet. | P |
| AC-MAT-05.3 | **Given** both of us accepted within C-001, **when** the second acceptance arrives, **then** the match becomes `accepted`, capacity is re-checked atomically and a relationship is created (N-038). | P |
| AC-MAT-05.4 | **Given** I decline, **when** I give a reason, **then** only the PM can read it, the counterpart sees only that the proposal was not taken forward, and no email carries the reason. | N |
| AC-MAT-05.5 | **Given** C-001 passes with a pending answer, **when** the time expires, **then** the match becomes `expired` and the PM is notified (N-039). | P |
| AC-MAT-05.6 | **Given** I am neither party of the proposal, **when** I open its address, **then** I get "not found". | N |

### US-MAT-06 · Accept a mentor for the team (SparkLab)

**As a** SparkLab mentor or team lead, **I want** to accept the pairing, **so that** the team and mentor start together.
**Requirements:** FR-REL-004, FR-MAT-016 · **Screens:** SCR-07 · **Slice:** S6

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-MAT-06.1 | **Given** a SparkLab proposal, **when** I am the mentor or the team lead, **then** I can accept or decline; other team members are notified, not asked. | P |
| AC-MAT-06.2 | **Given** the mentor already has the default number of teams (C-021), **when** acceptance is attempted, **then** it fails atomically and the PM is notified. | N |
| AC-MAT-06.3 | **Given** a team member who is not the lead, **when** they open the proposal action, **then** the accept/decline controls are absent and a direct call is "not found". | N |
| AC-MAT-06.4 | **Given** both accepted, **when** the match is `accepted`, **then** every team member receives "your team has a mentor" (N-038). | P |

### US-MAT-07 · Ask for a different mentor (rematch)

**As a** mentee or team lead, **I want** to ask for a rematch with a reason, **so that** a poor fit does not trap me.
**Requirements:** FR-MAT-013, FR-REL-009, FR-GOL-006 · **Screens:** SCR-08 · **Slice:** S6

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-MAT-07.1 | **Given** an active relationship, **when** I choose "Ask for a different mentor", **then** I must give a reason from a list (optional note) before continuing. | P |
| AC-MAT-07.2 | **Given** the rematch preview, **when** it shows my goals, **then** only goals I tick move to the new mentor; notes, reflections and messages are not offered. | N |
| AC-MAT-07.3 | **Given** the rematch is confirmed, **when** it completes, **then** my previous mentor is informed only that the relationship has closed (N-042) and cannot see my reason. | N |
| AC-MAT-07.4 | **Given** rematch, **when** new candidates are generated, **then** the previous mentor is excluded unless the PM overrides. | N |
