-- ============================================================
-- Schedule Efficiency Engine
-- calculate_schedule_efficiency RPC
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_schedule_efficiency(
  p_location_id uuid,
  p_week_start date,
  p_week_end date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_total_forecast_sales numeric := 0;
  v_total_scheduled_hours numeric := 0;
  v_total_scheduled_cost numeric := 0;
  v_target_labour_hours numeric := 0;
  v_target_cogs_pct numeric := 0;
  v_target_hourly_rate numeric := 0;
  v_splh numeric := 0;
  v_over_budget boolean := false;
  v_budget_variance_pct numeric := 0;
  v_target_cost numeric := 0;
  v_splh_goal numeric := 0;
  v_insights jsonb := '[]'::jsonb;
BEGIN
  -- 1. Get forecast sales for the week
  SELECT COALESCE(SUM(forecast_sales), 0)
  INTO v_total_forecast_sales
  FROM forecast_daily_metrics
  WHERE location_id = p_location_id
    AND date BETWEEN p_week_start AND p_week_end;

  -- 2. Get scheduled hours and cost from planned_shifts
  SELECT
    COALESCE(SUM(planned_hours), 0),
    COALESCE(SUM(planned_cost), 0)
  INTO v_total_scheduled_hours, v_total_scheduled_cost
  FROM planned_shifts
  WHERE location_id = p_location_id
    AND shift_date BETWEEN p_week_start AND p_week_end;

  -- 3. Get budget targets from budget_drivers (via budget_days)
  SELECT
    COALESCE(SUM(bd.target_labour_hours), 0),
    COALESCE(AVG(bd.target_cogs_pct), 0),
    COALESCE(AVG(bd.target_hourly_rate), 0)
  INTO v_target_labour_hours, v_target_cogs_pct, v_target_hourly_rate
  FROM budget_days bday
  JOIN budget_drivers bd ON bd.budget_day_id = bday.id
  WHERE bday.location_id = p_location_id
    AND bday.day BETWEEN p_week_start AND p_week_end;

  -- 4. Get SPLH goal from location_settings
  SELECT COALESCE(splh_goal, 50)
  INTO v_splh_goal
  FROM location_settings
  WHERE location_id = p_location_id;

  -- 5. Calculate SPLH
  IF v_total_scheduled_hours > 0 THEN
    v_splh := ROUND(v_total_forecast_sales / v_total_scheduled_hours, 2);
  END IF;

  -- 6. Calculate target cost and over_budget
  IF v_target_labour_hours > 0 AND v_target_hourly_rate > 0 THEN
    v_target_cost := v_target_labour_hours * v_target_hourly_rate;
  ELSE
    -- Fallback: use forecast sales * target COL%
    v_target_cost := v_total_forecast_sales * GREATEST(v_target_cogs_pct, 22) / 100;
  END IF;

  IF v_target_cost > 0 THEN
    v_budget_variance_pct := ROUND(
      ((v_total_scheduled_cost - v_target_cost) / v_target_cost) * 100, 1
    );
    v_over_budget := v_total_scheduled_cost > v_target_cost * 1.05;
  END IF;

  -- 7. Generate actionable insights
  IF v_splh > 0 AND v_splh < v_splh_goal THEN
    v_insights := v_insights || jsonb_build_object(
      'type', 'low_splh',
      'severity', 'warning',
      'message', format(
        'SPLH actual (€%s) está por debajo del objetivo (€%s). Considera optimizar la distribución de turnos.',
        v_splh, v_splh_goal
      ),
      'current_value', v_splh,
      'target_value', v_splh_goal
    );
  END IF;

  IF v_over_budget THEN
    v_insights := v_insights || jsonb_build_object(
      'type', 'over_budget',
      'severity', 'critical',
      'message', format(
        'Coste laboral programado (€%s) excede el presupuesto (€%s) en un %s%%. Sugerencia: revisa turnos fuera de horas pico.',
        ROUND(v_total_scheduled_cost, 0),
        ROUND(v_target_cost, 0),
        v_budget_variance_pct
      ),
      'scheduled_cost', v_total_scheduled_cost,
      'target_cost', v_target_cost,
      'variance_pct', v_budget_variance_pct
    );
  END IF;

  IF v_total_scheduled_hours > 0 AND v_target_labour_hours > 0
     AND v_total_scheduled_hours > v_target_labour_hours * 1.1 THEN
    v_insights := v_insights || jsonb_build_object(
      'type', 'excess_hours',
      'severity', 'info',
      'message', format(
        'Horas programadas (%sh) superan el objetivo (%sh). Considera redistribuir personal.',
        ROUND(v_total_scheduled_hours, 1),
        ROUND(v_target_labour_hours, 1)
      ),
      'scheduled_hours', v_total_scheduled_hours,
      'target_hours', v_target_labour_hours
    );
  END IF;

  -- Return structured result
  RETURN jsonb_build_object(
    'splh', v_splh,
    'splh_goal', v_splh_goal,
    'total_forecast_sales', v_total_forecast_sales,
    'total_scheduled_hours', v_total_scheduled_hours,
    'total_scheduled_cost', v_total_scheduled_cost,
    'target_labour_hours', v_target_labour_hours,
    'target_cogs_pct', v_target_cogs_pct,
    'target_cost', v_target_cost,
    'over_budget', v_over_budget,
    'budget_variance_pct', v_budget_variance_pct,
    'insights', v_insights
  );
END;
$$;
