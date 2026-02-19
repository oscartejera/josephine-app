-- ============================================================
-- PR5: Product Sales Materialized View
-- Replaces the regular VIEW with a MATERIALIZED VIEW for
-- better query performance on large order datasets.
-- Source: cdm_orders + cdm_order_lines + cdm_items + menu_items
-- ============================================================

-- Drop the existing regular view first
DROP VIEW IF EXISTS product_sales_daily_unified;

-- Create the materialized view
CREATE MATERIALIZED VIEW product_sales_daily_unified AS
SELECT
  o.org_id,
  o.location_id,
  (o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date AS day,
  COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid)    AS product_id,
  COALESCE(mi.name, ci.name, 'Unknown')::text                          AS product_name,
  COALESCE(mi.category, 'Other')::text                                 AS product_category,
  COALESCE(SUM(ol.qty), 0)::integer                                    AS units_sold,
  COALESCE(SUM(ol.gross), 0)::numeric                                  AS net_sales,
  0::numeric                                                           AS cogs,
  COALESCE(SUM(ol.gross), 0)::numeric                                  AS gross_profit,
  100::numeric                                                         AS margin_pct,
  'simulated'::text                                                    AS data_source
FROM cdm_orders o
JOIN locations l ON l.id = o.location_id
LEFT JOIN cdm_order_lines ol ON ol.order_id = o.id
LEFT JOIN cdm_items ci ON ci.id = ol.item_id
LEFT JOIN menu_items mi ON mi.id = ol.item_id
WHERE o.closed_at IS NOT NULL
GROUP BY o.org_id, o.location_id,
  (o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date,
  COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(mi.name, ci.name, 'Unknown'),
  COALESCE(mi.category, 'Other');

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_sales_mv_unique
  ON product_sales_daily_unified (org_id, location_id, day, product_id);

-- Additional index for common query patterns
CREATE INDEX IF NOT EXISTS idx_product_sales_mv_loc_day
  ON product_sales_daily_unified (location_id, day);

-- Grant access
GRANT SELECT ON product_sales_daily_unified TO anon, authenticated;

-- Initial refresh (populate the MV)
REFRESH MATERIALIZED VIEW product_sales_daily_unified;
