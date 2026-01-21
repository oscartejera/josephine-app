-- =============================================
-- GET LABOUR TIMESERIES RPC
-- =============================================
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
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH daily_agg AS (
    SELECT
      COALESCE(p.date, f.date) as agg_date,
      COALESCE(SUM(p.net_sales), 0) as sum_sales,
      COALESCE(SUM(f.forecast_sales), 0) as sum_forecast_sales,
      COALESCE(SUM(p.labor_cost), 0) as sum_labor_cost,
      COALESCE(SUM(f.planned_labor_cost), 0) as sum_planned_cost,
      COALESCE(SUM(p.labor_hours), 0) as sum_hours,
      COALESCE(SUM(f.planned_labor_hours), 0) as sum_planned_hours,
      COALESCE(SUM(p.orders), 0) as sum_orders,
      COALESCE(SUM(f.forecast_orders), 0) as sum_forecast_orders
    FROM pos_daily_metrics p
    FULL OUTER JOIN forecast_daily_metrics f 
      ON p.date = f.date AND p.location_id = f.location_id
    JOIN locations l ON COALESCE(p.location_id, f.location_id) = l.id
    WHERE l.group_id = get_user_group_id()
      AND COALESCE(p.date, f.date) >= date_from
      AND COALESCE(p.date, f.date) <= date_to
      AND (selected_location_id IS NULL OR COALESCE(p.location_id, f.location_id) = selected_location_id)
      AND COALESCE(p.location_id, f.location_id) IN (SELECT get_accessible_location_ids())
    GROUP BY COALESCE(p.date, f.date)
    ORDER BY COALESCE(p.date, f.date)
  )
  SELECT
    agg_date,
    ROUND(sum_sales::numeric, 2),
    ROUND(sum_forecast_sales::numeric, 2),
    ROUND(sum_labor_cost::numeric, 2),
    ROUND(sum_planned_cost::numeric, 2),
    ROUND(sum_hours::numeric, 1),
    ROUND(sum_planned_hours::numeric, 1),
    ROUND(sum_orders::numeric, 0),
    ROUND(sum_forecast_orders::numeric, 0),
    CASE WHEN sum_sales > 0 THEN ROUND((sum_labor_cost / sum_sales * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN sum_forecast_sales > 0 THEN ROUND((sum_planned_cost / sum_forecast_sales * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN sum_hours > 0 THEN ROUND((sum_sales / sum_hours)::numeric, 2) ELSE 0 END,
    CASE WHEN sum_planned_hours > 0 THEN ROUND((sum_forecast_sales / sum_planned_hours)::numeric, 2) ELSE 0 END,
    CASE WHEN sum_hours > 0 THEN ROUND((sum_orders / sum_hours)::numeric, 2) ELSE 0 END,
    CASE WHEN sum_planned_hours > 0 THEN ROUND((sum_forecast_orders / sum_planned_hours)::numeric, 2) ELSE 0 END
  FROM daily_agg;
$$;