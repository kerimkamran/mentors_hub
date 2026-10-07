-- 0011 · Base programme structure (slice S1 scaffolding; slices S3, S6, S7 extend it)
-- Composite foreign keys include organisation_id so a row can never point into another organisation (INV-1.7).

CREATE TABLE programme (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  type             text NOT NULL CHECK (type IN ('leadership', 'sparklab', 'open')),
  name             text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id)
);
ALTER TABLE programme ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('programme');

CREATE TABLE cohort (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  programme_id     uuid NOT NULL,
  name             text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  start_date       date,
  end_date         date,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'running', 'closed')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (programme_id, organisation_id) REFERENCES programme (id, organisation_id)
);
ALTER TABLE cohort ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('cohort');

CREATE TABLE participation (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  cohort_id        uuid NOT NULL,
  membership_id    uuid NOT NULL,
  kind             text NOT NULL CHECK (kind IN ('mentor', 'mentee', 'team_member')),
  is_team_lead     boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'enrolled', 'withdrawn')),
  capacity         integer CHECK (capacity IS NULL OR capacity BETWEEN 0 AND 20),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  UNIQUE (cohort_id, membership_id, kind),
  FOREIGN KEY (cohort_id, organisation_id) REFERENCES cohort (id, organisation_id),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE participation ENABLE ROW LEVEL SECURITY;
ALTER TABLE participation FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('participation');

CREATE TABLE relationship (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id          uuid NOT NULL REFERENCES organisation (id),
  cohort_id                uuid NOT NULL,
  match_id                 uuid,                 -- FK added with the match table (S6)
  status                   text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  started_at               timestamptz NOT NULL DEFAULT now(),
  ended_at                 timestamptz,
  ended_by_kind            text CHECK (ended_by_kind IN ('mentor', 'mentee', 'team_lead', 'pm', 'completed')),
  previous_relationship_id uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (cohort_id, organisation_id) REFERENCES cohort (id, organisation_id),
  FOREIGN KEY (previous_relationship_id, organisation_id) REFERENCES relationship (id, organisation_id)
);
ALTER TABLE relationship ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('relationship');

CREATE TABLE relationship_member (
  relationship_id  uuid NOT NULL,
  participation_id uuid NOT NULL,
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  role             text NOT NULL CHECK (role IN ('mentor', 'mentee', 'team_member', 'team_lead')),
  PRIMARY KEY (relationship_id, participation_id),
  FOREIGN KEY (relationship_id, organisation_id) REFERENCES relationship (id, organisation_id),
  FOREIGN KEY (participation_id, organisation_id) REFERENCES participation (id, organisation_id)
);
ALTER TABLE relationship_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_member FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('relationship_member');

GRANT SELECT, INSERT, UPDATE ON programme, cohort, participation, relationship, relationship_member TO mh_app;
