-- 0050 · Profile extension (slice S4): bio and headline, per-field visibility, autosave drafts, languages.
-- person_profile (0010) is only ALTERed here, never edited.

-- Search key shared by names and topics (FR-PRF-011, AC-PRF-01.3). Folds the C-115 pairs (via mh_normalise) and ALSO indexes ə
-- as "a", so "mammadov" finds Məmmədov (OQ-B1-49). Identical to searchKey() in src/domain/profiles/search.ts (a test keeps them equal).
CREATE FUNCTION mh_search_key(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT CASE
    WHEN mh_normalise(input) = mh_normalise(translate(input, 'əƏ', 'aA')) THEN mh_normalise(input)
    ELSE mh_normalise(input) || ' ' || mh_normalise(translate(input, 'əƏ', 'aA'))
  END
$$;
GRANT EXECUTE ON FUNCTION mh_search_key(text) TO mh_app;

ALTER TABLE person_profile
  ADD COLUMN headline   text CHECK (length(headline) <= 160),
  ADD COLUMN bio        text CHECK (length(bio) <= 2000),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- One row per (person, field) that differs from the default. A missing row means the default level:
-- "Only me" for every field except name and department (OQ-B1-19, AC-PRF-02.1).
CREATE TABLE profile_field_visibility (
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  membership_id    uuid NOT NULL,
  field            text NOT NULL CHECK (field IN ('name', 'department', 'job_title', 'headline', 'bio', 'languages', 'interests', 'topics_offered', 'topics_sought', 'availability')),
  level            text NOT NULL CHECK (level IN ('only_me', 'programme_counterparts', 'request_or_match')),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membership_id, field),
  CHECK (NOT (field = 'name' AND level = 'only_me')),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE profile_field_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_field_visibility FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('profile_field_visibility');

-- Autosaved unsent edits of the free-text part of the profile (FR-PRF-009, AC-PRF-01.4). Private to the owner; never read by
-- anyone else and never by matching. Payload is validated JSON of known keys (bio, headline), no other content.
CREATE TABLE profile_draft (
  membership_id    uuid PRIMARY KEY,
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  payload          jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND length(payload::text) <= 8000),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE profile_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_draft FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('profile_draft');

-- Languages with proficiency (FR-PRF-004).
CREATE TABLE person_language (
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  membership_id    uuid NOT NULL,
  language         text NOT NULL CHECK (language ~ '^[a-z]{2}$'),
  level            text NOT NULL CHECK (level IN ('working', 'fluent')),
  PRIMARY KEY (membership_id, language),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE person_language ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_language FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('person_language');

GRANT SELECT, INSERT, UPDATE, DELETE ON profile_field_visibility, profile_draft, person_language TO mh_app;
