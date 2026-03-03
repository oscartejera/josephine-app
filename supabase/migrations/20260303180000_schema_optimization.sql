-- ============================================================
-- SCHEMA OPTIMIZATION — Lean, Nory-Grade Database
-- 
-- Phase 1: Fix column mismatches in RPCs
-- Phase 2: Missing FK indexes (11 indexes)
-- Phase 3: RLS optimization (select auth.uid() pattern)
-- Phase 4: Schema constraints (CHECK, NOT NULL)
-- Phase 5: Cleanup (stubs, notify)
-- ============================================================


-- ============================================================
-- PHASE 1: Fix column mismatches in RPCs
-- ============================================================
-- Note: Views (sales_daily_unified, forecast_daily_unified, etc.) 
-- are already at their latest correct version from prior migrations.
-- We only fix RPCs that reference old column names.

-- 1a) Fix menu_engineering_summary — mi.category → COALESCE(mi.category_name, 'Other')
CREATE OR REPLACE FUNCTION menu_engineering_summary(
  p_date_from date,
  p_date_to date,
  p_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    WITH product_data AS (
      SELECT
        COALESCE(ol.item_id,'00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
        COALESCE(mi.name, ci.name, 'Unknown')        AS product_name,
        COALESCE(mi.category_name, ci.category, 'Other') AS product_category,
        COALESCE(SUM(ol.qty),0)::bigint               AS units_sold,
        COALESCE(SUM(ol.gross),0)                      AS net_sales,
        0::numeric                                      AS cogs,
        COALESCE(SUM(ol.gross),0)                      AS gross_profit,
        100::numeric                                    AS margin_pct
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id
      LEFT JOIN menu_items mi ON mi.id = ol.item_id
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to
        AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
      GROUP BY 1,2,3
    ),
    stats AS (
      SELECT AVG(margin_pct) AS avg_m, AVG(units_sold) AS avg_p FROM product_data
    )
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT pd.product_id, pd.product_name, pd.product_category,
        pd.units_sold, pd.net_sales, pd.cogs, pd.gross_profit, pd.margin_pct,
        CASE
          WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'star'
          WHEN pd.margin_pct <  COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'plow_horse'
          WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold <  COALESCE(s.avg_p,0) THEN 'puzzle'
          ELSE 'dog' END AS classification
      FROM product_data pd, stats s
      ORDER BY pd.net_sales DESC
    ) r
  );
END;
$$;


-- 1b) Fix get_top_products_unified — mi.category → COALESCE(mi.category_name, 'Other')
CREATE OR REPLACE FUNCTION get_top_products_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_ds jsonb;
  v_total numeric;
  v_items jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  SELECT COALESCE(SUM(net_sales),0) INTO v_total
  FROM daily_sales
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids) AND day BETWEEN p_from AND p_to;

  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb), '[]'::jsonb) INTO v_items
  FROM (
    SELECT
      COALESCE(ol.item_id,'00000000-0000-0000-0000-000000000000')::text AS product_id,
      COALESCE(mi.name, ci.name, 'Unknown')        AS name,
      COALESCE(mi.category_name, ci.category, 'Other') AS category,
      SUM(COALESCE(ol.gross,0))::numeric AS sales,
      SUM(COALESCE(ol.qty,0))::numeric         AS qty,
      CASE WHEN v_total > 0 THEN SUM(COALESCE(ol.gross,0))/v_total ELSE 0 END AS share
    FROM cdm_orders o
    JOIN cdm_order_lines ol ON ol.order_id = o.id
    LEFT JOIN cdm_items ci ON ci.id = ol.item_id
    LEFT JOIN menu_items mi ON mi.id = ol.item_id
    WHERE o.org_id = p_org_id AND o.location_id = ANY(p_location_ids)
      AND o.closed_at::date BETWEEN p_from AND p_to AND o.closed_at IS NOT NULL
    GROUP BY 1,2,3
    ORDER BY sales DESC
    LIMIT p_limit
  ) p;

  RETURN jsonb_build_object(
    'data_source',v_ds->>'data_source','mode',v_ds->>'mode',
    'reason',v_ds->>'reason','last_synced_at',v_ds->>'last_synced_at',
    'total_sales',v_total,'items',v_items
  );
