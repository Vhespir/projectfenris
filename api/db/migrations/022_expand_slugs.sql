-- Expand assign_slug() wordlist and re-backfill all REF- slugs

CREATE OR REPLACE FUNCTION assign_slug() RETURNS TRIGGER AS $$
DECLARE
  mods TEXT[] := ARRAY[
    'IRON','STEEL','GHOST','DELTA','ECHO','FOXTROT','SIERRA','TANGO','BRAVO','ALPHA',
    'ZULU','KILO','LIMA','MIKE','NOVEMBER','OSCAR','PAPA','ROMEO','VICTOR','WHISKEY',
    'COPPER','SILVER','TITAN','STORM','EMBER','FLINT','FORGE','RAVEN','WOLF','SHADOW',
    'CRIMSON','AMBER','OBSIDIAN','COBALT','ASH','BONE','CROW','DUSK','FROST','HAWK',
    'JADE','OAK','PINE','RUST','SAND','SMOKE','STONE','SWIFT','THORN','VIPER',
    'CEDAR','BLADE','BOLT','BRASS','COAL','DAWN','DIRE','EDGE','FANG','GRIM',
    'GRIT','HARD','HAZE','KEEN','LONE','SALT','SCAR','STARK','ZERO','BLAZE',
    'DARK','DEEP','DEAD','COLD','HOLLOW','SILENT','SCARLET','ONYX','IVORY','AZURE',
    'BRONZE','SLATE','CINDER','VAPOR','PHANTOM','COVERT','BLIND','SHARP','STOUT','ROUGH',
    'NARROW','HEAVY','MUTED','HOLLOW','BARREN','BROKEN','SUNKEN','RISING','BURIED','FALLEN',
    'FROZEN','CHARRED','WICKED','BITTER','RAGGED','JAGGED','TWISTED','CROOKED','HOLLOW','HOLLOW',
    'VEILED','SHROUD','ASHEN','LEADEN','SOLEMN','GLOOMY','DISMAL','DREARY','MURKY','BLEAK',
    'SPARE','SPARE','GAUNT','STARK','BRISK','CRISP','KEEN','STERN','STOIC','GRUFF',
    'SWIFT','QUICK','FLEET','AGILE','BRAVE','BOLD','DREAD','FELL','GRIM','IRON'
  ];
  nouns TEXT[] := ARRAY[
    'CACHE','RIDGE','WATCH','PROTOCOL','SIGNAL','BUNKER','ROUTE','SECTOR','GRID','NODE',
    'DEPOT','RELAY','BEACON','MARKER','STATION','OUTPOST','ZONE','POINT','BASE','LINK',
    'FIELD','POST','TRACK','TRAIL','VAULT','STORE','HUB','GATE','LINE','PACK',
    'BAND','BOLT','CAMP','CHAIN','CLIFF','CODE','CORD','CRATE','CREEK','CROSS',
    'DECK','DEN','DOOR','DROP','DRUM','DUST','FEED','FLAG','FORD','FORK',
    'GAP','GEAR','GROVE','GUARD','HAVEN','HEAP','HILL','HOLE','HOOK','HULL',
    'KEEP','KNOT','LATCH','LOCK','LOOP','MARK','MESH','MILL','MOUND','MOUNT',
    'NEST','NET','NOTCH','PATCH','PATH','PEAK','PILE','PIPE','POOL','PORT',
    'RACK','RAMP','REACH','ROAD','ROPE','RUN','SHAFT','SHORE','SITE','SLAB',
    'SPAN','SPIKE','SPUR','STACK','STAKE','STAND','STEP','STOCK','STRAP','SURGE',
    'TANK','TENT','TOLL','TRAP','TUBE','UNIT','VALE','VENT','WARD','WAVE',
    'WELL','WIRE','YARD','ARCH','BANK','BERM','BLUFF','BOLT','CAIRN','CAVE',
    'CORD','CRAG','CREST','DALE','DRAW','DUNE','DYKE','FERN','FORD','GLEN',
    'GULLY','HELM','KNOB','LAIR','LEDGE','MESA','MOAT','MOOR','PASS','PEAT',
    'PIER','PINE','RISE','SCARP','SHELF','SHOAL','SLOPE','SPRING','SUMP','SWALE'
  ];
  candidate TEXT;
  cnt INT;
  attempt INT := 0;
  mod_len INT;
  noun_len INT;
BEGIN
  IF NEW.slug IS NOT NULL THEN RETURN NEW; END IF;
  mod_len  := array_length(mods, 1);
  noun_len := array_length(nouns, 1);
  LOOP
    candidate := mods[1 + floor(random() * mod_len)::int]
              || '-'
              || nouns[1 + floor(random() * noun_len)::int];
    IF attempt > 0 THEN candidate := candidate || '-' || attempt::text; END IF;
    EXECUTE format('SELECT COUNT(1) FROM %I WHERE slug = $1', TG_TABLE_NAME) INTO cnt USING candidate;
    IF cnt = 0 THEN NEW.slug := candidate; RETURN NEW; END IF;
    attempt := attempt + 1;
    IF attempt > 50 THEN
      NEW.slug := 'REF-' || to_char(clock_timestamp(), 'SSMSUS');
      RETURN NEW;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Re-backfill any REF- slugs in all four tables

