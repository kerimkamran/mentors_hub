-- 0031 · Programme configuration (slice S3, FR-PRG-001…008): enrolment mode, eligibility rules, sponsors,
-- compatibility questionnaire definition, saved templates. Extends the S1 base tables (0011 is never edited).

ALTER TABLE programme
  ADD COLUMN enrolment_mode    text NOT NULL DEFAULT 'invite_only' CHECK (enrolment_mode IN ('invite_only', 'rule_based', 'nomination')),
  ADD COLUMN report_schedule   text NOT NULL DEFAULT 'none' CHECK (report_schedule IN ('monthly_and_final', 'per_phase', 'none')),
  ADD COLUMN rubric_version_id uuid,                       -- FK added with the rubric table (S5)
  ADD COLUMN template_id       uuid,                       -- the saved template it was created from, if any
  ADD COLUMN activated_at      timestamptz,
  ADD COLUMN closed_at         timestamptz,
  ADD COLUMN created_by        uuid,
  ADD CONSTRAINT programme_rule_based_open CHECK (enrolment_mode <> 'rule_based' OR type = 'open'),
  ADD CONSTRAINT programme_created_by_fk FOREIGN KEY (created_by, organisation_id) REFERENCES membership (id, organisation_id);

-- Legal programme transitions only: draft -> active -> closed (domain model §4; the service checks too).
CREATE FUNCTION mh_programme_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type IS DISTINCT FROM OLD.type THEN
    RAISE EXCEPTION 'programme type cannot change' USING ERRCODE = '23514';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT ((OLD.status = 'draft' AND NEW.status = 'active') OR (OLD.status = 'active' AND NEW.status = 'closed')) THEN
    RAISE EXCEPTION 'illegal programme transition % -> %', OLD.status, NEW.status USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER programme_transition BEFORE UPDATE ON programme
  FOR EACH ROW EXECUTE FUNCTION mh_programme_transition();

ALTER TABLE cohort
  ADD CONSTRAINT cohort_dates_ordered CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);
CREATE FUNCTION mh_cohort_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  o integer; n integer;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    o := array_position(ARRAY['draft', 'open', 'running', 'closed'], OLD.status);
    n := array_position(ARRAY['draft', 'open', 'running', 'closed'], NEW.status);
    IF n <= o THEN
      RAISE EXCEPTION 'illegal cohort transition % -> %', OLD.status, NEW.status USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cohort_transition BEFORE UPDATE ON cohort
  FOR EACH ROW EXECUTE FUNCTION mh_cohort_transition();

-- ---- eligibility rules (FR-PRG-004): all rules of a programme must hold (AND) -------------------------------------
CREATE TABLE eligibility_rule (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  programme_id     uuid NOT NULL,
  rule_type        text NOT NULL CHECK (rule_type IN ('department_in', 'tenure_min_months', 'grade_bucket_range')),
  params           jsonb NOT NULL CHECK (jsonb_typeof(params) = 'object'),
  position         integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (programme_id, organisation_id) REFERENCES programme (id, organisation_id)
);
ALTER TABLE eligibility_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_rule FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('eligibility_rule');
CREATE INDEX eligibility_rule_programme_idx ON eligibility_rule (programme_id, position);
GRANT SELECT, INSERT, DELETE ON eligibility_rule TO mh_app;

-- ---- sponsors (FR-PRG-006): named recipients of the final-evaluation pack; not users ------------------------------
CREATE TABLE sponsor (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  programme_id     uuid NOT NULL,
  name             text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  email            text NOT NULL CHECK (email = lower(email) AND length(email) <= 254 AND email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  role_label       text NOT NULL CHECK (length(role_label) BETWEEN 1 AND 120),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (programme_id, organisation_id) REFERENCES programme (id, organisation_id)
);
CREATE UNIQUE INDEX sponsor_programme_email_unique ON sponsor (programme_id, email);
ALTER TABLE sponsor ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('sponsor');
GRANT SELECT, INSERT, DELETE ON sponsor TO mh_app;

-- ---- compatibility questionnaire DEFINITION (FR-PRG-008). Answers belong to the profile/matching slices. ----------
CREATE TABLE compatibility_question (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  programme_id     uuid NOT NULL,
  section          text NOT NULL CHECK (section IN ('character', 'field', 'experience')),
  mode             text NOT NULL CHECK (mode IN ('similar', 'complementary')),
  scale_points     integer NOT NULL DEFAULT 5 CHECK (scale_points BETWEEN 3 AND 10),
  text_en          text NOT NULL CHECK (length(text_en) BETWEEN 1 AND 300),
  text_az          text NOT NULL CHECK (length(text_az) BETWEEN 1 AND 300),
  text_ru          text NOT NULL CHECK (length(text_ru) BETWEEN 1 AND 300),
  position         integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (programme_id, organisation_id) REFERENCES programme (id, organisation_id)
);
ALTER TABLE compatibility_question ENABLE ROW LEVEL SECURITY;
ALTER TABLE compatibility_question FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('compatibility_question');
CREATE INDEX compatibility_question_programme_idx ON compatibility_question (programme_id, section, position);
GRANT SELECT, INSERT, DELETE ON compatibility_question TO mh_app;

-- ---- saved programme templates (FR-ADM-006): settings version references + rubric ref + report schedule; no people --
CREATE TABLE settings_template (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisation (id),
  name              text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  programme_type    text NOT NULL CHECK (programme_type IN ('leadership', 'sparklab', 'open')),
  report_schedule   text NOT NULL CHECK (report_schedule IN ('monthly_and_final', 'per_phase', 'none')),
  rubric_version_id uuid,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (created_by, organisation_id) REFERENCES membership (id, organisation_id)
);
CREATE UNIQUE INDEX settings_template_name_unique ON settings_template (organisation_id, lower(name));
ALTER TABLE settings_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_template FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('settings_template');
GRANT SELECT, INSERT ON settings_template TO mh_app;

CREATE TABLE settings_template_item (
  template_id         uuid NOT NULL,
  organisation_id     uuid NOT NULL REFERENCES organisation (id),
  setting_group       text NOT NULL CHECK (setting_group IN ('cadence_capacity', 'matching', 'timings', 'flags')),
  settings_version_id  uuid NOT NULL,
  PRIMARY KEY (template_id, setting_group),
  FOREIGN KEY (template_id, organisation_id) REFERENCES settings_template (id, organisation_id),
  FOREIGN KEY (settings_version_id, organisation_id) REFERENCES settings_version (id, organisation_id)
);
ALTER TABLE settings_template_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_template_item FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('settings_template_item');
GRANT SELECT, INSERT ON settings_template_item TO mh_app;

ALTER TABLE programme
  ADD CONSTRAINT programme_template_fk FOREIGN KEY (template_id, organisation_id) REFERENCES settings_template (id, organisation_id);
GRANT SELECT, INSERT, UPDATE ON programme TO mh_app;
