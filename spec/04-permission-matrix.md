# Permission matrix

**Applies to:** FR-TEN-010 to FR-TEN-012 · INV-2, INV-4 · decisions D3, D15, D16
**Implementation:** the matrix below is the source for the single permission map in code (`permissions.ts`). A test (T-INV4-04) asserts every cell. Where this document and the code disagree, the build fails.

## 1. Rules of the matrix

1. **Deny by default.** A cell not marked allowed is denied.
2. **Denied means "not found".** A denied read or write on an id returns the same response as a non-existent id (INV-4.3). The only exception is an action on an object the user *can* see but may not perform (e.g. a mentee clicking a disabled PM-only button is impossible by UI, and by API returns "not found").
3. **Roles are scoped.** `org` = whole organisation, `prog` = one programme, `cohort` = one cohort. A role grants nothing outside its scope.
4. **Participation is not a role.** Mentor, mentee and team lead are participations in a programme and are evaluated per relationship.
5. **RLS is a second wall.** Even if this map had a bug, INV-1 and INV-2 deny at the database.
6. **Line managers have no row anywhere in this matrix** (D3). They hold no role, participation or export access by virtue of being a manager.

## 2. Actors

| Code | Actor | Scope | How acquired |
|---|---|---|---|
| **PA** | Platform admin | global | provisioned outside the app |
| **OA** | Organisation admin | org | granted by PA or OA; TOTP required |
| **PM** | Programme manager | prog / cohort | granted by OA |
| **AS** | Assessor | prog | granted by PM per application (conflict-checked) |
| **CM** | Content manager | org / prog | granted by OA |
| **SG** | Safeguarding contact | org (named contact) | named by OA; fallback = OA |
| **ME** | Mentee (or team member) | relationship | participation |
| **MO** | Mentor | relationship | participation (approved) |
| **TL** | Team lead | team relationship | participation attribute |
| **AP** | Applicant / nominee | own application | participation |
| **SP** | Sponsor | — | **not a user**; receives an export |
| **LM** | Line manager | — | **no access** |

## 3. Conditions used in cells

| Mark | Meaning |
|---|---|
| **Y** | Allowed within the actor's scope |
| **–** | Denied ("not found") |
| **own** | Only the actor's own record |
| **M** | Actor is a **member** of that relationship/team |
| **A** | Actor is the **author** |
| **S** | Within actor's **scope** (org/programme/cohort) |
| **S+PM** | Org admin allowed **only if** they also hold a PM role on that programme (D15) |
| **agg** | Aggregate only, hidden below C-028 (5) respondents |
| **ts** | Timestamps and status only, never content (INV-2.4) |
| **vis** | Subject to the owner's per-field visibility (§5) |
| **aud** | Allowed and written to the audit log |

## 4. Matrix

### 4.1 Tenancy, identity, settings

| Action | PA | OA | PM | AS | CM | SG | ME | MO | AP | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Create organisation | Y | – | – | – | – | – | – | – | – | |
| Read organisation settings | Y | Y | S (read) | – | – | – | – | – | – | |
| Change organisation settings (languages, domains, AI kill switch) | – | Y aud | – | – | – | – | – | – | – | Platform admin does not edit tenant settings |
| Record data-residency sign-off (INV-8.3) | – | Y aud (TOTP) | – | – | – | – | – | – | – | |
| Name safeguarding contact | – | Y aud | – | – | – | – | – | – | – | |
| Grant / revoke roles | – | Y aud | S (PM, AS only) aud | – | – | – | – | – | – | PM cannot grant OA or PM |
| Sign in | own | own | own | own | own | own | own | own | own | Only active HR-import people or explicit PM invitees (FR-TEN-005) |
| Enrol TOTP | Y | Y | – | – | – | – | – | – | – | Required for PA, OA |
| View audit log | – | Y | S (own programme actions) | – | – | – | – | – | – | Ids and statuses only |

### 4.2 People and import

| Action | PA | OA | PM | AS | CM | SG | ME | MO | AP | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Run people import | – | Y aud | S aud | – | – | – | – | – | – | Real data blocked until INV-8.3 |
| View import preview / error file | – | Y | S | – | – | – | – | – | – | |
| View a person's name and department | – | Y | S (programme people) | assigned only | – | – | vis | vis | own | |
| View grade bucket / reporting line | – | Y | S (needed for exclusions) | – | – | – | – | – | – | **Never** shown to ME/MO; matching reads them but does not display |
| Invite a person not in the import | – | Y aud | S aud | – | – | – | – | – | – | |
| Deactivate a person | – | Y aud | – | – | – | – | – | – | – | Import does it in bulk |

