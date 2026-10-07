-- 0070 · Mentor vetting (slice S5): rubric versions, mentor applications, assessments, released decisions
-- Spec: FR-VET-001…013, domain model §2.4 and §4.1 (state machine), matrix §4.5, INV-2/4 (blind assessment).
-- Every transition not in the §4.1 table is rejected here as well as in the service.

-- ---- rubric_version (TENANT; seeded per organisation by the app, immutable once used, FR-VET-003) ----
CREATE TABLE rubric_version (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  code             text NOT NULL CHECK (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  version          integer NOT NULL CHECK (version >= 1),
  name             text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  sections         jsonb NOT NULL CHECK (jsonb_typeof(sections) = 'array'),  -- [{code,label,labelKey,items:[{code,label,labelKey,max}]}]
  bands            jsonb NOT NULL CHECK (jsonb_typeof(bands) = 'array'),     -- [{min,outcome}] ascending; outcome approve | borderline | reject
  max_total        integer NOT NULL CHECK (max_total > 0),
  immutable_since  timestamptz,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, code, version),
  UNIQUE (id, organisation_id)
);
ALTER TABLE rubric_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_version FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('rubric_version');

-- ---- mentor_application (TENANT) -------------------------------------------------------------------
CREATE TABLE mentor_application (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id              uuid NOT NULL REFERENCES organisation (id),
  programme_id                 uuid NOT NULL,
  membership_id                uuid NOT NULL,
  status                       text NOT NULL CHECK (status IN ('draft', 'nominated', 'submitted', 'in_review', 'approved', 'rejected', 'withdrawn', 'suspended')),
  source                       text NOT NULL CHECK (source IN ('applied', 'nominated')),
  nominated_by                 uuid,
  rubric_version_id            uuid,                    -- pinned when the first assessor is assigned
  motivation                   text CHECK (length(motivation) <= 4000),
  experience                   text CHECK (length(experience) <= 4000),
  mentoring_experience         text CHECK (length(mentoring_experience) <= 4000),
  commitment_confirmed         boolean NOT NULL DEFAULT false,
  submitted_at                 timestamptz,
  decision                     text CHECK (decision IN ('approved', 'rejected')),
  decision_basis               text CHECK (decision_basis IN ('rubric', 'open_exception')),  -- open_exception = D9 exception (Open programme, no assessment)
  advisory_outcome             text CHECK (advisory_outcome IN ('approve', 'borderline', 'reject')),
  advisory_total               numeric(7, 2),
  decision_reason_differs_flag boolean NOT NULL DEFAULT false,
  decision_reason              text CHECK (length(decision_reason) <= 1000),                 -- PM-only; never shown to the applicant, never in audit
  decided_by                   uuid,
  decided_at                   timestamptz,
  suspended_at                 timestamptz,
  suspended_by                 uuid,
  suspension_reason            text CHECK (length(suspension_reason) <= 1000),
  closed_at                    timestamptz,             -- when rejected or withdrawn: starts the re-application cool-off (C-151)
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (programme_id, organisation_id) REFERENCES programme (id, organisation_id),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (nominated_by, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (rubric_version_id, organisation_id) REFERENCES rubric_version (id, organisation_id),
  CHECK (status NOT IN ('approved', 'suspended') OR decision = 'approved'),
  CHECK (status <> 'rejected' OR decision = 'rejected'),
  CHECK (NOT decision_reason_differs_flag OR length(coalesce(decision_reason, '')) >= 1),
  CHECK (status NOT IN ('rejected', 'withdrawn') OR closed_at IS NOT NULL)
);
-- One live application per person and programme; rejected and withdrawn ones are history (re-apply = new row).
CREATE UNIQUE INDEX mentor_application_one_live ON mentor_application (programme_id, membership_id) WHERE status NOT IN ('rejected', 'withdrawn');
CREATE INDEX mentor_application_person_idx ON mentor_application (membership_id);
CREATE INDEX mentor_application_programme_idx ON mentor_application (programme_id, status);
ALTER TABLE mentor_application ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_application FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('mentor_application');

-- ---- assessment (TENANT) — item scores are private to the assessor until the blind rules release them -----
CREATE TABLE assessment (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id         uuid NOT NULL REFERENCES organisation (id),
  application_id          uuid NOT NULL,
  assessor_membership_id  uuid NOT NULL,
  rubric_version_id       uuid NOT NULL,
  scores                  jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(scores) = 'object'),  -- {itemCode: integer}
  conflict_check          text NOT NULL CHECK (conflict_check = 'passed'),  -- a conflicting assignment is never stored
  due_at                  timestamptz NOT NULL,
  assigned_by             uuid,
  submitted_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, assessor_membership_id),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (application_id, organisation_id) REFERENCES mentor_application (id, organisation_id),
  FOREIGN KEY (assessor_membership_id, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (assigned_by, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (rubric_version_id, organisation_id) REFERENCES rubric_version (id, organisation_id)
);
CREATE INDEX assessment_assessor_idx ON assessment (assessor_membership_id);
ALTER TABLE assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('assessment');

-- ---- decision_release (TENANT) — PM-authored feedback released to the applicant, once, immutable ---------
CREATE TABLE decision_release (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id    uuid NOT NULL REFERENCES organisation (id),
  application_id     uuid NOT NULL,
  released_feedback  text CHECK (length(released_feedback) <= 2000),
  released_by        uuid,
  released_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id),
  FOREIGN KEY (application_id, organisation_id) REFERENCES mentor_application (id, organisation_id),
  FOREIGN KEY (released_by, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE decision_release ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_release FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('decision_release');

-- ---- vetting_relationship_flag (TENANT) — relationships of a suspended mentor, flagged to the PM (FR-VET-011) --
CREATE TABLE vetting_relationship_flag (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  application_id   uuid NOT NULL,
  relationship_id  uuid NOT NULL,
  flagged_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz,
  UNIQUE (application_id, relationship_id),
  FOREIGN KEY (application_id, organisation_id) REFERENCES mentor_application (id, organisation_id),
  FOREIGN KEY (relationship_id, organisation_id) REFERENCES relationship (id, organisation_id)
);
ALTER TABLE vetting_relationship_flag ENABLE ROW LEVEL SECURITY;
ALTER TABLE vetting_relationship_flag FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('vetting_relationship_flag');

-- =====================================================================================================
-- Guards (defence in depth: the service enforces the same rules)
-- =====================================================================================================

-- Rubric versions are immutable once used (FR-VET-003): after the first assessment (immutable_since) or
-- once an application or assessment references them, nothing but the immutable_since stamp may change.
CREATE FUNCTION mh_rubric_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE used boolean;
BEGIN
  IF OLD.immutable_since IS NULL AND NEW.immutable_since IS NOT NULL
     AND (NEW.id, NEW.organisation_id, NEW.code, NEW.version, NEW.name, NEW.sections, NEW.bands, NEW.max_total, NEW.created_at)
         IS NOT DISTINCT FROM (OLD.id, OLD.organisation_id, OLD.code, OLD.version, OLD.name, OLD.sections, OLD.bands, OLD.max_total, OLD.created_at) THEN
    RETURN NEW; -- stamping a version as used
  END IF;
  used := OLD.immutable_since IS NOT NULL
    OR EXISTS (SELECT 1 FROM assessment WHERE rubric_version_id = OLD.id)
    OR EXISTS (SELECT 1 FROM mentor_application WHERE rubric_version_id = OLD.id);
  IF used THEN
    RAISE EXCEPTION 'rubric version is immutable once used' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER rubric_version_guard BEFORE UPDATE ON rubric_version FOR EACH ROW EXECUTE FUNCTION mh_rubric_version_guard();

-- Legal mentor-application transitions only (domain model §4.1).
CREATE FUNCTION mh_mentor_application_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ptype text; n_all integer; n_open integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'nominated') THEN
      RAISE EXCEPTION 'illegal initial application status %', NEW.status USING ERRCODE = '23514';
    END IF;
    IF (NEW.status = 'nominated') <> (NEW.source = 'nominated') THEN
      RAISE EXCEPTION 'nominated applications start as nominated' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  NEW.updated_at := now();
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NOT ((OLD.status || '>' || NEW.status) = ANY (ARRAY[
    'nominated>draft', 'nominated>withdrawn', 'draft>submitted', 'draft>withdrawn',
    'submitted>in_review', 'submitted>withdrawn', 'submitted>approved',
    'in_review>approved', 'in_review>rejected', 'in_review>withdrawn',
    'approved>suspended', 'suspended>approved'])) THEN
    RAISE EXCEPTION 'illegal application transition % to %', OLD.status, NEW.status USING ERRCODE = '23514';
  END IF;
  SELECT count(*), count(*) FILTER (WHERE submitted_at IS NULL) INTO n_all, n_open FROM assessment WHERE application_id = OLD.id;
  IF OLD.status = 'submitted' AND NEW.status = 'in_review' AND n_all = 0 THEN
    RAISE EXCEPTION 'an assessor must be assigned first' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'in_review' AND NEW.status IN ('approved', 'rejected') AND (n_all = 0 OR n_open > 0) THEN
    RAISE EXCEPTION 'all assessments must be submitted before a decision' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'submitted' AND NEW.status = 'approved' THEN
    SELECT type INTO ptype FROM programme WHERE id = OLD.programme_id AND organisation_id = OLD.organisation_id;
    IF ptype IS DISTINCT FROM 'open' THEN
      RAISE EXCEPTION 'approval without assessment is for the Open programme only' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mentor_application_guard BEFORE INSERT OR UPDATE ON mentor_application FOR EACH ROW EXECUTE FUNCTION mh_mentor_application_guard();

-- Assignment guard: self-assessment is impossible, at most two assessors (C-026, FR-VET-005), rubric pinned.
CREATE FUNCTION mh_assessment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE app mentor_application%ROWTYPE; n integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.submitted_at IS NOT NULL THEN
      RAISE EXCEPTION 'a submitted assessment is immutable' USING ERRCODE = '23514';
    END IF;
    IF (NEW.application_id, NEW.assessor_membership_id, NEW.rubric_version_id) IS DISTINCT FROM (OLD.application_id, OLD.assessor_membership_id, OLD.rubric_version_id) THEN
      RAISE EXCEPTION 'assessment identity is immutable' USING ERRCODE = '23514';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  SELECT * INTO app FROM mentor_application WHERE id = NEW.application_id AND organisation_id = NEW.organisation_id FOR UPDATE;
  IF app.id IS NULL OR app.status NOT IN ('submitted', 'in_review') THEN
    RAISE EXCEPTION 'assessors can be assigned to submitted applications only' USING ERRCODE = '23514';
  END IF;
  IF app.membership_id = NEW.assessor_membership_id THEN
    RAISE EXCEPTION 'nobody can assess their own application' USING ERRCODE = '23514';
  END IF;
  IF app.rubric_version_id IS DISTINCT FROM NEW.rubric_version_id THEN
    RAISE EXCEPTION 'assessment must use the rubric version pinned to the application' USING ERRCODE = '23514';
  END IF;
  SELECT count(*) INTO n FROM assessment WHERE application_id = NEW.application_id;
  IF n >= 2 THEN
    RAISE EXCEPTION 'at most two assessors per application' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assessment_guard BEFORE INSERT OR UPDATE ON assessment FOR EACH ROW EXECUTE FUNCTION mh_assessment_guard();

-- The first assessment on a rubric version stamps it immutable (domain model §9).
CREATE FUNCTION mh_assessment_stamp_rubric() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE rubric_version SET immutable_since = now() WHERE id = NEW.rubric_version_id AND organisation_id = NEW.organisation_id AND immutable_since IS NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER assessment_stamp_rubric AFTER INSERT ON assessment FOR EACH ROW EXECUTE FUNCTION mh_assessment_stamp_rubric();

-- A released decision is permanent.
CREATE FUNCTION mh_decision_release_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'a released decision is immutable' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER decision_release_immutable BEFORE UPDATE OR DELETE ON decision_release FOR EACH ROW EXECUTE FUNCTION mh_decision_release_immutable();

-- ---- grants (least privilege) -----------------------------------------------------------------------
GRANT SELECT, INSERT ON rubric_version TO mh_app;
GRANT UPDATE (immutable_since) ON rubric_version TO mh_app;
GRANT SELECT, INSERT, UPDATE ON mentor_application TO mh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON assessment TO mh_app;   -- DELETE: 24-month retention (FR-VET-010)
GRANT SELECT, INSERT ON decision_release TO mh_app;
GRANT SELECT, INSERT, UPDATE ON vetting_relationship_flag TO mh_app;
