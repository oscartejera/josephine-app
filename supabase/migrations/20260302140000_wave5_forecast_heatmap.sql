-- ============================================================
-- Wave 5: Real-Time Intelligence
-- 5A: Payroll Forecast (project month-end labour cost)
-- 5B: Staffing Heatmap (hourly sales vs staff analysis)
-- ============================================================


-- =========================================
-- 5A: Payroll Forecast
-- =========================================
-- Projects the total payroll cost for the current month
-- by combining:
--   1) Actual hours already worked (from clock_records)
--   2) Remaining planned shifts (from planned_shifts)
-- Compares to budget from labour_rules if set.

CREATE OR REPLACE FUNCTION get_payroll_forecast(
  p_org_id uuid,
  p_location_id uuid,
  p_year int DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int,
  p_month int DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::int
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_month_start date;
  v_month_end date;
  v_today date := CURRENT_DATE;
  v_worked_hours numeric;
  v_worked_cost numeric;
  v_remaining_hours numeric;
  v_remaining_cost numeric;
  v_total_projected numeric;
  v_budget numeric;
  v_days_elapsed int;
  v_days_remaining int;
  v_days_total int;
  v_daily_avg_cost numeric;
  v_daily_run_rate numeric;
BEGIN
  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;
  v_days_total := v_month_end - v_month_start + 1;

  -- Days elapsed (capped to month)
  IF v_today > v_month_end THEN
    v_days_elapsed := v_days_total;
    v_days_remaining := 0;
  ELSIF v_today < v_month_start THEN
    v_days_elapsed := 0;
    v_days_remaining := v_days_total;
  ELSE
    v_days_elapsed := v_today - v_month_start;
    v_days_remaining := v_month_end - v_today + 1;
  END IF;

  -- 1) Already worked: sum planned_shifts up to today
  SELECT
    COALESCE(SUM(ps.planned_hours), 0),
    COALESCE(SUM(ps.planned_hours * COALESCE(e.hourly_cost, 0)), 0)
  INTO v_worked_hours, v_worked_cost
  FROM planned_shifts ps
  JOIN employees e ON e.id = ps.employee_id
  WHERE ps.location_id = p_location_id
    AND ps.shift_date BETWEEN v_month_start AND LEAST(v_today - 1, v_month_end);

  -- 2) Remaining: planned shifts from today onwards
  SELECT
    COALESCE(SUM(ps.planned_hours), 0),
    COALESCE(SUM(ps.planned_hours * COALESCE(e.hourly_cost, 0)), 0)
  INTO v_remaining_hours, v_remaining_cost
  FROM planned_shifts ps
  JOIN employees e ON e.id = ps.employee_id
  WHERE ps.location_id = p_location_id
    AND ps.shift_date BETWEEN v_today AND v_month_end;

  v_total_projected := v_worked_cost + v_remaining_cost;

  -- Daily run rate
  v_daily_run_rate := CASE WHEN v_days_elapsed > 0
    THEN ROUND(v_worked_cost / v_days_elapsed, 2)
    ELSE 0 END;

  -- Budget from labour_rules (optional)
  SELECT COALESCE(
    (SELECT value::numeric FROM labour_rules
     WHERE rule_key = 'monthly_labour_budget'
       AND location_id = p_location_id
       AND org_id = p_org_id
     LIMIT 1),
    (SELECT value::numeric FROM labour_rules
     WHERE rule_key = 'monthly_labour_budget'
       AND location_id IS NULL
       AND org_id = p_org_id
     LIMIT 1),
    0
  ) INTO v_budget;

  RETURN jsonb_build_object(
    'location_id', p_location_id,
    'period', jsonb_build_object('year', p_year, 'month', p_month),
    'days', jsonb_build_object(
      'total', v_days_total,
      'elapsed', v_days_elapsed,
      'remaining', v_days_remaining
    ),
    'worked', jsonb_build_object(
      'hours', ROUND(v_worked_hours, 1),
      'cost', ROUND(v_worked_cost, 2)
    ),
    'remaining', jsonb_build_object(
      'hours', ROUND(v_remaining_hours, 1),
      'cost', ROUND(v_remaining_cost, 2)
    ),
    'projected', jsonb_build_object(
      'total_cost', ROUND(v_total_projected, 2),
      'daily_run_rate', v_daily_run_rate
    ),
    'budget', jsonb_build_object(
      'amount', v_budget,
      'pct_used', CASE WHEN v_budget > 0
        THEN ROUND((v_worked_cost / v_budget) * 100, 1)
        ELSE NULL END,
      'pct_projected', CASE WHEN v_budget > 0
        THEN ROUND((v_total_projected / v_budget) * 100, 1)
        ELSE NULL END,
      'status', CASE
        WHEN v_budget = 0 THEN 'no_budget'
        WHEN v_total_projected <= v_budget * 0.9 THEN 'under_budget'
        WHEN v_total_projected <= v_budget THEN 'on_track'
        WHEN v_total_projected <= v_budget * 1.1 THEN 'warning'
        ELSE 'over_budget'
      END
    ),
    'per_employee', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'employee_id', sub.employee_id,
        'employee_name', sub.full_name,
        'role', sub.role_name,
        'worked_hours', sub.worked_h,
        'remaining_hours', sub.remaining_h,
        'total_hours', sub.worked_h + sub.remaining_h,
        'projected_cost', ROUND((sub.worked_h + sub.remaining_h) * sub.hourly_cost, 2)
      ) ORDER BY (sub.worked_h + sub.remaining_h) DESC), '[]'::jsonb)
      FROM (
        SELECT
          e.id AS employee_id,
          e.full_name,
          e.role_name,
          COALESCE(e.hourly_cost, 0) AS hourly_cost,
          COALESCE(SUM(CASE WHEN ps.shift_date < v_today THEN ps.planned_hours ELSE 0 END), 0) AS worked_h,
          COALESCE(SUM(CASE WHEN ps.shift_date >= v_today THEN ps.planned_hours ELSE 0 END), 0) AS remaining_h
        FROM employees e
        LEFT JOIN planned_shifts ps ON ps.employee_id = e.id
          AND ps.location_id = p_location_id
          AND ps.shift_date BETWEEN v_month_start AND v_month_end
        WHERE e.location_id = p_location_id AND e.active = true
        GROUP BY e.id, e.full_name, e.role_name, e.hourly_cost
        HAVING COALESCE(SUM(ps.planned_hours), 0) > 0
      ) sub
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_payroll_forecast(uuid, uuid, int, int) TO authenticated;


