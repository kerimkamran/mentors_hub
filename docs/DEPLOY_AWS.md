# Deploying to AWS Lightsail (staging, Frankfurt): clicks only, no terminal

Staging only, **synthetic data**. Real HR data is not allowed until IT/Legal data-residency sign-off is recorded (Plan D12).
Why Lightsail: one console, built-in HTTPS address, managed PostgreSQL. (AWS App Runner is closed to new customers.)
Approximate cost: database about 15 USD/month, container service (Small) about 20 USD/month.

## What happens automatically
When the container starts it creates the application database and the two database roles (generated passwords), applies all
migrations, creates the synthetic "Demo Telecom" organisation, then starts the web server and the background worker.
If any setup step fails the container does not start, and the log names the step.

## Part A: publish the container image (GitHub, once, then automatic)
1. In GitHub Desktop: commit the changes to `main` and click **Push origin**. This starts the workflow `image`.
2. On github.com open the repository → **Actions** → wait until `image` has a green tick (about 5 to 10 minutes).
3. Make the image public so AWS can pull it: github.com → your profile → **Packages** → `mentors_hub` → **Package settings** → **Change visibility** → **Public** (type the name to confirm). The code is already public; the image contains no secrets.

## Part B: database (AWS console, region Europe (Frankfurt))
1. Open the AWS console, set the region (top right) to **Europe (Frankfurt) eu-central-1**, search for **Lightsail**.
2. **Databases → Create database**. Location Frankfurt. Engine **PostgreSQL**, newest version 16 (or 17). Keep master user `dbmasteruser`. Choose **Specify a password** and enter a long password; save it in your password manager. Pick the smallest plan. Name it `mentors-hub-db`. Leave **Public mode off**. Click **Create database**.
3. Wait until the status is **Available** (about 10 minutes). Open the database and copy the **Endpoint** (host name) from the connection details.

## Part C: container service
1. Lightsail → **Containers → Create container service**. Location Frankfurt. Power **Small** (2 GB; Micro may run out of memory). Scale **1**. Name `mentors-hub`.
2. **Set up your first deployment** → container name `app` → **Specify a custom deployment**: Image `ghcr.io/kerimkamran/mentors_hub:latest`.
3. **Add environment variable** for each line:

| Key | Value |
|---|---|
| `DB_HOST` | the database Endpoint from Part B |
| `DB_PORT` | `5432` |
| `DB_NAME` | `mentors_hub` |
| `DB_SSL` | `1` |
| `ADMIN_USER` | `dbmasteruser` |
| `ADMIN_PASSWORD` | the database password you chose |
| `SESSION_SECRET` | a long random value, 48 characters or more (keep it private; all other secrets are derived from it) |
| `APP_BASE_URL` | `https://placeholder.example` for now (fixed in step 6) |
| `MAIL_FROM` | `Mentorship Hub <no-reply@azerconnect.az>` |
| `SMTP_URL` | `smtp://mail.invalid:25` |
| `DEFAULT_TIME_ZONE` | `Asia/Baku` |
| `DEMO_SEED` | `1` |
| `STAGING_MAIL_LOG` | `1` |
| `DEMO_ADMIN_EMAIL` | your work email (becomes administrator of the demo organisation) |
| `PORT` | `3000` |

4. **Open ports**: add port `3000`, protocol **HTTP**.
5. **Public endpoint**: choose container `app`. Health check: path `/api/health`, interval `30`, timeout `30`, healthy threshold `2`, unhealthy threshold `10` (the first start takes about a minute).
6. Click **Create container service**. Wait until the state is **Running** (5 to 10 minutes). Copy the **Public domain** (`https://mentors-hub.<random>.eu-central-1.cs.amazonlightsail.com`).
7. **Deployments → Modify your deployment**: change `APP_BASE_URL` to that public domain (no slash at the end) → **Save and deploy**. Wait for **Running** again.
8. Open `<public domain>/api/health`: it must show `"status":"ok"`.

## First sign-in (no mail server yet)
Staging writes the sign-in code and link to the container log instead of sending email (only while `DEMO_SEED=1`).
1. Open `<public domain>/signin`, enter the `DEMO_ADMIN_EMAIL` address, press the button. Stay in the same browser.
2. Lightsail → your container service → **Logs** (container `app`) → find the line `STAGING sign-in for <your address>` and copy the 6-digit code.
3. Enter the code, accept the privacy notice, then set up the authenticator app (administrators must use it).

## Later
- **New version**: push to `main`, wait for the green `image` workflow, then Lightsail → **Deployments → Modify → Save and deploy**.
- **Before real use**: connect a mail server (`SMTP_URL`, `MAIL_FROM`), remove `DEMO_SEED`, `STAGING_MAIL_LOG` and the demo address. After the first successful start you may also delete `ADMIN_USER` and `ADMIN_PASSWORD` and redeploy; the app then no longer holds the database master login.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| Deployment keeps failing, log shows `[start] database roles failed` | Wrong `DB_HOST`, `ADMIN_PASSWORD`, or the database is not reachable from the container service (same region needed). If it times out, in Lightsail turn on **Account → Advanced → VPC peering** for Frankfurt and retry. |
| `[PREP-001]` / `[PREP-006]` | The master user may not create roles or databases. Use the default master user `dbmasteruser`. |
| `[ENV-001]` | A variable is missing or malformed; the message names it. |
| Image cannot be pulled | The GitHub package is still private (Part A step 3), or the `image` workflow has not finished. |
| Container is killed during the first start | Increase the health-check unhealthy threshold; check the Logs tab for the failing `[start]` step. |
| Sign-in page works but the link opens a wrong address | `APP_BASE_URL` still has the placeholder (step 7). |
