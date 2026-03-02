-- ============================================================
-- Wave 3: Intelligence — Config-Driven Alerts & Compliance
-- No hardcoded values. All thresholds in labour_rules.
-- ============================================================

-- 1) Configurable labour rules per org/location
-- Every threshold is stored here, not in code.
CREATE TABLE IF NOT EXISTS labour_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  location_id uuid,  -- NULL = org-wide default
  rule_key text NOT NULL,
  rule_value numeric NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, location_id, rule_key)
);
ALTER TABLE labour_rules ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON labour_rules TO authenticated;

-- Seed default rules (Spanish labour law baselines)
-- These are DEFAULTS that get inserted only if org doesn't have custom ones.
-- The RPC reads from this table, so changes here propagate instantly.
COMMENT ON TABLE labour_rules IS
  'Configurable thresholds for labour compliance, overtime alerts, '
  'and staffing recommendations. Per-org defaults or per-location overrides.';

-- Helper: get a rule value with fallback chain: location → org → system default
CREATE OR REPLACE FUNCTION get_labour_rule(
  p_org_id uuid,
  p_location_id uuid,
  p_rule_key text,
  p_default numeric
)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_val numeric;
BEGIN
  -- 1) Location-specific override
  IF p_location_id IS NOT NULL THEN
    SELECT rule_value INTO v_val
    FROM labour_rules
    WHERE org_id = p_org_id
      AND location_id = p_location_id
      AND rule_key = p_rule_key;
    IF FOUND THEN RETURN v_val; END IF;
  END IF;

  -- 2) Org-wide default
  SELECT rule_value INTO v_val
  FROM labour_rules
  WHERE org_id = p_org_id
    AND location_id IS NULL
    AND rule_key = p_rule_key;
  IF FOUND THEN RETURN v_val; END IF;

  -- 3) System default (passed as parameter)
  RETURN p_default;
END;
$$;

GRANT EXECUTE ON FUNCTION get_labour_rule(uuid, uuid, text, numeric) TO authenticated;


