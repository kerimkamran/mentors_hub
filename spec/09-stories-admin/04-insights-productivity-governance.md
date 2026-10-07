# Admin stories — insights, productivity, governance, platform

**Batch 3, part A · DRAFT.** Format as in [01-settings-and-config.md](01-settings-and-config.md).

---

## Insights

### US-ADM-12 · See the programme funnel

**As a** programme manager, **I want** to see how people move from enrolment to reporting, **so that** I can find where they drop off.
**Requirements:** FR-ADM-017, FR-HLT-008, FR-HLT-009 · **Screens:** SCR-27 · **Slice:** S10

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-12.1 | **Given** a cohort, **when** I open Insights → Funnel, **then** I see counts at each stage: enrolled, matched, first session held, first check-in, first report submitted (Leadership/SparkLab), and the drop-off between stages. | P |
| AC-ADM-12.2 | **Given** the funnel, **when** I choose "Table view", **then** the same numbers appear as a table, and the chart is not colour-only. | P |
| AC-ADM-12.3 | **Given** a stage derived from feedback with fewer than C-028 respondents, **when** it renders, **then** the value is hidden and explained. | N |
| AC-ADM-12.4 | **Given** a drop-off count, **when** I click it, **then** I see names and status only for the people at that stage — no content of any kind. | N |
| AC-ADM-12.5 | **Given** a PM outside the programme's scope, **when** they request the funnel, **then** it is "not found". | N |

### US-ADM-13 · Schedule summary exports

**As a** programme manager or org admin, **I want** weekly or monthly summaries delivered to chosen people, **so that** leadership stays informed without logging in.
**Requirements:** FR-ADM-018, FR-HLT-009 · **Screens:** SCR-27 · **Slice:** S10

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-13.1 | **Given** Insights → Scheduled exports, **when** I create one, **then** I choose the programme, the report (KPIs, funnel, health counts), frequency (weekly or monthly per C-168), format (CSV or PDF) and recipients from people with admin or PM roles. | P |
| AC-ADM-13.2 | **Given** a scheduled export runs, **when** recipients are notified, **then** the email contains a link only; the file is downloaded after signing in and is available only to named recipients. | N |
| AC-ADM-13.3 | **Given** the export content, **when** it is generated, **then** it contains aggregates only, values under C-028 respondents are suppressed, and CSV cells starting `=`, `+`, `-` or `@` are neutralised. | N |
| AC-ADM-13.4 | **Given** a recipient who has lost the role or scope, **when** the next run happens, **then** they are skipped and I am notified. | N |
| AC-ADM-13.5 | **Given** a PM, **when** they create an export, **then** it can cover only their own programmes. | N |
| AC-ADM-13.6 | **Given** each run, **when** it completes, **then** an audit entry records the export, recipients and time by id. | P |

---

## Productivity

### US-ADM-14 · Jump anywhere with the command palette

**As an** admin, **I want** to press Ctrl/Cmd+K and type to go to a programme, person, page or action, **so that** I rarely need to browse menus.
**Requirements:** FR-ADM-019, FR-PRF-011 · **Screens:** SCR-34 · **Slice:** S3 (grows with each slice)

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-14.1 | **Given** any admin page, **when** I press Ctrl/Cmd+K, **then** a palette opens with focus in the search field and closes with Escape. | P |
| AC-ADM-14.2 | **Given** I type "mammadov" or "ozbek", **when** results appear, **then** Məmmədov and Özbək are found (C-115) in under C-122 at the 95th percentile. | P |
| AC-ADM-14.3 | **Given** results, **when** they render, **then** I see only programmes, people, pages and actions my role and scope permit; items I may not use never appear and no "hidden results" hint is shown. | N |
| AC-ADM-14.4 | **Given** an action result (e.g. "Invite person"), **when** I select it, **then** it opens the screen for that action — it never performs a change directly from the palette. | N |
| AC-ADM-14.5 | **Given** a screen reader or keyboard-only use, **when** I use the palette, **then** results are announced, arrow keys move, Enter opens, and focus returns to the previous element on close. | P |
| AC-ADM-14.6 | **Given** a participant, **when** they press the shortcut in the participant area, **then** the admin palette does not open. | N |

### US-ADM-15 · Act on many rows with a preview

**As an** org admin or PM, **I want** to apply an action to many rows after seeing exactly what will happen, **so that** bulk work is fast and safe.
**Requirements:** FR-ADM-020, FR-ADM-027 · **Screens:** SCR-28 · **Slice:** S3

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-15.1 | **Given** a list, **when** I select rows and choose a bulk action (invite, nominate, withdraw, send reminder), **then** a preview lists what will change and what will be skipped, with the reason for each skip. | P |
| AC-ADM-15.2 | **Given** the preview, **when** I confirm, **then** the action runs, a summary shows done / skipped / failed counts, and one audit entry records the batch by ids. | P |
| AC-ADM-15.3 | **Given** a row the actor may not act on, **when** the action runs, **then** that row is skipped and reported as "not found", even if it was selected in the preview. | N |
| AC-ADM-15.4 | **Given** a bulk erasure, **when** I start it, **then** it requires four-eyes approval and does not run until approved. | N |
| AC-ADM-15.5 | **Given** bulk reminders, **when** they are sent, **then** emails follow the notification catalogue (names and links only). | N |
| AC-ADM-15.6 | **Given** the confirmation, **when** I use only a keyboard or a screen reader, **then** the preview table and confirm dialog are fully operable and announced. | P |