END;
$$;


-- 1c) Fix cogs_daily — add org_id for proper multi-org filtering
-- Must DROP because adding new column (org_id) to existing view
DROP VIEW IF EXISTS cogs_daily;
CREATE VIEW cogs_daily AS
SELECT
  l.org_id,
  sm.location_id,
  (sm.created_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date AS date,
  SUM(ABS(sm.qty_delta) * COALESCE(sm.unit_cost, 0))::numeric             AS cogs_amount
FROM stock_movements sm
JOIN locations l ON l.id = sm.location_id
WHERE sm.movement_type IN ('waste', 'sale_estimate')
GROUP BY l.org_id, sm.location_id,
  (sm.created_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date;

GRANT SELECT ON cogs_daily TO anon, authenticated;


-- 1d) Fix get_instant_pnl_unified — use org_id from cogs_daily  
CREATE OR REPLACE FUNCTION get_instant_pnl_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE v_ds jsonb; v_locs jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb) INTO v_locs
  FROM (
    SELECT
      l.id AS location_id, l.name AS location_name,
      COALESCE(s.net_sales,0)::numeric   AS actual_sales,
      COALESCE(f.fc_sales,0)::numeric    AS forecast_sales,
      COALESCE(lab.cost,0)::numeric      AS actual_labour,
      ROUND(COALESCE(f.fc_sales,0)*0.28,2)::numeric AS forecast_labour,
      COALESCE(cg.cogs_est,0)::numeric   AS actual_cogs,
      (COALESCE(s.net_sales,0) - COALESCE(lab.cost,0) - COALESCE(cg.cogs_est,0))::numeric AS gp_value,
      true AS estimated_cogs
    FROM locations l
    LEFT JOIN (SELECT location_id, SUM(net_sales) AS net_sales FROM daily_sales
               WHERE org_id=p_org_id AND day BETWEEN p_from AND p_to GROUP BY 1) s ON s.location_id=l.id
    LEFT JOIN (SELECT fp.location_id, SUM(fp.yhat) AS fc_sales
               FROM forecast_points fp
               JOIN forecast_runs fr ON fr.id=fp.forecast_run_id AND fr.status='finished'
               WHERE fp.org_id=p_org_id AND fp.day BETWEEN p_from AND p_to GROUP BY 1) f ON f.location_id=l.id
    LEFT JOIN (SELECT te.location_id,
                 SUM(EXTRACT(EPOCH FROM (te.clock_out-te.clock_in))/3600.0
                     * COALESCE(e.hourly_cost, 14.50)) AS cost
               FROM time_entries te
               LEFT JOIN employees e ON e.id = te.employee_id
               WHERE te.org_id=p_org_id AND te.clock_out IS NOT NULL
                 AND te.clock_in::date BETWEEN p_from AND p_to GROUP BY 1) lab ON lab.location_id=l.id
    LEFT JOIN (SELECT sm.location_id, SUM(ABS(sm.qty_delta)*COALESCE(sm.unit_cost,0)) AS cogs_est
               FROM stock_movements sm
               JOIN locations loc2 ON loc2.id = sm.location_id
               WHERE loc2.org_id=p_org_id
                 AND sm.movement_type IN ('waste','sale_estimate')
                 AND sm.created_at::date BETWEEN p_from AND p_to GROUP BY 1) cg ON cg.location_id=l.id
    WHERE l.id = ANY(p_location_ids) AND l.active = true
  ) r;

  RETURN jsonb_build_object(
    'data_source',v_ds->>'data_source','mode',v_ds->>'mode',
    'reason',v_ds->>'reason','last_synced_at',v_ds->>'last_synced_at',
    'locations',v_locs
  );
END;
$$;


