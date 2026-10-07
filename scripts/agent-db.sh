#!/usr/bin/env bash
# Sandbox helper for parallel build agents: creates an isolated database for a worktree and writes its .env.
#   ./scripts/agent-db.sh <name>     (run inside the worktree; needs `su postgres`)
set -euo pipefail
NAME="${1:?usage: agent-db.sh <name>}"
DB="mh_${NAME//[^a-z0-9]/_}"
/home/claude/pgup.sh >/dev/null
su postgres -c "psql -v ON_ERROR_STOP=1 -f $PWD/db/bootstrap.sql" >/dev/null
su postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='$DB'\" | grep -q 1 || psql -c 'CREATE DATABASE $DB OWNER mh_owner'" >/dev/null
su postgres -c "psql -d $DB -c 'ALTER SCHEMA public OWNER TO mh_owner'" >/dev/null
sed -e "s#/mentors_hub#/$DB#g" .env.example > .env
[ -d node_modules ] || ln -s /home/claude/build/mentors_hub/node_modules node_modules
set -a; . ./.env; set +a
npx tsx scripts/migrate.ts
echo "database $DB ready; .env written"
