# Admin stories — operations, alerts, pilot gate, admin home

**Batch 3, part A · DRAFT.** Format as in [01-settings-and-config.md](01-settings-and-config.md). Operational views show ids, statuses, counts and error codes — never content (INV-3.10).

---

### US-ADM-05 · Watch and retry background jobs

**As an** org admin, **I want** to see background jobs and retry failed ones, **so that** emails, reminders, imports and retention never silently stall.
**Requirements:** FR-ADM-011, NFR-REL-003, NFR-OBS-004 · **Screens:** SCR-25 · **Slice:** S3

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-05.1 | **Given** jobs have run, **when** I open Operations → Jobs, **then** I see per queue the counts queued, running, succeeded and failed, and a list with job id, type, status, attempts, last error code and times. | P |
| AC-ADM-05.2 | **Given** a failed job, **when** I choose "Retry", **then** it is re-queued once, the action is audited by id, and a job that already succeeded cannot be retried. | P |
| AC-ADM-05.3 | **Given** a job, **when** I open its row, **then** I see no payload, no recipient address and no content. | N |
| AC-ADM-05.4 | **Given** job history older than C-162, **when** the retention job runs, **then** it is purged. | P |
| AC-ADM-05.5 | **Given** I am a PM or any non-admin role, **when** I request the job queue, **then** it is "not found"; a platform admin sees platform-wide health only, never tenant job details. | N |

### US-ADM-06 · Check email delivery

**As an** org admin, **I want** to see whether notification emails were delivered, **so that** a "nobody got the email" report can be diagnosed without reading mail.
**Requirements:** FR-ADM-012, FR-MSG-008, NFR-OBS-004 · **Screens:** SCR-25 · **Slice:** S3

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-06.1 | **Given** notifications were sent, **when** I open Email delivery, **then** I see per notification: template code, recipient name, status (queued, sent, deferred, bounced, failed), error code and time. | P |
| AC-ADM-06.2 | **Given** a bounced or failed delivery, **when** I choose "Resend", **then** one new attempt is queued and logged; a delivered email cannot be resent from here. | P |
| AC-ADM-06.3 | **Given** the log, **when** I inspect any row, **then** no subject, body, link token or sign-in code appears. | N |
| AC-ADM-06.4 | **Given** at least C-165's volume and bounce rate within 24 hours, **when** the threshold is crossed, **then** an alert appears in the alert centre. | P |
| AC-ADM-06.5 | **Given** I am a PM, **when** I open the log, **then** I see only status for notifications of my programmes and cannot resend; any other role gets "not found". | N |

### US-ADM-07 · Review import runs

**As an** org admin or PM, **I want** a history of HR imports, **so that** I can see what changed and fetch the error file.
**Requirements:** FR-ADM-013, FR-IMP-003, FR-IMP-007, FR-IMP-009, FR-IMP-010 · **Screens:** SCR-25 · **Slice:** S2

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-07.1 | **Given** import runs, **when** I open Import history, **then** each shows date, who ran it, dry-run or confirmed, counts (created, updated, deactivated, rejected) and state. | P |
| AC-ADM-07.2 | **Given** a run with rejected rows, **when** I choose "Download error file", **then** I get the file with a reason per row, and cells starting `=`, `+`, `-` or `@` are neutralised. | P |
| AC-ADM-07.3 | **Given** the page header, **when** I read it, **then** it shows whether data-residency sign-off is recorded; **given** it is not, **then** only synthetic or pseudonymised imports are marked as allowed. | P |
| AC-ADM-07.4 | **Given** raw rows older than C-104, **when** I open an old run, **then** the counts remain but the raw rows and error file are gone. | N |
| AC-ADM-07.5 | **Given** I am a PM outside the programme's scope or any non-admin role, **when** I open another run, **then** it is "not found". | N |

### US-ADM-08 · See system status

**As an** admin, **I want** a status page for the platform's parts, **so that** I know whether a problem is on our side.
**Requirements:** FR-ADM-014, NFR-REL-004, NFR-SEC-008 · **Screens:** SCR-25 · **Slice:** S0 (basic) → S14

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-08.1 | **Given** the status page, **when** I open it, **then** I see database, worker, mail sender, storage and migration status each with state (healthy, degraded, down), the last-checked time and a reference code for any problem. | P |
| AC-ADM-08.2 | **Given** a component is down, **when** the page renders, **then** it shows the state as text and icon and links to the related alert; it shows no hostnames, credentials or stack traces. | N |
| AC-ADM-08.3 | **Given** the latest migration failed, **when** I open the page, **then** it shows "migration failed" and that the previous version remains in service (fail closed). | P |
| AC-ADM-08.4 | **Given** a participant, PM-only or assessor user, **when** they request the status page, **then** it is "not found". | N |

