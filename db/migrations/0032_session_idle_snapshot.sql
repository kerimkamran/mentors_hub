-- 0032 · A session keeps the idle limit it was issued with (AC-TEN-04.3): a settings change applies to NEW sessions only;
-- existing sessions end when their old limits are reached. NULL (sessions issued before this migration) falls back to the
-- organisation's current setting.
ALTER TABLE web_session ADD COLUMN idle_minutes integer CHECK (idle_minutes IS NULL OR idle_minutes BETWEEN 15 AND 1440);