### US-ADM-16 · Explore roles and permissions

**As an** org admin, **I want** to see who holds which role and what each role can do, **so that** access reviews take minutes.
**Requirements:** FR-ADM-021, FR-TEN-010, FR-TEN-011 · **Screens:** SCR-29 · **Slice:** S1

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-16.1 | **Given** the explorer, **when** I open Roles, **then** I see each role with holders, scope (organisation, programme, cohort) and when it was granted and by whom. | P |
| AC-ADM-16.2 | **Given** a role, **when** I open "What can this role do?", **then** the list is generated from the same permission map the code enforces, not from separate documentation. | P |
| AC-ADM-16.3 | **Given** a person, **when** I open "Effective access", **then** I see their roles, scopes and participations and what each allows — and nothing about their private content. | N |
| AC-ADM-16.4 | **Given** I am a PM, **when** I open the explorer, **then** I see roles within my scope read-only; any other role gets "not found". | N |
| AC-ADM-16.5 | **Given** a line manager relationship, **when** I check effective access for a manager, **then** it shows no access by virtue of being a manager (D3). | N |

### US-ADM-17 · Preview emails in all languages

**As an** org admin or content manager, **I want** to preview every notification email in English, Azerbaijani and Russian with sample data, **so that** wording and layout are right before pilot.
**Requirements:** FR-ADM-022, FR-MSG-005, FR-PRV-006 · **Screens:** SCR-31 · **Slice:** S3

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-17.1 | **Given** the catalogue, **when** I choose a notification and a language, **then** I see the rendered email with synthetic names, dates and links, including plural forms (Russian one/few/many). | P |
| AC-ADM-17.2 | **Given** a preview, **when** it renders, **then** it uses synthetic fixtures only and reads no real person's data. | N |
| AC-ADM-17.3 | **Given** a notification with a missing translation, **when** I preview it, **then** the gap is flagged and the translation-completeness gate shows red. | N |
| AC-ADM-17.4 | **Given** a preview at narrow widths and with text 35% longer than English (C-112), **when** I switch the layout toggle, **then** I can check there is no clipping. | P |
| AC-ADM-17.5 | **Given** I am a PM, assessor or any non-admin role other than content manager, **when** I open the preview, **then** it is "not found". | N |

---

## Governance

### US-ADM-18 · Post announcements

**As an** org admin or PM, **I want** to post a banner or message to a programme or the whole organisation, **so that** people hear about changes in the product.
**Requirements:** FR-ADM-023, FR-MSG-005 · **Screens:** SCR-30 · **Slice:** S3

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-18.1 | **Given** Announcements, **when** I create one, **then** I choose scope (organisation, or a programme in my scope), text up to C-164, a start and an end date, and I see a preview in each language I provide. | P |
| AC-ADM-18.2 | **Given** an announcement without an end date or over the length limit, **when** I save, **then** it is rejected with the reason. | N |
| AC-ADM-18.3 | **Given** an active announcement, **when** a participant in scope opens any page, **then** they see a dismissible banner in their language; participants outside scope do not see it. | P |
| AC-ADM-18.4 | **Given** an announcement, **when** it is created, **then** no email is sent unless I explicitly choose "also notify", and any email carries a link only. | N |
| AC-ADM-18.5 | **Given** I am a PM, **when** I try to post to the whole organisation, **then** the option is absent and a direct call is "not found". | N |

### US-ADM-19 · Require a second admin for sensitive actions

**As an** org admin, **I want** the riskiest actions to need a second admin's approval, **so that** no single person can change them alone.
**Requirements:** FR-ADM-024, FR-TEN-009, FR-IMP-009 · **Screens:** SCR-29 · **Slice:** S1

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-19.1 | **Given** I choose residency sign-off, safeguarding-contact change, granting the org-admin role, or bulk erasure, **when** I submit, **then** a pending approval request is created and nothing happens yet. | P |
| AC-ADM-19.2 | **Given** a pending request, **when** a different org admin opens it, **then** they see the action and ids only and can approve (with their own authenticator code) or reject; **when** approved, **then** the action executes and both admins are recorded. | P |
| AC-ADM-19.3 | **Given** my own request, **when** I try to approve it, **then** the database rejects it. | N |
| AC-ADM-19.4 | **Given** fewer than C-163 org admins in the organisation, **when** I request a four-eyes action, **then** it is refused with an explanation, and the pilot-gate checklist shows this as open. | N |
| AC-ADM-19.5 | **Given** a request unanswered for C-160, **when** the time passes, **then** it expires, nothing executes and the requester is notified. | N |
| AC-ADM-19.6 | **Given** an approval is pending, **when** admins open the alert centre, **then** it appears as an alert for every other org admin. | P |

