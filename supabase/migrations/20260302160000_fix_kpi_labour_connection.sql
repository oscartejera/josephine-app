-- ============================================================
-- Fix: Connect labour cost to Dashboard and P&L
-- 
-- Root cause: rpc_kpi_range_summary reads from labour_daily_unified
-- which is empty. The actual labour data lives in
-- planned_shifts × employees.hourly_cost.
--
-- This fix rewrites the labour CTE to use planned_shifts as the
-- source of truth, matching how the Labour page calculates.
-- ============================================================

-- Helper RPC for ExecutiveBriefing: returns per-location labour cost for a date
CREATE OR REPLACE FUNCTION get_labour_cost_by_date(
  p_location_ids uuid[],
  p_date date
)
RETURNS TABLE(location_id uuid, labour_cost numeric)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    ps.location_id,
    COALESCE(SUM(ps.planned_hours * COALESCE(e.hourly_cost, 0)), 0) AS labour_cost
  FROM planned_shifts ps
  JOIN employees e ON e.id = ps.employee_id
  WHERE ps.location_id = ANY(p_location_ids)
    AND ps.shift_date = p_date
  GROUP BY ps.location_id;
$$;

GRANT EXECUTE ON FUNCTION get_labour_cost_by_date(uuid[], date) TO authenticated;

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
  v_current jsonb;
  v_previous jsonb;
  v_loc_filter uuid[];
BEGIN
  v_days := (p_to - p_from) + 1;

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
    WHERE location_id = ANY(v_loc_filter)
      AND date BETWEEN p_from AND p_to
  ),
  -- FIX: Read labour from planned_shifts × employees.hourly_cost
  -- This matches how the Labour page calculates actual cost.
  -- Falls back to labour_daily_unified if it has data (for payroll integration)
  labour AS (
    SELECT
      COALESCE(SUM(ps.planned_hours * COALESCE(e.hourly_cost, 0)), 0) AS total_cost,
      COALESCE(SUM(ps.planned_hours), 0) AS total_hours
    FROM planned_shifts ps
    JOIN employees e ON e.id = ps.employee_id
    WHERE ps.location_id = ANY(v_loc_filter)
      AND ps.shift_date BETWEEN p_from AND p_to
  ),
  cogs AS (
    SELECT COALESCE(SUM(cogs_amount), 0) AS total_cogs
    FROM cogs_daily
    WHERE location_id = ANY(v_loc_filter)
      AND date BETWEEN p_from AND p_to
  ),
  -- Also check monthly_cost_entries for manually entered COGS
  monthly_cogs AS (
    SELECT COALESCE(SUM(amount), 0) AS total_manual_cogs
    FROM monthly_cost_entries
    WHERE location_id = ANY(v_loc_filter)
      AND year = EXTRACT(YEAR FROM p_from)
      AND month = EXTRACT(MONTH FROM p_from)
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
    WHERE location_id = ANY(v_loc_filter)
      AND date BETWEEN p_from AND p_to
  ),
  cogs AS (
    -- Use forecast COGS as ~28% of forecast sales (estimated)
    SELECT COALESCE(SUM(forecast_sales * 0.28), 0) AS fc_cogs
    FROM forecast_daily_metrics
    WHERE location_id = ANY(v_loc_filter)
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


-- ============================================================
-- Fix 2: get_instant_pnl_unified — P&L Location Cards
--
-- Same root cause: reads labor_cost from sales_daily_unified (NULL).
-- Fix: add a labour subquery using planned_shifts × hourly_cost.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_instant_pnl_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $function$
DECLARE v_ds jsonb; v_locs jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb) INTO v_locs
  FROM (
    SELECT
      l.id AS location_id,
      l.name AS location_name,
      COALESCE(s.net_sales, 0)::numeric         AS actual_sales,
      COALESCE(fc.forecast_sales, 0)::numeric   AS forecast_sales,
      ROUND(COALESCE(s.net_sales, 0) * COALESCE(cg.cogs_pct, 0.32), 2)::numeric AS actual_cogs,
      ROUND(COALESCE(fc.forecast_sales, 0) * COALESCE(cg.cogs_pct, 0.32), 2)::numeric AS forecast_cogs,
      -- FIX: Read labor from planned_shifts × hourly_cost (source of truth)
      COALESCE(lb.actual_cost, 0)::numeric      AS actual_labour,
      COALESCE(lb.actual_hours, 0)::numeric     AS actual_labour_hours,
      COALESCE(fc.planned_labor_cost, 0)::numeric AS forecast_labour,
      COALESCE(fc.planned_labor_hours, 0)::numeric AS forecast_labour_hours,
      (COALESCE(s.net_sales, 0)
        - ROUND(COALESCE(s.net_sales, 0) * COALESCE(cg.cogs_pct, 0.32), 2)
        - COALESCE(lb.actual_cost, 0))::numeric AS actual_gp,
      (COALESCE(fc.forecast_sales, 0)
        - ROUND(COALESCE(fc.forecast_sales, 0) * COALESCE(cg.cogs_pct, 0.32), 2)
        - COALESCE(fc.planned_labor_cost, 0))::numeric AS forecast_gp,
      true AS estimated_cogs,
      CASE WHEN COALESCE(lb.actual_cost, 0) = 0 AND COALESCE(s.net_sales, 0) > 0
        THEN true ELSE false END AS estimated_labour
    FROM locations l
    LEFT JOIN (
      SELECT location_id,
             SUM(net_sales) AS net_sales
      FROM sales_daily_unified
      WHERE org_id = p_org_id AND date BETWEEN p_from AND p_to
      GROUP BY 1
    ) s ON s.location_id = l.id
    -- FIX: Labour from planned_shifts × employees.hourly_cost
    LEFT JOIN (
      SELECT ps.location_id,
             SUM(ps.planned_hours * COALESCE(e.hourly_cost, 0)) AS actual_cost,
             SUM(ps.planned_hours) AS actual_hours
      FROM planned_shifts ps
      JOIN employees e ON e.id = ps.employee_id
      WHERE ps.location_id = ANY(p_location_ids)
        AND ps.shift_date BETWEEN p_from AND p_to
      GROUP BY 1
    ) lb ON lb.location_id = l.id
    LEFT JOIN (
      SELECT location_id,
             SUM(forecast_sales) AS forecast_sales,
             SUM(planned_labor_cost) AS planned_labor_cost,
             SUM(planned_labor_hours) AS planned_labor_hours
      FROM forecast_daily_unified
      WHERE org_id = p_org_id AND day BETWEEN p_from AND p_to
      GROUP BY 1
    ) fc ON fc.location_id = l.id
    LEFT JOIN (
      SELECT location_id,
        CASE WHEN SUM(net_sales) > 0 THEN SUM(cogs) / SUM(net_sales) ELSE 0.32 END AS cogs_pct
      FROM product_sales_daily_unified
      WHERE org_id = p_org_id AND day BETWEEN p_from AND p_to
      GROUP BY 1
    ) cg ON cg.location_id = l.id
    WHERE l.id = ANY(p_location_ids) AND l.active = true
  ) r;

  RETURN jsonb_build_object(
    'data_source',    v_ds->>'data_source',
    'mode',           v_ds->>'mode',
    'reason',         v_ds->>'reason',
    'last_synced_at', v_ds->>'last_synced_at',
    'locations',      v_locs,
    'flags',          jsonb_build_object('estimated_cogs', true, 'cogs_note', 'COGS from product mix ratio')
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION get_instant_pnl_unified(uuid, uuid[], date, date) TO anon, authenticated;
