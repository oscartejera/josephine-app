-- ============================================================
-- PR4: Inventory Mart Views
-- 1. inventory_position_unified — current stock position per item/location
-- 2. low_stock_unified — active low-stock alerts enriched with item details
-- Idempotent: CREATE OR REPLACE VIEW throughout.
-- ============================================================

-- ------------------------------------------------------------
-- 1. inventory_position_unified
-- Joins inventory_items + inventory_item_location + locations
-- to provide a single view of stock position across locations.
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW inventory_position_unified AS
SELECT
  l.org_id,
  ii.id                                                   AS item_id,
  il.location_id,
  ii.name,
  ii.category_name,
  ii.unit,
  COALESCE(il.on_hand, 0)::numeric                        AS on_hand,
  COALESCE(ii.par_level, 0)::numeric                       AS par_level,
  COALESCE(il.reorder_point, 0)::numeric                   AS reorder_point,
  COALESCE(il.safety_stock, 0)::numeric                    AS safety_stock,
  COALESCE(ii.last_cost, 0)::numeric                       AS last_cost,
  GREATEST(COALESCE(ii.par_level, 0) - COALESCE(il.on_hand, 0), 0)::numeric AS deficit
FROM inventory_items ii
JOIN inventory_item_location il ON il.item_id = ii.id
JOIN locations l ON l.id = il.location_id;

GRANT SELECT ON inventory_position_unified TO anon, authenticated;

-- ------------------------------------------------------------
-- 2. low_stock_unified
-- Enriches low_stock_alerts with item name, on_hand, deficit.
-- Only active (non-closed) alerts.
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW low_stock_unified AS
SELECT
  lsa.id                                                   AS alert_id,
  lsa.item_id,
  lsa.location_id,
  lsa.org_id,
  ii.name                                                  AS item_name,
  ii.unit,
  COALESCE(lsa.on_hand, 0)::numeric                        AS on_hand,
  COALESCE(lsa.reorder_point, 0)::numeric                  AS reorder_point,
  GREATEST(COALESCE(lsa.reorder_point, 0) - COALESCE(lsa.on_hand, 0), 0)::numeric AS deficit,
  lsa.status,
  lsa.created_at
FROM low_stock_alerts lsa
JOIN inventory_items ii ON ii.id = lsa.item_id
WHERE lsa.status != 'closed';

GRANT SELECT ON low_stock_unified TO anon, authenticated;
