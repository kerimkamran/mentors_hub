-- 0052 · Availability, exceptions and blocks (slice S4; FR-PRF-007, FR-SCH-001, domain model §2.3).
-- Slots are NOT stored: they are generated from these rows by src/domain/availability/slots.ts.
-- Rules are local wall-clock windows in the owner's zone; weekday is ISO (Monday = 1, C-111).

CREATE TABLE availability_rule (            -- mentor weekly rules
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  membership_id    uuid NOT NULL,
  weekday          smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time       time NOT NULL,
  end_time         time NOT NULL,
  time_zone        text NOT NULL CHECK (length(time_zone) BETWEEN 1 AND 64),
  valid_from       date,
  valid_to         date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  CHECK (end_time > start_time),
  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_to >= valid_from),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE availability_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_rule FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('availability_rule');
CREATE INDEX availability_rule_person_idx ON availability_rule (membership_id);

CREATE TABLE availability_window (          -- mentee "I'm usually free…" windows
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  membership_id    uuid NOT NULL,
  weekday          smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time       time NOT NULL,
  end_time         time NOT NULL,
  time_zone        text NOT NULL CHECK (length(time_zone) BETWEEN 1 AND 64),
  valid_from       date,
  valid_to         date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  CHECK (end_time > start_time),
  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_to >= valid_from),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE availability_window ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_window FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('availability_window');
CREATE INDEX availability_window_person_idx ON availability_window (membership_id);

-- Away periods: any generated slot overlapping one is removed. No free text (INV-3).
CREATE TABLE availability_exception (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  membership_id    uuid NOT NULL,
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id),
  CHECK (ends_at > starts_at),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE availability_exception ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_exception FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('availability_exception');
CREATE INDEX availability_exception_person_idx ON availability_exception (membership_id, starts_at);

-- A person blocks another: neither is ever matched with, or shown to, the other (hard exclusion BLOCKED, C-081).
CREATE TABLE block (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id        uuid NOT NULL REFERENCES organisation (id),
  blocker_membership_id  uuid NOT NULL,
  blocked_membership_id  uuid NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_membership_id, blocked_membership_id),
  CHECK (blocker_membership_id <> blocked_membership_id),
  FOREIGN KEY (blocker_membership_id, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (blocked_membership_id, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE block ENABLE ROW LEVEL SECURITY;
ALTER TABLE block FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('block');
CREATE INDEX block_blocked_idx ON block (blocked_membership_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON availability_rule, availability_window, availability_exception TO mh_app;
GRANT SELECT, INSERT, DELETE ON block TO mh_app;
