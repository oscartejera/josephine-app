-- ============================================================
-- Fix Labour KPIs field name mismatch
-- RPC returns total_sales, total_actual_cost, col_pct, splh
-- Frontend expects actual_sales, actual_labor_cost, actual_col_pct, actual_splh
-- ============================================================

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

-- Also fix get_labour_timeseries to include forecast & field name alignment
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
    SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.date), '[]'::jsonb)
    FROM (
      SELECT
        ldu.day AS date,
        COALESCE(s.net_sales, 0)               AS actual_sales,
        COALESCE(fc.forecast_sales, 0)         AS forecast_sales,
        COALESCE(ldu.actual_hours, 0)          AS actual_hours,
        COALESCE(ldu.actual_cost, 0)           AS actual_labor_cost,
        COALESCE(ldu.scheduled_hours, 0)       AS planned_hours,
        COALESCE(ldu.scheduled_cost, 0)        AS planned_labor_cost,
        COALESCE(ldu.scheduled_headcount, 0)   AS scheduled_headcount,
        COALESCE(s.orders_count, 0)            AS actual_orders,
        COALESCE(fc.forecast_orders, 0)        AS forecast_orders,
        CASE WHEN COALESCE(ldu.actual_hours, 0) > 0
             THEN ROUND(COALESCE(s.net_sales, 0) / ldu.actual_hours, 2) ELSE 0 END AS actual_splh,
        CASE WHEN COALESCE(ldu.scheduled_hours, 0) > 0
             THEN ROUND(COALESCE(fc.forecast_sales, 0) / ldu.scheduled_hours, 2) ELSE 0 END AS planned_splh,
        CASE WHEN COALESCE(s.net_sales, 0) > 0
             THEN ROUND(COALESCE(ldu.actual_cost, 0) / s.net_sales * 100, 2) ELSE 0 END AS actual_col_pct,
        CASE WHEN COALESCE(fc.forecast_sales, 0) > 0
             THEN ROUND(COALESCE(ldu.scheduled_cost, 0) / fc.forecast_sales * 100, 2) ELSE 0 END AS planned_col_pct,
        CASE WHEN COALESCE(ldu.actual_hours, 0) > 0
             THEN ROUND(COALESCE(s.orders_count, 0)::numeric / ldu.actual_hours, 2) ELSE 0 END AS actual_oplh,
        CASE WHEN COALESCE(ldu.scheduled_hours, 0) > 0
             THEN ROUND(COALESCE(fc.forecast_orders, 0)::numeric / ldu.scheduled_hours, 2) ELSE 0 END AS planned_oplh,
        COALESCE(ldu.hours_variance, 0)        AS hours_variance,
        COALESCE(ldu.hours_variance_pct, 0)    AS hours_variance_pct
      FROM labour_daily_unified ldu
      LEFT JOIN (
        SELECT date, location_id, SUM(net_sales) AS net_sales, SUM(orders_count) AS orders_count
        FROM sales_daily_unified GROUP BY date, location_id
      ) s ON s.date = ldu.day AND s.location_id = ldu.location_id
      LEFT JOIN (
        SELECT date, location_id, SUM(forecast_sales) AS forecast_sales, SUM(forecast_orders) AS forecast_orders
        FROM forecast_daily_metrics GROUP BY date, location_id
      ) fc ON fc.date = ldu.day AND fc.location_id = ldu.location_id
      WHERE ldu.day BETWEEN date_from AND date_to
        AND (selected_location_id IS NULL OR ldu.location_id = selected_location_id)
    ) d
  );
END;
$$;

