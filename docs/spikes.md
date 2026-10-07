# Slice S0 spikes — results

| Spike (Plan §10) | Status | Evidence |
|---|---|---|
| The database role cannot bypass row-level security | **Done (automated)** | `tests/db/tenant-isolation.test.ts` — T-INV1-01…04, 07: app role is not superuser, has no BYPASSRLS, owns no tables; cross-organisation reads/writes return nothing or fail; no context ⇒ no rows. |
| Azerbaijani / Russian collation and search normalisation | **Done (automated)** | `tests/db/language.test.ts` — ICU collations `az_ai`, `az_ci`, `ru_ai`, `ru_ci` (migration 0002); SQL `mh_normalise` and `src/lib/search.ts` give identical results. **Gap:** see OQ-B1-49 (`mammadov` ↔ `Məmmədov` needs ə↔a, the written rule says ə↔e). |
| Outlook shows the calendar invite with Accept/Decline | **Builder done; Outlook check is MANUAL** | `src/lib/ics.ts` builds METHOD:REQUEST with ORGANIZER and RSVP attendees (unit-tested, parsed with ical.js). To finish the spike: `docker compose up -d`, `npm run spike:invite`, open the message in Mailpit (http://localhost:8025), then send the same invite to a real Azerconnect mailbox and record below whether Outlook classic, new, web and mobile show Accept/Decline and the Teams link. |
| Background worker runs as the least-privilege role | **Done (automated)** | `tests/db/worker.test.ts` |
| Render staging and production (Frankfurt), CI with a real database | **Config done; deployment needs your Render account** | `render.yaml`, `.github/workflows/ci.yml` |

## Manual Outlook result (fill in)

| Client | Accept/Decline shown | Teams link works | Notes |
|---|---|---|---|
| Outlook classic | | | |
| Outlook new | | | |
| Outlook web | | | |
| Outlook mobile | | | |
| Google Calendar | | | |
