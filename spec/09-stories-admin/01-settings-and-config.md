# Admin stories — settings and configuration centre

**Batch 3, part A · DRAFT.** Same story and acceptance-criteria format as [Batch 2](../06-stories-participant/01-access-and-profile.md): **Kind** is **P** (positive) or **N** (negative/permission). Numbers are cited by constant ID. Settings rules: [constants §0](../01-prd/constants.md).

---

### US-PRG-01 · Set meeting cadence and mentor capacity

**As a** programme manager, **I want** to set how often pairs should meet and how many mentees or teams a mentor can take, **so that** health signals and matching reflect how this programme really works.
**Requirements:** FR-PRG-010, FR-PRG-013, FR-PRG-014 · **Screens:** SCR-20 · **Slice:** S3

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-PRG-01.1 | **Given** a new programme created from a template, **when** I open Settings → General, **then** cadence and mentor capacity (default and maximum) show the starting defaults from C-020 and C-021 and are editable. | P |
| AC-PRG-01.2 | **Given** I enter a cadence outside 1–90 days or a maximum capacity below the default, **when** I save, **then** nothing is saved and the field shows which bound was violated in my language. | N |
| AC-PRG-01.3 | **Given** I change the cadence on an active programme, **when** I confirm the impact summary, **then** a new settings version is saved, health rules use the new cadence from the next evaluation, and sessions and matches already made are unchanged. | P |
| AC-PRG-01.4 | **Given** I am a PM of programme X, **when** I request the settings of programme Y by address, **then** I get "not found". | N |
| AC-PRG-01.5 | **Given** I save a change, **when** I open the audit log, **then** the entry shows my id, the settings group, the programme and the new version id, and no setting values as text. | N |

### US-PRG-02 · Tune matching settings with a what-if preview

**As a** programme manager, **I want** to change matching factors, thresholds, weights and exclusion switches and see the effect first, **so that** I never discover a bad setting only after pairs were suggested.
**Requirements:** FR-PRG-009, FR-PRG-013, FR-PRG-014, FR-PRG-015, FR-MAT-018, FR-ADM-003 · **Screens:** SCR-20, SCR-21 · **Slice:** S6

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-PRG-02.1 | **Given** Settings → Matching, **when** I open it, **then** I see weights (totalling 100), expertise depth factors, primary-goal multiplier, sub-score tables, thresholds and exclusion switches, each with its starting default marked and any changed value highlighted (C-050 … C-060, C-070 … C-072, C-080 … C-092). | P |
| AC-PRG-02.2 | **Given** I edit values, **when** I choose "Preview impact", **then** the engine runs read-only on the current cohort and shows how many candidate lists, top-5 recommendations and draft pairs would change, and nothing is stored. | P |
| AC-PRG-02.3 | **Given** weights that do not total 100, depth factors out of order, or a band score outside 0–1, **when** I try to save or preview, **then** it is rejected with the specific reason and the previous version stays in force. | N |
| AC-PRG-02.4 | **Given** I turn off an overridable exclusion (e.g. mentor junior to mentee), **when** I try to turn off "same person", "blocked" or "mentor not approved", **then** those switches are locked on and cannot be changed. | N |
| AC-PRG-02.5 | **Given** I save new matching settings, **when** earlier matches are viewed later, **then** each still shows the settings version it was scored with, and recomputation is never done in place. | N |
| AC-PRG-02.6 | **Given** I am a mentor, mentee, assessor or content manager, **when** I try to open matching settings, **then** I get "not found"; participants see only the effects (their explanations), never weights or factors. | N |

### US-PRG-03 · Configure timings, reminders and cool-offs

**As a** programme manager, **I want** to set reminder lead times and cool-off periods, **so that** nudges arrive when they help rather than annoy.
**Requirements:** FR-MSG-009, FR-VET-013, FR-PRG-013 · **Screens:** SCR-20 · **Slice:** S3

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-PRG-03.1 | **Given** Settings → Timings, **when** I open it, **then** I see the Open-request reminder (C-003), assessment, proposal and report reminders (C-153, C-154, C-157), the wrap-up and no-goal nudges (C-155, C-156), the re-application cool-off (C-151), the availability horizon (C-150) and minimum reason length (C-152) with their defaults. | P |
| AC-PRG-03.2 | **Given** a reminder lead time that falls after the event it relates to (e.g. a proposal reminder later than the deadline), **when** I save, **then** it is rejected with the reason. | N |
| AC-PRG-03.3 | **Given** I shorten a reminder lead time, **when** the change is saved, **then** reminders already scheduled keep their original time and new ones use the new value. | N |
| AC-PRG-03.4 | **Given** a cool-off of 0 days, **when** a rejected applicant re-applies, **then** they may apply immediately; **given** 180 days, **then** the application is blocked until the date shown to them neutrally. | P |
| AC-PRG-03.5 | **Given** I am a PM without scope on this programme, **when** I try to change its timings, **then** it is "not found" and nothing changes. | N |

### US-PRG-04 · Review history, compare versions, restore

**As a** programme manager or org admin, **I want** to see every settings change, compare any two versions, and go back, **so that** a mistake is reversible and a change is explainable.
**Requirements:** FR-PRG-014, FR-PRG-016, FR-ADM-004 · **Screens:** SCR-20 · **Slice:** S3

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-PRG-04.1 | **Given** Settings → History, **when** I open it, **then** I see each version with number, group, who saved it and when. | P |
| AC-PRG-04.2 | **Given** two selected versions, **when** I choose "Compare", **then** a side-by-side diff shows every changed value with old and new side by side and nothing unchanged. | P |
| AC-PRG-04.3 | **Given** an earlier version, **when** I choose "Restore", **then** a new version is saved with the old values (the old version is unchanged), after the same validation and impact summary as any save. | P |
| AC-PRG-04.4 | **Given** a group, **when** I choose "Restore defaults", **then** it is returned to the starting values in the constants table and the values that differed from defaults are listed before I confirm. | P |
| AC-PRG-04.5 | **Given** any saved version, **when** anyone tries to edit or delete it, **then** the database rejects it (versions are immutable). | N |
| AC-PRG-04.6 | **Given** I am a participant or an assessor, **when** I request a history address, **then** I get "not found". | N |

