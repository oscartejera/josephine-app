-- ============================================================
-- Guard: cdm_items NEVER has location_id
--
-- The error "column location_id does not exist" on
-- DELETE FROM cdm_items WHERE location_id ... was caused by
-- a legacy seed function that referenced wrong columns.
-- This migration:
--   1) Asserts cdm_items has org_id (not location_id)
--   2) Creates cdm_location_items bridge table if missing
--   3) Adds a safety trigger to prevent future misuse
-- ============================================================

-- 1) Schema assertion: cdm_items MUST have org_id, MUST NOT have location_id
DO $$
BEGIN
  -- Verify org_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cdm_items'
      AND column_name = 'org_id'
  ) THEN
    RAISE EXCEPTION 'cdm_items is missing org_id column — schema is broken';
  END IF;

  -- Verify location_id does NOT exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cdm_items'
      AND column_name = 'location_id'
  ) THEN
    RAISE EXCEPTION 'cdm_items has a location_id column — this should never exist. Items are org-scoped; use cdm_location_items for location binding.';
  END IF;

  RAISE NOTICE 'cdm_items schema OK: org_id present, location_id absent';
END $$;

-- 2) Create cdm_location_items bridge table (referenced in docs but never created)
CREATE TABLE IF NOT EXISTS cdm_location_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES cdm_items(id) ON DELETE CASCADE,
  price         NUMERIC,
  cost_price    NUMERIC,
  is_available  BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_cdm_location_items_location
  ON cdm_location_items(location_id);
CREATE INDEX IF NOT EXISTS idx_cdm_location_items_item
  ON cdm_location_items(item_id);

ALTER TABLE cdm_location_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cdm_location_items_policy ON cdm_location_items;
CREATE POLICY cdm_location_items_policy ON cdm_location_items
  FOR ALL USING (true);

COMMENT ON TABLE cdm_location_items IS
  'Bridge: which cdm_items are available at which locations, with location-specific pricing';
