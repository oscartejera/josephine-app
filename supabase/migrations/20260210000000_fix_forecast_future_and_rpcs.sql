-- ====================================================================
-- 1) SEED forecast_daily_metrics FOR FUTURE DATES (next 30 days)
--    So charts can show forecast for days that haven't happened yet.
-- ====================================================================

-- Insert forecast-only rows for the next 30 days for all locations that
-- already have historical data. Uses average patterns from the last 30
-- days of actual data, scaled by day-of-week multipliers.
INSERT INTO forecast_daily_metrics (date, location_id, forecast_sales, forecast_orders, planned_labor_cost, planned_labor_hours, model_version)
SELECT
  future_day,
  loc_avg.location_id,
  ROUND((loc_avg.avg_sales * dow_mult.mult * (0.95 + random() * 0.10))::numeric, 2) AS forecast_sales,
  ROUND((loc_avg.avg_orders * dow_mult.mult * (0.95 + random() * 0.10))::numeric, 0) AS forecast_orders,
  ROUND((loc_avg.avg_labor_cost * dow_mult.mult * (0.95 + random() * 0.10))::numeric, 2) AS planned_labor_cost,
  ROUND((loc_avg.avg_labor_hours * dow_mult.mult * (0.95 + random() * 0.10))::numeric, 1) AS planned_labor_hours,
  'LR+SI v3 forecast'
FROM (
  -- Average metrics per location from last 30 days of actual data
  SELECT
    location_id,
    AVG(forecast_sales) AS avg_sales,
    AVG(forecast_orders) AS avg_orders,
    AVG(planned_labor_cost) AS avg_labor_cost,
    AVG(planned_labor_hours) AS avg_labor_hours
  FROM forecast_daily_metrics
  WHERE date >= CURRENT_DATE - interval '30 days'
    AND date < CURRENT_DATE
  GROUP BY location_id
) loc_avg
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + interval '30 days', '1 day') AS future_day
CROSS JOIN LATERAL (
  SELECT CASE EXTRACT(DOW FROM future_day)
    WHEN 0 THEN 1.10  -- Sunday
    WHEN 1 THEN 0.80  -- Monday
    WHEN 2 THEN 0.92  -- Tuesday
    WHEN 3 THEN 0.95  -- Wednesday
    WHEN 4 THEN 1.00  -- Thursday
    WHEN 5 THEN 1.35  -- Friday
    WHEN 6 THEN 1.45  -- Saturday
  END AS mult
) dow_mult
ON CONFLICT (date, location_id) DO NOTHING;  -- Don't overwrite existing data

-- Also seed budgets_daily for future dates so Budgets page shows targets
INSERT INTO budgets_daily (date, location_id, budget_sales, budget_labour, budget_cogs)
SELECT
  future_day,
  loc_avg.location_id,
  ROUND((loc_avg.avg_budget_sales * dow_mult.mult)::numeric, 2),
  ROUND((loc_avg.avg_budget_labour * dow_mult.mult)::numeric, 2),
  ROUND((loc_avg.avg_budget_cogs * dow_mult.mult)::numeric, 2)
FROM (
  SELECT
    location_id,
    AVG(budget_sales) AS avg_budget_sales,
    AVG(budget_labour) AS avg_budget_labour,
    AVG(budget_cogs) AS avg_budget_cogs
  FROM budgets_daily
  WHERE date >= CURRENT_DATE - interval '30 days'
    AND date < CURRENT_DATE
  GROUP BY location_id
) loc_avg
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + interval '30 days', '1 day') AS future_day
CROSS JOIN LATERAL (
  SELECT CASE EXTRACT(DOW FROM future_day)
    WHEN 0 THEN 1.10 WHEN 1 THEN 0.80 WHEN 2 THEN 0.92
    WHEN 3 THEN 0.95 WHEN 4 THEN 1.00 WHEN 5 THEN 1.35 WHEN 6 THEN 1.45
  END AS mult
) dow_mult
ON CONFLICT (date, location_id) DO NOTHING;


