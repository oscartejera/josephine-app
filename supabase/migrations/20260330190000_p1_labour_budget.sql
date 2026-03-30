-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: P1 — Labour Real + Auto-Budget
--
-- 1. Fix rpc_kpi_range_summary: use time_entries (real) before planned_shifts
-- 2. Create generate_auto_budget() for new POS clients without budget data
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Fix rpc_kpi_range_summary ────────────────────────────────────────
-- BEFORE: Labour CTE only uses planned_shifts × hourly_cost
-- AFTER:  Prefers time_entries (actual clock-in/out) when available,
--         falls back to planned_shifts if no time entries exist.
--         Also adds labour_source field for transparency.

CREATE OR REPLACE FUNCTION public.rpc_kpi_range_summary(
  p_org_id uuid,
  p_location_ids text[] DEFAULT NULL,
  p_from date DEFAULT CURRENT_DATE - INTERVAL '7 days',
  p_to date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_days int;
  v_current jsonb;
  v_previous jsonb;
  v_loc_filter uuid[];
BEGIN
  v_days := (p_to - p_from) + 1;

  -- Resolve location filter (cast text[] to uuid[])
  IF p_location_ids IS NOT NULL AND array_length(p_location_ids, 1) > 0 THEN
    v_loc_filter := p_location_ids::uuid[];
  ELSE
    SELECT array_agg(id) INTO v_loc_filter
    FROM locations
    WHERE group_id = p_org_id AND active = true;
  END IF;

  -- If no locations, return zeros
  IF v_loc_filter IS NULL OR array_length(v_loc_filter, 1) IS NULL THEN
    v_current := jsonb_build_object(
      'net_sales', 0, 'orders_count', 0, 'covers', 0, 'avg_check', 0,
      'labour_cost', null, 'labour_hours', null, 'cogs', 0,
      'col_percent', null, 'gp_percent', null
    );
    RETURN jsonb_build_object(
      'current', v_current,
      'previous', v_current,
      'period', jsonb_build_object('from', p_from, 'to', p_to, 'days', v_days),
      'previousPeriod', jsonb_build_object('from', p_from, 'to', p_to)
    );
  END IF;

  -- ── ACTUAL (current period) ─────────────────────────────────
  WITH sales AS (
    SELECT
      COALESCE(SUM(net_sales), 0) AS total_sales,
      COALESCE(SUM(orders_count), 0) AS total_orders
    FROM sales_daily_unified
    WHERE location_id::uuid = ANY(v_loc_filter)
      AND date BETWEEN p_from AND p_to
  ),
  -- Labour from time_entries (ACTUAL clock-in/out hours × hourly_cost)
  labour_actual AS (
    SELECT
      COALESCE(SUM(
        EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0
        * COALESCE(e.hourly_cost, 0)
      ), 0) AS total_cost,
      COALESCE(SUM(
        EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0
      ), 0) AS total_hours
    FROM time_entries te
    JOIN employees e ON e.id = te.employee_id
    WHERE te.location_id::uuid = ANY(v_loc_filter)
      AND te.clock_in::date BETWEEN p_from AND p_to
      AND te.clock_out IS NOT NULL
  ),
  -- Labour fallback from planned_shifts (for locations without time tracking)
  labour_planned AS (
    SELECT
      COALESCE(SUM(ps.planned_hours * COALESCE(e.hourly_cost, 0)), 0) AS total_cost,
      COALESCE(SUM(ps.planned_hours), 0) AS total_hours
    FROM planned_shifts ps
    JOIN employees e ON e.id = ps.employee_id
    WHERE ps.location_id::uuid = ANY(v_loc_filter)
      AND ps.shift_date BETWEEN p_from AND p_to
  ),
  -- Use actual if available, fallback to planned
  labour AS (
    SELECT
      CASE WHEN la.total_hours > 0 THEN la.total_cost ELSE lp.total_cost END AS total_cost,
      CASE WHEN la.total_hours > 0 THEN la.total_hours ELSE lp.total_hours END AS total_hours,
      CASE WHEN la.total_hours > 0 THEN 'time_entries' ELSE 'planned_shifts' END AS source
    FROM labour_actual la, labour_planned lp
  ),
  cogs AS (
    SELECT COALESCE(SUM(cogs_amount), 0) AS total_cogs
    FROM cogs_daily
    WHERE location_id::uuid = ANY(v_loc_filter)
      AND date BETWEEN p_from AND p_to
  ),
  -- FIX: Use period_year and period_month (correct column names)
  monthly_cogs AS (
    SELECT COALESCE(SUM(amount), 0) AS total_manual_cogs
    FROM monthly_cost_entries
    WHERE location_id::uuid = ANY(v_loc_filter)
      AND period_year = EXTRACT(YEAR FROM p_from)
      AND period_month = EXTRACT(MONTH FROM p_from)
  )
  SELECT jsonb_build_object(
    'net_sales', s.total_sales,
    'orders_count', s.total_orders,
    'covers', s.total_orders,
    'avg_check', CASE WHEN s.total_orders > 0 THEN ROUND(s.total_sales / s.total_orders, 2) ELSE 0 END,
    'labour_cost', CASE WHEN l.total_cost > 0 THEN l.total_cost ELSE null END,
    'labour_hours', CASE WHEN l.total_hours > 0 THEN l.total_hours ELSE null END,
    'cogs', GREATEST(c.total_cogs, mc.total_manual_cogs),
    'col_percent', CASE WHEN s.total_sales > 0 AND l.total_cost > 0
      THEN ROUND((l.total_cost / s.total_sales) * 100, 1) ELSE null END,
    'gp_percent', CASE WHEN s.total_sales > 0
      THEN ROUND(((s.total_sales - GREATEST(c.total_cogs, mc.total_manual_cogs)) / s.total_sales) * 100, 1)
      ELSE null END,
    'cogs_source_mixed', false,
    'labour_source_mixed', CASE WHEN l.source = 'planned_shifts' THEN true ELSE false END
  )
  INTO v_current
  FROM sales s, labour l, cogs c, monthly_cogs mc;

  -- ── FORECAST (same date range from forecast_daily_metrics) ──
  WITH fc AS (
    SELECT
      COALESCE(SUM(forecast_sales), 0) AS fc_sales,
      COALESCE(SUM(forecast_orders), 0) AS fc_orders,
      COALESCE(SUM(planned_labor_hours), 0) AS fc_hours,
      COALESCE(SUM(planned_labor_cost), 0) AS fc_cost
    FROM forecast_daily_metrics
    WHERE location_id::uuid = ANY(v_loc_filter)
      AND date BETWEEN p_from AND p_to
  ),
  cogs AS (
    SELECT COALESCE(SUM(forecast_sales * 0.28), 0) AS fc_cogs
    FROM forecast_daily_metrics
    WHERE location_id::uuid = ANY(v_loc_filter)
      AND date BETWEEN p_from AND p_to
  )
  SELECT jsonb_build_object(
    'net_sales', fc.fc_sales,
    'orders_count', fc.fc_orders,
    'covers', fc.fc_orders,
    'avg_check', CASE WHEN fc.fc_orders > 0 THEN ROUND(fc.fc_sales / fc.fc_orders, 2) ELSE 0 END,
    'labour_cost', CASE WHEN fc.fc_cost > 0 THEN fc.fc_cost ELSE null END,
    'labour_hours', CASE WHEN fc.fc_hours > 0 THEN fc.fc_hours ELSE null END,
    'cogs', c.fc_cogs,
    'col_percent', CASE WHEN fc.fc_sales > 0 THEN ROUND((fc.fc_cost / fc.fc_sales) * 100, 1) ELSE null END,
    'gp_percent', CASE WHEN fc.fc_sales > 0 THEN ROUND(((fc.fc_sales - c.fc_cogs) / fc.fc_sales) * 100, 1) ELSE null END
  )
  INTO v_previous
  FROM fc, cogs c;

  RETURN jsonb_build_object(
    'current', v_current,
    'previous', v_previous,
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'days', v_days),
    'previousPeriod', jsonb_build_object('from', p_from, 'to', p_to)
  );
