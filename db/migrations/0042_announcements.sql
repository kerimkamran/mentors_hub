-- 0042 · In-app announcements (slice S3 part 2, US-ADM-18)
-- Admin-authored banner text (A4: never private content). Length is bounded by C-164 in code (admin-managed 100-2000);
-- the table keeps the platform ceiling of 2000. An end date is mandatory.

CREATE TABLE announcement (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisation (id),
  scope_type        text NOT NULL CHECK (scope_type IN ('org', 'programme')),
  programme_id      uuid,
  text_en           text CHECK (length(text_en) BETWEEN 1 AND 2000),
  text_az           text CHECK (length(text_az) BETWEEN 1 AND 2000),
  text_ru           text CHECK (length(text_ru) BETWEEN 1 AND 2000),
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz NOT NULL,
  ended_at          timestamptz,                   -- ended early by an author
  notify_requested  boolean NOT NULL DEFAULT false,
  created_by        uuid NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (coalesce(text_en, text_az, text_ru) IS NOT NULL),
  CHECK ((scope_type = 'org') = (programme_id IS NULL)),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (programme_id, organisation_id) REFERENCES programme (id, organisation_id),
  FOREIGN KEY (created_by, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE announcement ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('announcement');
CREATE INDEX announcement_window_idx ON announcement (organisation_id, starts_at, ends_at);

CREATE TABLE announcement_dismissal (
  announcement_id  uuid NOT NULL,
  membership_id    uuid NOT NULL,
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  dismissed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, membership_id),
  FOREIGN KEY (announcement_id, organisation_id) REFERENCES announcement (id, organisation_id),
  FOREIGN KEY (membership_id, organisation_id) REFERENCES membership (id, organisation_id)
);
ALTER TABLE announcement_dismissal ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_dismissal FORCE ROW LEVEL SECURITY;
SELECT mh_tenant_policy_only('announcement_dismissal');

GRANT SELECT, INSERT ON announcement TO mh_app;
GRANT UPDATE (ended_at) ON announcement TO mh_app;
GRANT SELECT, INSERT ON announcement_dismissal TO mh_app;
