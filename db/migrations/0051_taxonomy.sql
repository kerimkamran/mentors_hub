-- 0051 · Curated taxonomy, interests, person topics (slice S4; FR-PRF-002, FR-PRF-003, FR-PRF-005, domain model §2.3).
-- The platform's curated catalogue lives in src/domain/taxonomy/catalogue.ts and is copied into each organisation
-- (ensureTaxonomy). The copy is the organisation's own: an "override" is simply editing, hiding or adding rows.

CREATE TABLE taxonomy_topic (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  parent_id        uuid,
  catalogue_key    text CHECK (catalogue_key ~ '^[a-z][a-z0-9_]{1,62}$'),   -- NULL for topics the organisation added itself
  name_en          text NOT NULL CHECK (length(name_en) BETWEEN 1 AND 120),
  name_az          text NOT NULL CHECK (length(name_az) BETWEEN 1 AND 120),
  name_ru          text NOT NULL CHECK (length(name_ru) BETWEEN 1 AND 120),
  synonyms_en      text[] NOT NULL DEFAULT '{}',
  synonyms_az      text[] NOT NULL DEFAULT '{}',
  synonyms_ru      text[] NOT NULL DEFAULT '{}',
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  UNIQUE (organisation_id, catalogue_key),
  CHECK (parent_id IS DISTINCT FROM id),
  FOREIGN KEY (parent_id, organisation_id) REFERENCES taxonomy_topic (id, organisation_id)
);
ALTER TABLE taxonomy_topic ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_topic FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('taxonomy_topic');
CREATE INDEX taxonomy_topic_parent_idx ON taxonomy_topic (organisation_id, parent_id);

-- Two levels only (area -> topic): matching gives partial credit for a parent or child (matching-spec 4.1).
CREATE FUNCTION mh_taxonomy_two_levels() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM taxonomy_topic p WHERE p.id = NEW.parent_id AND p.parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'taxonomy has two levels only' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM taxonomy_topic c WHERE c.parent_id = NEW.id) THEN
      RAISE EXCEPTION 'taxonomy has two levels only' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER taxonomy_two_levels BEFORE INSERT OR UPDATE OF parent_id ON taxonomy_topic
  FOR EACH ROW EXECUTE FUNCTION mh_taxonomy_two_levels();

-- Curated interest tags (FR-PRF-005): same pattern, one level.
CREATE TABLE interest_tag (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  catalogue_key    text CHECK (catalogue_key ~ '^[a-z][a-z0-9_]{1,62}$'),
  name_en          text NOT NULL CHECK (length(name_en) BETWEEN 1 AND 80),
  name_az          text NOT NULL CHECK (length(name_az) BETWEEN 1 AND 80),
  name_ru          text NOT NULL CHECK (length(name_ru) BETWEEN 1 AND 80),
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 0,
  UNIQUE (id, organisation_id),
  UNIQUE (organisation_id, catalogue_key)
);
ALTER TABLE interest_tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_tag FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('interest_tag');

CREATE TABLE person_interest (
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  membership_id    uuid NOT NULL,
  interest_id      uuid NOT NULL,
  PRIMARY KEY (membership_id, interest_id),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (interest_id, organisation_id) REFERENCES interest_tag (id, organisation_id)
);
ALTER TABLE person_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_interest FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('person_interest');

-- Topics a person offers (with a depth) or seeks. Taxonomy rows only: no free-text topics (AC-PRF-01.1).
CREATE TABLE person_topic (
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  membership_id    uuid NOT NULL,
  topic_id         uuid NOT NULL,
  role             text NOT NULL CHECK (role IN ('offers', 'seeks')),
  depth            text CHECK (depth IN ('working', 'advanced', 'expert')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membership_id, topic_id, role),
  CHECK ((role = 'offers') = (depth IS NOT NULL)),                    -- AC-PRF-01.2: an offer must carry a depth
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (topic_id, organisation_id) REFERENCES taxonomy_topic (id, organisation_id)
);
ALTER TABLE person_topic ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_topic FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('person_topic');

-- A mentor's areas of expertise (C-032, FR-PRF-006): top-level taxonomy areas, chosen explicitly.
CREATE TABLE mentor_expertise_area (
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  membership_id    uuid NOT NULL,
  topic_id         uuid NOT NULL,
  PRIMARY KEY (membership_id, topic_id),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (topic_id, organisation_id) REFERENCES taxonomy_topic (id, organisation_id)
);
ALTER TABLE mentor_expertise_area ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_expertise_area FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('mentor_expertise_area');

CREATE FUNCTION mh_expertise_area_is_root() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM taxonomy_topic t WHERE t.id = NEW.topic_id AND t.parent_id IS NOT NULL) THEN
    RAISE EXCEPTION 'an expertise area must be a top-level taxonomy area' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expertise_area_is_root BEFORE INSERT OR UPDATE ON mentor_expertise_area
  FOR EACH ROW EXECUTE FUNCTION mh_expertise_area_is_root();

GRANT SELECT, INSERT, UPDATE ON taxonomy_topic, interest_tag TO mh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON person_topic, person_interest, mentor_expertise_area TO mh_app;
