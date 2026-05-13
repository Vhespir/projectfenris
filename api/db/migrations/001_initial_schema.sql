CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS disaster_events (
  id          SERIAL PRIMARY KEY,
  source      VARCHAR(20)  NOT NULL,
  event_type  VARCHAR(100) NOT NULL,
  title       TEXT         NOT NULL,
  severity    VARCHAR(20),
  geometry    GEOMETRY(Geometry, 4326),
  properties  JSONB        NOT NULL DEFAULT '{}',
  external_id VARCHAR(500),
  starts_at   TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  fetched_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS disaster_events_source_external_id
  ON disaster_events (source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS disaster_events_geometry_gist
  ON disaster_events USING GIST(geometry);

CREATE INDEX IF NOT EXISTS disaster_events_fetched_at
  ON disaster_events (fetched_at DESC);

CREATE TABLE IF NOT EXISTS users (
  id                 SERIAL PRIMARY KEY,
  username           VARCHAR(50)  UNIQUE NOT NULL,
  email              VARCHAR(255) UNIQUE NOT NULL,
  password_hash      TEXT         NOT NULL,
  region_state       VARCHAR(50),
  region_county      VARCHAR(100),
  latitude           DOUBLE PRECISION,
  longitude          DOUBLE PRECISION,
  reputation         INTEGER      NOT NULL DEFAULT 0,
  is_trusted         BOOLEAN      NOT NULL DEFAULT FALSE,
  is_moderator       BOOLEAN      NOT NULL DEFAULT FALSE,
  threat_profile     JSONB        NOT NULL DEFAULT '[]',
  notification_prefs JSONB        NOT NULL DEFAULT '{"email":true,"push":false,"severity":"moderate"}',
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS posts (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  post_type      VARCHAR(30)  NOT NULL,
  category       VARCHAR(100) NOT NULL,
  title          TEXT         NOT NULL,
  body           TEXT         NOT NULL,
  location_label TEXT,
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  upvote_count   INTEGER      NOT NULL DEFAULT 0,
  is_removed     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_type_created ON posts (post_type, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_user        ON posts (user_id);

CREATE TABLE IF NOT EXISTS upvotes (
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  post_id    INTEGER REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS news_items (
  id           SERIAL PRIMARY KEY,
  source       VARCHAR(100) NOT NULL,
  title        TEXT         NOT NULL,
  url          TEXT,
  summary      TEXT,
  category     VARCHAR(100),
  region       VARCHAR(100),
  published_at TIMESTAMPTZ,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS news_items_url_unique
  ON news_items (url)
  WHERE url IS NOT NULL;

CREATE INDEX IF NOT EXISTS news_items_published ON news_items (published_at DESC);
