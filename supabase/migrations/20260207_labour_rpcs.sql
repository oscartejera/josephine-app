-- =========================================================
-- Labour RPCs: get_labour_kpis, get_labour_timeseries, get_labour_locations_table
-- These power the Labour dashboard page
-- =========================================================

-- 1) KPI aggregates for the Labour page header cards
CREATE OR REPLACE FUNCTION public.get_labour_kpis(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_group_id uuid;
  result json;
BEGIN
  v_group_id := get_user_group_id();

  WITH actuals AS (
    SELECT
      COALESCE(SUM(p.net_sales),0) AS actual_sales,
      COALESCE(SUM(p.labor_cost),0) AS actual_labor_cost,
      COALESCE(SUM(p.labor_hours),0) AS actual_labor_hours,
      COALESCE(SUM(p.orders),0) AS actual_orders
    FROM pos_daily_metrics p
    JOIN locations l ON l.id = p.location_id
    WHERE l.group_id = v_group_id
      AND p.date >= date_from AND p.date <= date_to
      AND (selected_location_id IS NULL OR p.location_id = selected_location_id)
      AND p.location_id IN (SELECT get_accessible_location_ids())
  ),
  forecasts AS (
    SELECT
      COALESCE(SUM(f.forecast_sales),0) AS forecast_sales,
      COALESCE(SUM(f.planned_labor_cost),0) AS planned_labor_cost,
      COALESCE(SUM(f.planned_labor_hours),0) AS planned_labor_hours,
      COALESCE(SUM(f.forecast_orders),0) AS forecast_orders
    FROM forecast_daily_metrics f
    JOIN locations l ON l.id = f.location_id
    WHERE l.group_id = v_group_id
      AND f.date >= date_from AND f.date <= date_to
      AND (selected_location_id IS NULL OR f.location_id = selected_location_id)
      AND f.location_id IN (SELECT get_accessible_location_ids())
  )
  SELECT json_build_object(
    'actual_sales', a.actual_sales,
    'forecast_sales', f.forecast_sales,
    'actual_labor_cost', a.actual_labor_cost,
    'planned_labor_cost', f.planned_labor_cost,
    'actual_labor_hours', a.actual_labor_hours,
    'planned_labor_hours', f.planned_labor_hours,
    'actual_orders', a.actual_orders,
    'forecast_orders', f.forecast_orders,
    'actual_col_pct', CASE WHEN a.actual_sales > 0 THEN ROUND((a.actual_labor_cost / a.actual_sales * 100)::numeric, 2) ELSE 0 END,
    'planned_col_pct', CASE WHEN f.forecast_sales > 0 THEN ROUND((f.planned_labor_cost / f.forecast_sales * 100)::numeric, 2) ELSE 0 END,
    'actual_splh', CASE WHEN a.actual_labor_hours > 0 THEN ROUND((a.actual_sales / a.actual_labor_hours)::numeric, 2) ELSE 0 END,
    'planned_splh', CASE WHEN f.planned_labor_hours > 0 THEN ROUND((f.forecast_sales / f.planned_labor_hours)::numeric, 2) ELSE 0 END,
    'actual_oplh', CASE WHEN a.actual_labor_hours > 0 THEN ROUND((a.actual_orders / a.actual_labor_hours)::numeric, 2) ELSE 0 END,
    'planned_oplh', CASE WHEN f.planned_labor_hours > 0 THEN ROUND((f.forecast_orders / f.planned_labor_hours)::numeric, 2) ELSE 0 END,
    'sales_delta_pct', CASE WHEN f.forecast_sales > 0 THEN ROUND(((a.actual_sales - f.forecast_sales) / f.forecast_sales * 100)::numeric, 2) ELSE 0 END,
    'col_delta_pct', CASE WHEN f.forecast_sales > 0 AND a.actual_sales > 0 THEN ROUND(((a.actual_labor_cost / a.actual_sales - f.planned_labor_cost / f.forecast_sales) * 100)::numeric, 2) ELSE 0 END,
    'hours_delta_pct', CASE WHEN f.planned_labor_hours > 0 THEN ROUND(((a.actual_labor_hours - f.planned_labor_hours) / f.planned_labor_hours * 100)::numeric, 2) ELSE 0 END,
    'splh_delta_pct', CASE WHEN f.planned_labor_hours > 0 AND a.actual_labor_hours > 0 THEN ROUND(((a.actual_sales / a.actual_labor_hours - f.forecast_sales / f.planned_labor_hours) / (f.forecast_sales / f.planned_labor_hours) * 100)::numeric, 2) ELSE 0 END,
    'oplh_delta_pct', CASE WHEN f.planned_labor_hours > 0 AND a.actual_labor_hours > 0 AND f.forecast_orders > 0 THEN ROUND(((a.actual_orders / a.actual_labor_hours - f.forecast_orders / f.planned_labor_hours) / (f.forecast_orders / f.planned_labor_hours) * 100)::numeric, 2) ELSE 0 END
  ) INTO result
  FROM actuals a, forecasts f;

  RETURN result;
END;
$$;

-- 2) Daily timeseries for the Labour chart
CREATE OR REPLACE FUNCTION public.get_labour_timeseries(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  date date,
  actual_sales numeric,
  forecast_sales numeric,
  actual_labor_cost numeric,
  planned_labor_cost numeric,
  actual_hours numeric,
  planned_hours numeric,
  actual_orders numeric,
  forecast_orders numeric,
  actual_col_pct numeric,
  planned_col_pct numeric,
  actual_splh numeric,
  planned_splh numeric,
  actual_oplh numeric,
  planned_oplh numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  v_group_id := get_user_group_id();

  RETURN QUERY
  WITH dates AS (
    SELECT d::date AS dt
    FROM generate_series(date_from, date_to, '1 day'::interval) d
  ),
  act AS (
    SELECT
      p.date AS dt,
      SUM(p.net_sales) AS s,
      SUM(p.labor_cost) AS lc,
      SUM(p.labor_hours) AS lh,
      SUM(p.orders) AS o
    FROM pos_daily_metrics p
    JOIN locations l ON l.id = p.location_id
    WHERE l.group_id = v_group_id
      AND p.date >= date_from AND p.date <= date_to
      AND (selected_location_id IS NULL OR p.location_id = selected_location_id)
      AND p.location_id IN (SELECT get_accessible_location_ids())
    GROUP BY p.date
  ),
  fct AS (
    SELECT
      f.date AS dt,
      SUM(f.forecast_sales) AS fs,
      SUM(f.planned_labor_cost) AS plc,
      SUM(f.planned_labor_hours) AS plh,
      SUM(f.forecast_orders) AS fo
    FROM forecast_daily_metrics f
    JOIN locations l ON l.id = f.location_id
    WHERE l.group_id = v_group_id
      AND f.date >= date_from AND f.date <= date_to
      AND (selected_location_id IS NULL OR f.location_id = selected_location_id)
      AND f.location_id IN (SELECT get_accessible_location_ids())
    GROUP BY f.date
  )
  SELECT
    d.dt,
    COALESCE(a.s,0),
    COALESCE(fc.fs,0),
    COALESCE(a.lc,0),
    COALESCE(fc.plc,0),
    COALESCE(a.lh,0),
    COALESCE(fc.plh,0),
    COALESCE(a.o,0),
    COALESCE(fc.fo,0),
    CASE WHEN COALESCE(a.s,0) > 0 THEN ROUND((COALESCE(a.lc,0) / a.s * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN COALESCE(fc.fs,0) > 0 THEN ROUND((COALESCE(fc.plc,0) / fc.fs * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN COALESCE(a.lh,0) > 0 THEN ROUND((COALESCE(a.s,0) / a.lh)::numeric, 2) ELSE 0 END,
    CASE WHEN COALESCE(fc.plh,0) > 0 THEN ROUND((COALESCE(fc.fs,0) / fc.plh)::numeric, 2) ELSE 0 END,
    CASE WHEN COALESCE(a.lh,0) > 0 THEN ROUND((COALESCE(a.o,0) / a.lh)::numeric, 2) ELSE 0 END,
    CASE WHEN COALESCE(fc.plh,0) > 0 THEN ROUND((COALESCE(fc.fo,0) / fc.plh)::numeric, 2) ELSE 0 END
  FROM dates d
  LEFT JOIN act a ON a.dt = d.dt
  LEFT JOIN fct fc ON fc.dt = d.dt
  ORDER BY d.dt;
END;
$$;

-- 3) Per-location breakdown table with summary row
CREATE OR REPLACE FUNCTION public.get_labour_locations_table(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  location_id uuid,
  location_name text,
  sales_actual numeric,
  sales_projected numeric,
  sales_delta_pct numeric,
  col_actual_pct numeric,
  col_projected_pct numeric,
  col_delta_pct numeric,
  splh_actual numeric,
  splh_projected numeric,
  splh_delta_pct numeric,
  oplh_actual numeric,
  oplh_projected numeric,
  oplh_delta_pct numeric,
  labor_cost_actual numeric,
  labor_cost_projected numeric,
  hours_actual numeric,
  hours_projected numeric,
  is_summary boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  v_group_id := get_user_group_id();

  RETURN QUERY
  WITH loc_actual AS (
    SELECT
      p.location_id AS lid,
      SUM(p.net_sales) AS s,
      SUM(p.labor_cost) AS lc,
      SUM(p.labor_hours) AS lh,
      SUM(p.orders) AS o
    FROM pos_daily_metrics p
    JOIN locations l ON l.id = p.location_id
    WHERE l.group_id = v_group_id
      AND p.date >= date_from AND p.date <= date_to
      AND (selected_location_id IS NULL OR p.location_id = selected_location_id)
      AND p.location_id IN (SELECT get_accessible_location_ids())
    GROUP BY p.location_id
  ),
  loc_forecast AS (
    SELECT
      f.location_id AS lid,
      SUM(f.forecast_sales) AS fs,
      SUM(f.planned_labor_cost) AS plc,
      SUM(f.planned_labor_hours) AS plh,
      SUM(f.forecast_orders) AS fo
    FROM forecast_daily_metrics f
    JOIN locations l ON l.id = f.location_id
    WHERE l.group_id = v_group_id
      AND f.date >= date_from AND f.date <= date_to
      AND (selected_location_id IS NULL OR f.location_id = selected_location_id)
      AND f.location_id IN (SELECT get_accessible_location_ids())
    GROUP BY f.location_id
  ),
  per_location AS (
    SELECT
      l.id AS lid,
      l.name AS lname,
      COALESCE(a.s,0) AS sa,
      COALESCE(f.fs,0) AS sp,
      COALESCE(a.lc,0) AS lca,
      COALESCE(f.plc,0) AS lcp,
      COALESCE(a.lh,0) AS lha,
      COALESCE(f.plh,0) AS lhp,
      COALESCE(a.o,0) AS oa,
      COALESCE(f.fo,0) AS op
    FROM locations l
    LEFT JOIN loc_actual a ON a.lid = l.id
    LEFT JOIN loc_forecast f ON f.lid = l.id
    WHERE l.group_id = v_group_id
      AND (selected_location_id IS NULL OR l.id = selected_location_id)
      AND l.id IN (SELECT get_accessible_location_ids())
      AND (COALESCE(a.s,0) > 0 OR COALESCE(f.fs,0) > 0)
  )
  -- Per-location rows
  SELECT
    pl.lid,
    pl.lname,
    pl.sa,
    pl.sp,
    CASE WHEN pl.sp > 0 THEN ROUND(((pl.sa - pl.sp) / pl.sp * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN pl.sa > 0 THEN ROUND((pl.lca / pl.sa * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN pl.sp > 0 THEN ROUND((pl.lcp / pl.sp * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN pl.sp > 0 AND pl.sa > 0 THEN ROUND(((pl.lca / pl.sa - pl.lcp / pl.sp) * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN pl.lha > 0 THEN ROUND((pl.sa / pl.lha)::numeric, 2) ELSE 0 END,
    CASE WHEN pl.lhp > 0 THEN ROUND((pl.sp / pl.lhp)::numeric, 2) ELSE 0 END,
    CASE WHEN pl.lhp > 0 AND pl.lha > 0 THEN ROUND(((pl.sa / pl.lha - pl.sp / pl.lhp) / (pl.sp / pl.lhp) * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN pl.lha > 0 THEN ROUND((pl.oa / pl.lha)::numeric, 2) ELSE 0 END,
    CASE WHEN pl.lhp > 0 THEN ROUND((pl.op / pl.lhp)::numeric, 2) ELSE 0 END,
    CASE WHEN pl.lhp > 0 AND pl.lha > 0 AND pl.op > 0 THEN ROUND(((pl.oa / pl.lha - pl.op / pl.lhp) / (pl.op / pl.lhp) * 100)::numeric, 2) ELSE 0 END,
    pl.lca,
    pl.lcp,
    pl.lha,
    pl.lhp,
    false
  FROM per_location pl

  UNION ALL

  -- Summary row
  SELECT
    NULL::uuid,
    'Total'::text,
    SUM(pl.sa),
    SUM(pl.sp),
    CASE WHEN SUM(pl.sp) > 0 THEN ROUND(((SUM(pl.sa) - SUM(pl.sp)) / SUM(pl.sp) * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(pl.sa) > 0 THEN ROUND((SUM(pl.lca) / SUM(pl.sa) * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(pl.sp) > 0 THEN ROUND((SUM(pl.lcp) / SUM(pl.sp) * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(pl.sp) > 0 AND SUM(pl.sa) > 0 THEN ROUND(((SUM(pl.lca) / SUM(pl.sa) - SUM(pl.lcp) / SUM(pl.sp)) * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(pl.lha) > 0 THEN ROUND((SUM(pl.sa) / SUM(pl.lha))::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(pl.lhp) > 0 THEN ROUND((SUM(pl.sp) / SUM(pl.lhp))::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(pl.lhp) > 0 AND SUM(pl.lha) > 0 THEN ROUND(((SUM(pl.sa) / SUM(pl.lha) - SUM(pl.sp) / SUM(pl.lhp)) / (SUM(pl.sp) / SUM(pl.lhp)) * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(pl.lha) > 0 THEN ROUND((SUM(pl.oa) / SUM(pl.lha))::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(pl.lhp) > 0 THEN ROUND((SUM(pl.op) / SUM(pl.lhp))::numeric, 2) ELSE 0 END,
    CASE WHEN SUM(pl.lhp) > 0 AND SUM(pl.lha) > 0 AND SUM(pl.op) > 0 THEN ROUND(((SUM(pl.oa) / SUM(pl.lha) - SUM(pl.op) / SUM(pl.lhp)) / (SUM(pl.op) / SUM(pl.lhp)) * 100)::numeric, 2) ELSE 0 END,
    SUM(pl.lca),
    SUM(pl.lcp),
    SUM(pl.lha),
    SUM(pl.lhp),
    true
  FROM per_location pl

  ORDER BY is_summary, location_name;
END;
$$;
