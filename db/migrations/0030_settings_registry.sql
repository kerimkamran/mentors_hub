-- 0030 · Settings registry (slice S3, FR-PRG-013…016, FR-ADM-004…006, FR-ADM-028)
-- Admin-managed settings are stored as IMMUTABLE versions per (scope, scope id, group). The newest version is in force;
-- restoring an old version or the defaults inserts a NEW version. No free text: values are validated JSON of numbers,
-- booleans, short codes and colour hex strings (application validation + the database guard below).

CREATE TABLE settings_version (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id             uuid NOT NULL REFERENCES organisation (id),
  scope                       text NOT NULL CHECK (scope IN ('organisation', 'programme')),
  scope_id                    uuid,                       -- the programme id for scope = 'programme'
  setting_group               text NOT NULL CHECK (setting_group IN
    ('cadence_capacity', 'matching', 'timings', 'flags', 'security', 'session_timing', 'admin_ops', 'brand', 'localisation')),
  version_number              integer NOT NULL CHECK (version_number >= 1),
  values                      jsonb NOT NULL CHECK (jsonb_typeof(values) = 'object'),
  created_by                  uuid,                       -- membership id; NULL for the system-seeded baseline
  created_at                  timestamptz NOT NULL DEFAULT now(),
  restored_from_version_id    uuid,
  CHECK ((scope = 'organisation') = (scope_id IS NULL)),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (scope_id, organisation_id) REFERENCES programme (id, organisation_id),
  FOREIGN KEY (created_by, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (restored_from_version_id, organisation_id) REFERENCES settings_version (id, organisation_id)
);
CREATE UNIQUE INDEX settings_version_number_unique
  ON settings_version (organisation_id, scope, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'), setting_group, version_number);
CREATE INDEX settings_version_latest_idx
  ON settings_version (organisation_id, scope, scope_id, setting_group, version_number DESC);
ALTER TABLE settings_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_version FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('settings_version');

-- Versions are immutable: no UPDATE/DELETE/TRUNCATE for anyone, the owner included (AC-PRG-04.5).
CREATE FUNCTION mh_settings_version_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'settings_version is immutable' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER settings_version_no_change BEFORE UPDATE OR DELETE ON settings_version
  FOR EACH ROW EXECUTE FUNCTION mh_settings_version_immutable();
CREATE TRIGGER settings_version_no_truncate BEFORE TRUNCATE ON settings_version
  FOR EACH STATEMENT EXECUTE FUNCTION mh_settings_version_immutable();

-- Second wall behind the application validator (MT-P12): the invariants that must never reach the engine or sign-in.
CREATE FUNCTION mh_settings_version_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  w jsonb;
  total numeric;
  bad integer;
BEGIN
  IF NEW.setting_group = 'matching' THEN
    w := NEW.values -> 'weights';
    IF w IS NULL OR jsonb_typeof(w) <> 'object' THEN
      RAISE EXCEPTION 'matching weights missing' USING ERRCODE = '23514';
    END IF;
    SELECT count(*) INTO bad FROM jsonb_each_text(w) WHERE value !~ '^[0-9]{1,3}$';
    IF bad > 0 THEN
      RAISE EXCEPTION 'matching weights must be non-negative integers' USING ERRCODE = '23514';
    END IF;
    SELECT COALESCE(sum((value)::numeric), 0) INTO total FROM jsonb_each_text(w);
    IF total <> 100 THEN
      RAISE EXCEPTION 'matching weights must total 100' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.setting_group = 'cadence_capacity' THEN
    IF COALESCE((NEW.values ->> 'cadenceDays')::numeric, 0) NOT BETWEEN 1 AND 90 THEN
      RAISE EXCEPTION 'cadence must be 1-90 days' USING ERRCODE = '23514';
    END IF;
    IF COALESCE((NEW.values ->> 'capacityMax')::numeric, 0) < COALESCE((NEW.values ->> 'capacityDefault')::numeric, 1)
       OR (NEW.values ->> 'capacityMax')::numeric > 20 THEN
      RAISE EXCEPTION 'capacity maximum out of bounds' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.setting_group = 'security' THEN
    IF COALESCE((NEW.values ->> 'linkLifetimeMinutes')::numeric, 0) NOT BETWEEN 5 AND 30
       OR COALESCE((NEW.values ->> 'codeAttempts')::numeric, 0) NOT BETWEEN 3 AND 10
       OR COALESCE((NEW.values ->> 'sessionIdleMinutes')::numeric, 0) NOT BETWEEN 15 AND 1440
       OR COALESCE((NEW.values ->> 'sessionAbsoluteDays')::numeric, 0) NOT BETWEEN 1 AND 90 THEN
      RAISE EXCEPTION 'security settings out of platform bounds' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER settings_version_guard BEFORE INSERT ON settings_version
  FOR EACH ROW EXECUTE FUNCTION mh_settings_version_guard();

GRANT SELECT, INSERT ON settings_version TO mh_app;

-- ---- recorded prerequisites for feature flags (FR-ADM-005): DPIA sign-off, storage approval -----------------------
CREATE TABLE org_prerequisite (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  code             text NOT NULL CHECK (code IN ('dpia_signoff', 'storage_approval')),
  recorded_by      uuid NOT NULL,
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, code),
  FOREIGN KEY (recorded_by, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE org_prerequisite ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_prerequisite FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('org_prerequisite');
GRANT SELECT, INSERT ON org_prerequisite TO mh_app;

-- ---- organisation logo (FR-ADM-028): raster image bytes, validated by content before insert ------------------------
CREATE TABLE org_logo (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  content_type     text NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
  byte_size        integer NOT NULL CHECK (byte_size BETWEEN 1 AND 524288),
  sha256           text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  data             bytea NOT NULL CHECK (octet_length(data) = byte_size),
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (created_by, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE org_logo ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_logo FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('org_logo');
GRANT SELECT, INSERT ON org_logo TO mh_app;

-- ---- narrow, tenant-bound writers for the two organisation columns the settings centre owns ------------------------
-- `organisation` is a global table the app role may only read. These SECURITY DEFINER functions touch ONLY the row of
-- the current tenant context (app_org_id()), so a bug cannot change another organisation.
CREATE FUNCTION mh_set_org_ai_enabled(p_enabled boolean) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE organisation SET ai_enabled = p_enabled WHERE id = app_org_id()
$$;
CREATE FUNCTION mh_set_org_localisation(p_locale text, p_time_zone text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE organisation SET default_locale = p_locale, time_zone = p_time_zone WHERE id = app_org_id()
$$;
REVOKE ALL ON FUNCTION mh_set_org_ai_enabled(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION mh_set_org_localisation(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mh_set_org_ai_enabled(boolean) TO mh_app;
GRANT EXECUTE ON FUNCTION mh_set_org_localisation(text, text) TO mh_app;
