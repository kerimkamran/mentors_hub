-- One-time setup, run by a database superuser/admin (NOT by the application).
-- Creates the two roles the architecture requires (INV-1.4):
--   mh_owner : owns the schema and runs migrations. Never used by the running web app.
--   mh_app   : used by the web app and worker. Owns nothing, not superuser, no BYPASSRLS.
-- Passwords below are DEVELOPMENT ONLY. In staging/production create the roles with
-- strong generated passwords and put them in the environment, never in the repository.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mh_owner') THEN
    CREATE ROLE mh_owner LOGIN PASSWORD 'mh_owner_dev' NOSUPERUSER NOBYPASSRLS CREATEDB;  -- CREATEDB: dev and test only (scratch databases for migration tests)
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mh_app') THEN
    CREATE ROLE mh_app LOGIN PASSWORD 'mh_app_dev' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