-- Fix get_labour_locations_table to include forecast & field name alignment
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
        COALESCE(SUM(s.net_sales), 0)              AS sales_actual,
        COALESCE(SUM(fc.forecast_sales), 0)        AS sales_projected,
        CASE WHEN COALESCE(SUM(fc.forecast_sales), 0) > 0
          THEN ROUND((SUM(COALESCE(s.net_sales, 0)) - SUM(fc.forecast_sales)) / SUM(fc.forecast_sales) * 100, 1)
          ELSE 0 END                                AS sales_delta_pct,
        COALESCE(SUM(ldu.actual_cost), 0)          AS labor_cost_actual,
        COALESCE(SUM(ldu.scheduled_cost), 0)       AS labor_cost_projected,
        COALESCE(SUM(ldu.actual_hours), 0)         AS hours_actual,
        COALESCE(SUM(ldu.scheduled_hours), 0)      AS hours_projected,
        -- COL%
        CASE WHEN COALESCE(SUM(s.net_sales), 0) > 0
          THEN ROUND(SUM(COALESCE(ldu.actual_cost, 0)) / SUM(s.net_sales) * 100, 1)
          ELSE 0 END AS col_actual_pct,
        CASE WHEN COALESCE(SUM(fc.forecast_sales), 0) > 0
          THEN ROUND(SUM(COALESCE(ldu.scheduled_cost, 0)) / SUM(fc.forecast_sales) * 100, 1)
          ELSE 0 END AS col_projected_pct,
        CASE WHEN COALESCE(SUM(fc.forecast_sales), 0) > 0 AND COALESCE(SUM(s.net_sales), 0) > 0
          THEN ROUND(
            (SUM(COALESCE(ldu.actual_cost, 0)) / SUM(s.net_sales) * 100) -
            (SUM(COALESCE(ldu.scheduled_cost, 0)) / SUM(fc.forecast_sales) * 100),
          1) ELSE 0 END AS col_delta_pct,
        -- SPLH
        CASE WHEN COALESCE(SUM(ldu.actual_hours), 0) > 0
          THEN ROUND(SUM(COALESCE(s.net_sales, 0)) / SUM(ldu.actual_hours), 2)
          ELSE 0 END AS splh_actual,
        CASE WHEN COALESCE(SUM(ldu.scheduled_hours), 0) > 0
          THEN ROUND(SUM(COALESCE(fc.forecast_sales, 0)) / SUM(ldu.scheduled_hours), 2)
          ELSE 0 END AS splh_projected,
        CASE WHEN COALESCE(SUM(ldu.actual_hours), 0) > 0 AND COALESCE(SUM(ldu.scheduled_hours), 0) > 0 AND COALESCE(SUM(fc.forecast_sales), 0) > 0
          THEN ROUND(
            ((SUM(COALESCE(s.net_sales, 0)) / SUM(ldu.actual_hours)) - (SUM(COALESCE(fc.forecast_sales, 0)) / SUM(ldu.scheduled_hours)))
            / (SUM(COALESCE(fc.forecast_sales, 0)) / SUM(ldu.scheduled_hours)) * 100,
          1) ELSE 0 END AS splh_delta_pct,
        -- OPLH
        CASE WHEN COALESCE(SUM(ldu.actual_hours), 0) > 0
          THEN ROUND(SUM(COALESCE(s.orders_count, 0))::numeric / SUM(ldu.actual_hours), 2)
          ELSE 0 END AS oplh_actual,
        CASE WHEN COALESCE(SUM(ldu.scheduled_hours), 0) > 0
          THEN ROUND(SUM(COALESCE(fc.forecast_orders, 0))::numeric / SUM(ldu.scheduled_hours), 2)
          ELSE 0 END AS oplh_projected,
        CASE WHEN COALESCE(SUM(ldu.actual_hours), 0) > 0 AND COALESCE(SUM(ldu.scheduled_hours), 0) > 0 AND COALESCE(SUM(fc.forecast_orders), 0) > 0
          THEN ROUND(
            ((SUM(COALESCE(s.orders_count, 0))::numeric / SUM(ldu.actual_hours)) - (SUM(COALESCE(fc.forecast_orders, 0))::numeric / SUM(ldu.scheduled_hours)))
            / (SUM(COALESCE(fc.forecast_orders, 0))::numeric / SUM(ldu.scheduled_hours)) * 100,
          1) ELSE 0 END AS oplh_delta_pct,
        false AS is_summary
      FROM locations l
      LEFT JOIN labour_daily_unified ldu
        ON ldu.location_id = l.id AND ldu.day BETWEEN date_from AND date_to
      LEFT JOIN (
        SELECT date, location_id, SUM(net_sales) AS net_sales, SUM(orders_count) AS orders_count
        FROM sales_daily_unified GROUP BY date, location_id
      ) s ON s.date = ldu.day AND s.location_id = l.id
      LEFT JOIN (
        SELECT date, location_id, SUM(forecast_sales) AS forecast_sales, SUM(forecast_orders) AS forecast_orders
        FROM forecast_daily_metrics GROUP BY date, location_id
      ) fc ON fc.date = ldu.day AND fc.location_id = l.id
      WHERE (selected_location_id IS NULL OR l.id = selected_location_id)
        AND l.active = true
      GROUP BY l.id, l.name
    ) r
  );
END;
$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