END;
$$;

-- ── 2. Auto-Budget Generator ────────────────────────────────────────────
-- Creates a basic budget from forecast data for orgs that have no budget.
-- Called post-sync to ensure Executive Briefing has meaningful comparisons.

CREATE OR REPLACE FUNCTION public.generate_auto_budget(
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_start date;
  v_month_end date;
  v_existing_count int;
  v_version_id uuid;
  v_days_created int := 0;
  v_loc record;
  v_day date;
  v_day_id uuid;
  v_fc_sales numeric;
  v_fc_labour numeric;
BEGIN
  v_month_start := date_trunc('month', CURRENT_DATE)::date;
  v_month_end := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;

  -- Check if any published budget already exists for this org/month
  SELECT COUNT(*) INTO v_existing_count
  FROM budget_versions
  WHERE org_id = p_org_id
    AND status IN ('published', 'frozen')
    AND period_start <= v_month_end
    AND period_end >= v_month_start;

  IF v_existing_count > 0 THEN
    RETURN jsonb_build_object('created', false, 'reason', 'budget_exists');
  END IF;

  -- Check we have forecast data to base the budget on
  IF NOT EXISTS (
    SELECT 1 FROM forecast_daily_metrics
    WHERE org_id = p_org_id
      AND date BETWEEN v_month_start AND v_month_end
      AND forecast_sales > 0
  ) THEN
    RETURN jsonb_build_object('created', false, 'reason', 'no_forecast_data');
  END IF;

  -- Create one budget version per active location
  FOR v_loc IN
    SELECT id FROM locations
    WHERE group_id = p_org_id AND active = true
  LOOP
    v_version_id := gen_random_uuid();

    INSERT INTO budget_versions (id, org_id, location_id, name, period_start, period_end, status)
    VALUES (
      v_version_id, p_org_id, v_loc.id,
      'Auto-generated from forecast',
      v_month_start, v_month_end, 'published'
    );

    -- Create budget_days + budget_metrics for each day with forecast
    FOR v_day IN
      SELECT generate_series(v_month_start, v_month_end, '1 day'::interval)::date
    LOOP
      -- Get forecast for this day/location
      SELECT COALESCE(forecast_sales, 0), COALESCE(planned_labor_cost, 0)
      INTO v_fc_sales, v_fc_labour
      FROM forecast_daily_metrics
      WHERE org_id = p_org_id
        AND location_id = v_loc.id
        AND date = v_day
      LIMIT 1;

      -- Skip days with no forecast
      IF v_fc_sales <= 0 THEN CONTINUE; END IF;

      v_day_id := gen_random_uuid();

      INSERT INTO budget_days (id, budget_version_id, org_id, location_id, day)
      VALUES (v_day_id, v_version_id, p_org_id, v_loc.id, v_day);

      -- Sales metric
      INSERT INTO budget_metrics (budget_day_id, metric, value, layer)
      VALUES (v_day_id, 'sales_net', v_fc_sales, 'final');

      -- Labour metric
      INSERT INTO budget_metrics (budget_day_id, metric, value, layer)
      VALUES (v_day_id, 'labour_cost', v_fc_labour, 'final');

      -- COGS metric (32% of sales as default)
      INSERT INTO budget_metrics (budget_day_id, metric, value, layer)
      VALUES (v_day_id, 'cogs', ROUND(v_fc_sales * 0.32, 2), 'final');

      v_days_created := v_days_created + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'created', true,
    'days_created', v_days_created,
    'period', jsonb_build_object('from', v_month_start, 'to', v_month_end),
    'org_id', p_org_id
  );
END;
$$;
