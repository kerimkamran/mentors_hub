# Advanced admin panel — overview and decision record

**Batch 3, part A · DRAFT.** The admin area ("Manage") is an operations console in the style of the organisation's other tools. This document records *what* was chosen and why; stories are in [09-stories-admin/](09-stories-admin/), screens in [10-screens-admin.md](10-screens-admin.md), requirements as `FR-ADM-nnn` in the [PRD §5.17](01-prd/README.md).

> **Source of the feature list.** SparkLab, Vantage and AI Hub could not be opened from this session, so the capability list was built by **interview**: the programme owner accepted or declined each candidate capability one by one (2 October 2026). It has not yet been compared line by line with those tools. Once access is available, a comparison pass should check for anything those tools do that is missing here (OQ-B1-46).

## 1. Principles

1. **Advanced, but private by design.** No admin view — however powerful — can show notes, reflections, messages, concern text, decline reasons, check-in text or any free text (INV-2, INV-3, FR-ADM-030). Logs, exports, previews and alerts are built from ids, statuses, counts, timestamps and error codes.
2. **Everything configurable is versioned, validated and auditable.** Numeric parameters are admin-managed settings with bounds, immutable versions, diff, restore and defaults ([constants §0](01-prd/constants.md)).
3. **Sensitive changes need two people.** Four-eyes approval for the four highest-risk actions.
4. **One permission system.** The admin panel adds no new authorisation logic; the explorer reads the same permission map the code enforces (INV-4).
5. **Power without hiding the basics.** The Plan's PM workflows (dashboard, intervene list, matching, vetting, reports, concerns) remain the daily path; advanced tools sit beside them.
6. **Accessible and usable at every size.** Light/dark themes, dense keyboard-operable tables, a 320 px layout, WCAG 2.2 AA (FR-ADM-029).

## 2. Information architecture

The Plan's *Manage* items stay; three sections are added (FR-ADM-001). Items are trimmed to the viewer's role and scope.

| Section | Items | Screens |
|---|---|---|
| **Home** | Dashboard · Intervene list · Alert centre | SCR-19 |
| **Programmes** | Programmes and cohorts · Settings (General, Matching, Exclusions, Timings, Flags, History/Diff) · What-if preview · Templates | SCR-20, SCR-21 |
| **People** | Directory · Bulk actions · Invitations | SCR-28 |
| **Vetting · Matching · Relationships · Reports · Content** | *Core workflows — Batch 3 part B* | — |
| **Insights** | Programme funnel · Scheduled exports | SCR-27 |
| **Compliance** | Audit log · Override and exclusion log · Data requests · Consent and retention | SCR-23, SCR-24 |
| **Operations** | Job queue · Email delivery · Import history · System status · Pilot-gate checklist | SCR-25, SCR-26 |
| **Governance** | Roles and permissions · Approvals (four-eyes) · Announcements · Email template preview | SCR-29, SCR-30, SCR-31 |
| **Settings (organisation)** | Security and sessions · Feature flags · Brand and theme | SCR-22 |
| **Account** | My sessions and devices | SCR-32 |
| **Platform** (platform admin only) | Tenant console · System status | SCR-33, SCR-25 |
| **Global** | Command palette (Ctrl/Cmd+K) | SCR-34 |

## 3. Decision record — capabilities offered and chosen

Every candidate capability was offered once. **Chosen** items are specified in this batch; **Not chosen** items are out of scope unless the owner reopens them.

