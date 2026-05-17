ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio              TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url       TEXT,
  ADD COLUMN IF NOT EXISTS prep_level       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS focus_areas      JSONB  NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS years_prepping   INTEGER,
  ADD COLUMN IF NOT EXISTS living_situation VARCHAR(20),
  ADD COLUMN IF NOT EXISTS showcase         JSONB  NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS guides (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title        TEXT         NOT NULL,
  body         TEXT         NOT NULL,
  category     VARCHAR(100) NOT NULL,
  region       VARCHAR(100),
  rating       NUMERIC(3,1) NOT NULL DEFAULT 0,
  rating_count INTEGER      NOT NULL DEFAULT 0,
  is_removed   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guides_category   ON guides (category);
CREATE INDEX IF NOT EXISTS guides_rating     ON guides (rating DESC);
CREATE INDEX IF NOT EXISTS guides_user       ON guides (user_id);
CREATE INDEX IF NOT EXISTS guides_created    ON guides (created_at DESC);

CREATE TABLE IF NOT EXISTS guide_ratings (
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  guide_id   INTEGER REFERENCES guides(id) ON DELETE CASCADE NOT NULL,
  rating     INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, guide_id)
);
