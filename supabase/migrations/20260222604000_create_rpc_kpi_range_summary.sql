-- ============================================================
-- rpc_kpi_range_summary
--
-- Returns aggregated KPIs for a date range + auto-computed
-- previous period of the same length for comparison.
--
-- Called by: src/data/kpi.ts → getKpiRangeSummary()
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_kpi_range_summary(
  p_org_id uuid,
  p_location_ids uuid[] DEFAULT NULL,
  p_from date DEFAULT CURRENT_DATE - INTERVAL '7 days',
  p_to date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_days int;
  v_prev_from date;
  v_prev_to date;
  v_current jsonb;
  v_previous jsonb;
  v_loc_filter uuid[];
BEGIN
  -- Calculate period length and previous period dates
  v_days := (p_to - p_from) + 1;
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_days + 1;

  -- Resolve location filter
  IF p_location_ids IS NOT NULL AND array_length(p_location_ids, 1) > 0 THEN
    v_loc_filter := p_location_ids;
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
      'col_percent', null, 'gp_percent', null,
      'cogs_source_mixed', false, 'labour_source_mixed', false
    );
    RETURN jsonb_build_object(
      'current', v_current,
      'previous', v_current,
      'period', jsonb_build_object('from', p_from, 'to', p_to, 'days', v_days),
      'previousPeriod', jsonb_build_object('from', v_prev_from, 'to', v_prev_to)
    );
  END IF;

  -- ── Current period ──────────────────────────────────────────
  WITH sales AS (
    SELECT
      COALESCE(SUM(net_sales), 0) AS total_sales,
      COALESCE(SUM(orders_count), 0) AS total_orders
    FROM sales_daily_unified
    WHERE location_id = ANY(v_loc_filter)
      AND date BETWEEN p_from AND p_to
  ),
  labour AS (
    SELECT
      COALESCE(SUM(actual_cost), 0) AS total_labour_cost,
      COALESCE(SUM(actual_hours), 0) AS total_labour_hours
    FROM labour_daily_unified
    WHERE location_id = ANY(v_loc_filter)
      AND day BETWEEN p_from AND p_to
  ),
  cogs AS (
    SELECT
      COALESCE(SUM(cogs_amount), 0) AS total_cogs
    FROM cogs_daily
    WHERE location_id = ANY(v_loc_filter)
      AND date BETWEEN p_from AND p_to
  )
  SELECT jsonb_build_object(
    'net_sales', s.total_sales,
    'orders_count', s.total_orders,
    'covers', s.total_orders,
    'avg_check', CASE WHEN s.total_orders > 0 THEN ROUND(s.total_sales / s.total_orders, 2) ELSE 0 END,
    'labour_cost', CASE WHEN l.total_labour_cost > 0 THEN l.total_labour_cost ELSE null END,
    'labour_hours', CASE WHEN l.total_labour_hours > 0 THEN l.total_labour_hours ELSE null END,
    'cogs', c.total_cogs,
    'col_percent', CASE WHEN s.total_sales > 0 THEN ROUND((l.total_labour_cost / s.total_sales) * 100, 1) ELSE null END,
    'gp_percent', CASE WHEN s.total_sales > 0 THEN ROUND(((s.total_sales - c.total_cogs) / s.total_sales) * 100, 1) ELSE null END,
    'cogs_source_mixed', (c.total_cogs = 0 AND s.total_sales > 0),
    'labour_source_mixed', (l.total_labour_cost = 0 AND s.total_sales > 0)
  )
  INTO v_current
  FROM sales s, labour l, cogs c;

  -- ── Previous period ─────────────────────────────────────────
  WITH sales AS (
    SELECT
      COALESCE(SUM(net_sales), 0) AS total_sales,
      COALESCE(SUM(orders_count), 0) AS total_orders
    FROM sales_daily_unified
    WHERE location_id = ANY(v_loc_filter)
      AND date BETWEEN v_prev_from AND v_prev_to
  ),
  labour AS (
    SELECT
      COALESCE(SUM(actual_cost), 0) AS total_labour_cost,
      COALESCE(SUM(actual_hours), 0) AS total_labour_hours
    FROM labour_daily_unified
    WHERE location_id = ANY(v_loc_filter)
      AND day BETWEEN v_prev_from AND v_prev_to
  ),
  cogs AS (
    SELECT
      COALESCE(SUM(cogs_amount), 0) AS total_cogs
    FROM cogs_daily
    WHERE location_id = ANY(v_loc_filter)
      AND date BETWEEN v_prev_from AND v_prev_to
  )
  SELECT jsonb_build_object(
    'net_sales', s.total_sales,
    'orders_count', s.total_orders,
    'covers', s.total_orders,
    'avg_check', CASE WHEN s.total_orders > 0 THEN ROUND(s.total_sales / s.total_orders, 2) ELSE 0 END,
    'labour_cost', CASE WHEN l.total_labour_cost > 0 THEN l.total_labour_cost ELSE null END,
    'labour_hours', CASE WHEN l.total_labour_hours > 0 THEN l.total_labour_hours ELSE null END,
    'cogs', c.total_cogs,
    'col_percent', CASE WHEN s.total_sales > 0 THEN ROUND((l.total_labour_cost / s.total_sales) * 100, 1) ELSE null END,
    'gp_percent', CASE WHEN s.total_sales > 0 THEN ROUND(((s.total_sales - c.total_cogs) / s.total_sales) * 100, 1) ELSE null END,
    'cogs_source_mixed', (c.total_cogs = 0 AND s.total_sales > 0),
    'labour_source_mixed', (l.total_labour_cost = 0 AND s.total_sales > 0)
  )
  INTO v_previous
  FROM sales s, labour l, cogs c;

  -- ── Return combined result ──────────────────────────────────
  RETURN jsonb_build_object(
    'current', v_current,
    'previous', v_previous,
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'days', v_days),
    'previousPeriod', jsonb_build_object('from', v_prev_from, 'to', v_prev_to)
  );
END;
$$;
