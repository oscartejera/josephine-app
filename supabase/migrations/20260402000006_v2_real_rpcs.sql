-- ═══════════════════════════════════════════════════════════════════════════
-- V2 REAL RPCs — replace stubs with working functions
-- Created: 2026-04-02
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. PAYROLL FORECAST ────────────────────────────────────────────────
-- Returns full month projection with per-employee breakdown.
-- Matches ForecastData interface in PayrollForecast.tsx

CREATE OR REPLACE FUNCTION get_payroll_forecast(
  p_org_id uuid, p_location_id uuid, p_year int, p_month int
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_first_day  date;
  v_last_day   date;
  v_today      date := CURRENT_DATE;
  v_total_days int;
  v_elapsed    int;
  v_remaining  int;
  v_budget     numeric := 0;
  v_worked_h   numeric := 0;
  v_worked_c   numeric := 0;
  v_remain_h   numeric := 0;
  v_remain_c   numeric := 0;
  v_proj_cost  numeric;
  v_daily_rate numeric;
  v_per_emp    jsonb;
BEGIN
  v_first_day := make_date(p_year, p_month, 1);
  v_last_day  := (v_first_day + interval '1 month' - interval '1 day')::date;
  v_total_days := EXTRACT(DAY FROM v_last_day)::int;
  v_elapsed := LEAST(GREATEST((v_today - v_first_day + 1)::int, 0), v_total_days);
  v_remaining := v_total_days - v_elapsed;

  -- Budget for the month (try 'day' first, fallback to 'date')
  BEGIN
    SELECT COALESCE(SUM(budget_labour), 0) INTO v_budget
    FROM budget_daily_unified
    WHERE location_id = p_location_id AND day BETWEEN v_first_day AND v_last_day;
  EXCEPTION WHEN undefined_column THEN
    SELECT COALESCE(SUM(budget_labour), 0) INTO v_budget
    FROM budget_daily_unified
    WHERE location_id = p_location_id AND date BETWEEN v_first_day AND v_last_day;
  END;

  -- Per-employee aggregation
  WITH emp_shifts AS (
    SELECT
      ps.employee_id,
      e.full_name,
      e.role_name,
      COALESCE(e.hourly_cost, 12) AS hourly_cost,
      SUM(CASE WHEN ps.shift_date <= v_today THEN ps.planned_hours ELSE 0 END) AS worked_hours,
      SUM(CASE WHEN ps.shift_date > v_today  THEN ps.planned_hours ELSE 0 END) AS remaining_hours
    FROM planned_shifts ps
    JOIN employees e ON e.id = ps.employee_id
    WHERE ps.location_id = p_location_id
      AND ps.shift_date BETWEEN v_first_day AND v_last_day
    GROUP BY ps.employee_id, e.full_name, e.role_name, e.hourly_cost
  )
  SELECT
    COALESCE(SUM(worked_hours), 0),
    COALESCE(SUM(worked_hours * hourly_cost), 0),
    COALESCE(SUM(remaining_hours), 0),
    COALESCE(SUM(remaining_hours * hourly_cost), 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'employee_id', employee_id,
      'employee_name', full_name,
      'role', COALESCE(role_name, 'Staff'),
      'worked_hours', ROUND(worked_hours, 1),
      'remaining_hours', ROUND(remaining_hours, 1),
      'total_hours', ROUND(worked_hours + remaining_hours, 1),
      'projected_cost', ROUND((worked_hours + remaining_hours) * hourly_cost, 0)
    ) ORDER BY (worked_hours + remaining_hours) DESC), '[]'::jsonb)
  INTO v_worked_h, v_worked_c, v_remain_h, v_remain_c, v_per_emp
  FROM emp_shifts;

  v_proj_cost := v_worked_c + v_remain_c;
  v_daily_rate := CASE WHEN v_elapsed > 0 THEN ROUND(v_worked_c / v_elapsed, 0) ELSE 0 END;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('year', p_year, 'month', p_month),
    'days', jsonb_build_object('total', v_total_days, 'elapsed', v_elapsed, 'remaining', v_remaining),
    'worked', jsonb_build_object('hours', ROUND(v_worked_h, 1), 'cost', ROUND(v_worked_c, 0)),
    'remaining', jsonb_build_object('hours', ROUND(v_remain_h, 1), 'cost', ROUND(v_remain_c, 0)),
    'projected', jsonb_build_object('total_cost', ROUND(v_proj_cost, 0), 'daily_run_rate', v_daily_rate),
    'budget', jsonb_build_object(
      'amount', ROUND(v_budget, 0),
      'pct_used', CASE WHEN v_budget > 0 THEN ROUND(v_worked_c / v_budget * 100, 1) ELSE NULL END,
      'pct_projected', CASE WHEN v_budget > 0 THEN ROUND(v_proj_cost / v_budget * 100, 1) ELSE NULL END,
      'status', CASE
        WHEN v_budget = 0 THEN 'no_budget'
        WHEN v_proj_cost <= v_budget THEN 'on_track'
        WHEN v_proj_cost <= v_budget * 1.1 THEN 'warning'
        ELSE 'over_budget'
      END
    ),
    'per_employee', v_per_emp
  );