### US-PRG-05 · Switch features on and off with feature flags

**As an** org admin or PM, **I want** to control optional features per organisation or programme, **so that** each is enabled only when it is allowed and ready.
**Requirements:** FR-ADM-005, FR-PRG-012, FR-AIA-002, FR-RPT-003 · **Screens:** SCR-20, SCR-22 · **Slice:** S3 (framework), flags land with their slices

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-PRG-05.1 | **Given** Settings → Flags, **when** I open it, **then** I see each flag (SMART-goal assistant, agenda assistant, AI translation, attachments, Open mentoring, optional Open reports) with its current state, scope and who last changed it. | P |
| AC-PRG-05.2 | **Given** a flag with an unmet prerequisite (AI without recorded DPIA sign-off; attachments without recorded storage approval), **when** I try to switch it on, **then** it is blocked and the missing prerequisite is named. | N |
| AC-PRG-05.3 | **Given** the organisation AI kill switch is off, **when** I look at a programme's AI flags, **then** they are shown as overridden and cannot make AI run. | N |
| AC-PRG-05.4 | **Given** I am a PM, **when** I try to change an organisation-level flag, **then** the control is absent and a direct call is "not found"; programme-level flags in my scope are editable. | N |
| AC-PRG-05.5 | **Given** a flag change, **when** it is saved, **then** it is a new settings version, audited by id, and users see the effect on their next page load. | P |

### US-PRG-06 · Export, import and clone settings; programme templates

**As an** org admin or PM, **I want** to export, import and clone settings and save a configured programme as a template, **so that** a good setup can be reused and moved safely.
**Requirements:** FR-ADM-006, FR-PRG-003, FR-PRG-014 · **Screens:** SCR-20 · **Slice:** S3

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-PRG-06.1 | **Given** a programme, **when** I choose "Export settings", **then** I get a file with a schema version and settings values only — no people, no free text, no ids of people. | P |
| AC-PRG-06.2 | **Given** a settings file, **when** I import it into a programme, **then** it is validated as a whole, shows a diff against the current settings, and saves a new version only after I confirm. | P |
| AC-PRG-06.3 | **Given** a file with out-of-bounds values or an unknown schema version, **when** I import it, **then** nothing is saved and every problem is listed. | N |
| AC-PRG-06.4 | **Given** a configured programme, **when** I choose "Save as template", **then** a template is stored in my organisation with settings, rubric reference and report schedule, and appears when creating a programme. | P |
| AC-PRG-06.5 | **Given** I am a PM, **when** I try to import a file into a programme outside my scope, **then** it is "not found" and nothing changes. | N |

---

### US-TEN-04 · Manage organisation sign-in and session security

**As an** org admin, **I want** to tune link lifetime, attempt limits and session timeouts within safe limits, **so that** security fits our environment without breaking sign-in for colleagues.
**Requirements:** FR-TEN-016, FR-TEN-008, FR-PRG-014 · **Screens:** SCR-22 · **Slice:** S1

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-TEN-04.1 | **Given** Settings → Security, **when** I open it, **then** I see link and code lifetime, code attempts, per-email and per-browser request limits, and idle and absolute session lifetimes with their defaults (C-041, C-042, C-046, C-043). | P |
| AC-TEN-04.2 | **Given** a value outside the platform's minimum or maximum, or request limits so low that 100 colleagues behind one office address could not all sign in (C-045), **when** I save, **then** it is rejected with the reason. | N |
| AC-TEN-04.3 | **Given** I save a security change, **when** it takes effect, **then** it applies to new sign-ins and new sessions; existing sessions end only when their old limits are reached. | P |
| AC-TEN-04.4 | **Given** I am not an org admin, **when** I request the security settings, **then** I get "not found". | N |
| AC-TEN-04.5 | **Given** a security change, **when** I save, **then** I am asked for my authenticator code (step-up) before it is applied. | N |

### US-TEN-05 · Adjust logo and brand within safe limits

**As an** org admin, **I want** to change the logo and brand colours within limits, **so that** the platform feels like our organisation without breaking readability.
**Requirements:** FR-ADM-028, FR-PRV-010 · **Screens:** SCR-22 · **Slice:** S1 (theme), editor with S3

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-TEN-05.1 | **Given** Settings → Brand, **when** I open it, **then** I can change the logo and the six brand tokens only (font family stays Manrope with Noto Sans fallback, radius and border width are fixed). | P |
| AC-TEN-05.2 | **Given** a colour choice that fails the contrast checks in light or dark theme, **when** I try to save, **then** it is blocked and the failing pairs are listed. | N |
| AC-TEN-05.3 | **Given** a valid change, **when** I preview, **then** I see sample screens in light and dark before saving; **when** I save, **then** a new settings version is created and I can restore the previous one. | P |
| AC-TEN-05.4 | **Given** I try to upload custom CSS, a different font or set a custom domain, **when** I look at the editor, **then** those controls do not exist. | N |
| AC-TEN-05.5 | **Given** I upload a logo, **when** it is not a valid image by content (not by extension) or exceeds the size limit, **then** it is rejected. | N |
