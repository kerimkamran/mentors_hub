#!/usr/bin/env bash
# Create the local development database and roles (idempotent). Needs a PostgreSQL superuser.
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=... ./scripts/dev-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${DB_NAME:-mentors_hub}"
psql -v ON_ERROR_STOP=1 -f db/bootstrap.sql
psql -v ON_ERROR_STOP=1 -tc "SELECT 1 FROM pg_database WHERE datname = '$DB'" | grep -q 1 \
  || psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB OWNER mh_owner"
psql -v ON_ERROR_STOP=1 -d "$DB" -c "ALTER SCHEMA public OWNER TO mh_owner"
echo "ready: now run  cp .env.example .env && npm run db:migrate"
