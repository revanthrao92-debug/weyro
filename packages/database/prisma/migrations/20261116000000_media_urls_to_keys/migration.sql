-- C3: uploads are stored as object keys, never as presigned URLs (which expire).
-- Convert every existing full URL that points at our storage into its key.
-- URLs that do not point at our storage (external seed images) are left alone.

CREATE FUNCTION pg_temp.weyro_media_key(u text) RETURNS text AS $$
  SELECT CASE
    -- local dev driver: .../uploads/local-file?key=<url-encoded key>&token=...
    WHEN u ~ '[?&]key=[^&]+' THEN
      regexp_replace(
        replace(replace((regexp_match(u, '[?&]key=([^&]+)'))[1], '%2F', '/'), '%2f', '/'),
        '^(?!(damage-requests|vehicles|avatars|spare-parts|verification-documents)/).*$',
        ''
      )
    -- S3 virtual-host or path-style: strip the query string, keep the key suffix
    ELSE (regexp_match(
      split_part(u, '?', 1),
      '((?:damage-requests|vehicles|avatars|spare-parts|verification-documents)/[A-Za-z0-9._/-]+)$'
    ))[1]
  END;
$$ LANGUAGE sql IMMUTABLE;

UPDATE "request_media"
SET "url" = pg_temp.weyro_media_key("url")
WHERE "url" ~* '^https?://'
  AND COALESCE(pg_temp.weyro_media_key("url"), '') <> '';

UPDATE "spare_parts"
SET "imageUrl" = pg_temp.weyro_media_key("imageUrl")
WHERE "imageUrl" ~* '^https?://'
  AND COALESCE(pg_temp.weyro_media_key("imageUrl"), '') <> '';

UPDATE "customer_profiles"
SET "avatarUrl" = pg_temp.weyro_media_key("avatarUrl")
WHERE "avatarUrl" ~* '^https?://'
  AND COALESCE(pg_temp.weyro_media_key("avatarUrl"), '') <> '';

UPDATE "messages"
SET "mediaUrls" = ARRAY(
  SELECT COALESCE(NULLIF(pg_temp.weyro_media_key(m), ''), m)
  FROM unnest("mediaUrls") WITH ORDINALITY AS t(m, i)
  ORDER BY i
)
WHERE EXISTS (SELECT 1 FROM unnest("mediaUrls") AS m WHERE m ~* '^https?://');
