-- =============================================================================
-- FIX: Missing views, tables, and RPCs for Josephine v2
-- Fixes identified errors across Control Tower, Ventas, Personal, Caja,
-- Presupuestos, Inventario, Mermas, and Menu Engineering pages.
-- Created: 2026-04-05
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. RECREATE UNIFIED VIEWS (ensure they include ALL columns)
-- Drop first because column sets differ from previous migration
-- ═══════════════════════════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS product_sales_daily_unified_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS product_sales_daily_unified_mv_v2 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sales_hourly_unified_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sales_hourly_unified_mv_v2 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mart_kpi_daily_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mart_sales_category_daily_mv CASCADE;

DROP VIEW IF EXISTS low_stock_unified CASCADE;
DROP VIEW IF EXISTS sales_daily_unified CASCADE;
DROP VIEW IF EXISTS sales_hourly_unified CASCADE;
DROP VIEW IF EXISTS product_sales_daily_unified CASCADE;
DROP VIEW IF EXISTS v_forecast_accuracy CASCADE;

-- sales_daily_unified: ensure gross_sales and all payment columns
CREATE OR REPLACE VIEW sales_daily_unified AS
SELECT
  ds.org_id,
  ds.location_id,
  ds.day AS date,
  ds.net_sales,
  COALESCE(ds.gross_sales, ds.net_sales) AS gross_sales,
  ds.orders_count,
  COALESCE(ds.covers, ds.orders_count) AS covers,
  CASE WHEN ds.orders_count > 0 THEN ROUND(ds.net_sales / ds.orders_count, 2) ELSE 0 END AS avg_check,
  COALESCE(ds.payments_total, ds.net_sales) AS payments_total,
  COALESCE(ds.payments_cash, 0) AS payments_cash,
  COALESCE(ds.payments_card, 0) AS payments_card,
  COALESCE(ds.payments_other, 0) AS payments_other,
  COALESCE(ds.refunds, 0) AS refunds,
  COALESCE(ds.refunds, 0) AS refunds_amount,
  0 AS refunds_count,
  COALESCE(ds.discounts, 0) AS discounts,
  COALESCE(ds.discounts, 0) AS discounts_amount,
  COALESCE(ds.comps, 0) AS comps,
  COALESCE(ds.comps, 0) AS comps_amount,
  COALESCE(ds.voids, 0) AS voids,
  COALESCE(ds.voids, 0) AS voids_amount,
  0::numeric AS labor_cost,
  0::numeric AS labor_hours,
  COALESCE(ds.data_source, 'demo') AS data_source
FROM daily_sales ds;

-- labour_daily_unified: ensure org_id is exposed
DROP VIEW IF EXISTS labour_daily_unified CASCADE;
CREATE OR REPLACE VIEW labour_daily_unified AS
SELECT
  l.location_id,
  loc.org_id,
  l.date,
  l.labour_cost,
  l.labour_hours,
  CASE WHEN l.labour_hours > 0 THEN ROUND(l.labour_cost / l.labour_hours, 2) ELSE 0 END AS avg_hourly_rate
FROM labour_daily l
JOIN locations loc ON loc.id = l.location_id;

-- sales_hourly_unified: add missing columns
CREATE OR REPLACE VIEW sales_hourly_unified AS
SELECT
  s.org_id, s.location_id,
  s.day,
  s.day AS date,
  s.hour_of_day,
  (s.day || ' ' || lpad(s.hour_of_day::text, 2, '0') || ':00:00')::timestamptz AS hour_bucket,
  s.net_sales,
  COALESCE(s.net_sales, 0) AS gross_sales,
  s.orders_count,
  COALESCE(s.covers, s.orders_count) AS covers,
  CASE WHEN s.orders_count > 0 THEN ROUND(s.net_sales / s.orders_count, 2) ELSE 0 END AS avg_check,
  0::numeric AS discounts,
  0::numeric AS refunds,
  COALESCE(s.data_source, 'demo') AS data_source
FROM sales_hourly_raw s;

-- product_sales_daily_unified: ensure product_name column
CREATE OR REPLACE VIEW product_sales_daily_unified AS
SELECT
  o.org_id,
  o.location_id,
  o.closed_at::date AS day,
  COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
  COALESCE(mi.name, ci.name, ol.name, 'Unknown') AS product_name,
  COALESCE(mi.name, ci.name, ol.name, 'Unknown') AS name,
  COALESCE(mi.category, ci.category, 'Other') AS category,
  SUM(ol.qty) AS qty,
  SUM(ol.gross) AS gross,
  SUM(ol.net) AS net,
  'demo' AS data_source
FROM cdm_orders o
JOIN cdm_order_lines ol ON ol.order_id = o.id
LEFT JOIN menu_items mi ON mi.id = ol.item_id
LEFT JOIN cdm_items ci ON ci.id = ol.item_id
WHERE o.closed_at IS NOT NULL
GROUP BY o.org_id, o.location_id, o.closed_at::date,
         COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid),
         COALESCE(mi.name, ci.name, ol.name, 'Unknown'),
         COALESCE(mi.category, ci.category, 'Other');

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. CREATE v_forecast_accuracy VIEW
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_forecast_accuracy AS
SELECT
  f.id,
  f.location_id,
  loc.org_id,
  f.date,
  f.forecast_sales,
  f.actual_sales,
  f.mape,
  f.accuracy_pct,
  f.model_version,
  f.created_at
