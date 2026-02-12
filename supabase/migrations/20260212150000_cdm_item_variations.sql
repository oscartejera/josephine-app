-- cdm_item_variations: bridge table for Square catalog variations
-- Each cdm_item (parent) can have N variations. Square line_items reference
-- variations via catalog_object_id, so this table enables the FK link
-- from cdm_order_lines → cdm_items through the variation external ID.

-- 1) Create cdm_item_variations
CREATE TABLE IF NOT EXISTS cdm_item_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  cdm_item_id UUID NOT NULL REFERENCES cdm_items(id) ON DELETE CASCADE,
  external_provider TEXT NOT NULL DEFAULT 'square',
  external_variation_id TEXT NOT NULL,
  variation_name TEXT NOT NULL DEFAULT '',
  sku TEXT DEFAULT NULL,
  price NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, external_variation_id)
);

CREATE INDEX IF NOT EXISTS idx_cdm_item_variations_item
  ON cdm_item_variations(cdm_item_id);
CREATE INDEX IF NOT EXISTS idx_cdm_item_variations_org_ext
  ON cdm_item_variations(org_id, external_variation_id);

ALTER TABLE cdm_item_variations ENABLE ROW LEVEL SECURITY;

-- 2) Add external_variation_id + org_id to cdm_order_lines for backfill joins
ALTER TABLE cdm_order_lines
  ADD COLUMN IF NOT EXISTS external_variation_id TEXT DEFAULT NULL;

ALTER TABLE cdm_order_lines
  ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_cdm_order_lines_variation
  ON cdm_order_lines(org_id, external_variation_id)
  WHERE external_variation_id IS NOT NULL;

-- 3) RPC for late-binding backfill: link cdm_order_lines.item_id via variations
CREATE OR REPLACE FUNCTION backfill_order_lines_item_id(p_org_id UUID)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  rows_updated INT;
BEGIN
  UPDATE cdm_order_lines ol
  SET item_id = v.cdm_item_id
  FROM cdm_item_variations v
  WHERE ol.org_id = v.org_id
    AND ol.external_variation_id = v.external_variation_id
    AND ol.org_id = p_org_id
    AND ol.item_id IS NULL
    AND ol.external_variation_id IS NOT NULL;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;