### US-ADM-09 · Work from one alert centre

**As an** admin, **I want** a single prioritised list of things that need me, **so that** nothing important sits unseen.
**Requirements:** FR-ADM-015, FR-HLT-006 · **Screens:** SCR-19 · **Slice:** S10

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-09.1 | **Given** several conditions, **when** I open the alert centre, **then** I see failed jobs, bounce spike, overdue and due-soon data requests, mentors over capacity, unanswered proposals and pending approvals in priority order with a link to each. | P |
| AC-ADM-09.2 | **Given** an alert, **when** its condition clears (job succeeds, request closed), **then** it disappears without manual dismissal. | P |
| AC-ADM-09.3 | **Given** I am a PM, **when** I open the centre, **then** I see only alerts about my programmes (e.g. unanswered proposals, mentors over capacity) and none about platform operations or other programmes. | N |
| AC-ADM-09.4 | **Given** an alert, **when** it is shown, **then** it carries names, counts and links only — no content, reasons or free text. | N |

### US-ADM-10 · Track the pilot gate

**As a** programme owner or org admin, **I want** a live checklist for the Leadership pilot gate, **so that** we know exactly what blocks go-live.
**Requirements:** FR-ADM-016, FR-IMP-009, FR-PRV-005 · **Screens:** SCR-26 · **Slice:** S10

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-10.1 | **Given** the checklist, **when** I open it, **then** I see each gate item with a status: slices S0–S10 complete, data-residency sign-off recorded, safeguarding contact named, manual data-request procedure documented, at least C-163 org admins. | P |
| AC-ADM-10.2 | **Given** an item completed in the product (e.g. sign-off recorded, contact named, second admin added), **when** I reopen the page, **then** it shows done with who and when. | P |
| AC-ADM-10.3 | **Given** items not detectable by the product (slice completion, procedure documented), **when** I mark one as done, **then** I must name the evidence link or document, and the mark is audited. | P |
| AC-ADM-10.4 | **Given** any item is open, **when** I try to import real HR data or invite pilot participants, **then** the product blocks it and points to the open item. | N |
| AC-ADM-10.5 | **Given** I am a PM, **when** I open the checklist, **then** it is read-only; any other role gets "not found". | N |

### US-HLT-02 · See programme health and KPIs on the dashboard (Plan S10)

**As a** programme manager, **I want** a dashboard of KPIs against targets and a health breakdown, **so that** I can see how the programme is doing at a glance.
**Requirements:** FR-ADM-002, FR-HLT-005, FR-HLT-007, FR-HLT-008, FR-HLT-009, FR-HLT-010 · **Screens:** SCR-19 · **Slice:** S10

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-HLT-02.1 | **Given** a programme, **when** I open Dashboard, **then** I see the six measures (C-130 … C-135) against their targets, computed from the platform's own records, and a health breakdown by rule (I1, I2, A2, A4, A5). | P |
| AC-HLT-02.2 | **Given** any chart, **when** I choose "Table view", **then** the same numbers appear as an accessible table. | P |
| AC-HLT-02.3 | **Given** usefulness or check-in data with fewer than C-028 respondents, **when** the dashboard renders, **then** the value is hidden and explained. | N |
| AC-HLT-02.4 | **Given** a health count, **when** I click it, **then** I land on a list of relationships showing names, status, code and the timestamp involved — never notes, messages or check-in text. | N |
| AC-HLT-02.5 | **Given** a PM of programme X, **when** they request programme Y's dashboard, **then** it is "not found". | N |

### US-HLT-03 · Know where to intervene (Plan S10)

**As a** programme manager, **I want** an ordered "Where should I intervene?" list, **so that** my weekly time goes where it helps most.
**Requirements:** FR-HLT-006, FR-HLT-002 · **Screens:** SCR-19 · **Slice:** S10

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-HLT-03.1 | **Given** items exist, **when** I open the list, **then** they appear in the fixed order: support requests, inactive relationships, matches with no first session after C-006, unanswered proposals or requests, mentors over capacity, overdue reports. | P |
| AC-HLT-03.2 | **Given** several items in the same tier, **when** the list renders, **then** the oldest comes first. | P |
| AC-HLT-03.3 | **Given** a support request, **when** I open it, **then** I see the two names, relationship and date, and no text from the check-in. | N |
| AC-HLT-03.4 | **Given** a relationship that is paused or closed, **when** the list is built, **then** inactivity items are not produced for it. | N |
| AC-HLT-03.5 | **Given** an item outside my programme scope, **when** I request it by address, **then** it is "not found". | N |
