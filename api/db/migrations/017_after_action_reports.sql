CREATE TABLE after_action_reports (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  location_label TEXT,
  state         TEXT,
  duration      TEXT,
  narrative     TEXT NOT NULL,
  what_worked   TEXT[] DEFAULT '{}',
  what_failed   TEXT[] DEFAULT '{}',
  wish_had      TEXT[] DEFAULT '{}',
  key_takeaway  TEXT,
  signal_count  INTEGER NOT NULL DEFAULT 0,
  noise_count   INTEGER NOT NULL DEFAULT 0,
  is_removed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE aar_votes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aar_id  INTEGER NOT NULL REFERENCES after_action_reports(id) ON DELETE CASCADE,
  vote    VARCHAR(6) NOT NULL CHECK (vote IN ('signal', 'noise')),
  PRIMARY KEY (user_id, aar_id)
);

CREATE INDEX idx_aar_user    ON after_action_reports(user_id);
CREATE INDEX idx_aar_type    ON after_action_reports(incident_type);
CREATE INDEX idx_aar_state   ON after_action_reports(state);
CREATE INDEX idx_aar_created ON after_action_reports(created_at DESC);
CREATE INDEX idx_aar_votes_aar ON aar_votes(aar_id);