### 4.3 Programmes and content

| Action | PA | OA | PM | AS | CM | SG | ME | MO | AP | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Create programme from template | – | Y aud | – | – | – | – | – | – | – | **[PROPOSED]** PM may create (OQ-B1-24) |
| Edit programme config (weights, exclusions, cadence, sponsors) | – | Y | S aud | – | – | – | – | – | – | Weights must total 100 |
| Activate / close programme | – | Y | S aud | – | – | – | – | – | – | |
| Edit matching settings (factors, sub-scores, thresholds, weights, exclusion switches, horizon) | – | Y aud | S aud | – | – | – | – | – | – | Validated as a set; saves a new immutable version (FR-PRG-014) |
| Edit cadence, capacity default/maximum, reminder and nudge timings, cool-off, reason length | – | Y aud | S aud | – | – | – | – | – | – | Bounds in constants §0 |
| Edit organisation sign-in/security and session-timing settings | – | Y aud (TOTP) | – | – | – | – | – | – | – | Within platform-enforced minimums/maximums |
| View settings history; restore a previous version or the defaults | – | Y aud | S aud | – | – | – | – | – | – | Restore saves a new version |
| Set own mentor capacity (up to the programme maximum) | – | – | – | – | – | – | – | own | – | Lowering below current load notifies the PM |
| Read programme config | – | Y | S | – | S | – | summary | summary | summary | Participants see rules, not weights |
| Edit taxonomy, rubrics (new version), resources, templates | – | Y | – | – | Y | – | – | – | – | Rubrics immutable once used |
| Machine-translate admin content | – | Y (if AI on) | – | – | Y (if AI on) | – | – | – | – | INV-6 guard |
| Enable AI assistants (org / programme) | – | Y (org) | S (programme) | – | – | – | – | – | – | |

### 4.4 Profiles, goals, availability

| Action | PA | OA | PM | AS | CM | SG | ME | MO | AP | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Read own profile | own | own | own | own | own | own | own | own | own | |
| Edit own profile, visibility, availability | – | own | own | own | own | own | own | own | own | |
| Read another person's profile fields | – | – | S (basic only) | – | – | – | vis (mentors in programme) | vis (mentees who requested them, or relationship) | – | Only fields set visible |
| Create / edit own goals | – | – | – | – | – | – | own | own (as mentee in another programme) | – | |
| Read a mentee's goals | – | – | **tags and status only** (S) | – | – | – | own | M, only shared goals or in-relationship goals | – | Mentors see topic labels, goal titles only if shared |
| Read mentor availability | – | – | S | – | – | – | vis | own | – | |

### 4.5 Mentor vetting

| Action | PA | OA | PM | AS | CM | SG | ME | MO | AP | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Nominate a person | – | – | S aud | – | – | – | – | – | – | |
| Submit application | – | – | – | – | – | – | – | – | own | |
| Read application | – | – | S | assigned | – | – | – | – | own | |
| Assign assessor | – | – | S aud | – | – | – | – | – | – | Conflict blocked (self, direct manager, direct report) |
| Submit assessment | – | – | – | assigned | – | – | – | – | – | Blind until own submitted (FR-VET-006) |
| Read other assessors' scores | – | – | S (after all submitted) | after own submitted | – | – | – | – | – | |
| Record decision | – | – | S aud (reason if differs from band) | – | – | – | – | – | – | |
| Read decision and released feedback | – | – | S | – | – | – | – | – | own | Item-level scores hidden; included in data export |
| Suspend a mentor | – | – | S aud | – | – | – | – | – | – | |

### 4.6 Matching and relationships

| Action | PA | OA | PM | AS | CM | SG | ME | MO | TL | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| See recommended / browse (Open) | – | – | – | – | – | – | Y (own programme) | – | – | Only non-excluded candidates; neutral line otherwise |
| Send request (Open) | – | – | – | – | – | – | Y (max 2 open) | – | – | |
| Answer request (Open) | – | – | – | – | – | – | – | Y (recipient) | – | |
| Generate draft / edit / publish matches | – | – | S aud | – | – | – | – | – | – | Publishing re-checks all pairs |
| Override a hard exclusion | – | – | S aud (reason) | – | – | – | – | – | – | Not for SAME_PERSON, BLOCKED, NOT_APPROVED |
| See score breakdown and engine version | – | – | S | – | – | – | – | – | – | |
| See explanation reasons (≤3) | – | – | S | – | – | – | Y (own candidates) | topic labels only | Y | |
| Accept / decline proposal (Leadership) | – | – | – | – | – | – | Y (mentee party) | Y (mentor party) | – | Decline reason private to PM |
| Accept / decline proposal (SparkLab) | – | – | – | – | – | – | notified only | Y | Y | Other members notified |
| Read decline reason | – | – | S (private) | – | – | – | – | – | – | In-app only, never email |
| Pause / leave relationship | – | – | – | – | – | – | M | M | M | Immediate; PM notified |
| Start rematch | – | – | S aud | – | – | – | M (request) | – | M | Reason required |
| Read relationship list | – | – | S (ts + status) | – | – | – | M | M | M | |

