-- 0053 · Goals, pre-relationship (slice S4: Open-programme goals with taxonomy tags; US-GOL-01, FR-GOL-001, FR-GOL-005).
-- Slice S8 extends this table (SMART fields, relationship link, milestones) in its own migration range.

CREATE TABLE goal (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  membership_id    uuid NOT NULL,
  programme_id     uuid NOT NULL,
  title            text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  state            text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'active', 'achieved', 'dropped')),
  is_primary       boolean NOT NULL DEFAULT false,
  visibility       text NOT NULL DEFAULT 'only_me' CHECK (visibility IN ('only_me', 'programme_counterparts', 'request_or_match')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  CHECK (NOT is_primary OR state IN ('draft', 'active')),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (programme_id, organisation_id) REFERENCES programme (id, organisation_id)
);
ALTER TABLE goal ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('goal');
CREATE INDEX goal_person_idx ON goal (membership_id, programme_id);
-- At most one primary goal per person and programme (US-GOL-01: "mark one as primary").
CREATE UNIQUE INDEX goal_one_primary ON goal (membership_id, programme_id) WHERE is_primary;

CREATE TABLE goal_tag (
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  goal_id          uuid NOT NULL,
  topic_id         uuid NOT NULL,
  PRIMARY KEY (goal_id, topic_id),
  FOREIGN KEY (goal_id, organisation_id) REFERENCES goal (id, organisation_id),
  FOREIGN KEY (topic_id, organisation_id) REFERENCES taxonomy_topic (id, organisation_id)
);
ALTER TABLE goal_tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_tag FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('goal_tag');

GRANT SELECT, INSERT, UPDATE ON goal TO mh_app;
GRANT SELECT, INSERT, DELETE ON goal_tag TO mh_app;
