-- 0002 · Language support (slice S0 spike, NFR-I18N)
-- Search treats ə/e, ı/i, ö/o, ü/u, ç/c, ş/s, ğ/g and ё/е as the same, so "mammadov" finds
-- Məmmədov. The same mapping exists in src/lib/search.ts; a test keeps both identical.

CREATE FUNCTION mh_normalise(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT lower(
    translate(
      normalize(input, NFC),
      'əƏıİöÖüÜçÇşŞğĞёЁ',
      'eeiioouuccssggее'
    )
  )
$$;

-- Language-aware ordering for names (Azerbaijani and Russian alphabets sort correctly).
CREATE COLLATION az_ci (provider = icu, locale = 'az-u-ks-level1', deterministic = false);
CREATE COLLATION ru_ci (provider = icu, locale = 'ru-u-ks-level1', deterministic = false);
CREATE COLLATION az_ai (provider = icu, locale = 'az', deterministic = true);
CREATE COLLATION ru_ai (provider = icu, locale = 'ru', deterministic = true);

GRANT EXECUTE ON FUNCTION mh_normalise(text) TO mh_app;
