-- Replace separate upvotes/downvotes tables with a single post_votes table
-- (same pattern as guide_votes) to enforce mutual exclusion
CREATE TABLE IF NOT EXISTS post_votes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  vote    VARCHAR(10) NOT NULL CHECK (vote IN ('up', 'down')),
  PRIMARY KEY (user_id, post_id)
);

-- Migrate existing upvotes
INSERT INTO post_votes (user_id, post_id, vote)
SELECT user_id, post_id, 'up' FROM upvotes
ON CONFLICT DO NOTHING;

-- Migrate existing downvotes (skip if user already has an upvote for that post)
INSERT INTO post_votes (user_id, post_id, vote)
SELECT user_id, post_id, 'down' FROM downvotes
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS upvotes;
DROP TABLE IF EXISTS downvotes;

-- Comment voting (upvote-only, like Reddit comments)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS upvote_count INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS comment_votes (
  user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, comment_id)
);
