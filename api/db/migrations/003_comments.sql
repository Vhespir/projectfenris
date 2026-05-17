CREATE TABLE IF NOT EXISTS comments (
  id          SERIAL PRIMARY KEY,
  post_id     INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  guide_id    INTEGER REFERENCES guides(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  is_removed  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_parent CHECK (
    (post_id IS NOT NULL AND guide_id IS NULL) OR
    (post_id IS NULL AND guide_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id  ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_guide_id ON comments(guide_id);