| Area | Capability | Decision | Where specified |
|---|---|---|---|
| Settings | Version diff | **Chosen** | FR-ADM-004, US-PRG-04 |
| Settings | What-if impact preview | **Chosen** | FR-ADM-003, US-PRG-02 |
| Settings | Feature flags | **Chosen** | FR-ADM-005, US-PRG-05 |
| Settings | Clone / export settings (+ templates, chosen as extra) | **Chosen** | FR-ADM-006, US-PRG-06 |
| Audit | Audit log search and CSV | **Chosen** | FR-ADM-007, US-ADM-01 |
| Audit | Override and exclusion log | **Chosen** | FR-ADM-008, US-ADM-02 |
| Audit | Data-request queue | **Chosen** | FR-ADM-009, US-ADM-03 |
| Audit | Consent and retention view | **Chosen** | FR-ADM-010, US-ADM-04 |
| Operations | Job queue viewer | **Chosen** | FR-ADM-011, US-ADM-05 |
| Operations | Email delivery log | **Chosen** | FR-ADM-012, US-ADM-06 |
| Operations | Import run history | **Chosen** | FR-ADM-013, US-ADM-07 |
| Operations | System status page | **Chosen** | FR-ADM-014, US-ADM-08 |
| Analytics | Programme funnel | **Chosen** | FR-ADM-017, US-ADM-12 |
| Analytics | Scheduled exports | **Chosen** | FR-ADM-018, US-ADM-13 |
| Analytics | KPI-versus-targets and health drill-down as *extra* widgets | **Not chosen as extras** — but the Plan's PM dashboard (KPIs, health breakdown, intervene list, S10) is still delivered | FR-ADM-002, FR-HLT-005/006, US-HLT-02, US-HLT-03 |
| Productivity | Command palette | **Chosen** | FR-ADM-019, US-ADM-14 |
| Productivity | Bulk actions with preview | **Chosen** | FR-ADM-020, US-ADM-15 |
| Productivity | Role and permission explorer | **Chosen** | FR-ADM-021, US-ADM-16 |
| Productivity | Saved views and filters | **Not chosen** | — |
| Content | Email template preview | **Chosen** | FR-ADM-022, US-ADM-17 |
| Content | Translation manager, taxonomy manager (merge tooling), rubric builder | **Not chosen** — baseline editing stays as the Plan requires (content manager edits taxonomy, resources and templates; rubrics are seeded and versioned) | — |
| Governance | In-app announcements | **Chosen** | FR-ADM-023, US-ADM-18 |
| Governance | Four-eyes approval | **Chosen** (residency sign-off, safeguarding contact change, grant org admin, bulk erasure; blocked until 2 org admins exist) | FR-ADM-024, US-ADM-19 |
| Governance | Session and device manager | **Chosen** | FR-ADM-025, US-ADM-20 |
| Governance | Tenant console (platform admin) | **Chosen** | FR-ADM-026, US-ADM-21 |
| Appearance | Dark mode · Dense table mode · Mobile-friendly admin | **Chosen** | FR-ADM-029, US-ADM-23 |
| Appearance | Brand/theme editor | **Chosen as a limited editor** (logo and six tokens, contrast-gated); a recorded exception to the Plan's "no white-label self-service" | FR-ADM-028, US-TEN-05 |
| Extras | Pilot-gate checklist · Admin alert centre · Programme template library · People directory with CSV | **Chosen** | FR-ADM-016, -015, -006, -027 |

## 4. Deliberately not offered

Features that would contradict the Plan's privacy principles are *not* part of the admin panel even though some admin tools have them:

- **"View as user" / impersonation** — would expose private content (INV-2).
- **Reading or searching notes, reflections or messages**, even for support.
- **Raw data browsers or SQL consoles** over tenant tables.
- **Per-person "engagement scores"** or ranked lists of mentors/mentees.

## 5. Scope boundaries

- **Part A (this batch):** advanced panel capabilities above, the PM dashboard and intervene list.
- **Part B (not yet written):** core admin workflows — programme creation, people import, vetting (assessor side and decisions), matching admin (generate draft, publish, overrides), relationships list, reports and sponsor pack, safeguarding handling, content management, and the test plan and decision log.
- **Out of scope for the MVP** (Plan §14) still applies: external participants, line-manager views, SSO other than Entra ID later, Graph, Oracle HCM sync.

## 6. Open points from this decision round

Tracked in [open-questions-batch1.md](01-prd/open-questions-batch1.md): OQ-B1-46 (compare this list with SparkLab, Vantage, AI Hub and other internal tools once accessible), OQ-B1-47 (the limited brand editor is an exception to the Plan's "no white-label self-service", §14), and OQ-B1-48 (who the two org admins will be before the pilot gate, since four-eyes actions are blocked until two exist).
