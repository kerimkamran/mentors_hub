-- 0044 · Appearance preferences per identity (slice S3 part 2, US-ADM-23.5)
-- Stored on the global identity row so the choice follows the person to another device. It reveals nothing about anyone else.
ALTER TABLE identity ADD COLUMN theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system'));
ALTER TABLE identity ADD COLUMN density text NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable', 'dense'));
