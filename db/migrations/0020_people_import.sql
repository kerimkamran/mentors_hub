-- 0020 · People import (slice S2): HR records, grade ladder, import runs and raw rows, directory export log.
-- Every tenant table: organisation_id, forced RLS, isolation policy, composite foreign keys (INV-1, ARCHITECTURE rule 2).
-- Raw import rows hold personal data and are deleted after C-104 (30 days) by the worker task import.purge;
-- run counts and statuses are kept (FR-IMP-010, AC-ADM-07.4).

-- ---- grade_ladder -----------------------------------------------------------------------------
-- The ladder is derived from the import (FR-IMP-006). `name` is the raw grade label from HR and is NEVER shown to
-- participants; only `bucket` is used by matching and (to org admins) by the directory.
CREATE TABLE grade_ladder (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  name             text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  source_order     numeric,
  order_index      integer NOT NULL CHECK (order_index >= 0),
  bucket           integer NOT NULL CHECK (bucket BETWEEN 1 AND 20),
  UNIQUE (organisation_id, name),
  UNIQUE (id, organisation_id)
);
ALTER TABLE grade_ladder ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_ladder FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('grade_ladder');

-- ---- import_run -------------------------------------------------------------------------------
CREATE TABLE import_run (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id        uuid NOT NULL REFERENCES organisation (id),
  programme_id           uuid,
  cohort_id              uuid,
  started_by             uuid NOT NULL,
  confirmed_by           uuid,
  mode                   text NOT NULL DEFAULT 'dry_run' CHECK (mode IN ('dry_run', 'confirmed')),
  state                  text NOT NULL DEFAULT 'previewed' CHECK (state IN ('previewed', 'applied')),
  source_format          text NOT NULL CHECK (source_format IN ('csv', 'xlsx')),
  full_sync              boolean NOT NULL DEFAULT false,
  is_synthetic           boolean NOT NULL DEFAULT false,
  present_columns        text[] NOT NULL,
  ignored_columns        integer NOT NULL DEFAULT 0 CHECK (ignored_columns >= 0),
  total_rows             integer NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  created_count          integer NOT NULL DEFAULT 0 CHECK (created_count >= 0),
  updated_count          integer NOT NULL DEFAULT 0 CHECK (updated_count >= 0),
  unchanged_count        integer NOT NULL DEFAULT 0 CHECK (unchanged_count >= 0),
  deactivated_count      integer NOT NULL DEFAULT 0 CHECK (deactivated_count >= 0),
  rejected_count         integer NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  kept_admin_count       integer NOT NULL DEFAULT 0 CHECK (kept_admin_count >= 0),
  ladder_added           integer NOT NULL DEFAULT 0 CHECK (ladder_added >= 0),
  ladder_changed         integer NOT NULL DEFAULT 0 CHECK (ladder_changed >= 0),
  flagged_relationships  integer NOT NULL DEFAULT 0 CHECK (flagged_relationships >= 0),
  created_at             timestamptz NOT NULL DEFAULT now(),
  confirmed_at           timestamptz,
  rows_purged_at         timestamptz,
  UNIQUE (id, organisation_id),
  CHECK (cohort_id IS NULL OR programme_id IS NOT NULL),
  CHECK ((mode = 'confirmed') = (state = 'applied')),
  FOREIGN KEY (programme_id, organisation_id) REFERENCES programme (id, organisation_id),
  FOREIGN KEY (cohort_id, organisation_id) REFERENCES cohort (id, organisation_id),
  FOREIGN KEY (started_by, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (confirmed_by, organisation_id) REFERENCES membership (id, organisation_id)
);
CREATE INDEX import_run_org_time_idx ON import_run (organisation_id, created_at DESC);
ALTER TABLE import_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_run FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('import_run');

-- ---- import_row (raw rows; purged after C-104) --------------------------------------------------
CREATE TABLE import_row (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  run_id           uuid NOT NULL,
  row_number       integer,
  raw              jsonb NOT NULL,
  outcome          text NOT NULL CHECK (outcome IN ('create', 'update', 'unchanged', 'deactivate', 'reject')),
  reason_code      text CHECK (reason_code ~ '^[a-z_]{1,40}$'),
  FOREIGN KEY (run_id, organisation_id) REFERENCES import_run (id, organisation_id)
);
CREATE INDEX import_row_run_idx ON import_row (run_id, outcome, row_number);
ALTER TABLE import_row ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_row FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('import_row');

-- ---- hr_record --------------------------------------------------------------------------------
-- Grade bucket (via grade_id) and reporting line are engine inputs and are never displayed to participants.
CREATE TABLE hr_record (
  membership_id          uuid PRIMARY KEY,
  organisation_id        uuid NOT NULL REFERENCES organisation (id),
  employee_id            text NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 64),
  hire_date              date,
  grade_id               uuid,
  manager_membership_id  uuid,
  status                 text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_import_run_id     uuid,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, employee_id),
  CHECK (manager_membership_id IS NULL OR manager_membership_id <> membership_id),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (grade_id, organisation_id) REFERENCES grade_ladder (id, organisation_id),
  FOREIGN KEY (manager_membership_id, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (last_import_run_id, organisation_id) REFERENCES import_run (id, organisation_id)
);
CREATE INDEX hr_record_manager_idx ON hr_record (manager_membership_id);
ALTER TABLE hr_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_record FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('hr_record');

-- ---- directory_export_log -------------------------------------------------------------------------
-- "Logged with my id and filters" (AC-ADM-22.3). Filters are ids and codes only; the typed search text is NOT kept (INV-3).
CREATE TABLE directory_export_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id       uuid NOT NULL REFERENCES organisation (id),
  actor_membership_id   uuid NOT NULL,
  detail_level          text NOT NULL CHECK (detail_level IN ('full', 'basic')),
  row_count             integer NOT NULL CHECK (row_count >= 0),
  filters               jsonb NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (actor_membership_id, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE directory_export_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_export_log FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('directory_export_log');

-- ---- grants (least privilege) ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON grade_ladder, import_run, hr_record TO mh_app;
GRANT SELECT, INSERT, DELETE ON import_row TO mh_app;
GRANT SELECT, INSERT ON directory_export_log TO mh_app;
GRANT USAGE ON SEQUENCE import_row_id_seq TO mh_app;
