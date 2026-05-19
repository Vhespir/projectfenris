-- Friendly prepper-world slugs for events and news items
ALTER TABLE disaster_events ADD COLUMN IF NOT EXISTS slug VARCHAR(50) UNIQUE;
ALTER TABLE news_items      ADD COLUMN IF NOT EXISTS slug VARCHAR(50) UNIQUE;

-- Trigger function: assigns a random MODIFIER-NOUN slug on insert
CREATE OR REPLACE FUNCTION assign_slug()
RETURNS TRIGGER AS $$
DECLARE
  mods  TEXT[] := ARRAY['IRON','STEEL','GHOST','SHADOW','AMBER','DELTA','COLD','DARK','STORM',
                         'SILENT','EMBER','CRIMSON','RECON','BLACK','GREY','COPPER','FIELD',
                         'ALPHA','BRAVO','ECHO','FORGE','FLASH','VAULT','NIGHT','WOLF',
                         'ROGUE','STONE','ASHEN','RIDGE','FALLEN','LONE','BROKEN'];
  nouns TEXT[] := ARRAY['CACHE','RIDGE','WATCH','BEACON','FORGE','DEPOT','RELAY','SHELTER',
                         'SIGNAL','OUTPOST','TORCH','SCOUT','RAVEN','BASIN','FLARE','TRAIL',
                         'POST','BUNKER','HAWK','TIMBER','CREEK','ANVIL','POINT','HOLLOW',
                         'GATE','PASS','DRAW','PEAK','STAND','FOXHOLE','BIVOUAC','BULWARK'];
  candidate TEXT;
  cnt       INT;
  attempt   INT := 0;
BEGIN
  IF NEW.slug IS NOT NULL THEN RETURN NEW; END IF;
  LOOP
    candidate := mods[1 + (floor(random() * array_length(mods, 1)))::int]
              || '-'
              || nouns[1 + (floor(random() * array_length(nouns, 1)))::int];
    IF attempt > 0 THEN candidate := candidate || '-' || attempt::text; END IF;
    EXECUTE format('SELECT COUNT(1) FROM %I WHERE slug = $1', TG_TABLE_NAME)
      INTO cnt USING candidate;
    IF cnt = 0 THEN
      NEW.slug := candidate;
      RETURN NEW;
    END IF;
    attempt := attempt + 1;
    IF attempt > 20 THEN
      NEW.slug := 'REF-' || to_char(clock_timestamp(), 'SSMSUS');
      RETURN NEW;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_disaster_events_slug
  BEFORE INSERT ON disaster_events
  FOR EACH ROW EXECUTE FUNCTION assign_slug();

CREATE OR REPLACE TRIGGER trg_news_items_slug
  BEFORE INSERT ON news_items
  FOR EACH ROW EXECUTE FUNCTION assign_slug();

-- Backfill existing disaster_events
DO $$
DECLARE
  mods  TEXT[] := ARRAY['IRON','STEEL','GHOST','SHADOW','AMBER','DELTA','COLD','DARK','STORM',
                         'SILENT','EMBER','CRIMSON','RECON','BLACK','GREY','COPPER','FIELD',
                         'ALPHA','BRAVO','ECHO','FORGE','FLASH','VAULT','NIGHT','WOLF',
                         'ROGUE','STONE','ASHEN','RIDGE','FALLEN','LONE','BROKEN'];
  nouns TEXT[] := ARRAY['CACHE','RIDGE','WATCH','BEACON','FORGE','DEPOT','RELAY','SHELTER',
                         'SIGNAL','OUTPOST','TORCH','SCOUT','RAVEN','BASIN','FLARE','TRAIL',
                         'POST','BUNKER','HAWK','TIMBER','CREEK','ANVIL','POINT','HOLLOW',
                         'GATE','PASS','DRAW','PEAK','STAND','FOXHOLE','BIVOUAC','BULWARK'];
  rec       RECORD;
  candidate TEXT;
  cnt       INT;
  attempt   INT;
BEGIN
  FOR rec IN SELECT id FROM disaster_events WHERE slug IS NULL ORDER BY id LOOP
    attempt := 0;
    LOOP
      candidate := mods[1 + (floor(random() * array_length(mods, 1)))::int]
                || '-'
                || nouns[1 + (floor(random() * array_length(nouns, 1)))::int];
      IF attempt > 0 THEN candidate := candidate || '-' || attempt::text; END IF;
      SELECT COUNT(1) INTO cnt FROM disaster_events WHERE slug = candidate;
      IF cnt = 0 THEN
        UPDATE disaster_events SET slug = candidate WHERE id = rec.id;
        EXIT;
      END IF;
      attempt := attempt + 1;
    END LOOP;
  END LOOP;
END $$;

-- Backfill existing news_items
DO $$
DECLARE
  mods  TEXT[] := ARRAY['IRON','STEEL','GHOST','SHADOW','AMBER','DELTA','COLD','DARK','STORM',
                         'SILENT','EMBER','CRIMSON','RECON','BLACK','GREY','COPPER','FIELD',
                         'ALPHA','BRAVO','ECHO','FORGE','FLASH','VAULT','NIGHT','WOLF',
                         'ROGUE','STONE','ASHEN','RIDGE','FALLEN','LONE','BROKEN'];
  nouns TEXT[] := ARRAY['CACHE','RIDGE','WATCH','BEACON','FORGE','DEPOT','RELAY','SHELTER',
                         'SIGNAL','OUTPOST','TORCH','SCOUT','RAVEN','BASIN','FLARE','TRAIL',
                         'POST','BUNKER','HAWK','TIMBER','CREEK','ANVIL','POINT','HOLLOW',
                         'GATE','PASS','DRAW','PEAK','STAND','FOXHOLE','BIVOUAC','BULWARK'];
  rec       RECORD;
  candidate TEXT;
  cnt       INT;
  attempt   INT;
BEGIN
  FOR rec IN SELECT id FROM news_items WHERE slug IS NULL ORDER BY id LOOP
    attempt := 0;
    LOOP
      candidate := mods[1 + (floor(random() * array_length(mods, 1)))::int]
                || '-'
                || nouns[1 + (floor(random() * array_length(nouns, 1)))::int];
      IF attempt > 0 THEN candidate := candidate || '-' || attempt::text; END IF;
      SELECT COUNT(1) INTO cnt FROM news_items WHERE slug = candidate;
      IF cnt = 0 THEN
        UPDATE news_items SET slug = candidate WHERE id = rec.id;
        EXIT;
      END IF;
      attempt := attempt + 1;
    END LOOP;
  END LOOP;
END $$;

-- Cross-content reference table
CREATE TABLE IF NOT EXISTS content_references (
  id          BIGSERIAL    PRIMARY KEY,
  source_type VARCHAR(20)  NOT NULL,
  source_id   BIGINT       NOT NULL,
  target_type VARCHAR(20)  NOT NULL,
  target_id   BIGINT       NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS content_refs_source ON content_references (source_type, source_id);
CREATE INDEX IF NOT EXISTS content_refs_target ON content_references (target_type, target_id);

-- Fast slug lookups
CREATE INDEX IF NOT EXISTS idx_disaster_events_slug ON disaster_events (slug);
CREATE INDEX IF NOT EXISTS idx_news_items_slug       ON news_items (slug);
