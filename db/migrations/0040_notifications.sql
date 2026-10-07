-- 0040 · Notifications, email delivery log, notification preferences (slice S3 part 2)
-- R1 / INV-3: a notification row holds IDS ONLY (recipient, subject object, template code). The visible text is
-- rendered at display time from the template registry in the recipient's language and time zone. No subject, body,
-- link token, address or free text is ever stored here or in delivery_attempt.

CREATE TABLE notification (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  recipient_id     uuid NOT NULL,                 -- membership
  template_code    text NOT NULL CHECK (template_code ~ '^N-[0-9]{3}$'),
  subject_type     text NOT NULL CHECK (subject_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  subject_id       uuid NOT NULL,
  actor_id         uuid,                          -- membership that triggered it (id only; templates may show the name)
  programme_id     uuid,                          -- lets a PM see delivery status for their own programmes
  dedupe_key       text CHECK (dedupe_key ~ '^[A-Za-z0-9:_.-]{1,64}$'),
  created_at       timestamptz NOT NULL DEFAULT now(),
  read_at          timestamptz,
  UNIQUE (id, organisation_id),
  FOREIGN KEY (recipient_id, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (actor_id, organisation_id) REFERENCES membership (id, organisation_id),
  FOREIGN KEY (programme_id, organisation_id) REFERENCES programme (id, organisation_id)
);
ALTER TABLE notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('notification');
CREATE INDEX notification_recipient_idx ON notification (recipient_id, created_at DESC);
CREATE INDEX notification_programme_idx ON notification (programme_id) WHERE programme_id IS NOT NULL;
-- An explicit dedupe key makes a repeated trigger a no-op (rule: dedupe).
CREATE UNIQUE INDEX notification_dedupe_idx ON notification (recipient_id, template_code, subject_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- One row per delivery attempt of the email for a notification: status and error CODE only (US-ADM-06, C-161).
CREATE TABLE delivery_attempt (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  notification_id  uuid NOT NULL,
  template_code    text NOT NULL CHECK (template_code ~ '^N-[0-9]{3}$'),
  attempt_no       integer NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
  status           text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'deferred', 'bounced', 'failed')),
  error_code       text CHECK (error_code ~ '^[a-z][a-z0-9_]{1,39}$'),
  transport_tries  integer NOT NULL DEFAULT 0,
  queued_at        timestamptz NOT NULL DEFAULT now(),
  attempted_at     timestamptz,
  UNIQUE (id, organisation_id),
  UNIQUE (notification_id, attempt_no),
  FOREIGN KEY (notification_id, organisation_id) REFERENCES notification (id, organisation_id)
);
ALTER TABLE delivery_attempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_attempt FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('delivery_attempt');
CREATE INDEX delivery_attempt_time_idx ON delivery_attempt (organisation_id, queued_at DESC);

-- Per-person, per-template email switch (FR-MSG-007). Critical templates ignore it (enforced in code, tested).
CREATE TABLE notification_preference (
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  membership_id    uuid NOT NULL,
  template_code    text NOT NULL CHECK (template_code ~ '^N-[0-9]{3}$'),
  email_enabled    boolean NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membership_id, template_code),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE notification_preference ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preference FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('notification_preference');

GRANT SELECT, INSERT ON notification TO mh_app;
GRANT UPDATE (read_at) ON notification TO mh_app;
GRANT SELECT, INSERT, DELETE ON delivery_attempt TO mh_app;
GRANT UPDATE (status, error_code, transport_tries, attempted_at) ON delivery_attempt TO mh_app;
GRANT SELECT, INSERT, UPDATE ON notification_preference TO mh_app;
