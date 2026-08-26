-- Garden and crop tracking: beds hold crops, crops accumulate harvest logs,
-- and a separate seed inventory tracks what's on hand for next season.
-- Crops are never deleted on harvest completion (status changes instead) so
-- a bed's planting history stays intact for crop rotation planning.

CREATE TABLE garden_beds (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  location_label TEXT,
  size_sqft      NUMERIC(10,2),
  notes          TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE garden_crops (
  id                    SERIAL PRIMARY KEY,
  bed_id                INTEGER NOT NULL REFERENCES garden_beds(id) ON DELETE CASCADE,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  variety               TEXT,
  family                TEXT NOT NULL DEFAULT 'Other',
  status                TEXT NOT NULL DEFAULT 'planned',
  planted_date          DATE,
  expected_harvest_date DATE,
  season                TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE garden_harvests (
  id           SERIAL PRIMARY KEY,
  crop_id      INTEGER NOT NULL REFERENCES garden_crops(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  harvest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit         TEXT NOT NULL DEFAULT 'lbs',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE garden_seeds (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  variety        TEXT,
  family         TEXT NOT NULL DEFAULT 'Other',
  qty            NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit           TEXT NOT NULL DEFAULT 'packets',
  viability_year INTEGER,
  source         TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_garden_beds_user     ON garden_beds(user_id);
CREATE INDEX idx_garden_crops_bed     ON garden_crops(bed_id);
CREATE INDEX idx_garden_crops_user    ON garden_crops(user_id);
CREATE INDEX idx_garden_harvests_crop ON garden_harvests(crop_id);
CREATE INDEX idx_garden_harvests_user ON garden_harvests(user_id);
CREATE INDEX idx_garden_seeds_user    ON garden_seeds(user_id);