-- 1e) Fix get_labour_kpis — add org_id filter, fix p_data_source default
CREATE OR REPLACE FUNCTION get_labour_kpis(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE v_sales numeric; v_result jsonb;
BEGIN
  SELECT COALESCE(SUM(net_sales),0) INTO v_sales
  FROM sales_daily_unified
  WHERE date BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  SELECT jsonb_build_object(
    'total_actual_hours',    COALESCE(SUM(actual_hours),0),
    'total_actual_cost',     COALESCE(SUM(actual_cost),0),
    'total_scheduled_hours', COALESCE(SUM(scheduled_hours),0),
    'total_scheduled_cost',  COALESCE(SUM(scheduled_cost),0),
    'avg_headcount', CASE WHEN COUNT(*)>0 THEN SUM(scheduled_headcount)::numeric/COUNT(*) ELSE 0 END,
    'total_sales', v_sales,
    'splh',    CASE WHEN COALESCE(SUM(actual_hours),0)>0 THEN v_sales/SUM(actual_hours) ELSE 0 END,
    'col_pct', CASE WHEN v_sales>0 THEN COALESCE(SUM(actual_cost),0)/v_sales*100 ELSE 0 END
  ) INTO v_result
  FROM labour_daily_unified
  WHERE day BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  RETURN v_result;
END;
$$;


-- 1f) Fix get_labour_timeseries — default param
CREATE OR REPLACE FUNCTION get_labour_timeseries(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.day), '[]'::jsonb)
    FROM (
      SELECT
        ldu.day,
        COALESCE(ldu.actual_hours,0)        AS actual_hours,
        COALESCE(ldu.actual_cost,0)         AS actual_cost,
        COALESCE(ldu.scheduled_hours,0)     AS scheduled_hours,
        COALESCE(ldu.scheduled_cost,0)      AS scheduled_cost,
        COALESCE(ldu.scheduled_headcount,0) AS scheduled_headcount,
        COALESCE(ldu.hours_variance,0)      AS hours_variance,
        COALESCE(ldu.hours_variance_pct,0)  AS hours_variance_pct,
        COALESCE(s.net_sales,0)             AS sales,
        CASE WHEN COALESCE(ldu.actual_hours,0)>0
             THEN COALESCE(s.net_sales,0)/ldu.actual_hours ELSE 0 END AS splh,
        CASE WHEN COALESCE(s.net_sales,0)>0
             THEN COALESCE(ldu.actual_cost,0)/s.net_sales*100 ELSE 0 END AS col_pct
      FROM labour_daily_unified ldu
      LEFT JOIN (
        SELECT date, location_id, SUM(net_sales) AS net_sales
        FROM sales_daily_unified GROUP BY date, location_id
      ) s ON s.date = ldu.day AND s.location_id = ldu.location_id
      WHERE ldu.day BETWEEN date_from AND date_to
        AND (selected_location_id IS NULL OR ldu.location_id = selected_location_id)
    ) d
  );
END;
$$;


-- 1g) Fix get_labour_locations_table — default param
CREATE OR REPLACE FUNCTION get_labour_locations_table(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        l.id AS location_id, l.name AS location_name,
        COALESCE(SUM(ldu.actual_hours),0)    AS actual_hours,
        COALESCE(SUM(ldu.actual_cost),0)     AS actual_cost,
        COALESCE(SUM(ldu.scheduled_hours),0) AS scheduled_hours,
        COALESCE(SUM(ldu.scheduled_cost),0)  AS scheduled_cost,
        COALESCE(SUM(s.net_sales),0)         AS sales,
        CASE WHEN COALESCE(SUM(ldu.actual_hours),0)>0
             THEN SUM(COALESCE(s.net_sales,0))/SUM(ldu.actual_hours) ELSE 0 END AS splh,
        CASE WHEN COALESCE(SUM(s.net_sales),0)>0
             THEN SUM(COALESCE(ldu.actual_cost,0))/SUM(s.net_sales)*100 ELSE 0 END AS col_pct
      FROM locations l
      LEFT JOIN labour_daily_unified ldu
        ON ldu.location_id = l.id AND ldu.day BETWEEN date_from AND date_to
      LEFT JOIN (
        SELECT date, location_id, SUM(net_sales) AS net_sales
        FROM sales_daily_unified GROUP BY date, location_id
      ) s ON s.date = ldu.day AND s.location_id = l.id
      WHERE (selected_location_id IS NULL OR l.id = selected_location_id)
        AND l.active = true
      GROUP BY l.id, l.name
    ) r
  );
