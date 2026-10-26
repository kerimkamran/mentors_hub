-- 0081 · Email + password sign-in. A person never has a password chosen for them: an administrator issues a
-- single-use invite link and the person sets their own password through it (the administrator never sees it).
-- Only a salted scrypt hash is stored, never the password (INV-8.4 as amended). No default or seeded passwords.
ALTER TABLE identity ADD COLUMN password_hash text;
ALTER TABLE identity ADD COLUMN password_set_at timestamptz;
ALTER TABLE identity ADD CONSTRAINT identity_password_hash_format CHECK (password_hash IS NULL OR password_hash LIKE 'scrypt$v1$%');
