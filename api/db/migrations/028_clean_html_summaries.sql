-- Some atom feeds (PTWC's tsunami feed in particular) put their body in
-- <summary type="xhtml"> rather than a content field, and rss-parser has no
-- plain-text fallback for that shape, so raw markup was landing straight in
-- news_items.summary. The worker fetcher now strips this before insert, but
-- rows already ingested with the bug still need a one-time cleanup.
UPDATE news_items n
SET summary = NULLIF(cleaned.summary, '')
FROM (
  SELECT id,
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(summary, '<[^>]*>', ' ', 'g'),
                  '&nbsp;', ' ', 'gi'
                ),
                '&amp;', '&', 'gi'
              ),
              '&lt;', '<', 'gi'
            ),
            '&gt;', '>', 'gi'
          ),
          '&quot;', '"', 'gi'
        ),
        '\s+', ' ', 'g'
      )
    ) AS summary
  FROM news_items
  WHERE summary ~ '<[a-zA-Z/!]'
) cleaned
WHERE n.id = cleaned.id;