DO $$
DECLARE
  rec RECORD;
  mods TEXT[] := ARRAY[
    'IRON','STEEL','GHOST','DELTA','ECHO','FOXTROT','SIERRA','TANGO','BRAVO','ALPHA',
    'ZULU','KILO','LIMA','MIKE','NOVEMBER','OSCAR','PAPA','ROMEO','VICTOR','WHISKEY',
    'COPPER','SILVER','TITAN','STORM','EMBER','FLINT','FORGE','RAVEN','WOLF','SHADOW',
    'CRIMSON','AMBER','OBSIDIAN','COBALT','ASH','BONE','CROW','DUSK','FROST','HAWK',
    'JADE','OAK','PINE','RUST','SAND','SMOKE','STONE','SWIFT','THORN','VIPER',
    'CEDAR','BLADE','BOLT','BRASS','COAL','DAWN','DIRE','EDGE','FANG','GRIM',
    'GRIT','HARD','HAZE','KEEN','LONE','SALT','SCAR','STARK','ZERO','BLAZE',
    'DARK','DEEP','DEAD','COLD','HOLLOW','SILENT','SCARLET','ONYX','IVORY','AZURE',
    'BRONZE','SLATE','CINDER','VAPOR','PHANTOM','COVERT','BLIND','SHARP','STOUT','ROUGH',
    'NARROW','HEAVY','MUTED','BARREN','BROKEN','SUNKEN','RISING','BURIED','FALLEN','FROZEN',
    'CHARRED','WICKED','BITTER','RAGGED','JAGGED','TWISTED','CROOKED','VEILED','SHROUD','ASHEN',
    'LEADEN','SOLEMN','GLOOMY','DISMAL','DREARY','MURKY','BLEAK','GAUNT','BRISK','CRISP',
    'STERN','STOIC','GRUFF','QUICK','FLEET','AGILE','BRAVE','BOLD','DREAD','FELL'
  ];
  nouns TEXT[] := ARRAY[
    'CACHE','RIDGE','WATCH','PROTOCOL','SIGNAL','BUNKER','ROUTE','SECTOR','GRID','NODE',
    'DEPOT','RELAY','BEACON','MARKER','STATION','OUTPOST','ZONE','POINT','BASE','LINK',
    'FIELD','POST','TRACK','TRAIL','VAULT','STORE','HUB','GATE','LINE','PACK',
    'BAND','BOLT','CAMP','CHAIN','CLIFF','CODE','CORD','CRATE','CREEK','CROSS',
    'DECK','DEN','DOOR','DROP','DRUM','DUST','FEED','FLAG','FORD','FORK',
    'GAP','GEAR','GROVE','GUARD','HAVEN','HEAP','HILL','HOLE','HOOK','HULL',
    'KEEP','KNOT','LATCH','LOCK','LOOP','MARK','MESH','MILL','MOUND','MOUNT',
    'NEST','NET','NOTCH','PATCH','PATH','PEAK','PILE','PIPE','POOL','PORT',
    'RACK','RAMP','REACH','ROAD','ROPE','RUN','SHAFT','SHORE','SITE','SLAB',
    'SPAN','SPIKE','SPUR','STACK','STAKE','STAND','STEP','STOCK','STRAP','SURGE',
    'TANK','TENT','TOLL','TRAP','TUBE','UNIT','VALE','VENT','WARD','WAVE',
    'WELL','WIRE','YARD','ARCH','BANK','BERM','BLUFF','CAIRN','CAVE','CRAG',
    'CREST','DALE','DRAW','DUNE','DYKE','FERN','FORD','GLEN','GULLY','HELM',
    'KNOB','LAIR','LEDGE','MESA','MOAT','MOOR','PASS','PEAT','PIER','RISE',
    'SCARP','SHELF','SHOAL','SLOPE','SPRING','SUMP','SWALE','BRACE','CROWN','FLANK'
  ];
  candidate TEXT;
  cnt INT;
  attempt INT;
  mod_len INT := array_length(mods, 1);
  noun_len INT := array_length(nouns, 1);
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['disaster_events','news_items','guides','after_action_reports'] LOOP
    FOR rec IN EXECUTE format('SELECT id FROM %I WHERE slug IS NULL OR slug LIKE ''REF-%%'' ORDER BY id', tbl) LOOP
      attempt := 0;
      LOOP
        candidate := mods[1 + floor(random() * mod_len)::int]
                  || '-'
                  || nouns[1 + floor(random() * noun_len)::int];
        IF attempt > 0 THEN candidate := candidate || '-' || attempt::text; END IF;
        EXECUTE format('SELECT COUNT(1) FROM %I WHERE slug = $1', tbl) INTO cnt USING candidate;
        IF cnt = 0 THEN
          EXECUTE format('UPDATE %I SET slug = $1 WHERE id = $2', tbl) USING candidate, rec.id;
          EXIT;
        END IF;
        attempt := attempt + 1;
        IF attempt > 100 THEN
          EXECUTE format('UPDATE %I SET slug = $1 WHERE id = $2', tbl) USING ('REF-' || to_char(clock_timestamp(), 'SSMSUS')), rec.id;
          EXIT;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