END;$$;


-- ─── 2. STAFFING HEATMAP ────────────────────────────────────────────────
-- Returns avg sales, staff count, SPLH per day-of-week with status.
-- Matches HeatmapData interface in StaffingHeatmap.tsx

CREATE OR REPLACE FUNCTION get_staffing_heatmap(
  p_org_id uuid, p_location_id uuid, p_weeks_back int DEFAULT 4
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_from      date;
  v_to        date := CURRENT_DATE;
  v_target    numeric := 25; -- realistic SPLH for Spanish mid-market restaurants
  v_days      jsonb;
  v_summary   jsonb;
  v_over      int := 0;
  v_under     int := 0;
  v_optimal   int := 0;
  v_savings   numeric := 0;
  v_day_names text[] := ARRAY['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
BEGIN
  v_from := v_to - (p_weeks_back * 7);

  -- Try to get target SPLH from labour_rules
  BEGIN
    SELECT get_labour_rule(p_org_id, p_location_id, 'target_splh', 25) INTO v_target;
  EXCEPTION WHEN OTHERS THEN
    v_target := 25;
  END;

  WITH day_stats AS (
    SELECT
      EXTRACT(DOW FROM ds.day)::int AS dow,
      AVG(ds.net_sales) AS avg_sales,
      -- Count distinct employees with shifts on each day
      AVG(shift_counts.staff_count) AS avg_staff,
      CASE
        WHEN AVG(shift_counts.staff_count) > 0 AND AVG(shift_counts.total_hours) > 0
        THEN AVG(ds.net_sales) / AVG(shift_counts.total_hours)
        ELSE 0
      END AS avg_splh
    FROM daily_sales ds
    LEFT JOIN LATERAL (
      SELECT
        ps.shift_date,
        COUNT(DISTINCT ps.employee_id) AS staff_count,
        SUM(ps.planned_hours) AS total_hours
      FROM planned_shifts ps
      WHERE ps.location_id = p_location_id
        AND ps.shift_date = ds.day
      GROUP BY ps.shift_date
    ) shift_counts ON TRUE
    WHERE ds.location_id = p_location_id
      AND ds.day BETWEEN v_from AND v_to
    GROUP BY EXTRACT(DOW FROM ds.day)
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'day_of_week', dow,
      'day_name', v_day_names[dow + 1],
      'avg_daily_sales', ROUND(avg_sales, 0),
      'avg_staff_count', ROUND(COALESCE(avg_staff, 0), 1),
      'avg_daily_splh', ROUND(COALESCE(avg_splh, 0), 0),
      'status', CASE
        WHEN COALESCE(avg_staff, 0) = 0 THEN 'no_data'
        WHEN avg_splh >= v_target * 0.9 AND avg_splh <= v_target * 1.1 THEN 'optimal'
        WHEN avg_splh < v_target * 0.9 THEN 'overstaffed'
        ELSE 'understaffed'
      END
    ) ORDER BY CASE WHEN dow = 0 THEN 7 ELSE dow END  -- Mon-Sun order
  )
  INTO v_days
  FROM day_stats;

  -- Defaults if no data
  IF v_days IS NULL THEN
    v_days := '[]'::jsonb;
  END IF;

  -- Calculate summary
  SELECT
    COUNT(*) FILTER (WHERE (el->>'status') = 'overstaffed'),
    COUNT(*) FILTER (WHERE (el->>'status') = 'understaffed'),
    COUNT(*) FILTER (WHERE (el->>'status') = 'optimal')
  INTO v_over, v_under, v_optimal
  FROM jsonb_array_elements(v_days) el;

  -- Estimate potential savings: for overstaffed days, calculate excess cost
  SELECT COALESCE(SUM(
    GREATEST(0, (el->>'avg_staff_count')::numeric - ((el->>'avg_daily_sales')::numeric / v_target / 8)) * 8 * 12 * 4
  ), 0)
  INTO v_savings
  FROM jsonb_array_elements(v_days) el
  WHERE (el->>'status') = 'overstaffed';

  v_summary := jsonb_build_object(
    'overstaffed_days', v_over,
    'understaffed_days', v_under,
    'optimal_days', v_optimal,
    'potential_savings', ROUND(v_savings, 0)
  );

  RETURN jsonb_build_object(
    'target_splh', v_target,
    'operating_hours', jsonb_build_object('open', 10, 'close', 23),
    'days', v_days,
    'summary', v_summary
  );
END;$$;


-- ─── 3. EMPLOYEE REVENUE SCORES ─────────────────────────────────────────
-- Revenue per hour per employee, ranking, percentile
-- Used by the Performance tab / RevPAE widget

CREATE OR REPLACE FUNCTION get_employee_revenue_scores(
  p_org_id uuid, p_location_id uuid, p_from date, p_to date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_scores jsonb;
  v_total_sales numeric;
BEGIN
  -- Total sales for the period
  SELECT COALESCE(SUM(net_sales), 0) INTO v_total_sales
  FROM daily_sales
  WHERE location_id = p_location_id AND day BETWEEN p_from AND p_to;

  WITH emp_hours AS (
    SELECT
      ecr.employee_id,
      e.full_name,
      e.role_name,
      COALESCE(e.hourly_cost, 12) AS hourly_cost,
      SUM(
        EXTRACT(EPOCH FROM (COALESCE(ecr.clock_out, ecr.clock_in + interval '8 hours') - ecr.clock_in)) / 3600.0
      ) AS total_hours
    FROM employee_clock_records ecr
    JOIN employees e ON e.id = ecr.employee_id
    WHERE ecr.location_id = p_location_id
      AND ecr.clock_in::date BETWEEN p_from AND p_to
    GROUP BY ecr.employee_id, e.full_name, e.role_name, e.hourly_cost
  ),
  ranked AS (
    SELECT *,
      CASE WHEN total_hours > 0 THEN v_total_sales * (total_hours / SUM(total_hours) OVER ()) / total_hours ELSE 0 END AS revenue_per_hour,
      total_hours * hourly_cost AS total_cost,
      RANK() OVER (ORDER BY total_hours DESC) AS rank_hours,
      PERCENT_RANK() OVER (ORDER BY total_hours DESC) AS percentile
    FROM emp_hours
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'employee_id', employee_id,
    'employee_name', full_name,
    'role', COALESCE(role_name, 'Staff'),
    'total_hours', ROUND(total_hours, 1),
    'total_cost', ROUND(total_cost, 0),
    'revenue_per_hour', ROUND(revenue_per_hour, 2),
    'rank', rank_hours,
    'percentile', ROUND(percentile::numeric * 100, 0),
    'efficiency_ratio', CASE WHEN hourly_cost > 0 THEN ROUND(revenue_per_hour / hourly_cost, 2) ELSE 0 END
  ) ORDER BY revenue_per_hour DESC), '[]'::jsonb)
  INTO v_scores
  FROM ranked;

  RETURN jsonb_build_object(
    'location_id', p_location_id,
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'total_sales', v_total_sales,
    'scores', v_scores
  );