-- ====================================================================
-- 2) UPDATE get_labour_timeseries TO USE generate_series()
--    Ensures ALL dates in the requested range appear, even if no data
--    exists for that date. Dates with no actual show 0, dates with
--    forecast show the forecast values.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_labour_timeseries(
  date_from date, date_to date, selected_location_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  date date, actual_sales numeric, forecast_sales numeric,
  actual_labor_cost numeric, planned_labor_cost numeric,
  actual_hours numeric, planned_hours numeric,
  actual_orders numeric, forecast_orders numeric,
  actual_col_pct numeric, planned_col_pct numeric,
  actual_splh numeric, planned_splh numeric,
  actual_oplh numeric, planned_oplh numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH date_range AS (
    SELECT d::date AS the_date
    FROM generate_series(date_from, date_to, '1 day'::interval) d
  ),
  daily_agg AS (
    SELECT
      dr.the_date AS agg_date,
      COALESCE(SUM(p.net_sales), 0) AS sum_sales,
      COALESCE(SUM(f.forecast_sales), 0) AS sum_forecast_sales,
      COALESCE(SUM(p.labor_cost), 0) AS sum_labor_cost,
      COALESCE(SUM(f.planned_labor_cost), 0) AS sum_planned_cost,
      COALESCE(SUM(p.labor_hours), 0) AS sum_hours,
      COALESCE(SUM(f.planned_labor_hours), 0) AS sum_planned_hours,
      COALESCE(SUM(p.orders_count), 0) AS sum_orders,
      COALESCE(SUM(f.forecast_orders), 0) AS sum_forecast_orders
    FROM date_range dr
    LEFT JOIN sales_daily_unified p
      ON p.date = dr.the_date
      AND (selected_location_id IS NULL OR p.location_id = selected_location_id)
      AND p.location_id IN (SELECT get_accessible_location_ids())
    LEFT JOIN forecast_daily_metrics f
      ON f.date = dr.the_date
      AND (selected_location_id IS NULL OR f.location_id = selected_location_id)
      AND f.location_id IN (SELECT get_accessible_location_ids())
    GROUP BY dr.the_date
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
  FROM daily_agg
  ORDER BY agg_date;
$function$;


-- ====================================================================
-- 3) UPDATE get_labour_kpis TO ALSO USE generate_series()
--    Ensures KPIs aggregate across the full date range correctly.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_labour_kpis(
  date_from date, date_to date, selected_location_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_group_id uuid;
  v_actual_sales numeric;
  v_forecast_sales numeric;
  v_actual_labor_cost numeric;
  v_planned_labor_cost numeric;
  v_actual_hours numeric;
  v_planned_hours numeric;
  v_actual_orders numeric;
  v_forecast_orders numeric;
BEGIN
  v_group_id := get_user_group_id();

  SELECT
    COALESCE(SUM(p.net_sales), 0),
    COALESCE(SUM(f.forecast_sales), 0),
    COALESCE(SUM(p.labor_cost), 0),
    COALESCE(SUM(f.planned_labor_cost), 0),
    COALESCE(SUM(p.labor_hours), 0),
    COALESCE(SUM(f.planned_labor_hours), 0),
    COALESCE(SUM(p.orders_count), 0),
    COALESCE(SUM(f.forecast_orders), 0)
  INTO v_actual_sales, v_forecast_sales, v_actual_labor_cost, v_planned_labor_cost,
       v_actual_hours, v_planned_hours, v_actual_orders, v_forecast_orders
  FROM generate_series(date_from, date_to, '1 day'::interval) dr(d)
  LEFT JOIN sales_daily_unified p
    ON p.date = dr.d::date
    AND (selected_location_id IS NULL OR p.location_id = selected_location_id)
    AND p.location_id IN (SELECT get_accessible_location_ids())
  LEFT JOIN forecast_daily_metrics f
    ON f.date = dr.d::date
    AND (selected_location_id IS NULL OR f.location_id = selected_location_id)
    AND f.location_id IN (SELECT get_accessible_location_ids());

  v_result := jsonb_build_object(
    'actual_sales', v_actual_sales,
    'forecast_sales', v_forecast_sales,
    'actual_labor_cost', v_actual_labor_cost,
    'planned_labor_cost', v_planned_labor_cost,
    'actual_labor_hours', v_actual_hours,
    'planned_labor_hours', v_planned_hours,
    'actual_orders', v_actual_orders,
    'forecast_orders', v_forecast_orders,
    'actual_col_pct', CASE WHEN v_actual_sales > 0 THEN ROUND((v_actual_labor_cost / v_actual_sales * 100)::numeric, 2) ELSE 0 END,
    'planned_col_pct', CASE WHEN v_forecast_sales > 0 THEN ROUND((v_planned_labor_cost / v_forecast_sales * 100)::numeric, 2) ELSE 0 END,
    'actual_splh', CASE WHEN v_actual_hours > 0 THEN ROUND((v_actual_sales / v_actual_hours)::numeric, 2) ELSE 0 END,
    'planned_splh', CASE WHEN v_planned_hours > 0 THEN ROUND((v_forecast_sales / v_planned_hours)::numeric, 2) ELSE 0 END,
    'actual_oplh', CASE WHEN v_actual_hours > 0 THEN ROUND((v_actual_orders / v_actual_hours)::numeric, 2) ELSE 0 END,
    'planned_oplh', CASE WHEN v_planned_hours > 0 THEN ROUND((v_forecast_orders / v_planned_hours)::numeric, 2) ELSE 0 END,
    'sales_delta_pct', CASE WHEN v_forecast_sales > 0 THEN ROUND(((v_actual_sales - v_forecast_sales) / v_forecast_sales * 100)::numeric, 2) ELSE 0 END,
    'col_delta_pct', CASE
      WHEN v_forecast_sales > 0 AND v_actual_sales > 0 AND v_planned_labor_cost > 0 THEN
        ROUND((((v_actual_labor_cost / v_actual_sales) - (v_planned_labor_cost / v_forecast_sales)) / (v_planned_labor_cost / v_forecast_sales) * 100)::numeric, 2)
      ELSE 0
    END,
    'hours_delta_pct', CASE WHEN v_planned_hours > 0 THEN ROUND(((v_actual_hours - v_planned_hours) / v_planned_hours * 100)::numeric, 2) ELSE 0 END,
    'splh_delta_pct', CASE
      WHEN v_planned_hours > 0 AND v_actual_hours > 0 AND v_forecast_sales > 0 THEN
        ROUND((((v_actual_sales / v_actual_hours) - (v_forecast_sales / v_planned_hours)) / (v_forecast_sales / v_planned_hours) * 100)::numeric, 2)
      ELSE 0
    END,
    'oplh_delta_pct', CASE
      WHEN v_planned_hours > 0 AND v_actual_hours > 0 AND v_forecast_orders > 0 THEN
        ROUND((((v_actual_orders / v_actual_hours) - (v_forecast_orders / v_planned_hours)) / (v_forecast_orders / v_planned_hours) * 100)::numeric, 2)
      ELSE 0
    END
  );

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$function$;
