-- ============================================================
-- Wave 4: Advanced — Employee Revenue Score + Tip Distribution
-- All thresholds configurable via labour_rules table.
-- ============================================================

-- 1) RPC: get_employee_revenue_scores
-- Cross-references sales per day with employee shifts to estimate
-- revenue generated during each employee's working hours.
CREATE OR REPLACE FUNCTION get_employee_revenue_scores(
  p_org_id uuid,
  p_location_id uuid,
  p_date_from date,
  p_date_to date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_total_sales numeric;
BEGIN
  -- Total sales for the period at this location
  SELECT COALESCE(SUM(net_sales), 0) INTO v_total_sales
  FROM sales_daily_unified
  WHERE location_id = p_location_id
    AND date BETWEEN p_date_from AND p_date_to;

  -- Per-employee: sum hours worked, estimate revenue share by hour-weight
  SELECT COALESCE(jsonb_agg(emp ORDER BY (emp->>'revenue_share')::numeric DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'employee_id', e.id,
      'employee_name', e.full_name,
      'role', e.role_name,
      'hourly_cost', COALESCE(e.hourly_cost, 0),
      'total_hours', COALESCE(sh.total_hours, 0),
      'shift_count', COALESCE(sh.shift_count, 0),

      -- Revenue attribution: proportional to hours worked vs total hours
      'revenue_share', CASE WHEN total_hours_all.total > 0
        THEN ROUND(v_total_sales * COALESCE(sh.total_hours, 0) / total_hours_all.total, 2)
        ELSE 0 END,

      -- SPLH per employee
      'splh', CASE WHEN COALESCE(sh.total_hours, 0) > 0 AND total_hours_all.total > 0
        THEN ROUND((v_total_sales * COALESCE(sh.total_hours, 0) / total_hours_all.total) / sh.total_hours, 2)
        ELSE 0 END,

      -- Labor cost per employee
      'total_cost', ROUND(COALESCE(sh.total_hours, 0) * COALESCE(e.hourly_cost, 0), 2),

      -- ROI: revenue_share / total_cost
      'roi', CASE WHEN COALESCE(sh.total_hours, 0) * COALESCE(e.hourly_cost, 0) > 0
        THEN ROUND(
          (v_total_sales * COALESCE(sh.total_hours, 0) / NULLIF(total_hours_all.total, 0))
          / (sh.total_hours * e.hourly_cost), 2)
        ELSE 0 END,

      -- Trend placeholder (to be enriched with historical comparison)
      'trend', 'stable'
    ) AS emp
    FROM employees e
    LEFT JOIN (
      SELECT employee_id,
             SUM(planned_hours) AS total_hours,
             COUNT(*) AS shift_count
      FROM planned_shifts
      WHERE location_id = p_location_id
        AND shift_date BETWEEN p_date_from AND p_date_to
      GROUP BY employee_id
    ) sh ON sh.employee_id = e.id
    CROSS JOIN (
      SELECT COALESCE(SUM(planned_hours), 0) AS total
      FROM planned_shifts
      WHERE location_id = p_location_id
        AND shift_date BETWEEN p_date_from AND p_date_to
    ) total_hours_all
    WHERE e.location_id = p_location_id
      AND e.active = true
      AND COALESCE(sh.total_hours, 0) > 0
  ) sub;

  RETURN jsonb_build_object(
    'location_id', p_location_id,
    'date_range', jsonb_build_object('from', p_date_from, 'to', p_date_to),
    'total_sales', v_total_sales,
    'employees', v_result,
    'summary', jsonb_build_object(
      'employee_count', jsonb_array_length(v_result),
      'avg_splh', (SELECT ROUND(AVG((e->>'splh')::numeric), 2) FROM jsonb_array_elements(v_result) e),
      'avg_roi', (SELECT ROUND(AVG((e->>'roi')::numeric), 2) FROM jsonb_array_elements(v_result) e),
      'top_performer', (SELECT e->>'employee_name' FROM jsonb_array_elements(v_result) e ORDER BY (e->>'splh')::numeric DESC LIMIT 1)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_employee_revenue_scores(uuid, uuid, date, date) TO authenticated;


-- 2) Tip Distribution Rules (configurable per location)
CREATE TABLE IF NOT EXISTS tip_distribution_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  location_id uuid NOT NULL,
  rule_name text NOT NULL DEFAULT 'default',
  method text NOT NULL DEFAULT 'hours_worked'
    CHECK (method IN ('hours_worked', 'equal_split', 'role_weighted', 'custom')),
  pool_percentage numeric(5,2) NOT NULL DEFAULT 100.00
    CHECK (pool_percentage BETWEEN 0 AND 100),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, location_id, rule_name)
);
ALTER TABLE tip_distribution_rules ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON tip_distribution_rules TO authenticated;

