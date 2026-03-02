-- ============================================================
-- Fix: rpc_kpi_range_summary references "year" and "month"
-- but monthly_cost_entries uses "period_year" and "period_month"
-- ============================================================

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
  -- Labour from planned_shifts × employees.hourly_cost
  labour AS (
    SELECT
      COALESCE(SUM(ps.planned_hours * COALESCE(e.hourly_cost, 0)), 0) AS total_cost,
      COALESCE(SUM(ps.planned_hours), 0) AS total_hours
    FROM planned_shifts ps
    JOIN employees e ON e.id = ps.employee_id
    WHERE ps.location_id::uuid = ANY(v_loc_filter)
      AND ps.shift_date BETWEEN p_from AND p_to
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
    'labour_source_mixed', false
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

GRANT EXECUTE ON FUNCTION public.rpc_kpi_range_summary(uuid, text[], date, date) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
