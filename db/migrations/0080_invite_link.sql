-- 0080 · Invite links: an administrator adds a person and hands them a single-use sign-in link (invite-only access).
-- GLOBAL table (allowlisted in scripts/lint-migrations.ts, INV-1.6): a link is redeemed BEFORE an organisation context
-- exists, exactly like login_challenge. It holds only ids and the hash of the token, never the token itself.
CREATE TABLE invite_link (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisation (id),
  identity_id      uuid NOT NULL REFERENCES identity (id),
  membership_id    uuid NOT NULL REFERENCES membership (id),
  token_hash       text NOT NULL UNIQUE,
  created_by       uuid REFERENCES membership (id),   -- null only for the staging bootstrap link
  expires_at       timestamptz NOT NULL,
  used_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invite_link_membership_idx ON invite_link (membership_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON invite_link TO mh_app;