### US-ADM-20 · Manage my sessions and sign users out

**As an** admin, **I want** to see and revoke my own sessions, **and as an** org admin **I want** to force a user to sign out, **so that** a lost device or an incident is contained.
**Requirements:** FR-ADM-025, FR-TEN-009 · **Screens:** SCR-32 · **Slice:** S1

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-20.1 | **Given** Account → My sessions, **when** I open it, **then** I see each active session with browser, approximate location, last active time and a mark for "this device". | P |
| AC-ADM-20.2 | **Given** another of my sessions, **when** I choose "Sign out", **then** that session ends immediately. | P |
| AC-ADM-20.3 | **Given** I am an org admin, **when** I choose "Sign out everywhere" on a user and enter my authenticator code, **then** all that user's sessions end and the action is audited by ids. | P |
| AC-ADM-20.4 | **Given** I am not an org admin, **when** I try to end another user's session, **then** it is "not found". | N |
| AC-ADM-20.5 | **Given** a session list, **when** it renders, **then** it shows no page content or activity detail from those sessions. | N |

### US-ADM-21 · Operate the tenant console (platform admin)

**As a** platform admin, **I want** to create and disable organisations and see whether isolation holds, **so that** adding a second organisation is configuration, and I can prove it is safe.
**Requirements:** FR-ADM-026, FR-TEN-001, FR-TEN-002 · **Screens:** SCR-33 · **Slice:** S1

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-21.1 | **Given** the tenant console, **when** I create an organisation with name, locales, default time zone and email domains, **then** it is created empty with a first org admin invitation. | P |
| AC-ADM-21.2 | **Given** an organisation, **when** I disable it, **then** its users cannot sign in, no data is deleted, and the action is audited by id. | P |
| AC-ADM-21.3 | **Given** the usage view, **when** I open it, **then** I see counts only (people, programmes, active relationships, jobs) per organisation and never names or content. | N |
| AC-ADM-21.4 | **Given** the isolation self-check, **when** I run it, **then** it executes the tenant-isolation catalogue checks (every tenant table has forced RLS; no-context queries return nothing) and shows pass/fail per check. | P |
| AC-ADM-21.5 | **Given** I am not a platform admin, **when** I request the tenant console, **then** it is "not found". | N |
| AC-ADM-21.6 | **Given** a platform admin, **when** they try to open any organisation's people, notes, messages or reports, **then** there is no path to do so. | N |

### US-ADM-22 · Browse the people directory and export it

**As an** org admin or PM, **I want** to search imported people and see their participation, **so that** I can find who I need and export a list when appropriate.
**Requirements:** FR-ADM-027, FR-IMP-008, FR-PRV-001 · **Screens:** SCR-28 · **Slice:** S2

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-22.1 | **Given** the directory, **when** I search and filter by name, department, programme and participation status, **then** results appear in under C-122 at the 95th percentile with Azerbaijani/Russian folding. | P |
| AC-ADM-22.2 | **Given** a person, **when** I open their record, **then** I see name, department, participation and status; grade bucket and reporting line only if I am an org admin; never their notes, messages or goals' content. | N |
| AC-ADM-22.3 | **Given** "Export CSV", **when** I run it, **then** only the allowlisted columns for my role are included, cells starting `=`, `+`, `-` or `@` are neutralised, and the export is logged with my id and filters. | N |
| AC-ADM-22.4 | **Given** I am a PM, **when** I open the directory, **then** I see only people in my programmes; **when** I try to export, **then** basic fields only. | N |
| AC-ADM-22.5 | **Given** any other role, **when** they request the directory, **then** it is "not found". | N |

---

## Appearance and usability

### US-ADM-23 · Work comfortably in any theme, density and screen size

**As an** admin, **I want** light and dark themes, dense tables, and a layout that works on a phone, **so that** I can work how I prefer and from anywhere.
**Requirements:** FR-ADM-029, FR-PRV-008 · **Screens:** SCR-19, SCR-28 · **Slice:** S3

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-ADM-23.1 | **Given** the admin panel, **when** I choose light, dark or "follow my device", **then** every screen switches and every colour pair passes the contrast gate in both themes. | P |
| AC-ADM-23.2 | **Given** a long list, **when** I choose "Dense", **then** the table shows more rows per screen with a column chooser and sortable columns, and I can move between cells with arrow keys. | P |
| AC-ADM-23.3 | **Given** a 320 px width or 400% zoom, **when** I perform any admin action, **then** it is possible without horizontal scrolling of the page. | P |
| AC-ADM-23.4 | **Given** status, health or alert states, **when** displayed in either theme or density, **then** each is conveyed by text and icon as well as colour. | N |
| AC-ADM-23.5 | **Given** my theme and density choice, **when** I sign in on another device, **then** my preferences are remembered, and no preference exposes any other person's data. | P |
