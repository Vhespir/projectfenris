-- Add slugs to guides and after_action_reports
-- assign_slug() function already created in migration 020

ALTER TABLE guides ADD COLUMN IF NOT EXISTS slug VARCHAR(50) UNIQUE;
ALTER TABLE after_action_reports ADD COLUMN IF NOT EXISTS slug VARCHAR(50) UNIQUE;

CREATE OR REPLACE TRIGGER trg_guides_slug
  BEFORE INSERT ON guides
  FOR EACH ROW EXECUTE FUNCTION assign_slug();

CREATE OR REPLACE TRIGGER trg_aar_slug
  BEFORE INSERT ON after_action_reports
  FOR EACH ROW EXECUTE FUNCTION assign_slug();

-- Backfill existing guides
DO $$
DECLARE
  rec RECORD;
  mods TEXT[] := ARRAY['IRON','STEEL','GHOST','DELTA','ECHO','FOXTROT','SIERRA','TANGO','BRAVO','ALPHA','ZULU','KILO','LIMA','MIKE','NOVEMBER','OSCAR','PAPA','ROMEO','VICTOR','WHISKEY','COPPER','SILVER','TITAN','RIDGE','STORM','EMBER','FLINT','FORGE','RAVEN','WOLF'];
  nouns TEXT[] := ARRAY['CACHE','RIDGE','WATCH','PROTOCOL','SIGNAL','BUNKER','ROUTE','SECTOR','GRID','NODE','DEPOT','RELAY','BEACON','MARKER','STATION','OUTPOST','ZONE','POINT','BASE','LINK','FIELD','POST','TRACK','TRAIL','VAULT','STORE','HUB','GATE','LINE','PACK'];
  candidate TEXT;
  cnt INT;
  attempt INT;
BEGIN
  FOR rec IN SELECT id FROM guides WHERE slug IS NULL ORDER BY id LOOP
    attempt := 0;
    LOOP
      candidate := mods[1 + floor(random() * array_length(mods,1))::int] || '-' || nouns[1 + floor(random() * array_length(nouns,1))::int];
      IF attempt > 0 THEN candidate := candidate || '-' || attempt::text; END IF;
      SELECT COUNT(1) INTO cnt FROM guides WHERE slug = candidate;
      IF cnt = 0 THEN
        UPDATE guides SET slug = candidate WHERE id = rec.id;
        EXIT;
      END IF;
      attempt := attempt + 1;
      IF attempt > 20 THEN
        UPDATE guides SET slug = 'REF-' || to_char(clock_timestamp(), 'SSMSUS') WHERE id = rec.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Backfill existing after_action_reports
DO $$
DECLARE
  rec RECORD;
  mods TEXT[] := ARRAY['IRON','STEEL','GHOST','DELTA','ECHO','FOXTROT','SIERRA','TANGO','BRAVO','ALPHA','ZULU','KILO','LIMA','MIKE','NOVEMBER','OSCAR','PAPA','ROMEO','VICTOR','WHISKEY','COPPER','SILVER','TITAN','RIDGE','STORM','EMBER','FLINT','FORGE','RAVEN','WOLF'];
  nouns TEXT[] := ARRAY['CACHE','RIDGE','WATCH','PROTOCOL','SIGNAL','BUNKER','ROUTE','SECTOR','GRID','NODE','DEPOT','RELAY','BEACON','MARKER','STATION','OUTPOST','ZONE','POINT','BASE','LINK','FIELD','POST','TRACK','TRAIL','VAULT','STORE','HUB','GATE','LINE','PACK'];
  candidate TEXT;
  cnt INT;
  attempt INT;
BEGIN
  FOR rec IN SELECT id FROM after_action_reports WHERE slug IS NULL ORDER BY id LOOP
    attempt := 0;
    LOOP
      candidate := mods[1 + floor(random() * array_length(mods,1))::int] || '-' || nouns[1 + floor(random() * array_length(nouns,1))::int];
      IF attempt > 0 THEN candidate := candidate || '-' || attempt::text; END IF;
      SELECT COUNT(1) INTO cnt FROM after_action_reports WHERE slug = candidate;
      IF cnt = 0 THEN
        UPDATE after_action_reports SET slug = candidate WHERE id = rec.id;
        EXIT;
      END IF;
      attempt := attempt + 1;
      IF attempt > 20 THEN
        UPDATE after_action_reports SET slug = 'REF-' || to_char(clock_timestamp(), 'SSMSUS') WHERE id = rec.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;