FROM forecast_accuracy_daily f
JOIN locations loc ON loc.id = f.location_id;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CREATE inventory_lot_tracking TABLE (if not exists)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS inventory_lot_tracking (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id uuid REFERENCES inventory_items(id),
  location_id uuid REFERENCES locations(id),
  lot_number text,
  received_date date,
  expiry_date date,
  qty_received numeric DEFAULT 0,
  qty_remaining numeric DEFAULT 0,
  unit_cost numeric DEFAULT 0,
  supplier_id uuid,
  status text DEFAULT 'active' CHECK (status IN ('active','expired','consumed','disposed')),
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE inventory_lot_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "lot_tracking_org_access" ON inventory_lot_tracking
  FOR ALL USING (
    location_id IN (SELECT id FROM locations WHERE org_id IN (
      SELECT group_id FROM profiles WHERE id = auth.uid()
    ))
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. CREATE MISSING RPCs
-- ═══════════════════════════════════════════════════════════════════════════

-- get_dead_stock: returns inventory items with no movement in X days
CREATE OR REPLACE FUNCTION get_dead_stock(
  p_org_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_days_threshold int DEFAULT 30
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result jsonb;
  v_cutoff date := CURRENT_DATE - p_days_threshold;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'item_id', ii.id,
    'item_name', ii.name,
    'category', COALESCE(ii.category_name, ii.category, 'Other'),
    'unit', ii.unit,
    'on_hand', COALESCE(il.on_hand, 0),
    'unit_cost', COALESCE(ii.last_cost, 0),
    'total_value', ROUND(COALESCE(il.on_hand, 0) * COALESCE(ii.last_cost, 0), 2),
    'last_movement_date', last_mv.last_date,
    'days_since_movement', CASE WHEN last_mv.last_date IS NOT NULL
      THEN (CURRENT_DATE - last_mv.last_date)::int
      ELSE 999
    END
  ) ORDER BY COALESCE(il.on_hand, 0) * COALESCE(ii.last_cost, 0) DESC), '[]'::jsonb)
  INTO v_result
  FROM inventory_items ii
  LEFT JOIN inventory_item_location il ON il.item_id = ii.id
    AND (p_location_id IS NULL OR il.location_id = p_location_id)
  LEFT JOIN LATERAL (
    SELECT MAX(sm.created_at::date) AS last_date
    FROM stock_movements sm
    WHERE sm.inventory_item_id = ii.id
      AND (p_location_id IS NULL OR sm.location_id = p_location_id)
  ) last_mv ON TRUE
  WHERE ii.org_id = p_org_id
    AND ii.is_active = true
    AND COALESCE(il.on_hand, 0) > 0
    AND (last_mv.last_date IS NULL OR last_mv.last_date < v_cutoff);

  RETURN jsonb_build_object(
    'threshold_days', p_days_threshold,
    'items', v_result,
    'total_items', jsonb_array_length(v_result),
    'total_value', (SELECT COALESCE(SUM((item->>'total_value')::numeric), 0) FROM jsonb_array_elements(v_result) item)
  );
END;$$;

-- get_menu_engineering_timeline: returns ME snapshots over time
CREATE OR REPLACE FUNCTION get_menu_engineering_timeline(
  p_org_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_months int DEFAULT 3
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'snapshot_date', ms.snapshot_date,
    'location_id', ms.location_id,
    'total_items', ms.total_items,
    'stars', ms.stars_count,
    'plowhorses', ms.plowhorses_count,
    'puzzles', ms.puzzles_count,
    'dogs', ms.dogs_count,
    'avg_margin', ms.avg_margin,
    'avg_popularity', ms.avg_popularity
  ) ORDER BY ms.snapshot_date DESC), '[]'::jsonb)
  INTO v_result
  FROM menu_engineering_snapshots ms
  JOIN locations loc ON loc.id = ms.location_id
  WHERE loc.org_id = p_org_id
    AND (p_location_id IS NULL OR ms.location_id = p_location_id)
    AND ms.snapshot_date >= CURRENT_DATE - (p_months * 30);

  RETURN v_result;
END;$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. GRANTS
-- ═══════════════════════════════════════════════════════════════════════════

GRANT SELECT ON sales_daily_unified TO anon, authenticated;
GRANT SELECT ON labour_daily_unified TO anon, authenticated;
GRANT SELECT ON sales_hourly_unified TO anon, authenticated;
GRANT SELECT ON product_sales_daily_unified TO anon, authenticated;
GRANT SELECT ON v_forecast_accuracy TO anon, authenticated;
GRANT ALL ON inventory_lot_tracking TO anon, authenticated;

GRANT EXECUTE ON FUNCTION get_dead_stock(uuid, uuid, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_menu_engineering_timeline(uuid, uuid, int) TO anon, authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RECREATE MATERIALIZED VIEWS (dropped at top of this migration)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS product_sales_daily_unified_mv AS
SELECT * FROM product_sales_daily_unified;

CREATE MATERIALIZED VIEW IF NOT EXISTS sales_hourly_unified_mv AS
SELECT * FROM sales_hourly_unified;

CREATE MATERIALIZED VIEW IF NOT EXISTS product_sales_daily_unified_mv_v2 AS
SELECT * FROM product_sales_daily_unified;

CREATE MATERIALIZED VIEW IF NOT EXISTS sales_hourly_unified_mv_v2 AS
SELECT * FROM sales_hourly_unified;
