# Admin stories — audit and compliance

**Batch 3, part A · DRAFT.** Format as in [01-settings-and-config.md](01-settings-and-config.md). Every view here reads ids, statuses, counts, timestamps and error codes only (INV-3.10).

---

### US-ADM-01 · Search the audit log and export it

**As an** org admin, **I want** to filter the audit log and export it, **so that** I can answer "who did what, when" without reading anyone's content.
**Requirements:** FR-ADM-007, FR-PRV-001, FR-ADM-030 · **Screens:** SCR-23 · **Slice:** S13 (viewer; log itself from S1)

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-01.1 | **Given** the audit log, **when** I filter by actor, action, programme, object type and date range, **then** only matching entries appear, newest first, in under C-121 at the 95th percentile at reference scale. | P |
| AC-ADM-01.2 | **Given** any entry, **when** I open it, **then** it shows actor id and display name, action code, object type and id, status and time — and no free text. | N |
| AC-ADM-01.3 | **Given** a filter, **when** I choose "Export CSV", **then** the file contains the same columns, cells beginning with `=`, `+`, `-` or `@` are neutralised, and the export itself is logged with my id and filter. | P |
| AC-ADM-01.4 | **Given** I am a PM, **when** I open the audit log, **then** I see only entries about actions on my programmes; **when** I try to export, **then** the control is absent. | N |
| AC-ADM-01.5 | **Given** I am a participant, assessor, content manager or safeguarding user, **when** I request the audit log by address, **then** I get "not found". | N |
| AC-ADM-01.6 | **Given** an export larger than the row limit, **when** I request it, **then** I am asked to narrow the date range; nothing partial is delivered silently. | N |

### US-ADM-02 · Review overrides and exclusion counts

**As an** org admin or PM, **I want** a log of every matching override and counts of exclusions, **so that** fairness questions can be answered even though protected attributes are not stored.
**Requirements:** FR-ADM-008, FR-HLT-011, FR-MAT-002 · **Screens:** SCR-23 · **Slice:** S6

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-02.1 | **Given** PMs have overridden exclusions, **when** I open the override log, **then** I see per override: programme, pair (names), exclusion code, who overrode, when, and the reason text. | P |
| AC-ADM-02.2 | **Given** the exclusion counts view, **when** I choose a programme and period, **then** I see counts per exclusion code and how many were overridden, with no names. | P |
| AC-ADM-02.3 | **Given** a PM, **when** they open the log, **then** they see only their programmes; **given** any other role, **then** "not found". | N |
| AC-ADM-02.4 | **Given** the reason text, **when** it appears in the log, **then** it is visible to admins only and never copied into audit entries, notifications or exports. | N |
| AC-ADM-02.5 | **Given** the log, **when** I read its header, **then** it states the acknowledged gap: protected attributes are not stored, so fairness cannot be measured against them. | P |

### US-ADM-03 · Work the data-request queue

**As an** org admin, **I want** a queue of export and erasure requests with deadlines, **so that** no request is missed and the manual procedure is followed before self-service exists.
**Requirements:** FR-ADM-009, FR-PRV-004, FR-PRV-005 · **Screens:** SCR-24 · **Slice:** S13 (manual checklist from pilot gate)

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-03.1 | **Given** a user requests an export or erasure, **when** it arrives, **then** it appears in the queue with type, requester, received date and the response target (C-166). | P |
| AC-ADM-03.2 | **Given** a request approaching its target, **when** C-167 is reached, **then** an alert appears in the alert centre and the request is marked "due soon"; past the target it is marked "overdue". | P |
| AC-ADM-03.3 | **Given** I open a request, **when** I work it, **then** I follow a checklist (verify identity, run export or anonymisation, confirm delivery) and each step is recorded by id and time. | P |
| AC-ADM-03.4 | **Given** an erasure request that is part of a bulk erasure, **when** I start it, **then** it needs four-eyes approval before it runs. | N |
| AC-ADM-03.5 | **Given** a request, **when** I view it, **then** I see no content of the requester's notes or messages; the export is generated and delivered only to the requester. | N |
| AC-ADM-03.6 | **Given** any other role, **when** they request the queue by address, **then** it is "not found". | N |

### US-ADM-04 · See consents and retention runs

**As an** org admin, **I want** to see who accepted which notice version and what the retention jobs did, **so that** I can show compliance.
**Requirements:** FR-ADM-010, FR-PRV-003, FR-PRV-009 · **Screens:** SCR-24 · **Slice:** S13

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-04.1 | **Given** consent records, **when** I open Consent, **then** I see per notice version the counts accepted and pending and can list who has not yet accepted the current version. | P |
| AC-ADM-04.2 | **Given** retention jobs, **when** I open Retention, **then** I see each run with date, data class (C-100 … C-104), counts deleted or anonymised, and the next scheduled run. | P |
| AC-ADM-04.3 | **Given** a retention run, **when** it is listed, **then** it shows counts only, never which person's data was removed or any content. | N |
| AC-ADM-04.4 | **Given** I am not an org admin, **when** I request consents or retention runs, **then** it is "not found". | N |
