-- 0041 · Background-job run summaries (slice S3 part 2, US-ADM-05)
-- A summary row per job: queue, status, attempts, error CODE, times. Never the payload, never an address (INV-3.10).
-- graphile-worker keeps the payload in its own table; the admin view reads only this one.

CREATE TABLE job_run (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  graphile_job_id  bigint NOT NULL,
  queue            text NOT NULL CHECK (queue ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  status           text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  attempts         integer NOT NULL DEFAULT 0,
  max_attempts     integer,
  last_error_code  text CHECK (last_error_code ~ '^[a-z][a-z0-9_]{1,39}$'),
  created_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  finished_at      timestamptz,
  retried_at       timestamptz,
  UNIQUE (organisation_id, graphile_job_id)
);
ALTER TABLE job_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_run FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('job_run');
CREATE INDEX job_run_time_idx ON job_run (organisation_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON job_run TO mh_app;
