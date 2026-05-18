CREATE TABLE inventory_kits (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'custom',
  purpose        TEXT,
  location_label TEXT,
  weight_limit_g INTEGER,
  budget_cents   INTEGER,
  notes          TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_items (
  id               SERIAL PRIMARY KEY,
  kit_id           INTEGER NOT NULL REFERENCES inventory_kits(id) ON DELETE CASCADE,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id      TEXT,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT 'Other',
  qty              NUMERIC(10,2) NOT NULL DEFAULT 0,
  par              NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit             TEXT NOT NULL DEFAULT 'units',
  weight_g         INTEGER,
  cost_cents       INTEGER,
  expiry           DATE,
  note             TEXT,
  storage_location TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_kits_user ON inventory_kits(user_id);
CREATE INDEX idx_inv_kits_type ON inventory_kits(type);
CREATE INDEX idx_inv_items_kit  ON inventory_items(kit_id);
CREATE INDEX idx_inv_items_user ON inventory_items(user_id);