### 4.7 Scheduling and sessions

| Action | PA | OA | PM | AS | CM | SG | ME | MO | TL | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Book / reschedule / cancel session | – | – | – | – | – | – | M | M | M | |
| See session time, status, attendance | – | – | S (ts + status) | – | – | – | M | M | M | |
| Read agenda | – | – | – | – | – | – | M | M | M | |
| Read shared notes, decisions, reflections | – | – | **–** | – | – | – | M | M | M | INV-2.1 |
| Read private notes | – | – | **–** | – | – | – | A | A | A | INV-2.2 |
| Write / edit notes | – | – | – | – | – | – | M | M | M | |
| Create actions | – | – | – | – | – | – | M | M | M | |
| Read messages | – | – | **–** | – | – | – | M | M | M | |
| Send message | – | – | – | – | – | – | M | M | M | |
| Submit check-in | – | – | – | – | – | – | own | own | own | |
| Read own check-in answers | – | – | – | – | – | – | own | own | own | |
| See check-in "support requested" flag | – | – | S (flag + names) | – | – | – | own | – | own | No text |
| See usefulness aggregates | – | – | S agg | – | – | – | – | – | – | Hidden under 5 respondents |

### 4.8 Reports and export

| Action | PA | OA | PM | AS | CM | SG | ME | MO | SP | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Write / submit progress report (incl. one amendment) | – | – | – | – | – | – | – | M (mentor) | – | |
| Read progress report | – | S+PM | S | – | – | – | M (mentee of that relationship) | M (author) | – | D3, D15 |
| Waive a report | – | – | S aud (reason) | – | – | – | – | – | – | |
| Configure sponsors | – | – | S aud | – | – | – | – | – | – | |
| Export final-evaluation pack | – | S+PM aud | S aud | – | – | – | – | – | receives export | Every export logged with recipients (D15) |
| See who will see the pack | – | – | S | – | – | – | own | – | – | At enrolment and on final report |

### 4.9 Concerns and health

| Action | PA | OA | PM | AS | CM | SG | ME | MO | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Report a concern | – | – | – | – | – | – | M | M | Routed to SG; OA fallback when contact unset or conflicted |
| Read a concern | – | **fallback only** | **–** | – | – | Y | – | author's own submission only | **Never the PM** (D16) |
| Act on / close a concern | – | fallback only | – | – | – | Y aud | – | – | |
| See relationship health flags | – | – | S (codes + names + ts) | – | – | – | – | – | ts only |
| See "Where should I intervene?" list | – | – | S | – | – | – | – | – | |
| See dashboard KPIs | – | Y (org-wide agg) | S agg | – | – | – | – | – | |
| See exclusion counts and override log | – | Y | S | – | – | – | – | – | Fairness gap acknowledged (§14) |

### 4.10 Privacy and AI

| Action | PA | OA | PM | AS | CM | SG | ME | MO | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Request own data export | – | own | own | own | own | own | own | own | Includes own item-level assessment scores |
| Request erasure / anonymisation | – | own | own | own | own | own | own | own | Executed per retention rules |
| Process data-subject request (manual procedure pre-S13) | – | Y aud | – | – | – | – | – | – | Pilot gate |
| Use AI assistant | – | – | – | – | – | – | Y (if all four switches allow) | Y (if all four allow) | INV-6.2 |
| Toggle AI kill switch | – | Y aud | – | – | – | – | – | – | |

### 4.11 Advanced admin panel

Conditions as in §3. Platform admin (PA) never reads tenant content. **Four-eyes** = requires approval by a different org admin (FR-ADM-024).

