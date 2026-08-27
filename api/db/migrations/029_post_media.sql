-- Photo/video attachments on posts, so a first-hand field report or
-- self-reported news post can carry actual evidence, not just text.
-- One post can have multiple attachments, hence the separate table rather
-- than columns on posts directly.
CREATE TABLE IF NOT EXISTS post_media (
  id                SERIAL PRIMARY KEY,
  post_id           INTEGER REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  media_type        VARCHAR(10) NOT NULL CHECK (media_type IN ('photo', 'video')),
  url               TEXT NOT NULL,
  thumbnail_url     TEXT,
  width             INTEGER,
  height            INTEGER,
  duration_seconds  NUMERIC,
  bytes             INTEGER,
  position          INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media (post_id, position);