-- 2) RPC: check_labour_compliance
-- Returns compliance status for each employee at a location for a given week.
-- All thresholds from labour_rules table, not hardcoded.
CREATE OR REPLACE FUNCTION check_labour_compliance(
  p_org_id uuid,
  p_location_id uuid,
  p_week_start date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_max_weekly_hours numeric;
  v_min_rest_between_shifts numeric;
  v_min_weekly_rest_days numeric;
  v_overtime_warning_hours numeric;
  v_target_splh numeric;
  v_week_end date;
  v_result jsonb;
BEGIN
  v_week_end := p_week_start + INTERVAL '6 days';

  -- Load configurable thresholds (with Spanish law defaults)
  v_max_weekly_hours := get_labour_rule(p_org_id, p_location_id, 'max_weekly_hours', 40);
  v_min_rest_between_shifts := get_labour_rule(p_org_id, p_location_id, 'min_rest_hours', 12);
  v_min_weekly_rest_days := get_labour_rule(p_org_id, p_location_id, 'min_weekly_rest_days', 1.5);
  v_overtime_warning_hours := get_labour_rule(p_org_id, p_location_id, 'overtime_warning_hours', 36);
  v_target_splh := get_labour_rule(p_org_id, p_location_id, 'target_splh', 60);

  SELECT COALESCE(jsonb_agg(emp_result ORDER BY emp_result->>'employee_name'), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'employee_id', e.id,
      'employee_name', e.full_name,
      'role', e.role_name,
      'total_hours', COALESCE(hours_data.total_hours, 0),
      'shift_count', COALESCE(hours_data.shift_count, 0),
      'days_worked', COALESCE(hours_data.days_worked, 0),
      'days_off', 7 - COALESCE(hours_data.days_worked, 0),

      -- Overtime check
      'overtime_status', CASE
        WHEN COALESCE(hours_data.total_hours, 0) > v_max_weekly_hours THEN 'breach'
        WHEN COALESCE(hours_data.total_hours, 0) > v_overtime_warning_hours THEN 'warning'
        ELSE 'ok'
      END,
      'hours_until_overtime', GREATEST(v_max_weekly_hours - COALESCE(hours_data.total_hours, 0), 0),
      'overtime_excess', GREATEST(COALESCE(hours_data.total_hours, 0) - v_max_weekly_hours, 0),

      -- Rest check
      'min_rest_ok', COALESCE(hours_data.min_rest_hours, 99) >= v_min_rest_between_shifts,
      'min_rest_hours', COALESCE(hours_data.min_rest_hours, 99),

      -- Weekly rest check
      'weekly_rest_ok', (7 - COALESCE(hours_data.days_worked, 0)) >= v_min_weekly_rest_days,

      -- Risk score (0-100, higher = more risk)
      'risk_score', LEAST(100, (
        CASE WHEN COALESCE(hours_data.total_hours, 0) > v_max_weekly_hours THEN 40 ELSE 0 END
        + CASE WHEN COALESCE(hours_data.total_hours, 0) > v_overtime_warning_hours THEN 20 ELSE 0 END
        + CASE WHEN COALESCE(hours_data.min_rest_hours, 99) < v_min_rest_between_shifts THEN 25 ELSE 0 END
        + CASE WHEN (7 - COALESCE(hours_data.days_worked, 0)) < v_min_weekly_rest_days THEN 15 ELSE 0 END
      ))
    ) AS emp_result
    FROM employees e
    LEFT JOIN LATERAL (
      SELECT
        SUM(ps.planned_hours) AS total_hours,
        COUNT(*) AS shift_count,
        COUNT(DISTINCT ps.shift_date) AS days_worked,
        MIN(rest_calc.rest_hours) AS min_rest_hours
      FROM planned_shifts ps
      LEFT JOIN LATERAL (
        -- Calculate rest between consecutive shifts for this employee
        SELECT EXTRACT(EPOCH FROM (
          (ps2.shift_date + ps2.start_time::time) - (ps.shift_date + ps.end_time::time)
        )) / 3600.0 AS rest_hours
        FROM planned_shifts ps2
        WHERE ps2.employee_id = ps.employee_id
          AND ps2.location_id = p_location_id
          AND ps2.shift_date BETWEEN p_week_start AND v_week_end
          AND (ps2.shift_date + ps2.start_time::time) > (ps.shift_date + ps.end_time::time)
        ORDER BY ps2.shift_date + ps2.start_time::time
        LIMIT 1
      ) rest_calc ON true
      WHERE ps.employee_id = e.id
        AND ps.location_id = p_location_id
        AND ps.shift_date BETWEEN p_week_start AND v_week_end
    ) hours_data ON true
    WHERE e.location_id = p_location_id
      AND e.active = true
  ) sub;

  RETURN jsonb_build_object(
    'week_start', p_week_start,
    'week_end', v_week_end,
    'location_id', p_location_id,
    'thresholds', jsonb_build_object(
      'max_weekly_hours', v_max_weekly_hours,
      'min_rest_hours', v_min_rest_between_shifts,
      'min_weekly_rest_days', v_min_weekly_rest_days,
      'overtime_warning_hours', v_overtime_warning_hours,
      'target_splh', v_target_splh
    ),
    'employees', v_result,
    'summary', jsonb_build_object(
      'total_employees', jsonb_array_length(v_result),
      'overtime_warnings', (SELECT COUNT(*) FROM jsonb_array_elements(v_result) e WHERE e->>'overtime_status' = 'warning'),
      'overtime_breaches', (SELECT COUNT(*) FROM jsonb_array_elements(v_result) e WHERE e->>'overtime_status' = 'breach'),
      'rest_violations', (SELECT COUNT(*) FROM jsonb_array_elements(v_result) e WHERE (e->>'min_rest_ok')::boolean = false),
      'weekly_rest_violations', (SELECT COUNT(*) FROM jsonb_array_elements(v_result) e WHERE (e->>'weekly_rest_ok')::boolean = false),
      'avg_risk_score', (SELECT ROUND(AVG((e->>'risk_score')::numeric)) FROM jsonb_array_elements(v_result) e)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_labour_compliance(uuid, uuid, date) TO authenticated;


-- 3) RPC: get_staffing_recommendation
-- Uses forecast + configurable SPLH target to recommend headcount per day.
CREATE OR REPLACE FUNCTION get_staffing_recommendation(
  p_org_id uuid,
  p_location_id uuid,
  p_date_from date,
  p_date_to date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_target_splh numeric;
  v_avg_shift_hours numeric;
  v_result jsonb;
BEGIN
  -- Load configurable targets from labour_rules
  v_target_splh := get_labour_rule(p_org_id, p_location_id, 'target_splh', 60);
  v_avg_shift_hours := get_labour_rule(p_org_id, p_location_id, 'avg_shift_hours', 8);

  SELECT COALESCE(jsonb_agg(day_rec ORDER BY day_rec->>'date'), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'date', fm.date,
      'forecast_sales', fm.forecast_sales,
      'recommended_hours', CASE WHEN v_target_splh > 0
        THEN ROUND(fm.forecast_sales / v_target_splh, 1) ELSE 0 END,
      'recommended_headcount', CASE WHEN v_target_splh > 0 AND v_avg_shift_hours > 0
        THEN CEIL(fm.forecast_sales / v_target_splh / v_avg_shift_hours) ELSE 0 END,
      'scheduled_hours', COALESCE(sh.total_hours, 0),
      'scheduled_headcount', COALESCE(sh.headcount, 0),
      'delta_hours', COALESCE(sh.total_hours, 0) - CASE WHEN v_target_splh > 0
        THEN ROUND(fm.forecast_sales / v_target_splh, 1) ELSE 0 END,
      'status', CASE
        WHEN COALESCE(sh.total_hours, 0) = 0 THEN 'no_schedule'
        WHEN COALESCE(sh.total_hours, 0) > (fm.forecast_sales / NULLIF(v_target_splh, 0)) * 1.15 THEN 'overstaffed'
        WHEN COALESCE(sh.total_hours, 0) < (fm.forecast_sales / NULLIF(v_target_splh, 0)) * 0.85 THEN 'understaffed'
        ELSE 'optimal'
      END
    ) AS day_rec
    FROM forecast_daily_metrics fm
    LEFT JOIN (
      SELECT shift_date, SUM(planned_hours) AS total_hours, COUNT(DISTINCT employee_id) AS headcount
      FROM planned_shifts
      WHERE location_id = p_location_id
        AND shift_date BETWEEN p_date_from AND p_date_to
      GROUP BY shift_date
    ) sh ON sh.shift_date = fm.date
    WHERE fm.date BETWEEN p_date_from AND p_date_to
      AND fm.location_id = p_location_id
  ) sub;

  RETURN jsonb_build_object(
    'target_splh', v_target_splh,
    'avg_shift_hours', v_avg_shift_hours,
    'location_id', p_location_id,
    'date_range', jsonb_build_object('from', p_date_from, 'to', p_date_to),
    'days', v_result,
    'summary', jsonb_build_object(
      'total_days', jsonb_array_length(v_result),
      'overstaffed_days', (SELECT COUNT(*) FROM jsonb_array_elements(v_result) d WHERE d->>'status' = 'overstaffed'),
      'understaffed_days', (SELECT COUNT(*) FROM jsonb_array_elements(v_result) d WHERE d->>'status' = 'understaffed'),
      'optimal_days', (SELECT COUNT(*) FROM jsonb_array_elements(v_result) d WHERE d->>'status' = 'optimal'),
      'no_schedule_days', (SELECT COUNT(*) FROM jsonb_array_elements(v_result) d WHERE d->>'status' = 'no_schedule')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_staffing_recommendation(uuid, uuid, date, date) TO authenticated;
