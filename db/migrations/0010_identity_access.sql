-- 0010 · Identity, membership, roles, sign-in, sessions, consent (slice S1)
-- GLOBAL tables (allowlisted in scripts/lint-migrations.ts, INV-1.6): organisation_domain, identity,
-- login_challenge, web_session, auth_rate_limit. They carry no tenant content; sign-in and sessions
-- must be resolvable BEFORE an organisation context exists (the organisation comes from the session row, INV-1.5).

-- Every tenant table states ENABLE/FORCE ROW LEVEL SECURITY literally (the SQL lint checks the text, INV-1.2),
-- then calls mh_tenant_policy_only to add the isolation policy and the immutable-organisation trigger.
CREATE FUNCTION mh_tenant_policy_only(tbl regclass) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('CREATE POLICY tenant_isolation ON %s USING (organisation_id = app_org_id()) WITH CHECK (organisation_id = app_org_id())', tbl);
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION mh_forbid_org_change()', 'org_immutable_' || (tbl::oid)::text, tbl);
END $$;

-- ---- organisation_domain (GLOBAL) -----------------------------------------
CREATE TABLE organisation_domain (
  domain           text PRIMARY KEY CHECK (domain = lower(domain) AND domain ~ '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$'),
  organisation_id  uuid NOT NULL REFERENCES organisation (id)
);

-- ---- identity (GLOBAL; no password column, INV-8.4) -------------------------
CREATE TABLE identity (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE CHECK (email = lower(email) AND email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  locale            text CHECK (locale IN ('en', 'az', 'ru')),
  time_zone         text,
  totp_secret_enc   text,                         -- AES-256-GCM, never plaintext
  totp_enrolled_at  timestamptz,
  is_platform_admin boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ---- membership (TENANT) ---------------------------------------------------
CREATE TABLE membership (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  identity_id      uuid NOT NULL REFERENCES identity (id),
  status           text NOT NULL DEFAULT 'invited' CHECK (status IN ('active', 'inactive', 'invited')),
  source           text NOT NULL CHECK (source IN ('import', 'invite')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, identity_id),
  UNIQUE (id, organisation_id)
);
ALTER TABLE membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('membership');

-- ---- person_profile (TENANT; extended in S4) -------------------------------
CREATE TABLE person_profile (
  membership_id    uuid PRIMARY KEY,
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  display_name     text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 200),
  department       text CHECK (length(department) <= 200),
  job_title        text CHECK (length(job_title) <= 200),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE person_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_profile FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('person_profile');

-- ---- role_grant (TENANT) ----------------------------------------------------
CREATE TABLE role_grant (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  membership_id    uuid NOT NULL,
  role             text NOT NULL CHECK (role IN ('pm', 'assessor', 'content_manager', 'safeguarding', 'org_admin')),
  scope_type       text NOT NULL CHECK (scope_type IN ('org', 'programme', 'cohort')),
  scope_id         uuid,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope_type = 'org') = (scope_id IS NULL)),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id)
);
CREATE UNIQUE INDEX role_grant_unique ON role_grant (membership_id, role, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'));
ALTER TABLE role_grant ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_grant FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('role_grant');

-- ---- consent (TENANT) -------------------------------------------------------
CREATE TABLE consent (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  membership_id    uuid NOT NULL,
  scope            text NOT NULL CHECK (scope IN ('privacy_notice', 'ai_assistance', 'programme_data_sharing')),
  version          text NOT NULL CHECK (version ~ '^[a-z0-9.-]{1,20}$'),
  accepted_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, scope, version),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('consent');

-- ---- login_challenge (GLOBAL) — magic link + code, bound to the requesting browser --
CREATE TABLE login_challenge (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id      uuid NOT NULL REFERENCES identity (id),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  token_hash       text NOT NULL UNIQUE,
  code_hash        text NOT NULL,
  browser_hash     text NOT NULL,
  expires_at       timestamptz NOT NULL,
  used_at          timestamptz,
  failed_attempts  integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_challenge_identity_idx ON login_challenge (identity_id, created_at DESC);

-- ---- web_session (GLOBAL; the organisation comes from this row, INV-1.5) -----
CREATE TABLE web_session (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash        text NOT NULL UNIQUE,
  identity_id       uuid NOT NULL REFERENCES identity (id),
  organisation_id   uuid NOT NULL REFERENCES organisation (id),
  membership_id     uuid NOT NULL REFERENCES membership (id),
  issued_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  totp_verified_at  timestamptz,
  revoked_at        timestamptz
);
CREATE INDEX web_session_identity_idx ON web_session (identity_id);

-- ---- auth_rate_limit (GLOBAL) — per-identity and per-browser, never per-IP (C-045) --
CREATE TABLE auth_rate_limit (
  bucket        text NOT NULL,
  window_start  timestamptz NOT NULL,
  hits          integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

-- ---- grants -----------------------------------------------------------------
GRANT SELECT ON organisation_domain TO mh_app;
GRANT SELECT, INSERT, UPDATE ON identity TO mh_app;
GRANT SELECT, INSERT, UPDATE ON membership, person_profile TO mh_app;
GRANT SELECT, INSERT, DELETE ON role_grant TO mh_app;
GRANT SELECT, INSERT ON consent TO mh_app;
GRANT SELECT, INSERT, UPDATE ON login_challenge TO mh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON web_session TO mh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_rate_limit TO mh_app;
