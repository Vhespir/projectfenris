-- Who each cache is sized for is now per-kit, not one setting shared across
-- every kit. A GHB is usually sized for one person getting home; a Home
-- Cache is usually sized for the whole household. Defaults match what the
-- frontend already used as its fallback.

ALTER TABLE inventory_kits
  ADD COLUMN household_people INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN household_pets   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN household_days   INTEGER NOT NULL DEFAULT 14;
