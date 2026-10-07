-- 0043 · Bulk-action batches (slice S3 part 2, US-ADM-15)
-- A batch records WHO ran WHICH action on WHICH ids and the outcome per id. No names, no free text. A four-eyes action
-- (e.g. bulk erasure) is stored 'pending_approval' and runs only after a DIFFERENT org admin approves (AC-ADM-15.4);
-- the database refuses self-approval.

CREATE TABLE bulk_batch (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  action_code      text NOT NULL CHECK (action_code ~ '^[a-z][a-z0-9_]{1,39}$'),
  context_id       uuid,                           -- e.g. the programme or cohort the action targets
  status           text NOT NULL CHECK (status IN ('pending_approval', 'done', 'rejected')),
  created_by       uuid NOT NULL,
  approved_by      uuid,
  done_count       integer NOT NULL DEFAULT 0,
  skipped_count    integer NOT NULL DEFAULT 0,
  failed_count     integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  CHECK (approved_by IS NULL OR approved_by <> created_by),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (created_by, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (approved_by, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE bulk_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_batch FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('bulk_batch');

CREATE TABLE bulk_batch_item (
  batch_id         uuid NOT NULL,
  object_id        uuid NOT NULL,
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  outcome          text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'done', 'skipped', 'failed')),
  reason_code      text CHECK (reason_code ~ '^[a-z][a-z0-9_]{1,39}$'),
  PRIMARY KEY (batch_id, object_id),
  FOREIGN KEY (batch_id, organisation_id) REFERENCES bulk_batch (id, organisation_id)
);
ALTER TABLE bulk_batch_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_batch_item FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('bulk_batch_item');

GRANT SELECT, INSERT ON bulk_batch, bulk_batch_item TO mh_app;
GRANT UPDATE (status, approved_by, done_count, skipped_count, failed_count, finished_at) ON bulk_batch TO mh_app;
GRANT UPDATE (outcome, reason_code) ON bulk_batch_item TO mh_app;