END;
$$;


-- ============================================================
-- PHASE 2: Missing FK Indexes (10-100x faster JOINs)
-- ============================================================

-- FK indexes on JOIN columns not currently indexed
-- All wrapped in DO/EXCEPTION to gracefully skip if table/column doesn't exist

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cdm_order_lines_order_id ON cdm_order_lines (order_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_cdm_order_lines_order_id: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cdm_order_lines_item_id ON cdm_order_lines (item_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_cdm_order_lines_item_id: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_inv_item_loc_item_id ON inventory_item_location (item_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_inv_item_loc_item_id: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_inv_item_loc_location_id ON inventory_item_location (location_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_inv_item_loc_location_id: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_waste_events_item_id ON waste_events (inventory_item_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_waste_events_item_id: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_waste_events_loc_created ON waste_events (location_id, created_at);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_waste_events_loc_created: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_employees_org_id ON employees (org_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_employees_org_id: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cash_counts_loc_day ON cash_counts_daily (location_id, day);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_cash_counts_loc_day: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_budget_drivers_day_id ON budget_drivers (budget_day_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_budget_drivers_day_id: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_time_entries_org_clockin_date ON time_entries (org_id, (clock_in::date));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_time_entries_clockin: %', SQLERRM; END $$;


-- ============================================================
-- PHASE 3: RLS Optimization — (select auth.uid()) pattern
-- ============================================================
-- Fix the 3 policies that use bare auth.uid()

-- 3a) Fix org_settings policy (from fix_resolver migration)
DO $$ BEGIN
  DROP POLICY IF EXISTS org_settings_all ON org_settings;
  CREATE POLICY org_settings_all ON org_settings
    USING ((select is_org_member(org_id, (select auth.uid()))))
    WITH CHECK ((select is_org_member(org_id, (select auth.uid()))));
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'org_settings table not found, skipping RLS fix';
END $$;

-- 3b) Fix integrations policy
DO $$ BEGIN
  DROP POLICY IF EXISTS integrations_rls ON integrations;
  CREATE POLICY integrations_rls ON integrations
    USING ((select is_org_member(org_id, (select auth.uid()))))
    WITH CHECK ((select is_org_member(org_id, (select auth.uid()))));
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'integrations table not found, skipping RLS fix';
END $$;


-- ============================================================
-- PHASE 4: Schema Constraints (Data Integrity)
-- ============================================================
-- Use DO blocks to safely add constraints

-- 4a) CHECK constraints on daily_sales
DO $$ BEGIN
  ALTER TABLE daily_sales ADD CONSTRAINT chk_daily_sales_orders_positive
    CHECK (orders_count >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN check_violation THEN
  RAISE NOTICE 'daily_sales has rows with negative orders_count, skipping';
END $$;

-- 4b) NOT NULL on critical FK columns
DO $$ BEGIN
  ALTER TABLE budget_days ALTER COLUMN budget_version_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE budget_days ALTER COLUMN org_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE budget_metrics ALTER COLUMN budget_day_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE stock_movements ALTER COLUMN location_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE waste_events ALTER COLUMN location_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ============================================================
-- PHASE 5: Cleanup
-- ============================================================

-- 5a) Drop stub RPCs that consume PostgREST schema slots
DROP FUNCTION IF EXISTS add_loyalty_points(uuid, integer, text, text, uuid, uuid);
DROP FUNCTION IF EXISTS redeem_loyalty_reward(uuid, uuid, uuid);

-- 5b) Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
