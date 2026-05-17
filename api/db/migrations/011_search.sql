CREATE INDEX IF NOT EXISTS posts_fts
  ON posts USING GIN(to_tsvector('english', title || ' ' || body));

CREATE INDEX IF NOT EXISTS guides_fts
  ON guides USING GIN(to_tsvector('english', title || ' ' || body));

CREATE INDEX IF NOT EXISTS events_fts
  ON disaster_events USING GIN(to_tsvector('english', title || ' ' || event_type));

CREATE INDEX IF NOT EXISTS news_fts
  ON news_items USING GIN(to_tsvector('english', title || ' ' || coalesce(summary, '')));
