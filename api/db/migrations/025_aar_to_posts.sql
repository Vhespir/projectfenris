-- Fold After Action Reports into posts as a 4th post_type ('aar') instead of
-- a fully parallel table. AAR previously had no comment threads at all (no
-- aar_comments table ever existed) and duplicated posts' vote/notification/
-- real-time infrastructure with its own aar_votes table. As a real post,
-- AAR gets comments, the unified vote system, the new-post live banner, and
-- #slug citations for free.

-- AAR's structured fields, as nullable columns -- only populated when
-- post_type = 'aar'. location_label already existed on posts (used by
-- field_report) and is reused directly.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS incident_type TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS what_worked TEXT[] DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS what_failed TEXT[] DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS wish_had TEXT[] DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS key_takeaway TEXT;

-- Give every post a slug, same as disaster_events/news_items/guides/AARs
-- already have -- keeps AAR-turned-posts citable via #slug exactly as
-- before, and is a natural extension of the existing assign_slug() trigger
-- to the one content type that didn't have it yet.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS slug VARCHAR(50) UNIQUE;
CREATE OR REPLACE TRIGGER trg_posts_slug
  BEFORE INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION assign_slug();
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts (slug);

-- Migrate existing AAR rows into posts. category is set to incident_type
-- since posts.category is NOT NULL and AAR has no separate category concept.
INSERT INTO posts (
  user_id, post_type, category, title, body, location_label, state,
  incident_type, duration, what_worked, what_failed, wish_had, key_takeaway,
  upvote_count, downvote_count, is_removed, created_at, updated_at, slug
)
SELECT
  user_id, 'aar', incident_type, title, narrative, location_label, state,
  incident_type, duration, what_worked, what_failed, wish_had, key_takeaway,
  signal_count, noise_count, is_removed, created_at, updated_at, slug
FROM after_action_reports;

-- Migrate votes. aar_votes used signal/noise; post_votes uses up/down.
INSERT INTO post_votes (user_id, post_id, vote)
SELECT av.user_id, p.id, CASE av.vote WHEN 'signal' THEN 'up' ELSE 'down' END
FROM aar_votes av
JOIN after_action_reports a ON a.id = av.aar_id
JOIN posts p ON p.slug = a.slug
ON CONFLICT DO NOTHING;

-- Repoint any content_references that targeted the old aar type (refs.js
-- never actually wrote these -- only events/news get cited on post create --
-- but this is here in case that changes before this migration runs).
UPDATE content_references cr
SET target_type = 'post', target_id = p.id
FROM after_action_reports a
JOIN posts p ON p.slug = a.slug
WHERE cr.target_type = 'aar' AND cr.target_id = a.id;

DROP TABLE IF EXISTS aar_votes;
DROP TABLE IF EXISTS after_action_reports;
