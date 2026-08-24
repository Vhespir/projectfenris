-- /search computed to_tsvector() fresh on every row on every query -- no
-- index could ever be used for that predicate, so it was a full sequential
-- scan over posts/guides every time. Precompute it at write time instead via
-- a generated column, and index that.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_posts_search ON posts USING GIN (search_vector);

ALTER TABLE guides ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_guides_search ON guides USING GIN (search_vector);
