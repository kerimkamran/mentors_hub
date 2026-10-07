-- 0001 · Foundation (slice S0)
-- Establishes the tenancy primitives every later table builds on: the organisation context
-- function, the append-only audit log, and forced row-level security (INV-1, INV-3, INV-4).

-- ---- tenant context ------------------------------------------------------
-- The application sets `app.org_id` per transaction from the signed-in session (INV-1.5).
-- Unset or empty => NULL => every policy comparison is false => no rows, no writes (INV-1.3).
CREATE FUNCTION app_org_id() RETURNS uuid
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nullif(current_setting('app.org_id', true), '')::uuid
$$;

-- organisation_id can never be changed after insert (INV-1, T-INV1-07).
CREATE FUNCTION mh_forbid_org_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organisation_id IS DISTINCT FROM OLD.organisation_id THEN
    RAISE EXCEPTION 'organisation_id is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

-- ---- organisation (GLOBAL table; on the RLS allowlist, INV-1.6) ----------
CREATE TABLE organisation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  slug                text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  default_locale      text NOT NULL DEFAULT 'en' CHECK (default_locale IN ('en', 'az', 'ru')),
  time_zone           text NOT NULL DEFAULT 'Asia/Baku',
  residency_signoff_at timestamptz,          -- real HR data is refused until set (INV-8.3, FR-IMP-009)
  ai_enabled          boolean NOT NULL DEFAULT false,  -- organisation AI kill switch, off by default (INV-6)
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ---- audit_log (TENANT table, append-only, no free text, INV-3/4) ---------
CREATE TABLE audit_log (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  actor_id         uuid,                     -- FK to identity added in S1
  action           text NOT NULL CHECK (action ~ '^[a-z][a-z0-9_.]{1,63}$'),  -- a code, never a sentence
  object_type      text CHECK (object_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  object_id        uuid,
  status           text NOT NULL CHECK (status IN ('ok', 'denied', 'failed')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_org_time_idx ON audit_log (organisation_id, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (organisation_id = app_org_id());
CREATE POLICY audit_log_insert ON audit_log FOR INSERT
  WITH CHECK (organisation_id = app_org_id());
-- No UPDATE or DELETE policy exists: with RLS forced, those statements affect 0 rows.

CREATE FUNCTION mh_audit_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION mh_audit_append_only();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION mh_audit_append_only();

-- ---- grants to the application role (least privilege, INV-1.4) -----------
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO mh_app;
GRANT EXECUTE ON FUNCTION app_org_id() TO mh_app;
GRANT SELECT ON organisation TO mh_app;
GRANT SELECT, INSERT ON audit_log TO mh_app;
GRANT USAGE ON SEQUENCE audit_log_id_seq TO mh_app;
