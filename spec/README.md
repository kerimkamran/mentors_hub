# Mentorship Hub — Specification

**Batches 1, 2 and 3A (admin panel) of 3 · drafts for review · 2 October 2026**
Batch 1 awaits sign-off; Batches 2 and 3A are drafted ahead of it and will need revisiting if Batch 1 decisions change. Batch 3B (remaining admin and operations epics) is not yet written.
Derived from *Mentorship Hub — Product & Delivery Plan v1.0* (decisions D1–D16). Per D1, the specification is reviewed in three batches before any code is written.

## Contents (Batch 1)

| # | Document | What it settles |
|---|---|---|
| 1 | [PRD](01-prd/README.md) | Goals, personas, programme types, **199 requirement IDs** across 17 epics (incl. Home and the advanced admin panel) |
| 1a | [Constants table](01-prd/constants.md) | Every number, threshold and default, with ID and status (FIXED / DEFAULT / PROPOSED) |
| 1b | [Matching specification](01-prd/matching-spec.md) | Pipeline, hard exclusions, scoring formulas, explanations, property tests |
| 1c | [Notification catalogue](01-prd/notification-catalogue.md) | Every email / in-app notification, recipients, content limits, tests |
| 1d | [Non-functional requirements](01-prd/nfr.md) | Security, privacy, accessibility, i18n, performance, reliability |
| 1e | [Open questions](01-prd/open-questions-batch1.md) | 48 items the Plan leaves open, each with a proposal, owner and needed-by milestone; the numeric ones are resolved as admin-managed settings |
| 2 | [Glossary EN/AZ/RU](02-glossary.md) | Single vocabulary (AZ/RU provisional, pending native review) |
| 3 | [Invariants](03-invariants.md) | The eight never-compromised principles → numbered rules → enforcing tests |
| 4 | [Permission matrix](04-permission-matrix.md) | Action × role × scope; "not found" semantics; field visibility levels |
| 5 | [Domain model](05-domain-model.md) | Entities, six state machines, health rules I1/I2/A2/A4/A5, intervene list, Home priority |

### Batch 2 (draft)

| # | Document | What it settles |
|---|---|---|
| 6 | [Participant stories](06-stories-participant/) | 40 user stories, 180 Given/When/Then acceptance criteria with IDs; every story has at least one negative/permission case |
| 7 | [Participant screens](07-screens-participant.md) | 18 screens (sign-in → privacy), 12 cross-cutting UX rules |
| 8 | [Traceability matrix](08-traceability.md) | **Generated**: requirement → story → criteria → screen → test |

### Batch 3, part A — advanced admin panel (draft)

| # | Document | What it settles |
|---|---|---|
| 9 | [Admin panel overview](09-admin-panel.md) | Principles, information architecture, the capabilities chosen and deliberately not offered (no impersonation, no content browsing, no SQL console) |
| 9a | [Admin stories](09-stories-admin/) | 32 stories, 166 acceptance criteria: settings and configuration centre, audit and compliance, operations and alerts, insights, people, roles and approvals, tenant console |
| 10 | [Admin screens](10-screens-admin.md) | SCR-19…SCR-34 (home, settings, what-if preview, audit, data requests, operations, pilot gate, insights, directory, roles, announcements, templates, sessions, tenant console, command palette) and rules A1–A12 |

Admin story files: [settings & config](09-stories-admin/01-settings-and-config.md) · [audit & compliance](09-stories-admin/02-audit-and-compliance.md) · [operations & home](09-stories-admin/03-operations-and-home.md) · [insights, productivity, governance](09-stories-admin/04-insights-productivity-governance.md)

The admin capability list comes from a yes/no feature interview; it has **not** yet been compared with the SparkLab, Vantage and AI Hub admin panels (OQ-B1-46).

Story files: [access & profile](06-stories-participant/01-access-and-profile.md) · [goals & matching](06-stories-participant/02-goals-and-matching.md) · [relationships, scheduling, sessions](06-stories-participant/03-relationships-scheduling-sessions.md) · [reports, concerns, messaging, AI, privacy, Home](06-stories-participant/04-reports-concerns-messaging-ai-privacy-home.md)

