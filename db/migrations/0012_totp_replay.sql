-- 0012 · TOTP replay protection: a code's time-step can be used only once per identity.
ALTER TABLE identity ADD COLUMN totp_last_counter bigint;
