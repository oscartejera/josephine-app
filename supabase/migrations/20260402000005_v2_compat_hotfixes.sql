-- =============================================================================
-- JOSEPHINE DB v2 — Compatibility Hotfixes
-- Applied after initial v2 migration to fix frontend-backend mismatches
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. MISSING COLUMNS (frontend expects legacy columns)
-- ═══════════════════════════════════════════════════════════════════════════

-- profiles: frontend reads group_id to identify org
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES groups(id) ON DELETE SET NULL;

-- locations: frontend expects city and active columns
ALTER TABLE locations ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- groups: frontend expects subscription-related columns
ALTER TABLE groups ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active';

-- notifications: frontend expects link and read columns
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    EXECUTE 'ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link text';
    -- Rename is_read → read if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='is_read') THEN
      ALTER TABLE notifications RENAME COLUMN is_read TO read;
    END IF;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. MISSING RLS POLICIES (locations, profiles, groups had RLS enabled
--    but no policies, causing empty results for authenticated users)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'locations', 'profiles', 'groups', 'org_memberships',
    'location_memberships', 'notifications'
  ])
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      -- Drop existing if any, then create fresh
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_sel', t); EXCEPTION WHEN OTHERS THEN NULL; END;
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_ins', t); EXCEPTION WHEN OTHERS THEN NULL; END;
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_upd', t); EXCEPTION WHEN OTHERS THEN NULL; END;
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_del', t); EXCEPTION WHEN OTHERS THEN NULL; END;
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', t||'_sel', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)', t||'_ins', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t||'_upd', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true)', t||'_del', t);
      EXECUTE format('GRANT ALL ON %I TO authenticated', t);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. FIX rpc_kpi_range_summary — Return nested contract structure
--    Frontend expects: { current: {...}, previous: {...}, period: {...}, previousPeriod: {...} }
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop ambiguous text[] overload
DROP FUNCTION IF EXISTS rpc_kpi_range_summary(uuid, text[], date, date);

-- Recreate with correct nested contract
CREATE OR REPLACE FUNCTION rpc_kpi_range_summary(
  p_org_id uuid, p_location_ids uuid[], p_from date, p_to date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_days int;
  v_prev_from date;
  v_prev_to date;
  v_sales numeric; v_orders bigint; v_covers bigint;
  v_labour numeric; v_labour_hours numeric; v_cogs numeric;
  v_prev_sales numeric; v_prev_orders bigint; v_prev_covers bigint;
  v_prev_labour numeric; v_prev_labour_hours numeric; v_prev_cogs numeric;
BEGIN
  v_days := (p_to - p_from + 1);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_days + 1;

  -- Current period sales
  SELECT COALESCE(SUM(net_sales),0), COALESCE(SUM(orders_count),0), COALESCE(SUM(covers),0)
  INTO v_sales, v_orders, v_covers
  FROM daily_sales
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids) AND day BETWEEN p_from AND p_to;

  -- Current period labour
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (COALESCE(te.clock_out, te.clock_in + interval '8 hours') - te.clock_in)) / 3600.0
    * COALESCE(e.hourly_cost, 12)
  ), 0)::numeric,
  COALESCE(SUM(
    EXTRACT(EPOCH FROM (COALESCE(te.clock_out, te.clock_in + interval '8 hours') - te.clock_in)) / 3600.0
  ), 0)::numeric
  INTO v_labour, v_labour_hours
  FROM time_entries te
  LEFT JOIN employees e ON e.id = te.employee_id
  WHERE te.location_id = ANY(p_location_ids) AND te.clock_in::date BETWEEN p_from AND p_to;

  -- Current period COGS
  SELECT COALESCE(SUM(cogs_amount),0) INTO v_cogs
  FROM cogs_daily WHERE location_id = ANY(p_location_ids) AND date BETWEEN p_from AND p_to;

  -- Previous period
  SELECT COALESCE(SUM(net_sales),0), COALESCE(SUM(orders_count),0), COALESCE(SUM(covers),0)
  INTO v_prev_sales, v_prev_orders, v_prev_covers
  FROM daily_sales
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids) AND day BETWEEN v_prev_from AND v_prev_to;

  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (COALESCE(te.clock_out, te.clock_in + interval '8 hours') - te.clock_in)) / 3600.0
    * COALESCE(e.hourly_cost, 12)
  ), 0)::numeric,
  COALESCE(SUM(
    EXTRACT(EPOCH FROM (COALESCE(te.clock_out, te.clock_in + interval '8 hours') - te.clock_in)) / 3600.0
  ), 0)::numeric
  INTO v_prev_labour, v_prev_labour_hours
  FROM time_entries te
  LEFT JOIN employees e ON e.id = te.employee_id
  WHERE te.location_id = ANY(p_location_ids) AND te.clock_in::date BETWEEN v_prev_from AND v_prev_to;

  SELECT COALESCE(SUM(cogs_amount),0) INTO v_prev_cogs
  FROM cogs_daily WHERE location_id = ANY(p_location_ids) AND date BETWEEN v_prev_from AND v_prev_to;

  RETURN jsonb_build_object(
    'current', jsonb_build_object(
      'net_sales', v_sales, 'orders_count', v_orders, 'covers', v_covers,
      'avg_check', CASE WHEN v_orders > 0 THEN ROUND(v_sales / v_orders, 2) ELSE 0 END,
      'labour_cost', v_labour, 'labour_hours', v_labour_hours, 'cogs', v_cogs,
      'col_percent', CASE WHEN v_sales > 0 THEN ROUND(v_labour / v_sales * 100, 1) ELSE NULL END,
      'gp_percent', CASE WHEN v_sales > 0 THEN ROUND((v_sales - v_cogs) / v_sales * 100, 1) ELSE NULL END
    ),
    'previous', jsonb_build_object(
      'net_sales', v_prev_sales, 'orders_count', v_prev_orders, 'covers', v_prev_covers,
      'avg_check', CASE WHEN v_prev_orders > 0 THEN ROUND(v_prev_sales / v_prev_orders, 2) ELSE 0 END,
      'labour_cost', v_prev_labour, 'labour_hours', v_prev_labour_hours, 'cogs', v_prev_cogs,
      'col_percent', CASE WHEN v_prev_sales > 0 THEN ROUND(v_prev_labour / v_prev_sales * 100, 1) ELSE NULL END,
      'gp_percent', CASE WHEN v_prev_sales > 0 THEN ROUND((v_prev_sales - v_prev_cogs) / v_prev_sales * 100, 1) ELSE NULL END
    ),
    'period', jsonb_build_object('from', p_from::text, 'to', p_to::text, 'days', v_days),
    'previousPeriod', jsonb_build_object('from', v_prev_from::text, 'to', v_prev_to::text)
  );
