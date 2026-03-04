-- ============================================================
-- Wave 1: Payroll → Labour Foundation
-- Connects existing payroll (payslips) to Labour KPIs,
-- adds Prime Cost %, and Cost per Cover.
-- ============================================================

-- 1) View: aggregate payroll costs by month/location
-- Uses IF EXISTS guard since payroll tables are Edge-Function-managed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payslips')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_runs')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_contracts')
  THEN
    -- Full version with location_id from contracts
    EXECUTE $view$
      CREATE OR REPLACE VIEW v_payroll_monthly_cost AS
      SELECT
        pr.period_year,
        pr.period_month,
        pr.group_id                                        AS org_id,
        COALESCE(ec.location_id, pr.legal_entity_id)::text AS location_id,
        SUM(COALESCE(ps.gross_pay, 0))                     AS total_gross,
        SUM(COALESCE(ps.employer_ss, 0))                   AS total_employer_ss,
        SUM(COALESCE(ps.gross_pay, 0))
          + SUM(COALESCE(ps.employer_ss, 0))               AS total_cost,
        COUNT(DISTINCT ps.employee_id)                      AS headcount,
        'payroll'::text                                     AS source
      FROM payslips ps
      JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
      LEFT JOIN employee_contracts ec
        ON ec.employee_id = ps.employee_id
        AND ec.legal_entity_id = pr.legal_entity_id
      WHERE pr.status IN ('calculated','approved','paid')
      GROUP BY pr.period_year, pr.period_month, pr.group_id,
               COALESCE(ec.location_id, pr.legal_entity_id);
    $view$;
    EXECUTE 'GRANT SELECT ON v_payroll_monthly_cost TO anon, authenticated';
    RAISE NOTICE 'v_payroll_monthly_cost view created (full version with contracts)';

  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payslips')
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_runs')
  THEN
    -- Simplified version without contracts (no location_id resolution)
    EXECUTE $view$
      CREATE OR REPLACE VIEW v_payroll_monthly_cost AS
      SELECT
        pr.period_year,
        pr.period_month,
        pr.group_id                   AS org_id,
        pr.legal_entity_id::text      AS location_id,
        SUM(COALESCE(ps.gross_pay, 0))                     AS total_gross,
        SUM(COALESCE(ps.employer_ss, 0))                   AS total_employer_ss,
        SUM(COALESCE(ps.gross_pay, 0))
          + SUM(COALESCE(ps.employer_ss, 0))               AS total_cost,
        COUNT(DISTINCT ps.employee_id)                      AS headcount,
        'payroll'::text                                     AS source
      FROM payslips ps
      JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
      WHERE pr.status IN ('calculated','approved','paid')
      GROUP BY pr.period_year, pr.period_month, pr.group_id, pr.legal_entity_id;
    $view$;
    EXECUTE 'GRANT SELECT ON v_payroll_monthly_cost TO anon, authenticated';
    RAISE NOTICE 'v_payroll_monthly_cost view created (simplified, no contracts)';

  ELSE
    RAISE NOTICE 'Payroll tables not found, skipping v_payroll_monthly_cost view creation';
  END IF;
END $$;


-- 2) Table: monthly cost entries for manual COGS input (Wave 2 prep)
CREATE TABLE IF NOT EXISTS monthly_cost_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  location_id text,
  period_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  category text NOT NULL CHECK (category IN ('food','beverage','packaging','supplies','other')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','accounting_import')),
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, location_id, period_year, period_month, category)
);
ALTER TABLE monthly_cost_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON monthly_cost_entries TO authenticated;


-- 3) Updated get_labour_kpis: payroll-first + cost_per_cover + prime_cost
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
  v_actual_sales     numeric;
  v_actual_hours     numeric;
  v_schedule_cost    numeric;
  v_actual_cost      numeric;
  v_forecast_sales   numeric;
  v_forecast_orders  numeric;
  v_planned_hours    numeric;
  v_planned_cost     numeric;
  v_actual_orders    numeric;
  v_payroll_cost     numeric := 0;
  v_cost_source      text := 'schedule';
  v_payroll_headcount numeric := 0;
  v_cogs_total       numeric := 0;
  v_has_payroll      boolean := false;