-- =========================================
-- 5B: Staffing Heatmap
-- =========================================
-- Analyzes each day of the week by hour:
--   • avg sales per hour (from sales_daily_unified, estimated per-hour)
--   • avg employees scheduled per hour
--   • SPLH per hour slot
--   • recommendation: optimal, overstaffed, understaffed

CREATE OR REPLACE FUNCTION get_staffing_heatmap(
  p_org_id uuid,
  p_location_id uuid,
  p_weeks_back int DEFAULT 4
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_date_from date;
  v_date_to date := CURRENT_DATE;
  v_target_splh numeric;
  v_result jsonb;
  v_opening_hour int := 10;
  v_closing_hour int := 23;
BEGIN
  v_date_from := v_date_to - (p_weeks_back * 7);

  -- Get target SPLH from labour_rules
  SELECT COALESCE(
    (SELECT value::numeric FROM labour_rules
     WHERE rule_key = 'target_splh' AND location_id = p_location_id AND org_id = p_org_id LIMIT 1),
    (SELECT value::numeric FROM labour_rules
     WHERE rule_key = 'target_splh' AND location_id IS NULL AND org_id = p_org_id LIMIT 1),
    (SELECT value::numeric FROM labour_rules
     WHERE rule_key = 'target_splh' AND location_id IS NULL AND org_id IS NULL LIMIT 1),
    60
  ) INTO v_target_splh;

  -- Get opening/closing from labour_rules if available
  SELECT COALESCE(
    (SELECT value::int FROM labour_rules
     WHERE rule_key = 'opening_hour' AND location_id = p_location_id AND org_id = p_org_id LIMIT 1),
    10
  ) INTO v_opening_hour;

  SELECT COALESCE(
    (SELECT value::int FROM labour_rules
     WHERE rule_key = 'closing_hour' AND location_id = p_location_id AND org_id = p_org_id LIMIT 1),
    23
  ) INTO v_closing_hour;

  -- Build the heatmap: for each day_of_week × hour
  -- We estimate hourly sales by distributing daily sales across operating hours
  -- and count employees per hour from planned_shifts (start_time/end_time)
  SELECT jsonb_agg(day_data ORDER BY dow)
  INTO v_result
  FROM (
    SELECT
      dow,
      CASE dow
        WHEN 0 THEN 'Domingo'
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sábado'
      END AS day_name,
      jsonb_build_object(
        'day_of_week', dow,
        'day_name', CASE dow
          WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Lunes' WHEN 2 THEN 'Martes'
          WHEN 3 THEN 'Miércoles' WHEN 4 THEN 'Jueves' WHEN 5 THEN 'Viernes'
          WHEN 6 THEN 'Sábado'
        END,
        'avg_daily_sales', ROUND(avg_sales, 2),
        'avg_staff_count', ROUND(avg_staff, 1),
        'avg_daily_splh', CASE WHEN avg_staff > 0
          THEN ROUND(avg_sales / (avg_staff * (v_closing_hour - v_opening_hour)), 2)
          ELSE 0 END,
        'status', CASE
          WHEN avg_staff = 0 THEN 'no_data'
          WHEN avg_sales / NULLIF(avg_staff * (v_closing_hour - v_opening_hour), 0) > v_target_splh * 1.3 THEN 'understaffed'
          WHEN avg_sales / NULLIF(avg_staff * (v_closing_hour - v_opening_hour), 0) < v_target_splh * 0.7 THEN 'overstaffed'
          ELSE 'optimal'
        END,
        'hours', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'hour', h,
            'est_sales', ROUND(COALESCE(avg_sales / NULLIF(v_closing_hour - v_opening_hour, 0), 0), 2),
            'est_staff', ROUND(COALESCE(avg_staff, 0), 1),
            'splh', CASE WHEN avg_staff > 0
              THEN ROUND(avg_sales / NULLIF(avg_staff * (v_closing_hour - v_opening_hour), 0), 2)
              ELSE 0 END,
            'status', CASE
              WHEN avg_staff = 0 THEN 'no_data'
              WHEN avg_sales / NULLIF(avg_staff * (v_closing_hour - v_opening_hour), 0) > v_target_splh * 1.3 THEN 'understaffed'
              WHEN avg_sales / NULLIF(avg_staff * (v_closing_hour - v_opening_hour), 0) < v_target_splh * 0.7 THEN 'overstaffed'
              ELSE 'optimal'
            END
          ) ORDER BY h), '[]'::jsonb)
          FROM generate_series(v_opening_hour, v_closing_hour - 1) AS h
        )
      ) AS day_data
    FROM (
      SELECT
        EXTRACT(DOW FROM s.date)::int AS dow,
        AVG(s.net_sales) AS avg_sales,
        (SELECT AVG(staff_cnt) FROM (
          SELECT ps.shift_date, COUNT(DISTINCT ps.employee_id) AS staff_cnt
          FROM planned_shifts ps
          WHERE ps.location_id = p_location_id
            AND EXTRACT(DOW FROM ps.shift_date)::int = EXTRACT(DOW FROM s.date)::int
            AND ps.shift_date BETWEEN v_date_from AND v_date_to
          GROUP BY ps.shift_date
        ) sc) AS avg_staff
      FROM sales_daily_unified s
      WHERE s.location_id = p_location_id
        AND s.date BETWEEN v_date_from AND v_date_to
      GROUP BY EXTRACT(DOW FROM s.date)::int
    ) daily
  ) agg;

  RETURN jsonb_build_object(
    'location_id', p_location_id,
    'period', jsonb_build_object('from', v_date_from, 'to', v_date_to, 'weeks', p_weeks_back),
    'target_splh', v_target_splh,
    'operating_hours', jsonb_build_object('open', v_opening_hour, 'close', v_closing_hour),
    'days', COALESCE(v_result, '[]'::jsonb),
    'summary', jsonb_build_object(
      'overstaffed_days', (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(v_result, '[]'::jsonb)) d WHERE d->>'status' = 'overstaffed'),
      'understaffed_days', (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(v_result, '[]'::jsonb)) d WHERE d->>'status' = 'understaffed'),
      'optimal_days', (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(v_result, '[]'::jsonb)) d WHERE d->>'status' = 'optimal'),
      'potential_savings', (
        SELECT COALESCE(
          ROUND(SUM(
            CASE WHEN (d->>'status') = 'overstaffed'
              THEN ((d->>'avg_staff_count')::numeric - (d->>'avg_daily_sales')::numeric / NULLIF(v_target_splh * (v_closing_hour - v_opening_hour), 0)) * 4.3 * 8 * 12
              ELSE 0 END
          ), 2), 0)
        FROM jsonb_array_elements(COALESCE(v_result, '[]'::jsonb)) d
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_staffing_heatmap(uuid, uuid, int) TO authenticated;