## How to review

1. Start with **[open questions](01-prd/open-questions-batch1.md)** — the decisions only you can make (the numeric ones are now admin-managed settings; the open ones include OQ-B1-44, 46, 47, 48). Section A (constants) and the "Needed by: B1" items must be settled before sign-off.
2. Read the **[PRD](01-prd/README.md)** requirement tables; anything marked **[PROPOSED]** is not in the Plan.
3. Check the **[matching spec](01-prd/matching-spec.md)** formulas with a domain expert (HR / L&D). The numeric parameters are all in the constants table so they can change without rewriting the spec.
4. Check the **[permission matrix](04-permission-matrix.md)** with Legal/HR: especially who sees reports, decline reasons, concerns and check-ins.
5. Native speakers review the **[glossary](02-glossary.md)**.

## Coverage of Plan decisions

| Decision | Primary place in the spec |
|---|---|
| D1 Spec first | PRD §7; this file |
| D2 Three programmes | PRD §4, FR-PRG-002 |
| D3 Structured reports, private notes | FR-RPT-001, INV-2, permission matrix §4.7–4.8 |
| D4 Tenant-ready | FR-TEN-001/002, INV-1 |
| D5 Stack | NFR-MNT-001 |
| D6 Magic link | FR-TEN-003…009, INV-5 |
| D7 Availability and .ics | FR-SCH-001/002, N-050 |
| D8 Languages | FR-TEN-013, FR-PRV-006/007, NFR-I18N |
| D9 Vetting | FR-VET-001, domain model §4.1 |
| D10 No AI in matching | FR-MAT-001, FR-AIA, INV-6 |
| D11 CSV/Excel import | FR-IMP |
| D12 Hosting EU | FR-PRV-011, NFR-PRV-001 |
| D13 Both accept in 7 days | FR-REL-002…004, domain model §4.2, C-001 |
| D14 Reports by programme | FR-RPT-003 |
| D15 Report reach and sponsors | FR-PRG-006/007, FR-RPT-004…006 |
| D16 Concerns to safeguarding | FR-HLT-002/003, N-063, N-080 |

## Conventions

- **IDs are permanent:** `FR-AREA-nnn`, `NFR-AREA-nnn`, `C-nnn` (constants), `GL-nnn` (glossary), `N-nnn` (notifications), `OQ-B1-nn` (open questions), `INV-n.m` and `T-INVn-nn` (invariants and tests), `MT-Pn` / `MT-Sn` (matching tests).
- **Never restate a constant's value** in a story or acceptance criterion — cite its ID.
- **Status tags:** FIXED (a Plan decision), DEFAULT (Plan default), **PROPOSED** (author's proposal, needs confirmation).
- The traceability matrix (BRD requirement → story → criterion → screen → test) is **generated** from these IDs; it is never edited by hand.

## Automated checks

```bash
python3 spec/tools/check_spec.py                  # consistency checks
python3 spec/tools/gen_traceability.py            # regenerate 08-traceability.md
python3 spec/tools/gen_traceability.py --check    # CI: fail if it is out of date
```

`check_spec.py` verifies that matching weights total 100 per programme; constants and IDs are defined once and every reference resolves; every PROPOSED constant has an open question; relative links work; and, for Batches 2 and 3A, every story has 3–6 acceptance criteria with at least one negative/permission case, links only to existing requirements and screens, and every screen is used. Both run in CI via `.github/workflows/spec-check.yml`.

## What comes next

| Batch | Contents | Starts |
|---|---|---|
| 2 | Participant epics and user screen specifications | **Drafted** (see above); finalise after Batch 1 sign-off |
| 3A | Advanced admin panel: settings centre, audit and compliance, operations, insights, governance | **Drafted** (see above) |
| 3B | Remaining admin and operations epics (programme creation, people-import admin, vetting assessor and decisions, matching admin, relationships list, reports and sponsor pack, safeguarding handling, content management), test plan, decision log | After Batch 2/3A review |
