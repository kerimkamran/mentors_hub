# Deploying to Render (staging, Frankfurt): clicks only, no terminal

Staging only, **synthetic data**. Real HR data is not allowed until IT/Legal data-residency sign-off is recorded (Plan D12).
You need a Render account with a payment method (paid database, web service and worker) and this repository on GitHub.

## What the blueprint does for you
`render.yaml` creates the PostgreSQL 16 database, the web service and the worker. On every deploy the web service first
(1) creates the two database roles with generated passwords (`mh_owner` migrations, `mh_app` runtime), (2) applies all migrations,
(3) creates the synthetic "Demo Telecom" organisation. A failing step stops the release and the old version keeps running.

## Steps
1. Render dashboard → **New → Blueprint** → connect GitHub → pick `kerimkamran/mentors_hub`, branch `main`.
2. Render asks for **one value**: `DEMO_ADMIN_EMAIL`. Enter the email address that should become the administrator of the demo organisation (for example your work address).
3. Click **Apply**. Wait until `azerconnect-mentors-hub` shows **Live** (first build takes several minutes).
4. Open the web service. Its address must be `https://azerconnect-mentors-hub.onrender.com`. If Render shows a different address, open **Environment → mentors-hub-shared**, change `APP_BASE_URL` to that address, and redeploy both services.
5. Open `<address>/api/health`: it must show `"status":"ok"`.

## First sign-in (no mail server yet)
No email server is connected, so staging writes the sign-in code and link to the **worker log** instead (only possible while `DEMO_SEED=1`).
1. Open `<address>/signin`, enter the `DEMO_ADMIN_EMAIL` address, press the button. Stay in the same browser.
2. Render → `azerconnect-mentors-hub-worker` → **Logs**: find the line `STAGING sign-in for <your address>` and copy the 6-digit code (or open the link).
3. Enter the code, accept the privacy notice, then set up the authenticator app (administrators must use it).
4. Open **Roles** and **Settings** from the menu.

## Before real use
Connect a mail server (set `SMTP_URL`, `MAIL_FROM`), then remove `DEMO_SEED` and `STAGING_MAIL_LOG` from the shared environment group. Production is a separate copy of the blueprint.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| Deploy fails with `[PREP-001]` | The Render database user may not create roles: contact Render support, or tell the developer. |
| `[PREP-004]` / `[PREP-005]` | A pre-existing database role is too privileged; use a fresh database. |
| `[MIG-001]` | A migration failed; the message names the file. |
| `[ENV-001]` | An environment variable is missing; the message names it. |
| Health returns `503` | The database is still starting; retry after a minute. |
| No sign-in line in the worker log | `STAGING_MAIL_LOG`/`DEMO_SEED` removed, or the address is not a member of an organisation. |