END;$$;


-- ─── 4. STAFFING RECOMMENDATION ─────────────────────────────────────────
-- Suggests optimal staffing per day based on sales patterns and target SPLH

CREATE OR REPLACE FUNCTION get_staffing_recommendation(
  p_org_id uuid, p_location_id uuid, p_from date, p_to date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_target_splh numeric := 25;
  v_days jsonb;
BEGIN
  -- Get target SPLH
  BEGIN
    SELECT get_labour_rule(p_org_id, p_location_id, 'target_splh', 25) INTO v_target_splh;
  EXCEPTION WHEN OTHERS THEN
    v_target_splh := 25;
  END;

  WITH daily_data AS (
    SELECT
      ds.day AS the_date,
      ds.net_sales,
      COALESCE(shifts.staff_count, 0) AS current_staff,
      COALESCE(shifts.total_hours, 0) AS current_hours,
      -- Optimal staff = sales / (target_splh * avg_shift_hours)
      CASE WHEN v_target_splh > 0
        THEN CEIL(ds.net_sales / (v_target_splh * 8))
        ELSE 0
      END AS recommended_staff,
      CASE WHEN COALESCE(shifts.total_hours, 0) > 0
        THEN ds.net_sales / shifts.total_hours
        ELSE 0
      END AS actual_splh
    FROM daily_sales ds
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT ps.employee_id) AS staff_count,
        SUM(ps.planned_hours) AS total_hours
      FROM planned_shifts ps
      WHERE ps.location_id = p_location_id AND ps.shift_date = ds.day
    ) shifts ON TRUE
    WHERE ds.location_id = p_location_id
      AND ds.day BETWEEN p_from AND p_to
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', the_date,
    'sales', ROUND(net_sales, 0),
    'current_staff', current_staff,
    'current_hours', ROUND(current_hours, 1),
    'recommended_staff', recommended_staff,
    'actual_splh', ROUND(actual_splh, 0),
    'target_splh', v_target_splh,
    'delta_staff', recommended_staff - current_staff,
    'action', CASE
      WHEN current_staff = 0 THEN 'no_data'
      WHEN current_staff > recommended_staff THEN 'reduce'
      WHEN current_staff < recommended_staff THEN 'increase'
      ELSE 'optimal'
    END
  ) ORDER BY the_date), '[]'::jsonb)
  INTO v_days
  FROM daily_data;

  RETURN jsonb_build_object(
    'location_id', p_location_id,
    'target_splh', v_target_splh,
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'days', COALESCE(v_days, '[]'::jsonb)
  );
