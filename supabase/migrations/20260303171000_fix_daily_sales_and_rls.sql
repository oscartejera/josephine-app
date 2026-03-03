-- ============================================================
-- Fix: Populate daily_sales for current dates + fix RLS grants
-- 
-- Root cause: Cash Mgmt, Budgets, and Inventory pages show €0 
-- because daily_sales has no rows for current month. Also fixes
-- 500 errors on stock_movements/waste_events from missing grants.
-- ============================================================


-- ─── 1. ENSURE daily_sales TABLE has correct columns ─────────

-- daily_sales predates tracked migrations. Ensure it has the
-- columns we need for cash/card split.
DO $$ BEGIN
  ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS payments_cash numeric DEFAULT 0;
  ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS payments_card numeric DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ─── 2. INSERT daily_sales for current 30-day window ─────────
-- The Sales RPCs read from daily_sales (the actual table).
-- Cash Management + Budgets read from sales_daily_unified which unions daily_sales.
-- If no rows → €0.

INSERT INTO daily_sales (org_id, location_id, day, net_sales, gross_sales, orders_count, payments_total, payments_cash, payments_card, refunds, discounts, comps, voids)
SELECT
  l.org_id,
  l.id,
  d::date,
  -- Net sales: €2,200-3,800 depending on day of week
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)
    WHEN EXTRACT(DOW FROM d) = 0 THEN 2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)
    ELSE 2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)
  END::numeric,
  -- Gross sales: net + 5%
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN ROUND((3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 1.05, 2)
    WHEN EXTRACT(DOW FROM d) = 0 THEN ROUND((2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 1.05, 2)
    ELSE ROUND((2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 1.05, 2)
  END::numeric,
  -- Orders: covers / 2.5 avg party size
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 56 + (EXTRACT(DOY FROM d)::int % 10)
    WHEN EXTRACT(DOW FROM d) = 0 THEN 44 + (EXTRACT(DOY FROM d)::int % 8)
    ELSE 36 + (EXTRACT(DOW FROM d)::int * 2)
  END::integer,
  -- Payments total = net_sales
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)
    WHEN EXTRACT(DOW FROM d) = 0 THEN 2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)
    ELSE 2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)
  END::numeric,
  -- payments_cash: 25% of total
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.25
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.25
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.25
  END, 2)::numeric,
  -- payments_card: 75% of total
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.75
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.75
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.75
  END, 2)::numeric,
  -- Refunds: 0.5% of net
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.005
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.005
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.005
  END, 2)::numeric,
  -- Discounts: 3%
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.03
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.03
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.03
  END, 2)::numeric,
  -- Comps: 1%
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.01
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.01
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.01
  END, 2)::numeric,
  -- Voids: 0.2%
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.002
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.002
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.002
  END, 2)::numeric
FROM locations l
CROSS JOIN generate_series(CURRENT_DATE - 30, CURRENT_DATE + 7, '1 day'::interval) AS d
WHERE l.active = true
ON CONFLICT DO NOTHING;


-- ─── 3. FIX RLS: Explicit grants for all seed tables ────────
-- The dynamic DO block in the previous migration may have failed
-- silently for some tables. Apply explicit grants/policies.

-- stock_movements
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_movements_read ON stock_movements;
CREATE POLICY stock_movements_read ON stock_movements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS stock_movements_write ON stock_movements;
CREATE POLICY stock_movements_write ON stock_movements FOR INSERT TO authenticated WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_movements TO authenticated;

-- waste_events
ALTER TABLE waste_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS waste_events_read ON waste_events;
CREATE POLICY waste_events_read ON waste_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS waste_events_write ON waste_events;
CREATE POLICY waste_events_write ON waste_events FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS waste_events_delete ON waste_events;
CREATE POLICY waste_events_delete ON waste_events FOR DELETE TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON waste_events TO authenticated;

-- inventory_items
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_items_read ON inventory_items;
CREATE POLICY inventory_items_read ON inventory_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS inventory_items_write ON inventory_items;
CREATE POLICY inventory_items_write ON inventory_items FOR INSERT TO authenticated WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_items TO authenticated;

-- inventory_item_location
ALTER TABLE inventory_item_location ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_item_location_read ON inventory_item_location;
CREATE POLICY inventory_item_location_read ON inventory_item_location FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS inventory_item_location_write ON inventory_item_location;
CREATE POLICY inventory_item_location_write ON inventory_item_location FOR INSERT TO authenticated WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_item_location TO authenticated;

-- budget tables
ALTER TABLE budget_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budget_versions_read ON budget_versions;
CREATE POLICY budget_versions_read ON budget_versions FOR SELECT TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE ON budget_versions TO authenticated;

ALTER TABLE budget_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budget_days_read ON budget_days;
CREATE POLICY budget_days_read ON budget_days FOR SELECT TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE ON budget_days TO authenticated;

ALTER TABLE budget_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budget_metrics_read ON budget_metrics;
CREATE POLICY budget_metrics_read ON budget_metrics FOR SELECT TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE ON budget_metrics TO authenticated;

ALTER TABLE budget_drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budget_drivers_read ON budget_drivers;
CREATE POLICY budget_drivers_read ON budget_drivers FOR SELECT TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE ON budget_drivers TO authenticated;

-- cash_counts_daily
ALTER TABLE cash_counts_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_counts_daily_read ON cash_counts_daily;
CREATE POLICY cash_counts_daily_read ON cash_counts_daily FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cash_counts_daily_write ON cash_counts_daily;
CREATE POLICY cash_counts_daily_write ON cash_counts_daily FOR INSERT TO authenticated WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON cash_counts_daily TO authenticated;


-- ─── 4. REFRESH mart_kpi_daily_mv ────────────────────────────
-- The materialized view needs to be refreshed after new daily_sales
REFRESH MATERIALIZED VIEW CONCURRENTLY mart_kpi_daily_mv;


-- ─── 5. RELOAD SCHEMA ───────────────────────────────────────
NOTIFY pgrst, 'reload schema';
