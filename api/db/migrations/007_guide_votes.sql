CREATE TABLE IF NOT EXISTS guide_votes (
  user_id  INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  guide_id INTEGER NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  vote     VARCHAR(6) NOT NULL CHECK (vote IN ('signal', 'noise')),
  PRIMARY KEY (user_id, guide_id)
);

CREATE INDEX IF NOT EXISTS idx_guide_votes_guide_id ON guide_votes (guide_id);

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS signal_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS noise_count  INTEGER NOT NULL DEFAULT 0;