COMMENT ON TABLE tip_distribution_rules IS
  'Tip distribution rules per location. '
  'method = how to split tips among staff. '
  'pool_percentage = what % of tips go into the pool (rest to house).';


-- 3) Role weights for tip distribution (only used when method = 'role_weighted')
CREATE TABLE IF NOT EXISTS tip_role_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES tip_distribution_rules(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  weight numeric(5,2) NOT NULL DEFAULT 1.0 CHECK (weight >= 0),
  UNIQUE(rule_id, role_name)
);
ALTER TABLE tip_role_weights ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON tip_role_weights TO authenticated;


-- 4) Tip entries (actual tips recorded per day/shift)
CREATE TABLE IF NOT EXISTS tip_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  location_id uuid NOT NULL,
  date date NOT NULL,
  total_tips numeric(10,2) NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'pos_import')),
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, location_id, date)
);
ALTER TABLE tip_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON tip_entries TO authenticated;


-- 5) Tip distributions (calculated result per employee per day)
CREATE TABLE IF NOT EXISTS tip_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_entry_id uuid NOT NULL REFERENCES tip_entries(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  employee_name text,
  role_name text,
  hours_worked numeric(5,2) DEFAULT 0,
  weight numeric(5,2) DEFAULT 1.0,
  share_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE tip_distributions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON tip_distributions TO authenticated;


-- 6) RPC: calculate_tip_distribution
-- Given a tip entry, distributes tips according to the location's active rules.
CREATE OR REPLACE FUNCTION calculate_tip_distribution(
  p_tip_entry_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_entry record;
  v_rule record;
  v_pool numeric;
  v_total_weight numeric;
  v_result jsonb;
BEGIN
  -- Get the tip entry
  SELECT * INTO v_entry FROM tip_entries WHERE id = p_tip_entry_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Tip entry not found');
  END IF;

  -- Get active rule for this location
  SELECT * INTO v_rule
  FROM tip_distribution_rules
  WHERE location_id = v_entry.location_id
    AND org_id = v_entry.org_id
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    -- Default: hours_worked, 100% pool
    v_rule := ROW(
      gen_random_uuid(), v_entry.org_id, v_entry.location_id,
      'default', 'hours_worked', 100.00, true, now(), now()
    )::tip_distribution_rules;
  END IF;

  -- Calculate pool amount
  v_pool := v_entry.total_tips * (v_rule.pool_percentage / 100.0);

  -- Delete existing distributions for this entry
  DELETE FROM tip_distributions WHERE tip_entry_id = p_tip_entry_id;

  -- Distribute based on method
  IF v_rule.method = 'equal_split' THEN
    -- Equal split among all employees who worked that day
    INSERT INTO tip_distributions (tip_entry_id, employee_id, employee_name, role_name, hours_worked, weight, share_amount)
    SELECT
      p_tip_entry_id,
      e.id,
      e.full_name,
      e.role_name,
      COALESCE(ps.total_hours, 0),
      1.0,
      ROUND(v_pool / NULLIF(COUNT(*) OVER (), 0), 2)
    FROM employees e
    JOIN (
      SELECT DISTINCT employee_id, SUM(planned_hours) AS total_hours
      FROM planned_shifts
      WHERE location_id = v_entry.location_id AND shift_date = v_entry.date
      GROUP BY employee_id
    ) ps ON ps.employee_id = e.id
    WHERE e.location_id = v_entry.location_id AND e.active = true;

  ELSIF v_rule.method = 'role_weighted' THEN
    -- Weighted by role
    SELECT COALESCE(SUM(
      COALESCE(rw.weight, 1.0) * COALESCE(ps.total_hours, 0)
    ), 0) INTO v_total_weight
    FROM employees e
    JOIN (
      SELECT employee_id, SUM(planned_hours) AS total_hours
      FROM planned_shifts WHERE location_id = v_entry.location_id AND shift_date = v_entry.date
      GROUP BY employee_id
    ) ps ON ps.employee_id = e.id
    LEFT JOIN tip_role_weights rw ON rw.rule_id = v_rule.id AND rw.role_name = e.role_name
    WHERE e.location_id = v_entry.location_id AND e.active = true;

    INSERT INTO tip_distributions (tip_entry_id, employee_id, employee_name, role_name, hours_worked, weight, share_amount)
    SELECT
      p_tip_entry_id,
      e.id,
      e.full_name,
      e.role_name,
      COALESCE(ps.total_hours, 0),
      COALESCE(rw.weight, 1.0),
      CASE WHEN v_total_weight > 0
        THEN ROUND(v_pool * (COALESCE(rw.weight, 1.0) * COALESCE(ps.total_hours, 0)) / v_total_weight, 2)
        ELSE 0 END
    FROM employees e
    JOIN (
      SELECT employee_id, SUM(planned_hours) AS total_hours
      FROM planned_shifts WHERE location_id = v_entry.location_id AND shift_date = v_entry.date
      GROUP BY employee_id
    ) ps ON ps.employee_id = e.id
    LEFT JOIN tip_role_weights rw ON rw.rule_id = v_rule.id AND rw.role_name = e.role_name
    WHERE e.location_id = v_entry.location_id AND e.active = true;

  ELSE
    -- Default: hours_worked (proportional to hours)
    SELECT COALESCE(SUM(ps.total_hours), 0) INTO v_total_weight
    FROM (
      SELECT employee_id, SUM(planned_hours) AS total_hours
      FROM planned_shifts WHERE location_id = v_entry.location_id AND shift_date = v_entry.date
      GROUP BY employee_id
    ) ps;

    INSERT INTO tip_distributions (tip_entry_id, employee_id, employee_name, role_name, hours_worked, weight, share_amount)
    SELECT
      p_tip_entry_id,
      e.id,
      e.full_name,
      e.role_name,
      COALESCE(ps.total_hours, 0),
      1.0,
      CASE WHEN v_total_weight > 0
        THEN ROUND(v_pool * COALESCE(ps.total_hours, 0) / v_total_weight, 2)
        ELSE 0 END
    FROM employees e
    JOIN (
      SELECT employee_id, SUM(planned_hours) AS total_hours
      FROM planned_shifts WHERE location_id = v_entry.location_id AND shift_date = v_entry.date
      GROUP BY employee_id
    ) ps ON ps.employee_id = e.id
    WHERE e.location_id = v_entry.location_id AND e.active = true;
  END IF;

  -- Return the distributions
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'employee_id', td.employee_id,
    'employee_name', td.employee_name,
    'role', td.role_name,
    'hours_worked', td.hours_worked,
    'weight', td.weight,
    'share_amount', td.share_amount
  ) ORDER BY td.share_amount DESC), '[]'::jsonb)
  INTO v_result
  FROM tip_distributions td
  WHERE td.tip_entry_id = p_tip_entry_id;

  RETURN jsonb_build_object(
    'tip_entry_id', p_tip_entry_id,
    'date', v_entry.date,
    'total_tips', v_entry.total_tips,
    'pool_percentage', v_rule.pool_percentage,
    'pool_amount', v_pool,
    'method', v_rule.method,
    'distributions', v_result,
    'employee_count', jsonb_array_length(v_result)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_tip_distribution(uuid) TO authenticated;
