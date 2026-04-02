-- ===========================================
-- FIX 2: Recreate get_labour_kpis with uuid type
-- ===========================================
-- Drop ALL overloads first
DROP FUNCTION IF EXISTS get_labour_kpis(date, date, text, text);
DROP FUNCTION IF EXISTS get_labour_kpis(date, date, uuid, text);

CREATE OR REPLACE FUNCTION get_labour_kpis(
  date_from date,
  date_to date,
  selected_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_sales         numeric := 0;
  v_orders        numeric := 0;
  v_fc_sales      numeric := 0;
  v_fc_orders     numeric := 0;
  v_actual_cost   numeric := 0;
  v_actual_hours  numeric := 0;
  v_sched_cost    numeric := 0;
  v_sched_hours   numeric := 0;
  v_headcount     numeric := 0;
  v_cogs          numeric := 0;
  v_row_count     int     := 0;
BEGIN
  -- 1) Sales from sales_daily_unified
  SELECT COALESCE(SUM(net_sales), 0),
         COALESCE(SUM(orders_count), 0)
  INTO v_sales, v_orders
  FROM sales_daily_unified
  WHERE date BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  -- 2) Forecast sales from forecast_daily_metrics (if exists)
  BEGIN
    SELECT COALESCE(SUM(forecast_sales), 0),
           COALESCE(SUM(forecast_orders), 0)
    INTO v_fc_sales, v_fc_orders
    FROM forecast_daily_metrics
    WHERE date BETWEEN date_from AND date_to
      AND (selected_location_id IS NULL OR location_id = selected_location_id);
  EXCEPTION WHEN undefined_table THEN
    v_fc_sales := 0; v_fc_orders := 0;
  END;

  -- 3) Labour from labour_daily_unified
  SELECT COALESCE(SUM(actual_cost), 0),
         COALESCE(SUM(actual_hours), 0),
         COALESCE(SUM(scheduled_cost), 0),
         COALESCE(SUM(scheduled_hours), 0),
         CASE WHEN COUNT(*) > 0 THEN SUM(scheduled_headcount)::numeric / COUNT(*) ELSE 0 END,
         COUNT(*)
  INTO v_actual_cost, v_actual_hours, v_sched_cost, v_sched_hours, v_headcount, v_row_count
  FROM labour_daily_unified
  WHERE day BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  -- 4) COGS from cogs_daily (if exists)
  BEGIN
    SELECT COALESCE(SUM(cogs_amount), 0) INTO v_cogs
    FROM cogs_daily
    WHERE date BETWEEN date_from AND date_to
      AND (selected_location_id IS NULL OR location_id = selected_location_id);
  EXCEPTION WHEN undefined_table THEN
    v_cogs := 0;
  END;

  -- If cogs_daily is empty, try monthly_cost_entries
  IF v_cogs = 0 THEN
    BEGIN
      SELECT COALESCE(SUM(amount), 0) INTO v_cogs
      FROM monthly_cost_entries
      WHERE (selected_location_id IS NULL OR location_id = selected_location_id)
        AND period_year = EXTRACT(YEAR FROM date_from)
        AND period_month = EXTRACT(MONTH FROM date_from);
    EXCEPTION WHEN undefined_table THEN
      v_cogs := 0;
    END;
  END IF;

  -- 5) Build result matching frontend LabourKpis interface
  RETURN jsonb_build_object(
    -- Sales
    'actual_sales',         v_sales,
    'forecast_sales',       v_fc_sales,
    'actual_orders',        v_orders,
    'forecast_orders',      v_fc_orders,

    -- Labour cost/hours
    'actual_labor_cost',    v_actual_cost,
    'planned_labor_cost',   v_sched_cost,
    'actual_labor_hours',   v_actual_hours,
    'planned_labor_hours',  v_sched_hours,
    'schedule_labor_cost',  v_sched_cost,

    -- Derived KPIs: COL%
    'actual_col_pct',  CASE WHEN v_sales > 0 THEN ROUND(v_actual_cost / v_sales * 100, 2) ELSE 0 END,
    'planned_col_pct', CASE WHEN v_fc_sales > 0 THEN ROUND(v_sched_cost / v_fc_sales * 100, 2) ELSE 0 END,

    -- Derived KPIs: SPLH
    'actual_splh',  CASE WHEN v_actual_hours > 0 THEN ROUND(v_sales / v_actual_hours, 2) ELSE 0 END,
    'planned_splh', CASE WHEN v_sched_hours > 0 THEN ROUND(v_fc_sales / v_sched_hours, 2) ELSE 0 END,

    -- Derived KPIs: OPLH (orders per labour hour)
    'actual_oplh',  CASE WHEN v_actual_hours > 0 THEN ROUND(v_orders / v_actual_hours, 2) ELSE 0 END,
    'planned_oplh', CASE WHEN v_sched_hours > 0 THEN ROUND(v_fc_orders / v_sched_hours, 2) ELSE 0 END,

    -- Deltas (actual vs forecast/planned)
    'sales_delta_pct', CASE WHEN v_fc_sales > 0
      THEN ROUND((v_sales - v_fc_sales) / v_fc_sales * 100, 1) ELSE 0 END,
    'col_delta_pct', CASE WHEN v_fc_sales > 0 AND v_sched_cost > 0
      THEN ROUND(
        (v_actual_cost / v_sales * 100) - (v_sched_cost / v_fc_sales * 100),
      1) ELSE 0 END,
    'hours_delta_pct', CASE WHEN v_sched_hours > 0
      THEN ROUND((v_actual_hours - v_sched_hours) / v_sched_hours * 100, 1) ELSE 0 END,
    'splh_delta_pct', CASE WHEN v_sched_hours > 0 AND v_actual_hours > 0 AND v_fc_sales > 0
      THEN ROUND(
        ((v_sales / v_actual_hours) - (v_fc_sales / v_sched_hours)) / (v_fc_sales / v_sched_hours) * 100,
      1) ELSE 0 END,
    'oplh_delta_pct', CASE WHEN v_sched_hours > 0 AND v_actual_hours > 0 AND v_fc_orders > 0
      THEN ROUND(
        ((v_orders / v_actual_hours) - (v_fc_orders / v_sched_hours)) / (v_fc_orders / v_sched_hours) * 100,
      1) ELSE 0 END,

    -- Cost per cover
    'cost_per_cover', CASE WHEN v_orders > 0 THEN ROUND(v_actual_cost / v_orders, 2) ELSE 0 END,

    -- COGS & Prime Cost
    'cogs_total',       v_cogs,
    'cogs_pct',         CASE WHEN v_sales > 0 THEN ROUND(v_cogs / v_sales * 100, 1) ELSE 0 END,
    'prime_cost_pct',   CASE WHEN v_sales > 0 THEN ROUND((v_actual_cost + v_cogs) / v_sales * 100, 1) ELSE 0 END,
    'prime_cost_amount', v_actual_cost + v_cogs,

    -- Source indicator
    'labor_cost_source', 'payroll',

    -- Legacy fields for backward compat
    'avg_headcount',    v_headcount,
    'total_sales',      v_sales,
    'splh',             CASE WHEN v_actual_hours > 0 THEN ROUND(v_sales / v_actual_hours, 2) ELSE 0 END,
    'col_pct',          CASE WHEN v_sales > 0 THEN ROUND(v_actual_cost / v_sales * 100, 2) ELSE 0 END
  );
END;
$$;
