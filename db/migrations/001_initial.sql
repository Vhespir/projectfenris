-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  region VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Posts
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(100),
  region VARCHAR(255),
  location GEOMETRY(Point, 4326),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Disaster Events
CREATE TABLE IF NOT EXISTS disaster_events (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  event_type VARCHAR(100),
  title TEXT,
  severity VARCHAR(50),
  geometry GEOMETRY,
  properties JSONB,
  fetched_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_location ON posts USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_events_geometry ON disaster_events USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_events_source ON disaster_events(source);
CREATE INDEX IF NOT EXISTS idx_posts_region ON posts(region);