END;$$;

-- Fix get_instant_pnl_unified
CREATE OR REPLACE FUNCTION get_instant_pnl_unified(
  p_org_id uuid, p_location_ids text[], p_from date, p_to date
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT rpc_kpi_range_summary(p_org_id, ARRAY(SELECT unnest(p_location_ids)::uuid), p_from, p_to);
$$;

GRANT EXECUTE ON FUNCTION rpc_kpi_range_summary(uuid, uuid[], date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_instant_pnl_unified(uuid, text[], date, date) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. MISSING STUB RPCs
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_food_cost_variance(
  p_org_id uuid, p_location_ids uuid[] DEFAULT NULL,
  p_from date DEFAULT (CURRENT_DATE - 30), p_to date DEFAULT CURRENT_DATE
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'total_cogs', 0, 'budget_cogs', 0, 'variance', 0, 'variance_pct', 0, 'items', '[]'::jsonb
  );
$$;
GRANT EXECUTE ON FUNCTION get_food_cost_variance(uuid, uuid[], date, date) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. MISSING VIEWS (labour_daily, budgets_daily, planned_shifts)
-- ═══════════════════════════════════════════════════════════════════════════

-- labour_daily: aggregated labour costs from time_entries
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'labour_daily' AND table_schema = 'public') THEN
    CREATE VIEW labour_daily AS
    SELECT te.location_id, te.clock_in::date AS date,
      COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(te.clock_out, te.clock_in + interval '8 hours') - te.clock_in)) / 3600.0
        * COALESCE(e.hourly_cost, 12)), 0)::numeric AS labour_cost,
      COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(te.clock_out, te.clock_in + interval '8 hours') - te.clock_in)) / 3600.0
      ), 0)::numeric AS labour_hours
    FROM time_entries te LEFT JOIN employees e ON e.id = te.employee_id
    GROUP BY te.location_id, te.clock_in::date;
    GRANT SELECT ON labour_daily TO anon, authenticated;
  END IF;
END $$;

-- budgets_daily: maps budget_days to expected column names
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budgets_daily' AND table_schema = 'public') THEN
    CREATE VIEW budgets_daily AS
    SELECT bd.location_id, bd.date,
      COALESCE(bd.revenue, 0) AS budget_sales,
      COALESCE(bd.labour, 0) AS budget_labour,
      COALESCE(bd.cogs, 0) AS budget_cogs
    FROM budget_days bd;
    GRANT SELECT ON budgets_daily TO anon, authenticated;
  END IF;
END $$;

-- planned_shifts: maps shifts to expected column names
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'planned_shifts' AND table_schema = 'public') THEN
    CREATE VIEW planned_shifts AS
    SELECT s.location_id, s.shift_date,
      COALESCE(s.duration_hours, 8) AS planned_hours, s.employee_id
    FROM shifts s;
    GRANT SELECT ON planned_shifts TO anon, authenticated;
  END IF;
END $$;

-- forecast_daily_metrics table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'forecast_daily_metrics' AND table_schema = 'public') THEN
    CREATE TABLE forecast_daily_metrics (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      location_id uuid REFERENCES locations(id),
      date date NOT NULL,
      forecast_sales numeric DEFAULT 0,
      planned_labor_hours numeric DEFAULT 0,
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE forecast_daily_metrics ENABLE ROW LEVEL SECURITY;
    CREATE POLICY forecast_daily_metrics_sel ON forecast_daily_metrics FOR SELECT TO authenticated USING (true);
    GRANT SELECT ON forecast_daily_metrics TO anon, authenticated;
  END IF;
END $$;


-- Reload PostgREST cache
NOTIFY pgrst, 'reload schema';