END;$$;


-- ─── 5. AUTOMATED COGS ──────────────────────────────────────────────────
-- Calculates COGS from stock_movements (purchases) or estimates from sales

CREATE OR REPLACE FUNCTION compute_cogs_daily(
  p_location_id uuid, p_date date
) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cogs numeric := 0;
  v_sales numeric := 0;
BEGIN
  -- Try actual purchases from stock_movements
  SELECT COALESCE(SUM(ABS(qty_delta) * COALESCE(unit_cost, 0)), 0) INTO v_cogs
  FROM stock_movements
  WHERE location_id = p_location_id
    AND created_at::date = p_date
    AND movement_type = 'purchase';

  -- If no purchase data, estimate as 32% of sales (industry benchmark)
  IF v_cogs = 0 THEN
    SELECT COALESCE(net_sales, 0) INTO v_sales
    FROM daily_sales
    WHERE location_id = p_location_id AND day = p_date;

    v_cogs := v_sales * 0.32;
  END IF;

  -- Upsert into cogs_daily
  INSERT INTO cogs_daily (location_id, date, cogs_amount)
  VALUES (p_location_id, p_date, v_cogs)
  ON CONFLICT (location_id, date)
  DO UPDATE SET cogs_amount = EXCLUDED.cogs_amount;

  RETURN v_cogs;
END;$$;


-- Backfill COGS for all locations in an org
CREATE OR REPLACE FUNCTION backfill_cogs_daily(p_org_id uuid, p_days int DEFAULT 90)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_loc record;
  v_date date;
  v_total int := 0;
  v_total_cogs numeric := 0;
BEGIN
  FOR v_loc IN SELECT id FROM locations WHERE group_id = p_org_id LOOP
    FOR v_date IN SELECT generate_series(CURRENT_DATE - p_days, CURRENT_DATE, '1 day'::interval)::date LOOP
      v_total_cogs := v_total_cogs + compute_cogs_daily(v_loc.id, v_date);
      v_total := v_total + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'org_id', p_org_id,
    'days_processed', v_total,
    'total_cogs', ROUND(v_total_cogs, 2)
  );
END;$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION get_payroll_forecast(uuid, uuid, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_staffing_heatmap(uuid, uuid, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_employee_revenue_scores(uuid, uuid, date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_staffing_recommendation(uuid, uuid, date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION compute_cogs_daily(uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION backfill_cogs_daily(uuid, int) TO anon, authenticated;
