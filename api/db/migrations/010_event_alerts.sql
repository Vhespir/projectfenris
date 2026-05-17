CREATE TABLE IF NOT EXISTS event_alerts (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES disaster_events(id) ON DELETE CASCADE,
  sent_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);