| Action | PA | OA | PM | AS | CM | SG | ME | MO | AP | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Open admin home, dashboard, alert centre | – | Y (org agg) | S agg | – | – | – | – | – | – | Alerts trimmed to the viewer's scope |
| Search audit log | – | Y | S (own programme actions) | – | – | – | – | – | – | Ids and statuses only |
| Export audit log to CSV | – | Y aud | – | – | – | – | – | – | – | Logged with recipient |
| View override and exclusion log | – | Y | S | – | – | – | – | – | – | Reason text visible to admins only |
| View data-request queue; process a request | – | Y aud | – | – | – | – | – | – | – | Erasure in bulk is four-eyes |
| View consent records and retention runs | – | Y | – | – | – | – | – | – | – | |
| View job queue; retry a job | PA (platform health, ids only) | Y aud (retry) | – | – | – | – | – | – | – | No payloads |
| View email delivery log; resend | – | Y aud | S (own programme, status only) | – | – | – | – | – | – | Never content |
| View import run history | – | Y | S | – | – | – | – | – | – | |
| View system status page | Y | Y | – | – | – | – | – | – | – | |
| View pilot-gate checklist | – | Y | S (read) | – | – | – | – | – | – | |
| View programme funnel | – | Y agg | S agg | – | – | – | – | – | – | Aggregates only |
| Create or edit a scheduled export | – | Y aud | S aud (own programme, aggregates) | – | – | – | – | – | – | Delivered as an authenticated link |
| Use command palette | Y | Y | Y | Y | Y | Y | – | – | – | Results permission-trimmed |
| Run a bulk action (after preview) | – | Y aud | S aud | – | – | – | – | – | – | Each row permission-checked |
| Open role and permission explorer | – | Y | S (read, own scope) | – | – | – | – | – | – | |
| Preview email templates (synthetic data) | – | Y | – | – | Y | – | – | – | – | |
| Post an announcement | – | Y aud | S aud (own programme) | – | – | – | – | – | – | Text only; no private content |
| Edit feature flags | – | Y aud (org and programme) | S aud (programme flags only) | – | – | – | – | – | – | Prerequisites enforced |
| Export, import, clone settings; manage templates | – | Y aud | S aud (own programme) | – | – | – | – | – | – | Settings only, never people data |
| Edit brand tokens and logo | – | Y aud | – | – | – | – | – | – | – | Blocked unless contrast passes |
| Request a four-eyes action | – | Y | – | – | – | – | – | – | – | |
| Approve a four-eyes action | – | Y aud (not the requester; TOTP) | – | – | – | – | – | – | – | Sees action and ids only |
| See own active sessions; revoke own | own | own | own | own | own | own | own | own | own | |
| Force sign-out of another user | – | Y aud (TOTP) | – | – | – | – | – | – | – | |
| Open tenant console; create or disable an organisation | Y aud | – | – | – | – | – | – | – | – | Usage counts and isolation self-check only |
| View people directory | – | Y | S (basic) | – | – | – | – | – | – | |
| Export people directory to CSV | – | Y aud | S aud (basic fields only) | – | – | – | – | – | – | Grade and reporting line only for OA; formula-injection neutralised |

## 5. Profile-field visibility levels

Each profile field and each goal has one level, chosen by the owner. **Default is "Only me"** for every field except name and department **[PROPOSED]** (OQ-B1-19).

| Level | Who can read | Read by matching engine? |
|---|---|---|
| **Only me** | owner | **No** |
| **Mentors in my programme / Mentees in my programme** | approved participants in the same programme, in discovery | Yes |
| **People I request or match with** | the counterpart of a request, proposal or relationship | Yes |
| **PM only (basic)** | PM within scope (name, department, programme status) | n/a |

The engine therefore sees exactly the fields a person has allowed (INV-7.2, FR-PRF-010). Grade bucket and reporting line are HR inputs: they are not profile fields, are never displayed, and are read only by the engine and by PMs for exclusion purposes.

## 6. Responses to forbidden requests

| Situation | Response |
|---|---|
| Read or write an id the actor may not see | "Not found" page / `404` with the generic body |
| Action on a visible object that the actor may not perform | `404` generic (not `403`) |
| Role-scoped list | Only in-scope rows; counts reflect only in-scope rows |
| Search/autocomplete | Only in-scope hits; no "N results hidden" hint |
| API validation failure on an allowed action | Normal validation error (the actor already knows the object exists) |

## 7. Tests

| ID | Test |
|---|---|
| T-PM-01 | Each cell of §4 asserted: allow/deny for each (actor, action) pair, with and without scope |
| T-PM-02 | Org admin without PM role cannot read a report; with PM role on that programme, can (D15) |
| T-PM-03 | Concern notification and read: PM-role-only user cannot read or be notified (D16) |
| T-PM-04 | Mentor cannot read mentee goal titles unless shared |
| T-PM-05 | Line manager (user who is the direct manager of a mentee) sees nothing for that mentee |
| T-PM-06 | Grade bucket and reporting line absent from every participant-facing payload |
| T-PM-07 | Default visibility is "Only me" for new profile fields |