BEGIN
  -- Sales
  SELECT COALESCE(SUM(net_sales), 0), COALESCE(SUM(orders_count), 0)
  INTO v_actual_sales, v_actual_orders
  FROM sales_daily_unified
  WHERE date BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  -- Schedule-based labour (always computed as fallback)
  SELECT COALESCE(SUM(labour_hours), 0), COALESCE(SUM(labour_cost), 0)
  INTO v_actual_hours, v_schedule_cost
  FROM labour_daily
  WHERE date BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  -- Forecast
  SELECT COALESCE(SUM(forecast_sales), 0),
         COALESCE(SUM(forecast_orders), 0),
         COALESCE(SUM(planned_labor_hours), 0),
         COALESCE(SUM(planned_labor_cost), 0)
  INTO v_forecast_sales, v_forecast_orders, v_planned_hours, v_planned_cost
  FROM forecast_daily_metrics
  WHERE date BETWEEN date_from AND date_to
    AND (selected_location_id IS NULL OR location_id = selected_location_id);

  -- Try payroll data (prefer over schedule if available)
  BEGIN
    SELECT COALESCE(SUM(total_cost), 0), COALESCE(SUM(headcount), 0)
    INTO v_payroll_cost, v_payroll_headcount
    FROM v_payroll_monthly_cost
    WHERE make_date(period_year, period_month, 1)
          BETWEEN date_trunc('month', date_from)::date
              AND date_trunc('month', date_to)::date
      AND (selected_location_id IS NULL
           OR location_id = selected_location_id::text);

    IF v_payroll_cost > 0 THEN
      v_has_payroll := true;
      v_cost_source := 'payroll';
      v_actual_cost := v_payroll_cost;
    ELSE
      v_actual_cost := v_schedule_cost;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    -- View doesn't exist yet (payroll tables not set up)
    v_actual_cost := v_schedule_cost;
  END;

  -- COGS from monthly_cost_entries (if any)
  BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO v_cogs_total
    FROM monthly_cost_entries
    WHERE period_year = EXTRACT(YEAR FROM date_from)::int
      AND period_month = EXTRACT(MONTH FROM date_from)::int
      AND (selected_location_id IS NULL
           OR location_id = selected_location_id::text);
  EXCEPTION WHEN undefined_table THEN
    v_cogs_total := 0;
  END;

  RETURN jsonb_build_object(
    'actual_sales',        v_actual_sales,
    'actual_labor_cost',   v_actual_cost,
    'actual_labor_hours',  v_actual_hours,
    'actual_orders',       v_actual_orders,
    'forecast_sales',      v_forecast_sales,
    'planned_labor_cost',  v_planned_cost,
    'planned_labor_hours', v_planned_hours,
    'forecast_orders',     v_forecast_orders,

    -- COL%
    'actual_col_pct',  CASE WHEN v_actual_sales > 0
      THEN ROUND(v_actual_cost / v_actual_sales * 100, 2) ELSE 0 END,
    'planned_col_pct', CASE WHEN v_forecast_sales > 0
      THEN ROUND(v_planned_cost / v_forecast_sales * 100, 2) ELSE 0 END,

    -- SPLH
    'actual_splh',  CASE WHEN v_actual_hours > 0
      THEN ROUND(v_actual_sales / v_actual_hours, 2) ELSE 0 END,
    'planned_splh', CASE WHEN v_planned_hours > 0
      THEN ROUND(v_forecast_sales / v_planned_hours, 2) ELSE 0 END,

    -- OPLH
    'actual_oplh',  CASE WHEN v_actual_hours > 0
      THEN ROUND(v_actual_orders::numeric / v_actual_hours, 2) ELSE 0 END,
    'planned_oplh', CASE WHEN v_planned_hours > 0
      THEN ROUND(v_forecast_orders::numeric / v_planned_hours, 2) ELSE 0 END,

    -- Deltas
    'sales_delta_pct', CASE WHEN v_forecast_sales > 0
      THEN ROUND((v_actual_sales - v_forecast_sales) / v_forecast_sales * 100, 1) ELSE 0 END,
    'col_delta_pct', CASE WHEN v_forecast_sales > 0 AND v_actual_sales > 0
      THEN ROUND((v_actual_cost / v_actual_sales * 100) - (v_planned_cost / v_forecast_sales * 100), 1)
      ELSE 0 END,
    'hours_delta_pct', CASE WHEN v_planned_hours > 0
      THEN ROUND((v_actual_hours - v_planned_hours) / v_planned_hours * 100, 1) ELSE 0 END,
    'splh_delta_pct', CASE WHEN v_planned_hours > 0 AND v_actual_hours > 0 AND v_forecast_sales > 0
      THEN ROUND(((v_actual_sales / v_actual_hours) - (v_forecast_sales / v_planned_hours)) / (v_forecast_sales / v_planned_hours) * 100, 1)
      ELSE 0 END,
    'oplh_delta_pct', CASE WHEN v_planned_hours > 0 AND v_actual_hours > 0 AND v_forecast_orders > 0
      THEN ROUND(((v_actual_orders::numeric / v_actual_hours) - (v_forecast_orders::numeric / v_planned_hours)) / (v_forecast_orders::numeric / v_planned_hours) * 100, 1)
      ELSE 0 END,

    -- Totals
    'total_actual_hours',    v_actual_hours,
    'total_actual_cost',     v_actual_cost,
    'total_scheduled_hours', v_planned_hours,
    'total_scheduled_cost',  v_planned_cost,
    'avg_headcount',         v_payroll_headcount,
    'total_sales',           v_actual_sales,
    'splh', CASE WHEN v_actual_hours > 0
      THEN ROUND(v_actual_sales / v_actual_hours, 2) ELSE 0 END,
    'col_pct', CASE WHEN v_actual_sales > 0
      THEN ROUND(v_actual_cost / v_actual_sales * 100, 2) ELSE 0 END,

    -- ===== NEW FIELDS =====
    -- Data source indicator
    'labor_cost_source',   v_cost_source,       -- 'payroll' | 'schedule'
    'schedule_labor_cost', v_schedule_cost,      -- always available for triple comparison

    -- Cost per Cover (Labour cost / covers)
    'cost_per_cover', CASE WHEN v_actual_orders > 0
      THEN ROUND(v_actual_cost / v_actual_orders, 2) ELSE 0 END,

    -- COGS & Prime Cost
    'cogs_total',  v_cogs_total,
    'cogs_pct',    CASE WHEN v_actual_sales > 0
      THEN ROUND(v_cogs_total / v_actual_sales * 100, 2) ELSE 0 END,
    'prime_cost_pct', CASE WHEN v_actual_sales > 0
      THEN ROUND((v_actual_cost + v_cogs_total) / v_actual_sales * 100, 2) ELSE 0 END,
    'prime_cost_amount', v_actual_cost + v_cogs_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_labour_kpis(date, date, uuid, text) TO anon, authenticated;


-- 4) Table: labour_alerts for overtime warnings (Wave 3 prep)
CREATE TABLE IF NOT EXISTS labour_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  location_id text,
  employee_id uuid,
  alert_type text NOT NULL CHECK (alert_type IN (
    'overtime_warning','overtime_breach',
    'rest_violation','max_hours_warning',
    'schedule_drift','cost_anomaly'
  )),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE labour_alerts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON labour_alerts TO authenticated;

-- Index for fast unread alerts lookup
CREATE INDEX IF NOT EXISTS idx_labour_alerts_unread
  ON labour_alerts (org_id, is_read, created_at DESC)
  WHERE is_read = false;
