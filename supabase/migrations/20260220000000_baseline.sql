-- =============================================================================
-- JOSEPHINE — CONSOLIDATED BASELINE SCHEMA
-- Generated: 2026-03-04  |  Squashed from 47 migrations
-- =============================================================================
-- Each function/view appears exactly ONCE (the latest version).
-- Tables appear once (first CREATE) + all ALTER TABLE statements.
-- This file IS the schema. When in doubt, this is the source of truth.


-- ═══════════════════════════════════════════════════════════════════════════
-- EXTENSIONS (1)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ═══════════════════════════════════════════════════════════════════════════
-- SCHEMA SETUP & MISC (55)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS ops;

UPDATE recipe_ingredients
  SET qty_gross = quantity, qty_net = quantity
  WHERE qty_gross = 0 AND quantity > 0;

UPDATE recipe_ingredients
  SET qty_gross = qty_base_units, qty_net = qty_base_units
  WHERE qty_gross = 0 AND qty_base_units > 0;

DO $$
DECLARE
  v_org_id uuid;
  v_version_id uuid;
  v_loc record;
  v_day date;
  v_day_id uuid;
  v_base_sales numeric;
  v_dow int; -- day of week (0=Sun, 1=Mon, ...)
BEGIN
  -- Get org
  SELECT id INTO v_org_id FROM groups LIMIT 1;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'No org found'; END IF;

  -- Get budget version
  SELECT id INTO v_version_id
  FROM budget_versions
  WHERE org_id = v_org_id
  ORDER BY created_at DESC LIMIT 1;
  IF v_version_id IS NULL THEN RAISE EXCEPTION 'No budget version found'; END IF;

  -- Iterate over all active locations
  FOR v_loc IN SELECT id, name FROM locations WHERE active = true LOOP
    -- For each day in current month (Feb 2026)
    FOR v_day IN SELECT generate_series('2026-02-01'::date, '2026-02-28'::date, '1 day') LOOP
      v_dow := EXTRACT(DOW FROM v_day);

      -- Realistic daily sales based on day of week
      v_base_sales := CASE
        WHEN v_dow IN (5, 6) THEN 4200 + (random() * 800)  -- Fri/Sat peak
        WHEN v_dow = 0 THEN 3500 + (random() * 500)        -- Sunday
        ELSE 2500 + (random() * 1000)                       -- Weekdays
      END;

      -- Insert budget_day (skip if exists)
      INSERT INTO budget_days (id, org_id, budget_version_id, location_id, day)
      VALUES (gen_random_uuid(), v_org_id, v_version_id, v_loc.id, v_day)
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_day_id;

      -- If day already existed, fetch its ID
      IF v_day_id IS NULL THEN
        SELECT id INTO v_day_id
        FROM budget_days
        WHERE org_id = v_org_id
          AND budget_version_id = v_version_id
          AND location_id = v_loc.id
          AND day = v_day;
      END IF;

      -- Insert budget_drivers with target percentages
      INSERT INTO budget_drivers (
        budget_day_id,
        target_covers,
        target_avg_check,
        target_cogs_pct,
        target_labour_hours,
        target_hourly_rate
      ) VALUES (
        v_day_id,
        ROUND(v_base_sales / 25),       -- ~covers at avg check €25
        25.0,                             -- avg check €25
        28.0,                             -- COGS target 28%
        ROUND(v_base_sales / 50),        -- labour hours (target SPLH = €50)
        12.5                              -- avg hourly rate €12.50
      )
      ON CONFLICT (budget_day_id) DO UPDATE SET
        target_covers = EXCLUDED.target_covers,
        target_avg_check = EXCLUDED.target_avg_check,
        target_cogs_pct = EXCLUDED.target_cogs_pct,
        target_labour_hours = EXCLUDED.target_labour_hours,
        target_hourly_rate = EXCLUDED.target_hourly_rate;

      -- Delete existing forecast for this location + day, then insert fresh
      DELETE FROM forecast_daily_metrics
      WHERE location_id = v_loc.id AND date = v_day;

      INSERT INTO forecast_daily_metrics (
        location_id, date,
        forecast_sales, forecast_orders,
        planned_labor_cost, planned_labor_hours
      ) VALUES (
        v_loc.id, v_day,
        v_base_sales,
        ROUND(v_base_sales / 25),          -- orders ≈ sales / avg check
        v_base_sales * 0.30,               -- planned labor cost = 30% of sales
        ROUND(v_base_sales / 50)           -- planned labor hours (SPLH target = €50)
      );

    END LOOP;

    RAISE NOTICE 'Seeded budget + forecast for location: %', v_loc.name;
  END LOOP;
END $$;

UPDATE location_settings
SET target_col_percent = 30,
    splh_goal = 50
WHERE location_id IN (SELECT id FROM locations WHERE active = true);

DELETE FROM budgets_daily
WHERE location_id IN (SELECT id FROM locations WHERE active = true)
  AND date BETWEEN '2026-02-01' AND '2026-02-28';

DO $$
DECLARE
  v_emp record;
  v_dow int; -- 0=Sunday, 1=Monday, ..., 6=Saturday
BEGIN
  FOR v_emp IN
    SELECT e.id AS emp_id, e.location_id
    FROM employees e
    WHERE e.active = true
      AND e.location_id IS NOT NULL
  LOOP
    -- Insert availability for Monday(1) through Sunday(0)
    FOR v_dow IN 0..6 LOOP
      -- Skip if availability already exists for this employee+day+location
      IF NOT EXISTS (
        SELECT 1 FROM employee_availability
        WHERE employee_id = v_emp.emp_id
          AND location_id = v_emp.location_id
          AND day_of_week = v_dow
      ) THEN
        INSERT INTO employee_availability (employee_id, location_id, day_of_week, start_time, end_time, is_available)
        VALUES (
          v_emp.emp_id,
          v_emp.location_id,
          v_dow,
          (CASE
            WHEN v_dow IN (0) THEN '10:00'
            ELSE '09:00'
          END)::time,
          (CASE
            WHEN v_dow IN (5, 6) THEN '01:00'
            WHEN v_dow = 0 THEN '22:00'
            ELSE '23:30'
          END)::time,
          true
        );
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Employee availability seeded for all active employees';
END $$;

UPDATE recipe_ingredients SET qty_gross = quantity WHERE qty_gross IS NULL AND quantity IS NOT NULL;

UPDATE inventory_items SET category_name = category WHERE category_name IS NULL AND category IS NOT NULL;

UPDATE inventory_items SET order_unit = unit WHERE order_unit IS NULL AND unit IS NOT NULL;

UPDATE inventory_items SET price = last_cost WHERE price IS NULL AND last_cost IS NOT NULL;

DO $$
DECLARE
  v_loc record;
  v_day date;
  v_dow int;
  v_nm  numeric;
  v_hr  numeric;
  v_sb  numeric := 0;
  v_sr  numeric := 0;
  v_ob  integer := 0;
  v_ors integer := 0;
  v_lhb numeric := 0;
  v_lr  numeric := 0;
  v_ns  numeric;
  v_oc  integer;
  v_gs  numeric;
  v_pc  numeric;
  v_pk  numeric;
  v_po  numeric;
  v_ra  numeric;
  v_da  numeric;
  v_ca  numeric;
  v_va  numeric;
  v_lh  numeric;
  v_lc  numeric;
  v_cg  numeric;
  v_fs  numeric;
  v_fo  integer;
  v_plh numeric;
  v_plc numeric;
  v_is_future boolean;
BEGIN
  FOR v_loc IN
    SELECT id,
      CASE id
        WHEN '57f62bae-4d5b-44b0-8055-fdde12ee5a96' THEN 1.15
        WHEN '9c501324-66e4-40e8-bfcb-7cc855f3754e' THEN 1.00
        WHEN '9469ef7a-c1b1-4314-8349-d0ea253ba483' THEN 0.90
        WHEN 'fe0717f7-6fa7-4e5e-8467-6c9585b03022' THEN 0.85
        ELSE 1.0
      END AS lm
    FROM locations WHERE active = true
  LOOP
    FOR v_day IN SELECT generate_series(
      (CURRENT_DATE - 90)::date,
      (CURRENT_DATE + 30)::date,
      '1 day'::interval
    )::date LOOP

      v_is_future := (v_day > CURRENT_DATE);
      v_dow := EXTRACT(DOW FROM v_day)::int;

      IF v_dow = 0 THEN v_sb:=1100; v_sr:=400; v_ob:=55; v_ors:=25; v_lhb:=18; v_lr:=6;
      ELSIF v_dow = 1 THEN v_sb:=1200; v_sr:=300; v_ob:=60; v_ors:=20; v_lhb:=20; v_lr:=5;
      ELSIF v_dow = 2 THEN v_sb:=1350; v_sr:=350; v_ob:=68; v_ors:=22; v_lhb:=22; v_lr:=5;
      ELSIF v_dow = 3 THEN v_sb:=1450; v_sr:=350; v_ob:=72; v_ors:=22; v_lhb:=24; v_lr:=5;
      ELSIF v_dow = 4 THEN v_sb:=1650; v_sr:=400; v_ob:=82; v_ors:=25; v_lhb:=28; v_lr:=6;
      ELSIF v_dow = 5 THEN v_sb:=2400; v_sr:=600; v_ob:=120; v_ors:=35; v_lhb:=36; v_lr:=8;
      ELSIF v_dow = 6 THEN v_sb:=2800; v_sr:=700; v_ob:=140; v_ors:=40; v_lhb:=40; v_lr:=10;
      END IF;

      v_nm := 1.0 + (random() - 0.5) * 0.24;
      v_hr := 13.5 + random() * 3.0;

      v_ns := ROUND((v_sb + random() * v_sr) * v_loc.lm * v_nm, 2);
      v_oc := GREATEST(1, FLOOR((v_ob + random() * v_ors) * v_loc.lm * v_nm))::integer;
      v_gs := ROUND(v_ns * (1.03 + random() * 0.03), 2);
      v_pc := ROUND(v_ns * (0.20 + random() * 0.10), 2);
      v_pk := ROUND(v_ns * (0.62 + random() * 0.10), 2);
      v_po := ROUND(GREATEST(0, v_ns - v_pc - v_pk), 2);
      v_ra := ROUND(v_ns * (0.002 + random() * 0.006), 2);
      v_da := ROUND(v_ns * (0.015 + random() * 0.020), 2);
      v_ca := ROUND(v_ns * (0.005 + random() * 0.010), 2);
      v_va := ROUND(v_ns * (0.004 + random() * 0.008), 2);

      v_lh := ROUND((v_lhb + random() * v_lr) * v_loc.lm * v_nm, 2);
      v_lc := ROUND(v_lh * v_hr, 2);
      v_cg := ROUND(v_ns * (0.26 + random() * 0.04), 2);

      v_fs := ROUND(v_ns * (0.88 + random() * 0.24), 2);
      v_fo := GREATEST(1, ROUND(v_oc * (0.90 + random() * 0.20)))::integer;
      v_plh := ROUND(v_lh * (0.90 + random() * 0.20), 2);
      v_plc := ROUND(v_plh * v_hr, 2);

      IF NOT v_is_future THEN
        INSERT INTO pos_daily_finance (id, date, location_id, net_sales, gross_sales, orders_count,
          payments_cash, payments_card, payments_other, refunds_amount, refunds_count,
          discounts_amount, comps_amount, voids_amount, created_at, data_source)
        VALUES (gen_random_uuid(), v_day, v_loc.id, v_ns, v_gs, v_oc,
          v_pc, v_pk, v_po, v_ra, FLOOR(random()*3)::integer,
          v_da, v_ca, v_va, NOW(), 'demo')
        ON CONFLICT (date, location_id, data_source) DO NOTHING;

        INSERT INTO labour_daily (id, date, location_id, labour_cost, labour_hours, created_at)
        VALUES (gen_random_uuid(), v_day, v_loc.id, v_lc, v_lh, NOW())
        ON CONFLICT (date, location_id) DO UPDATE
          SET labour_cost = EXCLUDED.labour_cost, labour_hours = EXCLUDED.labour_hours;

        INSERT INTO cogs_daily (location_id, date, cogs_amount)
        VALUES (v_loc.id, v_day, v_cg)
        ON CONFLICT DO NOTHING;

        INSERT INTO budgets_daily (id, date, location_id, budget_sales, budget_labour, budget_cogs, created_at)
        VALUES (gen_random_uuid(), v_day, v_loc.id,
          ROUND(v_sb * v_loc.lm * 1.05, 2),
          ROUND(v_sb * v_loc.lm * 0.22, 2),
          ROUND(v_sb * v_loc.lm * 0.28, 2), NOW())
        ON CONFLICT DO NOTHING;
      END IF;

      INSERT INTO forecast_daily_metrics (id, date, location_id, forecast_sales, forecast_orders,
        planned_labor_hours, planned_labor_cost, created_at)
      VALUES (gen_random_uuid(), v_day, v_loc.id, v_fs, v_fo, v_plh, v_plc, NOW())
      ON CONFLICT DO NOTHING;

    END LOOP;
  END LOOP;

  RAISE NOTICE 'Backfilled 90 days + 30 day forecast for all active locations';
END;
$$;

UPDATE inventory_items ii
SET category_name = ic.name
FROM inventory_categories ic
WHERE ii.category_id = ic.id
  AND ii.category_name IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'menu_engineering_actions'
      AND policyname = 'Users can manage their own actions'
  ) THEN
    CREATE POLICY "Users can manage their own actions"
      ON menu_engineering_actions
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
DECLARE d date;
BEGIN
  FOR d IN SELECT generate_series(
    (CURRENT_DATE - INTERVAL '30 days')::date, CURRENT_DATE, '1 day')::date
  LOOP
    PERFORM generate_pos_daily_data(d);
  END LOOP;
END $$;

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

COMMENT ON TABLE labour_rules IS
  'Configurable thresholds for labour compliance, overtime alerts, '
  'and staffing recommendations. Per-org defaults or per-location overrides.';

COMMENT ON TABLE tip_distribution_rules IS
  'Tip distribution rules per location. '
  'method = how to split tips among staff. '
  'pool_percentage = what % of tips go into the pool (rest to house).';

COMMENT ON COLUMN locations.latitude IS 'GPS latitude for geofence validation';

COMMENT ON COLUMN locations.longitude IS 'GPS longitude for geofence validation';

COMMENT ON COLUMN locations.geofence_radius_m IS 'Allowed clock-in radius in meters (default 200m)';

COMMENT ON COLUMN public.legal_entities.iban IS 'Company IBAN for SEPA payment transfers (debtor account)';

COMMENT ON COLUMN public.legal_entities.bic IS 'Company BIC/SWIFT code for SEPA payment transfers';

DO $$ BEGIN
  ALTER TABLE budget_versions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE budget_days ENABLE ROW LEVEL SECURITY;
  ALTER TABLE budget_metrics ENABLE ROW LEVEL SECURITY;
  ALTER TABLE budget_drivers ENABLE ROW LEVEL SECURITY;
  ALTER TABLE waste_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
  ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
  ALTER TABLE inventory_item_location ENABLE ROW LEVEL SECURITY;
  ALTER TABLE cash_counts_daily ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['budget_versions','budget_days','budget_metrics','budget_drivers',
    'waste_events','stock_movements','inventory_items','inventory_item_location','cash_counts_daily'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', t || '_select_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_insert_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)', t || '_insert_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_update_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t || '_update_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_delete_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true)', t || '_delete_all', t);
    EXECUTE format('GRANT ALL ON %I TO authenticated', t);
  END LOOP;
END $$;

DO $$ BEGIN
  ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS payments_cash numeric DEFAULT 0;
  ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS payments_card numeric DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

UPDATE daily_sales 
SET 
  payments_cash = COALESCE(ROUND(payments_total * 0.25, 2), 0),
  payments_card = COALESCE(ROUND(payments_total * 0.75, 2), 0)
WHERE (payments_cash IS NULL OR payments_cash = 0)
  AND payments_total > 0;

UPDATE daily_sales
SET
  refunds = COALESCE(ROUND(net_sales * 0.005, 2), 0),
  discounts = COALESCE(ROUND(net_sales * 0.03, 2), 0),
  comps = COALESCE(ROUND(net_sales * 0.01, 2), 0),
  voids = COALESCE(ROUND(net_sales * 0.002, 2), 0)
WHERE (refunds IS NULL OR refunds = 0)
  AND net_sales > 0;

REFRESH MATERIALIZED VIEW CONCURRENTLY mart_kpi_daily_mv;

DO $$ BEGIN
  CREATE UNIQUE INDEX idx_budget_days_uniq 
    ON budget_days (budget_version_id, location_id, day);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'budget_days index: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX idx_budget_metrics_uniq 
    ON budget_metrics (budget_day_id, metric, layer);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'budget_metrics index: %', SQLERRM;
END $$;

UPDATE budget_versions SET 
  start_date = LEAST(COALESCE(start_date, CURRENT_DATE - 60), CURRENT_DATE - 30),
  end_date   = GREATEST(COALESCE(end_date, CURRENT_DATE + 7), CURRENT_DATE + 7)
WHERE status IN ('published', 'frozen');

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cdm_order_lines_order_id ON cdm_order_lines (order_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_cdm_order_lines_order_id: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cdm_order_lines_item_id ON cdm_order_lines (item_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_cdm_order_lines_item_id: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_inv_item_loc_item_id ON inventory_item_location (item_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_inv_item_loc_item_id: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_inv_item_loc_location_id ON inventory_item_location (location_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_inv_item_loc_location_id: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_waste_events_item_id ON waste_events (inventory_item_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_waste_events_item_id: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_waste_events_loc_created ON waste_events (location_id, created_at);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_waste_events_loc_created: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_employees_org_id ON employees (org_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_employees_org_id: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cash_counts_loc_day ON cash_counts_daily (location_id, day);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_cash_counts_loc_day: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_budget_drivers_day_id ON budget_drivers (budget_day_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_budget_drivers_day_id: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_time_entries_org_clockin_date ON time_entries (org_id, (clock_in::date));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_time_entries_clockin: %', SQLERRM; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS org_settings_all ON org_settings;
  CREATE POLICY org_settings_all ON org_settings
    USING ((select is_org_member(org_id, (select auth.uid()))))
    WITH CHECK ((select is_org_member(org_id, (select auth.uid()))));
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'org_settings table not found, skipping RLS fix';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS integrations_rls ON integrations;
  CREATE POLICY integrations_rls ON integrations
    USING ((select is_org_member(org_id, (select auth.uid()))))
    WITH CHECK ((select is_org_member(org_id, (select auth.uid()))));
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'integrations table not found, skipping RLS fix';
END $$;

DO $$ BEGIN
  ALTER TABLE daily_sales ADD CONSTRAINT chk_daily_sales_orders_positive
    CHECK (orders_count >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN check_violation THEN
  RAISE NOTICE 'daily_sales has rows with negative orders_count, skipping';
END $$;

DO $$ BEGIN
  ALTER TABLE budget_days ALTER COLUMN budget_version_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE budget_days ALTER COLUMN org_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE budget_metrics ALTER COLUMN budget_day_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE stock_movements ALTER COLUMN location_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE waste_events ALTER COLUMN location_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
DECLARE
  v_org_id     uuid;
  v_loc_ids    uuid[];
  v_loc_id     uuid;
  v_loc_name   text;
  v_loc_idx    int;
  v_day        date;
  v_day_of_week int;
  v_is_weekend boolean;
  v_daily_sales numeric;

  v_emp_ids    uuid[] := ARRAY[
    'e0000001-0000-0000-0000-000000000001'::uuid,
    'e0000001-0000-0000-0000-000000000002'::uuid,
    'e0000001-0000-0000-0000-000000000003'::uuid,
    'e0000001-0000-0000-0000-000000000004'::uuid,
    'e0000001-0000-0000-0000-000000000005'::uuid,
    'e0000001-0000-0000-0000-000000000006'::uuid,
    'e0000001-0000-0000-0000-000000000007'::uuid,
    'e0000001-0000-0000-0000-000000000008'::uuid
  ];
  v_emp_names  text[] := ARRAY[
    'Carlos Garcia', 'Maria Lopez', 'Pedro Martinez', 'Ana Rodriguez',
    'Luis Fernandez', 'Carmen Sanchez', 'Javier Ruiz', 'Elena Torres'
  ];
  v_emp_roles  text[] := ARRAY[
    'Head Chef', 'Sous Chef', 'Line Cook', 'Line Cook',
    'Waiter', 'Waiter', 'Waiter', 'Host'
  ];
  v_emp_costs  numeric[] := ARRAY[22.00, 18.00, 14.50, 14.50, 13.00, 13.00, 12.50, 12.00];
  v_emp_idx    int;

  v_schedule_id uuid;
  v_shift_id    uuid;
  v_shift_start timestamptz;
  v_shift_end   timestamptz;
  v_clock_in    timestamptz;
  v_clock_out   timestamptz;
  v_sc_id       uuid;

  v_mi_names    text[] := ARRAY[
    'Jamon Iberico','Croquetas de Jamon','Pimientos de Padron','Tortilla Espanola',
    'Gazpacho','Paella Valenciana','Chuleton de Buey','Bacalao al Pil-Pil',
    'Pulpo a la Gallega','Cochinillo Asado','Cerveza Estrella Galicia',
    'Tinto de Verano','Ribera del Duero','Tarta de Queso','Crema Catalana'
  ];
  v_mi_cats     text[] := ARRAY[
    'Entrantes','Entrantes','Entrantes','Entrantes','Entrantes',
    'Principales','Principales','Principales','Principales','Principales',
    'Bebidas','Bebidas','Vinos','Postres','Postres'
  ];
  v_mi_prices   numeric[] := ARRAY[18.50,9.50,8.00,10.00,7.50,22.00,32.00,24.00,19.50,28.00,3.50,4.00,6.50,8.50,7.50];
  v_mi_id       uuid;
  v_mi_idx      int;

  v_order_id    uuid;
  v_order_time  timestamptz;
  v_order_idx   int;
  v_item_idx    int;
  v_chosen_item int;
  v_max_orders  int;
  v_item_count  int;
  v_week_start  date;

BEGIN
  SELECT id INTO v_org_id FROM groups LIMIT 1;
  IF v_org_id IS NULL THEN RAISE NOTICE 'No org.'; RETURN; END IF;

  SELECT array_agg(id ORDER BY name) INTO v_loc_ids
  FROM locations WHERE org_id = v_org_id AND active = true;
  IF v_loc_ids IS NULL OR array_length(v_loc_ids, 1) = 0 THEN RAISE NOTICE 'No locations.'; RETURN; END IF;

  RAISE NOTICE 'Seeding: org=%, locs=%', v_org_id, array_length(v_loc_ids, 1);

  -- 1. EMPLOYEES
  FOR v_emp_idx IN 1..8 LOOP
    INSERT INTO employees (id, org_id, full_name, email, role_name, hourly_cost, status)
    VALUES (
      v_emp_ids[v_emp_idx], v_org_id,
      v_emp_names[v_emp_idx],
      lower(replace(v_emp_names[v_emp_idx], ' ', '.')) || '@josephine.app',
      v_emp_roles[v_emp_idx], v_emp_costs[v_emp_idx], 'active'
    )
    ON CONFLICT (id) DO UPDATE SET hourly_cost = EXCLUDED.hourly_cost, role_name = EXCLUDED.role_name;
  END LOOP;
  RAISE NOTICE 'OK: 8 employees';

  -- 2. MENU ITEMS + CDM ITEMS
  FOR v_mi_idx IN 1..15 LOOP
    v_mi_id := ('d0000000-0000-0000-0000-' || lpad(v_mi_idx::text, 12, '0'))::uuid;

    INSERT INTO menu_items (id, org_id, name, category, is_active)
    VALUES (v_mi_id, v_org_id, v_mi_names[v_mi_idx], v_mi_cats[v_mi_idx], true)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category;

    INSERT INTO cdm_items (id, org_id, name, category, is_active, external_id, metadata)
    VALUES (v_mi_id, v_org_id, v_mi_names[v_mi_idx], v_mi_cats[v_mi_idx],
            true, 'demo-item-' || v_mi_idx, '{}'::jsonb)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category;
  END LOOP;
  RAISE NOTICE 'OK: 15 menu + cdm items';

  -- 3. PER-LOCATION DATA
  FOR v_loc_idx IN 1..array_length(v_loc_ids, 1) LOOP
    v_loc_id := v_loc_ids[v_loc_idx];
    SELECT name INTO v_loc_name FROM locations WHERE id = v_loc_id;

    -- Stock count
    v_sc_id := ('c0000000-0000-0000-0000-' || lpad(v_loc_idx::text, 12, '0'))::uuid;
    INSERT INTO stock_counts (id, group_id, location_id, start_date, end_date, status)
    VALUES (v_sc_id, v_org_id, v_loc_id, '2026-03-01', '2026-03-31', 'completed')
    ON CONFLICT (id) DO NOTHING;

    -- Stock count lines
    FOR v_mi_idx IN 1..15 LOOP
      v_mi_id := ('d0000000-0000-0000-0000-' || lpad(v_mi_idx::text, 12, '0'))::uuid;
      INSERT INTO stock_count_lines (id, stock_count_id, inventory_item_id,
        opening_qty, deliveries_qty, transfers_net_qty, closing_qty, used_qty, sales_qty, variance_qty)
      VALUES (
        ('b00' || lpad(v_loc_idx::text, 2, '0') || '000-0000-0000-0000-' || lpad(v_mi_idx::text, 12, '0'))::uuid,
        v_sc_id, v_mi_id,
        50+v_mi_idx*3, 30+v_mi_idx*2, 0, 25+v_mi_idx*2,
        (50+v_mi_idx*3+30+v_mi_idx*2)-(25+v_mi_idx*2),
        (50+v_mi_idx*3+30+v_mi_idx*2)-(25+v_mi_idx*2)-2, 2)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;

    -- WEEKLY SCHEDULES (Mon to Mon)
    v_week_start := '2026-03-02'::date;
    WHILE v_week_start <= '2026-03-30'::date LOOP
      v_schedule_id := gen_random_uuid();
      INSERT INTO schedules (id, org_id, location_id, week_start, status)
      VALUES (v_schedule_id, v_org_id, v_loc_id, v_week_start, 'published')
      ON CONFLICT DO NOTHING;

      -- DAILY LOOP
      v_day := v_week_start;
      WHILE v_day < v_week_start + 7 AND v_day <= LEAST('2026-03-31'::date, CURRENT_DATE) LOOP
        v_day_of_week := EXTRACT(DOW FROM v_day)::int;
        v_is_weekend := v_day_of_week IN (0, 5, 6);
        v_daily_sales := CASE WHEN v_is_weekend
          THEN 3200 + v_loc_idx * 200 + (random() * 400 - 200)
          ELSE 2200 + v_loc_idx * 150 + (random() * 300 - 150)
        END;

        -- Morning shift (kitchen 08-16)
        v_shift_id := gen_random_uuid();
        v_shift_start := (v_day::text || ' 08:00:00+01')::timestamptz;
        v_shift_end   := (v_day::text || ' 16:00:00+01')::timestamptz;
        INSERT INTO shifts (id, schedule_id, location_id, start_at, end_at, required_headcount)
        VALUES (v_shift_id, v_schedule_id, v_loc_id, v_shift_start, v_shift_end, 3)
        ON CONFLICT (id) DO NOTHING;
        FOR v_emp_idx IN 1..3 LOOP
          INSERT INTO shift_assignments (shift_id, employee_id)
          VALUES (v_shift_id, v_emp_ids[v_emp_idx])
          ON CONFLICT DO NOTHING;
        END LOOP;

        -- Evening shift (floor 16-00)
        v_shift_id := gen_random_uuid();
        v_shift_start := (v_day::text || ' 16:00:00+01')::timestamptz;
        v_shift_end   := (v_day::text || ' 23:59:00+01')::timestamptz;
        INSERT INTO shifts (id, schedule_id, location_id, start_at, end_at, required_headcount)
        VALUES (v_shift_id, v_schedule_id, v_loc_id, v_shift_start, v_shift_end, 4)
        ON CONFLICT (id) DO NOTHING;
        FOR v_emp_idx IN 4..7 LOOP
          INSERT INTO shift_assignments (shift_id, employee_id)
          VALUES (v_shift_id, v_emp_ids[v_emp_idx])
          ON CONFLICT DO NOTHING;
        END LOOP;

        -- Host shift (11-23)
        v_shift_id := gen_random_uuid();
        v_shift_start := (v_day::text || ' 11:00:00+01')::timestamptz;
        v_shift_end   := (v_day::text || ' 23:00:00+01')::timestamptz;
        INSERT INTO shifts (id, schedule_id, location_id, start_at, end_at, required_headcount)
        VALUES (v_shift_id, v_schedule_id, v_loc_id, v_shift_start, v_shift_end, 1)
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO shift_assignments (shift_id, employee_id)
        VALUES (v_shift_id, v_emp_ids[8])
        ON CONFLICT DO NOTHING;

        -- Time entries: kitchen (08-16)
        FOR v_emp_idx IN 1..3 LOOP
          v_clock_in  := (v_day::text || ' 07:45:00+01')::timestamptz + make_interval(mins => (random()*20)::int);
          v_clock_out := (v_day::text || ' 16:00:00+01')::timestamptz + make_interval(mins => (random()*30-10)::int);
          INSERT INTO time_entries (id, org_id, location_id, employee_id, clock_in, clock_out, source)
          VALUES (gen_random_uuid(), v_org_id, v_loc_id, v_emp_ids[v_emp_idx], v_clock_in, v_clock_out, 'app')
          ON CONFLICT DO NOTHING;
        END LOOP;

        -- Time entries: floor (16-00)
        FOR v_emp_idx IN 4..7 LOOP
          v_clock_in  := (v_day::text || ' 15:50:00+01')::timestamptz + make_interval(mins => (random()*15)::int);
          v_clock_out := (v_day::text || ' 23:50:00+01')::timestamptz + make_interval(mins => (random()*20)::int);
          INSERT INTO time_entries (id, org_id, location_id, employee_id, clock_in, clock_out, source)
          VALUES (gen_random_uuid(), v_org_id, v_loc_id, v_emp_ids[v_emp_idx], v_clock_in, v_clock_out, 'app')
          ON CONFLICT DO NOTHING;
        END LOOP;

        -- Time entry: host (11-23)
        v_clock_in  := (v_day::text || ' 10:55:00+01')::timestamptz + make_interval(mins => (random()*10)::int);
        v_clock_out := (v_day::text || ' 22:55:00+01')::timestamptz + make_interval(mins => (random()*15)::int);
        INSERT INTO time_entries (id, org_id, location_id, employee_id, clock_in, clock_out, source)
        VALUES (gen_random_uuid(), v_org_id, v_loc_id, v_emp_ids[8], v_clock_in, v_clock_out, 'app')
        ON CONFLICT DO NOTHING;

        -- CDM Orders + Lines (Menu Engineering)
        v_max_orders := CASE WHEN v_is_weekend THEN 8 ELSE 5 END;
        FOR v_order_idx IN 1..v_max_orders LOOP
          v_order_id := gen_random_uuid();
          v_order_time := (v_day::text || ' ' || lpad((12 + v_order_idx % 10)::text, 2, '0') || ':' || lpad((v_order_idx * 7 % 60)::text, 2, '0') || ':00+01')::timestamptz;

          INSERT INTO cdm_orders (id, org_id, location_id, opened_at, closed_at, net_sales, gross_sales, discounts, external_id, metadata)
          VALUES (v_order_id, v_org_id, v_loc_id, v_order_time, v_order_time + interval '45 minutes',
                  v_daily_sales / v_max_orders, v_daily_sales / v_max_orders * 1.05,
                  v_daily_sales / v_max_orders * 0.05,
                  'demo-ord-' || v_loc_idx || '-' || v_day || '-' || v_order_idx, '{}'::jsonb)
          ON CONFLICT DO NOTHING;

          v_item_count := 2 + (v_order_idx % 3);
          FOR v_item_idx IN 1..v_item_count LOOP
            v_chosen_item := ((v_order_idx + v_item_idx + v_loc_idx) % 15) + 1;
            INSERT INTO cdm_order_lines (id, org_id, order_id, item_id, name, qty, gross, net, metadata)
            VALUES (gen_random_uuid(), v_org_id, v_order_id,
                    ('d0000000-0000-0000-0000-' || lpad(v_chosen_item::text, 12, '0'))::uuid,
                    v_mi_names[v_chosen_item],
                    1 + (v_item_idx % 3),
                    v_mi_prices[v_chosen_item] * (1 + (v_item_idx % 3)),
                    v_mi_prices[v_chosen_item] * (1 + (v_item_idx % 3)) * 0.95,
                    '{}'::jsonb)
            ON CONFLICT DO NOTHING;
          END LOOP;
        END LOOP;

        v_day := v_day + 1;
      END LOOP; -- daily

      v_week_start := v_week_start + 7;
    END LOOP; -- weekly

    RAISE NOTICE 'OK: Location %: %', v_loc_idx, v_loc_name;
  END LOOP; -- locations

  RAISE NOTICE 'All seed data inserted';
END $$;

REFRESH MATERIALIZED VIEW product_sales_daily_unified_mv;

REFRESH MATERIALIZED VIEW sales_hourly_unified_mv;

REFRESH MATERIALIZED VIEW mart_kpi_daily_mv;

REFRESH MATERIALIZED VIEW mart_sales_category_daily_mv;


-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES (37)
-- ═══════════════════════════════════════════════════════════════════════════

-- table: ai_conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  user_id       uuid NOT NULL,
  location_id   uuid REFERENCES locations(id) ON DELETE SET NULL,
  title         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- table: ai_messages
CREATE TABLE IF NOT EXISTS ai_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user','assistant','system')),
  content         text NOT NULL,
  tool_calls      jsonb,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- table: ai_order_guide_items
CREATE TABLE IF NOT EXISTS ai_order_guide_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_guide_id    uuid NOT NULL REFERENCES ai_order_guides(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  forecast_need_qty numeric(12,3) NOT NULL DEFAULT 0,
  on_hand_qty       numeric(12,3) NOT NULL DEFAULT 0,
  order_qty         numeric(12,3) NOT NULL DEFAULT 0,
  unit              text,
  unit_cost         numeric(10,2) NOT NULL DEFAULT 0,
  line_total        numeric(12,2) GENERATED ALWAYS AS (order_qty * unit_cost) STORED,
  supplier_name     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- table: ai_order_guides
CREATE TABLE IF NOT EXISTS ai_order_guides (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL,
  location_id           uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_start_date   date NOT NULL,
  forecast_end_date     date NOT NULL,
  generated_at          timestamptz NOT NULL DEFAULT now(),
  status                text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','sent','received','cancelled')),
  total_estimated_cost  numeric(12,2) NOT NULL DEFAULT 0,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- table: announcements
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  location_id uuid,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'info',
  pinned boolean NOT NULL DEFAULT false,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- table: budget_days
CREATE TABLE IF NOT EXISTS budget_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_version_id uuid NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  location_id uuid NOT NULL,
  day date NOT NULL,
  UNIQUE(budget_version_id, location_id, day)
);

-- table: budget_drivers
CREATE TABLE IF NOT EXISTS budget_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_day_id uuid NOT NULL REFERENCES budget_days(id) ON DELETE CASCADE,
  target_covers numeric DEFAULT 0,
  target_avg_check numeric DEFAULT 0,
  target_cogs_pct numeric DEFAULT 0,
  target_labour_hours numeric DEFAULT 0,
  target_hourly_rate numeric DEFAULT 0,
  UNIQUE(budget_day_id)
);

-- table: budget_metrics
CREATE TABLE IF NOT EXISTS budget_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_day_id uuid NOT NULL REFERENCES budget_days(id) ON DELETE CASCADE,
  metric text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  layer text NOT NULL DEFAULT 'final' CHECK (layer IN ('base','adjustment','final')),
  UNIQUE(budget_day_id, metric, layer)
);

-- table: budget_versions
CREATE TABLE IF NOT EXISTS budget_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  location_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  period_start date,
  period_end date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','frozen','archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- table: cash_counts_daily
CREATE TABLE IF NOT EXISTS cash_counts_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  location_id uuid NOT NULL,
  date date NOT NULL,
  cash_expected numeric DEFAULT 0,
  cash_counted numeric DEFAULT 0,
  variance numeric DEFAULT 0,
  counted_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(location_id, date)
);

-- table: compliance_tokens
CREATE TABLE IF NOT EXISTS compliance_tokens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id  uuid NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  provider         text NOT NULL CHECK (provider IN ('tgss','aeat','sepe','other')),
  certificate_ref  text,
  expires_at       timestamptz,
  is_active        boolean NOT NULL DEFAULT true,
  metadata         jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- table: employee_breaks
CREATE TABLE IF NOT EXISTS employee_breaks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clock_record_id uuid NOT NULL REFERENCES employee_clock_records(id) ON DELETE CASCADE,
  break_start     timestamptz NOT NULL DEFAULT now(),
  break_end       timestamptz,
  break_type      text NOT NULL DEFAULT 'unpaid'
                  CHECK (break_type IN ('paid','unpaid','meal')),
  duration_minutes int GENERATED ALWAYS AS (
    CASE WHEN break_end IS NOT NULL
      THEN EXTRACT(EPOCH FROM (break_end - break_start))::int / 60
      ELSE NULL
    END
  ) STORED,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- table: employee_clock_records
CREATE TABLE IF NOT EXISTS employee_clock_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  clock_in    timestamptz NOT NULL DEFAULT now(),
  clock_out   timestamptz,
  clock_in_lat  double precision,
  clock_in_lng  double precision,
  clock_out_lat double precision,
  clock_out_lng double precision,
  source      text NOT NULL DEFAULT 'manual'
              CHECK (source IN ('manual','geo','kiosk','api')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- table: employee_reviews
CREATE TABLE IF NOT EXISTS employee_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  employee_id   uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id   uuid NOT NULL,
  location_id   uuid REFERENCES locations(id) ON DELETE SET NULL,
  review_date   date NOT NULL DEFAULT CURRENT_DATE,
  overall_rating int NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  categories    jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- e.g. { "punctuality": 4, "teamwork": 5, "quality": 3, "initiative": 4, "attitude": 5 }
  strengths     text,
  improvements  text,
  goals         text,
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','submitted','acknowledged')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- table: event_calendar
CREATE TABLE IF NOT EXISTS event_calendar (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  location_id   uuid REFERENCES locations(id) ON DELETE CASCADE,
  event_date    date NOT NULL,
  name          text NOT NULL,
  event_type    text NOT NULL DEFAULT 'local'
                CHECK (event_type IN ('holiday','sports','concert','festival','local','weather','custom')),
  impact_multiplier numeric(4,2) NOT NULL DEFAULT 1.0,
  recurrence    text DEFAULT 'none'
                CHECK (recurrence IN ('none','yearly','monthly','weekly')),
  city          text,
  source        text DEFAULT 'manual'
                CHECK (source IN ('manual','api','system')),
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- table: inventory_counts
CREATE TABLE IF NOT EXISTS inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES locations(id),
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  counted_by uuid,
  count_date date NOT NULL DEFAULT CURRENT_DATE,
  stock_expected numeric NOT NULL DEFAULT 0,
  stock_actual numeric NOT NULL DEFAULT 0,
  variance numeric NOT NULL DEFAULT 0,
  variance_pct numeric NOT NULL DEFAULT 0,
  unit_cost numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- table: inventory_item_location
CREATE TABLE IF NOT EXISTS inventory_item_location (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  location_id uuid NOT NULL,
  on_hand numeric DEFAULT 0,
  reorder_point numeric DEFAULT 0,
  safety_stock numeric DEFAULT 0,
  UNIQUE(item_id, location_id)
);

-- table: inventory_items
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  category_name text DEFAULT 'Other',
  unit text DEFAULT 'unidad',
  par_level numeric DEFAULT 0,
  last_cost numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- table: labour_alerts
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

-- table: labour_rules
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

-- table: manager_logbook
CREATE TABLE IF NOT EXISTS manager_logbook (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL,
  shift_date  date NOT NULL DEFAULT CURRENT_DATE,
  category    text NOT NULL DEFAULT 'general'
              CHECK (category IN ('general','incident','staffing','inventory','maintenance','customer')),
  content     text NOT NULL,
  severity    text NOT NULL DEFAULT 'info'
              CHECK (severity IN ('info','warning','critical')),
  resolved    boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- table: menu_engineering_actions
CREATE TABLE IF NOT EXISTS menu_engineering_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  location_id uuid REFERENCES locations(id),
  date_from date NOT NULL,
  date_to date NOT NULL,
  product_id uuid,
  action_type text NOT NULL,
  classification text NOT NULL,
  estimated_impact_eur numeric,
  created_at timestamptz DEFAULT now()
);

-- table: monthly_cost_entries
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

-- table: ops.mv_refresh_log
CREATE TABLE ops.mv_refresh_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  views_refreshed text[],
  triggered_by text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  error_message text,
  metadata jsonb
);

-- table: payslip_lines
CREATE TABLE IF NOT EXISTS payslip_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id uuid NOT NULL REFERENCES payslips(id),
  concept_code text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'earning'
);

-- table: recipes
CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  menu_item_name text NOT NULL,
  selling_price numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- table: reviews
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  location_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'google',
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text,
  reviewer_name text,
  sentiment text,
  review_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- table: stock_count_lines
CREATE TABLE IF NOT EXISTS stock_count_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id uuid NOT NULL REFERENCES stock_counts(id),
  inventory_item_id uuid NOT NULL,
  opening_qty numeric,
  deliveries_qty numeric,
  transfers_net_qty numeric,
  closing_qty numeric,
  used_qty numeric,
  sales_qty numeric,
  variance_qty numeric,
  batch_balance numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- table: stock_counts
CREATE TABLE IF NOT EXISTS stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  location_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- table: stock_movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  location_id uuid NOT NULL,
  item_id uuid,
  movement_type text NOT NULL CHECK (movement_type IN ('purchase','waste','sale_estimate','adjustment','transfer','return')),
  qty_delta numeric NOT NULL DEFAULT 0,
  unit_cost numeric DEFAULT 0,
  reference_id uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- table: tip_distribution_rules
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

-- table: tip_distributions
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

-- table: tip_entries
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

-- table: tip_role_weights
CREATE TABLE IF NOT EXISTS tip_role_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES tip_distribution_rules(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  weight numeric(5,2) NOT NULL DEFAULT 1.0 CHECK (weight >= 0),
  UNIQUE(rule_id, role_name)
);

-- table: training_records
CREATE TABLE IF NOT EXISTS training_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  cert_name       text NOT NULL,
  cert_type       text NOT NULL DEFAULT 'food_safety'
                  CHECK (cert_type IN ('food_safety','alcohol','first_aid','fire','allergen','haccp','custom')),
  issued_date     date,
  expiry_date     date,
  status          text NOT NULL DEFAULT 'valid'
                  CHECK (status IN ('valid','expiring','expired','pending')),
  document_url    text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- table: waste_events
CREATE TABLE IF NOT EXISTS waste_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  location_id uuid NOT NULL,
  inventory_item_id uuid,
  quantity numeric DEFAULT 0,
  waste_value numeric DEFAULT 0,
  reason text,
  notes text,
  logged_by uuid,
  created_at timestamptz DEFAULT now()
);

-- table: weather_cache
CREATE TABLE IF NOT EXISTS weather_cache (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_date    date NOT NULL,
  temperature_c    numeric(4,1),
  feels_like_c     numeric(4,1),
  condition        text,
  condition_detail text,
  icon_code        text,
  humidity_pct     int,
  wind_speed_ms    numeric(5,1),
  rain_mm          numeric(5,1) DEFAULT 0,
  sales_multiplier numeric(4,2) NOT NULL DEFAULT 1.00,
  fetched_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id, forecast_date)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE ALTERATIONS (21)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Main',
  ADD COLUMN IF NOT EXISTS yield_qty numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS yield_unit text DEFAULT 'portion',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS is_sub_recipe boolean DEFAULT false;

ALTER TABLE recipe_ingredients
  ADD COLUMN IF NOT EXISTS sub_recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS qty_gross numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_net numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS yield_pct numeric DEFAULT 100,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS category text DEFAULT 'Main';

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS yield_qty numeric DEFAULT 1;

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS yield_unit text DEFAULT 'portion';

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_sub_recipe boolean DEFAULT false;

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS qty_gross numeric;

ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS yield_pct numeric DEFAULT 100;

ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS unit text;

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS type text DEFAULT 'Food';

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS category_name text;

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS order_unit text;

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS order_unit_qty numeric DEFAULT 1;

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS price numeric;

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS vat_rate numeric DEFAULT 10;

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS category_name text;

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS latitude       double precision,
  ADD COLUMN IF NOT EXISTS longitude      double precision,
  ADD COLUMN IF NOT EXISTS geofence_radius_m int NOT NULL DEFAULT 200;

ALTER TABLE public.legal_entities ADD COLUMN IF NOT EXISTS iban TEXT;

ALTER TABLE public.legal_entities ADD COLUMN IF NOT EXISTS bic TEXT;


-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — ENABLE (30)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_engineering_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE labour_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE labour_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_distribution_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_role_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_clock_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_logbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_order_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_order_guide_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_item_location ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_counts_daily ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES (56)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_daily_sales_org_loc_day
  ON daily_sales (org_id, location_id, day);

CREATE INDEX IF NOT EXISTS idx_time_entries_org_loc
  ON time_entries (org_id, location_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_loc_clockin
  ON time_entries (location_id, clock_in);

CREATE INDEX IF NOT EXISTS idx_shifts_loc_start
  ON shifts (location_id, start_at);

CREATE INDEX IF NOT EXISTS idx_forecast_points_org_loc_day
  ON forecast_points (org_id, location_id, day);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_org_loc_status
  ON forecast_runs (org_id, location_id, status, finished_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_budget_days_org_loc_day
  ON budget_days (org_id, location_id, day);

CREATE INDEX IF NOT EXISTS idx_budget_metrics_day_layer
  ON budget_metrics (budget_day_id, layer);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user
  ON org_memberships (user_id);

CREATE INDEX IF NOT EXISTS idx_location_memberships_user
  ON location_memberships (user_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_loc_type
  ON stock_movements (location_id, movement_type, created_at);

CREATE INDEX IF NOT EXISTS idx_cdm_orders_org_loc_closed
  ON cdm_orders (org_id, location_id, closed_at)
  WHERE closed_at IS NOT NULL;

CREATE UNIQUE INDEX idx_product_sales_daily_unified_mv_pk
  ON product_sales_daily_unified_mv (org_id, location_id, day, product_id);

CREATE UNIQUE INDEX idx_sales_hourly_unified_mv_pk
  ON sales_hourly_unified_mv (org_id, location_id, hour_bucket);

CREATE UNIQUE INDEX idx_mart_kpi_daily_mv_pk
  ON mart_kpi_daily_mv (org_id, location_id, date);

CREATE UNIQUE INDEX idx_mart_sales_category_daily_mv_pk
  ON mart_sales_category_daily_mv (org_id, location_id, date, product_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id
  ON recipe_ingredients(recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_sub_recipe_id
  ON recipe_ingredients(sub_recipe_id);

CREATE INDEX IF NOT EXISTS idx_ri_menu_item_id ON recipe_ingredients(menu_item_id);

CREATE INDEX IF NOT EXISTS idx_ri_sub_recipe_id ON recipe_ingredients(sub_recipe_id);

CREATE INDEX IF NOT EXISTS idx_ic_org_location ON inventory_counts(org_id, location_id);

CREATE INDEX IF NOT EXISTS idx_ic_item ON inventory_counts(item_id);

CREATE INDEX IF NOT EXISTS idx_ic_date ON inventory_counts(count_date DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_loc_date
  ON reviews (location_id, review_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_hourly_unified_mv_v2_pk
  ON sales_hourly_unified_mv_v2 (org_id, location_id, day, hour_bucket, data_source);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_sales_daily_unified_mv_v2_pk
  ON product_sales_daily_unified_mv_v2 (org_id, location_id, day, product_id, data_source);

CREATE UNIQUE INDEX IF NOT EXISTS idx_psdu_mv_uniq
  ON product_sales_daily_unified_mv (org_id, location_id, day, product_id);

CREATE UNIQUE INDEX IF NOT EXISTS integration_accounts_integration_external_account_key
  ON integration_accounts (integration_id, external_account_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mart_sales_category_daily_mv_pk
  ON mart_sales_category_daily_mv (org_id, location_id, date, product_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mkd_mv ON mart_kpi_daily_mv (org_id, location_id, date, data_source);

CREATE INDEX IF NOT EXISTS idx_labour_alerts_unread
  ON labour_alerts (org_id, is_read, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_clock_records_employee
  ON employee_clock_records(employee_id, clock_in DESC);

CREATE INDEX IF NOT EXISTS idx_clock_records_location
  ON employee_clock_records(location_id, clock_in DESC);

CREATE INDEX IF NOT EXISTS idx_clock_records_active
  ON employee_clock_records(location_id)
  WHERE clock_out IS NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_tokens_entity
  ON compliance_tokens(legal_entity_id);

CREATE INDEX IF NOT EXISTS idx_breaks_clock_record
  ON employee_breaks(clock_record_id);

CREATE INDEX IF NOT EXISTS idx_logbook_location_date
  ON manager_logbook(location_id, shift_date DESC);

CREATE INDEX IF NOT EXISTS idx_logbook_org
  ON manager_logbook(org_id, shift_date DESC);

CREATE INDEX IF NOT EXISTS idx_logbook_unresolved
  ON manager_logbook(location_id)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_order_guides_location
  ON ai_order_guides(location_id, forecast_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_order_guides_org
  ON ai_order_guides(org_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_guide_items_guide
  ON ai_order_guide_items(order_guide_id);

CREATE INDEX IF NOT EXISTS idx_order_guide_items_item
  ON ai_order_guide_items(inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_weather_location_date
  ON weather_cache(location_id, forecast_date);

CREATE INDEX IF NOT EXISTS idx_reviews_employee
  ON employee_reviews(employee_id, review_date DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_org
  ON employee_reviews(org_id, review_date DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_location
  ON employee_reviews(location_id, review_date DESC);

CREATE INDEX IF NOT EXISTS idx_events_location_date
  ON event_calendar(location_id, event_date);

CREATE INDEX IF NOT EXISTS idx_events_org_date
  ON event_calendar(org_id, event_date);

CREATE INDEX IF NOT EXISTS idx_events_date_range
  ON event_calendar(event_date)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_training_employee
  ON training_records(employee_id);

CREATE INDEX IF NOT EXISTS idx_training_expiry
  ON training_records(expiry_date)
  WHERE status != 'expired';

CREATE INDEX IF NOT EXISTS idx_training_org
  ON training_records(org_id);

CREATE INDEX IF NOT EXISTS idx_conversations_user
  ON ai_conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_org
  ON ai_conversations(org_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON ai_messages(conversation_id, created_at);


-- ═══════════════════════════════════════════════════════════════════════════
-- VIEWS (15)
-- ═══════════════════════════════════════════════════════════════════════════

-- view: budget_daily_unified
CREATE OR REPLACE VIEW budget_daily_unified AS
SELECT
  bd.org_id,
  bd.location_id,
  bd.day,
  COALESCE(MAX(CASE WHEN bm.metric = 'sales_net'    THEN bm.value END), 0)::numeric AS budget_sales,
  COALESCE(MAX(CASE WHEN bm.metric = 'labour_cost'  THEN bm.value END), 0)::numeric AS budget_labour,
  COALESCE(MAX(CASE WHEN bm.metric = 'cogs'         THEN bm.value END), 0)::numeric AS budget_cogs,
  -- profit = sales - labour - cogs
  (COALESCE(MAX(CASE WHEN bm.metric = 'sales_net'   THEN bm.value END), 0)
 - COALESCE(MAX(CASE WHEN bm.metric = 'labour_cost' THEN bm.value END), 0)
 - COALESCE(MAX(CASE WHEN bm.metric = 'cogs'        THEN bm.value END), 0))::numeric AS budget_profit,
  -- margin_pct = profit / sales * 100
  CASE WHEN COALESCE(MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END), 0) > 0
    THEN ((COALESCE(MAX(CASE WHEN bm.metric = 'sales_net'   THEN bm.value END), 0)
         - COALESCE(MAX(CASE WHEN bm.metric = 'labour_cost' THEN bm.value END), 0)
         - COALESCE(MAX(CASE WHEN bm.metric = 'cogs'        THEN bm.value END), 0))
         / MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END) * 100)::numeric
    ELSE 0 END AS budget_margin_pct,
  -- col_pct = labour / sales * 100
  CASE WHEN COALESCE(MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END), 0) > 0
    THEN (COALESCE(MAX(CASE WHEN bm.metric = 'labour_cost' THEN bm.value END), 0)
         / MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END) * 100)::numeric
    ELSE 0 END AS budget_col_pct,
  -- cogs_pct = cogs / sales * 100
  CASE WHEN COALESCE(MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END), 0) > 0
    THEN (COALESCE(MAX(CASE WHEN bm.metric = 'cogs'        THEN bm.value END), 0)
         / MAX(CASE WHEN bm.metric = 'sales_net' THEN bm.value END) * 100)::numeric
    ELSE 0 END AS budget_cogs_pct,
  -- budget_drivers columns
  COALESCE(MAX(drv.target_covers), 0)::numeric           AS target_covers,
  COALESCE(MAX(drv.target_avg_check), 0)::numeric        AS target_avg_check,
  COALESCE(MAX(drv.target_cogs_pct), 0)::numeric         AS target_cogs_pct,
  COALESCE(MAX(drv.target_labour_hours), 0)::numeric     AS target_labour_hours,
  COALESCE(MAX(drv.target_hourly_rate), 0)::numeric      AS target_hourly_rate
FROM budget_days bd
JOIN budget_versions bv ON bv.id = bd.budget_version_id
LEFT JOIN budget_metrics bm
  ON bm.budget_day_id = bd.id
  AND bm.layer IN ('final', 'base')
LEFT JOIN budget_drivers drv
  ON drv.budget_day_id = bd.id
WHERE bv.status IN ('published', 'frozen')
GROUP BY bd.org_id, bd.location_id, bd.day;

-- view: cogs_daily
CREATE VIEW cogs_daily AS
SELECT
  l.org_id,
  sm.location_id,
  (sm.created_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date AS date,
  SUM(ABS(sm.qty_delta) * COALESCE(sm.unit_cost, 0))::numeric             AS cogs_amount
FROM stock_movements sm
JOIN locations l ON l.id = sm.location_id
WHERE sm.movement_type IN ('waste', 'sale_estimate')
GROUP BY l.org_id, sm.location_id,
  (sm.created_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date;

-- view: forecast_daily_unified
CREATE OR REPLACE VIEW public.forecast_daily_unified AS
SELECT
  r.org_id,
  r.location_id,
  r.day,
  r.forecast_sales,
  r.forecast_orders,
  r.planned_labor_hours,
  r.planned_labor_cost,
  r.forecast_avg_check,
  r.forecast_sales_lower,
  r.forecast_sales_upper,
  r.data_source
FROM (
  -- ── DEMO: forecast_runs + forecast_points ───────────────────
  SELECT
    fp.org_id,
    fp.location_id,
    fp.day,
    COALESCE(fp.yhat, 0)::numeric                          AS forecast_sales,
    ROUND(COALESCE(fp.yhat, 0) / NULLIF(25, 0))::integer  AS forecast_orders,
    ROUND(COALESCE(fp.yhat, 0) * 0.28 / 14.50, 1)::numeric AS planned_labor_hours,
    ROUND(COALESCE(fp.yhat, 0) * 0.28, 2)::numeric        AS planned_labor_cost,
    25::numeric                                            AS forecast_avg_check,
    COALESCE(fp.yhat_lower, 0)::numeric                    AS forecast_sales_lower,
    COALESCE(fp.yhat_upper, 0)::numeric                    AS forecast_sales_upper,
    'demo'::text                                           AS data_source
  FROM forecast_points fp
  JOIN (
    SELECT DISTINCT ON (org_id, location_id)
      id, org_id, location_id
    FROM forecast_runs
    WHERE status IN ('finished','completed')
    ORDER BY org_id, location_id, finished_at DESC NULLS LAST
  ) lr ON lr.id = fp.forecast_run_id

  UNION ALL

  -- ── POS: weekday-average heuristic (56-day history → 14-day horizon)
  SELECT
    hist.org_id,
    hist.location_id,
    fd.day,
    COALESCE(dow_avg.avg_sales, hist.overall_avg_sales, 0)::numeric   AS forecast_sales,
    COALESCE(dow_avg.avg_orders, hist.overall_avg_orders, 0)::integer AS forecast_orders,
    ROUND(
      COALESCE(dow_avg.avg_sales, hist.overall_avg_sales, 0)
      * COALESCE(ls.target_col_percent, 28) / 100.0
      / NULLIF(COALESCE(ls.default_hourly_cost, 14.50), 0), 1
    )::numeric                                                        AS planned_labor_hours,
    ROUND(
      COALESCE(dow_avg.avg_sales, hist.overall_avg_sales, 0)
      * COALESCE(ls.target_col_percent, 28) / 100.0, 2
    )::numeric                                                        AS planned_labor_cost,
    CASE WHEN COALESCE(dow_avg.avg_orders, hist.overall_avg_orders, 0) > 0
         THEN ROUND(
           COALESCE(dow_avg.avg_sales, hist.overall_avg_sales, 0)
           / COALESCE(dow_avg.avg_orders, hist.overall_avg_orders, 1), 2
         )::numeric
         ELSE 0 END                                                   AS forecast_avg_check,
    ROUND(COALESCE(dow_avg.avg_sales, hist.overall_avg_sales, 0) * 0.85, 2)::numeric AS forecast_sales_lower,
    ROUND(COALESCE(dow_avg.avg_sales, hist.overall_avg_sales, 0) * 1.15, 2)::numeric AS forecast_sales_upper,
    'pos'::text                                                       AS data_source
  FROM (
    -- Per-location overall averages from last 56 days of POS orders
    SELECT
      o.org_id,
      o.location_id,
      ROUND(AVG(day_sales), 2)   AS overall_avg_sales,
      ROUND(AVG(day_orders))     AS overall_avg_orders
    FROM (
      SELECT
        org_id, location_id,
        (closed_at)::date AS d,
        SUM(net_sales)    AS day_sales,
        COUNT(*)          AS day_orders
      FROM cdm_orders
      WHERE closed_at IS NOT NULL
        AND (provider IS NOT NULL OR integration_account_id IS NOT NULL)
        AND closed_at >= (current_date - 56)
      GROUP BY org_id, location_id, (closed_at)::date
    ) o
    GROUP BY o.org_id, o.location_id
  ) hist
  -- Generate 14 future days
  CROSS JOIN LATERAL generate_series(
    current_date, current_date + 13, '1 day'::interval
  ) AS fd(day)
  -- Weekday-specific averages
  LEFT JOIN LATERAL (
    SELECT
      ROUND(AVG(day_sales), 2) AS avg_sales,
      ROUND(AVG(day_orders))   AS avg_orders
    FROM (
      SELECT
        SUM(net_sales) AS day_sales,
        COUNT(*)       AS day_orders
      FROM cdm_orders
      WHERE org_id = hist.org_id
        AND location_id = hist.location_id
        AND closed_at IS NOT NULL
        AND (provider IS NOT NULL OR integration_account_id IS NOT NULL)
        AND closed_at >= (current_date - 56)
        AND EXTRACT(DOW FROM closed_at) = EXTRACT(DOW FROM fd.day)
      GROUP BY (closed_at)::date
    ) wd
  ) dow_avg ON true
  LEFT JOIN location_settings ls ON ls.location_id = hist.location_id
) r
-- ── Filter by resolved data source ───────────────────────────
JOIN LATERAL resolve_data_source(r.org_id) ds ON true
WHERE ds->>'data_source' = r.data_source;

-- view: groups
CREATE OR REPLACE VIEW groups AS
SELECT id, name FROM orgs;

-- view: inventory_position_unified
CREATE OR REPLACE VIEW inventory_position_unified AS
SELECT
  l.org_id,
  ii.id                                                   AS item_id,
  il.location_id,
  ii.name,
  ii.category_name,
  ii.unit,
  COALESCE(il.on_hand, 0)::numeric                        AS on_hand,
  COALESCE(ii.par_level, 0)::numeric                       AS par_level,
  COALESCE(il.reorder_point, 0)::numeric                   AS reorder_point,
  COALESCE(il.safety_stock, 0)::numeric                    AS safety_stock,
  COALESCE(ii.last_cost, 0)::numeric                       AS last_cost,
  GREATEST(COALESCE(ii.par_level, 0) - COALESCE(il.on_hand, 0), 0)::numeric AS deficit
FROM inventory_items ii
JOIN inventory_item_location il ON il.item_id = ii.id
JOIN locations l ON l.id = il.location_id;

-- view: labour_daily_unified
CREATE OR REPLACE VIEW labour_daily_unified AS
SELECT
  COALESCE(a.org_id,       s.org_id)       AS org_id,
  COALESCE(a.location_id,  s.location_id)  AS location_id,
  COALESCE(a.day,          s.day)          AS day,
  COALESCE(a.actual_hours, 0)::numeric     AS actual_hours,
  COALESCE(a.actual_cost,  0)::numeric     AS actual_cost,
  COALESCE(s.scheduled_hours, 0)::numeric  AS scheduled_hours,
  COALESCE(s.scheduled_cost,  0)::numeric  AS scheduled_cost,
  COALESCE(s.scheduled_headcount, 0)::integer AS scheduled_headcount,
  (COALESCE(a.actual_hours, 0) - COALESCE(s.scheduled_hours, 0))::numeric AS hours_variance,
  (COALESCE(a.actual_cost,  0) - COALESCE(s.scheduled_cost,  0))::numeric AS cost_variance,
  CASE WHEN COALESCE(s.scheduled_hours, 0) > 0
       THEN ((COALESCE(a.actual_hours, 0) - s.scheduled_hours) / s.scheduled_hours * 100)::numeric
       ELSE 0 END AS hours_variance_pct
FROM (
  -- Actuals: aggregate time_entries per day with real hourly_cost
  SELECT
    te.org_id,
    te.location_id,
    (te.clock_in AT TIME ZONE COALESCE(loc.timezone, 'Europe/Madrid'))::date AS day,
    SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0)          AS actual_hours,
    SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0
        * COALESCE(e.hourly_cost, 14.50))                                   AS actual_cost
  FROM time_entries te
  JOIN locations loc ON loc.id = te.location_id
  LEFT JOIN employees e ON e.id = te.employee_id
  WHERE te.clock_out IS NOT NULL
  GROUP BY te.org_id, te.location_id,
           (te.clock_in AT TIME ZONE COALESCE(loc.timezone, 'Europe/Madrid'))::date
) a
FULL OUTER JOIN (
  -- Scheduled: aggregate shifts + assignments per day with real hourly_cost
  SELECT
    sch.org_id,
    sh.location_id,
    (sh.start_at AT TIME ZONE COALESCE(loc.timezone, 'Europe/Madrid'))::date AS day,
    SUM(EXTRACT(EPOCH FROM (sh.end_at - sh.start_at)) / 3600.0)             AS scheduled_hours,
    SUM(EXTRACT(EPOCH FROM (sh.end_at - sh.start_at)) / 3600.0
        * COALESCE(e.hourly_cost, 14.50))                                    AS scheduled_cost,
    COUNT(DISTINCT sa.employee_id)::integer                                   AS scheduled_headcount
  FROM shifts sh
  JOIN schedules sch ON sch.id = sh.schedule_id
  JOIN locations loc ON loc.id = sh.location_id
  LEFT JOIN shift_assignments sa ON sa.shift_id = sh.id
  LEFT JOIN employees e ON e.id = sa.employee_id
  GROUP BY sch.org_id, sh.location_id,
           (sh.start_at AT TIME ZONE COALESCE(loc.timezone, 'Europe/Madrid'))::date
) s ON a.org_id = s.org_id AND a.location_id = s.location_id AND a.day = s.day;

-- view: low_stock_unified
CREATE OR REPLACE VIEW low_stock_unified AS
SELECT
  lsa.id                                                   AS alert_id,
  lsa.item_id,
  lsa.location_id,
  lsa.org_id,
  ii.name                                                  AS item_name,
  ii.unit,
  COALESCE(lsa.on_hand, 0)::numeric                        AS on_hand,
  COALESCE(lsa.reorder_point, 0)::numeric                  AS reorder_point,
  GREATEST(COALESCE(lsa.reorder_point, 0) - COALESCE(lsa.on_hand, 0), 0)::numeric AS deficit,
  lsa.status,
  lsa.created_at
FROM low_stock_alerts lsa
JOIN inventory_items ii ON ii.id = lsa.item_id
WHERE lsa.status != 'closed';

-- view: mart_kpi_daily
CREATE OR REPLACE VIEW mart_kpi_daily AS SELECT * FROM mart_kpi_daily_mv;

-- view: mart_sales_category_daily
CREATE OR REPLACE VIEW mart_sales_category_daily AS
SELECT * FROM mart_sales_category_daily_mv;

-- view: mart_stock_count_headers
CREATE OR REPLACE VIEW mart_stock_count_headers AS
SELECT
  sc.id,
  sc.group_id,
  sc.location_id,
  l.name AS location_name,
  sc.start_date,
  sc.end_date,
  sc.status,
  sc.created_at,
  sc.updated_at,
  COUNT(scl.id)::integer AS line_count,
  COALESCE(SUM(scl.variance_qty), 0)::numeric AS total_variance_qty
FROM stock_counts sc
JOIN locations l ON l.id = sc.location_id
LEFT JOIN stock_count_lines scl ON scl.stock_count_id = sc.id
GROUP BY sc.id, sc.group_id, sc.location_id, l.name,
         sc.start_date, sc.end_date, sc.status,
         sc.created_at, sc.updated_at;

-- view: mart_stock_count_lines_enriched
CREATE OR REPLACE VIEW mart_stock_count_lines_enriched AS
SELECT
  scl.id,
  scl.stock_count_id,
  sc.group_id,
  sc.location_id,
  sc.start_date,
  sc.end_date,
  sc.status AS count_status,
  scl.inventory_item_id,
  ii.name AS item_name,
  ii.unit,
  COALESCE(ii.last_cost, 0)::numeric AS unit_cost,
  COALESCE(scl.opening_qty, 0)::numeric AS opening_qty,
  COALESCE(scl.deliveries_qty, 0)::numeric AS deliveries_qty,
  COALESCE(scl.transfers_net_qty, 0)::numeric AS transfers_net_qty,
  COALESCE(scl.closing_qty, 0)::numeric AS closing_qty,
  COALESCE(scl.used_qty, 0)::numeric AS used_qty,
  COALESCE(scl.sales_qty, 0)::numeric AS sales_qty,
  COALESCE(scl.variance_qty, 0)::numeric AS variance_qty,
  COALESCE(scl.batch_balance, 0)::numeric AS batch_balance,
  (COALESCE(scl.variance_qty, 0) * COALESCE(ii.last_cost, 0))::numeric AS variance_value
FROM stock_count_lines scl
JOIN stock_counts sc ON sc.id = scl.stock_count_id
JOIN inventory_items ii ON ii.id = scl.inventory_item_id;

-- view: product_sales_daily_unified
CREATE OR REPLACE VIEW product_sales_daily_unified AS
SELECT
  mv.org_id, mv.location_id, mv.day, mv.product_id, mv.product_name,
  mv.product_category, mv.units_sold, mv.net_sales, mv.cogs,
  mv.gross_profit, mv.margin_pct,
  'demo'::text AS data_source,
  mv.day AS date
FROM product_sales_daily_unified_mv mv
UNION ALL
SELECT
  o.org_id,
  o.location_id,
  (o.closed_at::date) AS day,
  COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
  COALESCE(ci.name, 'Unknown') AS product_name,
  COALESCE(ci.category, 'Other') AS product_category,
  COALESCE(SUM(ol.qty), 0)::integer AS units_sold,
  COALESCE(SUM(ol.gross), 0)::numeric AS net_sales,
  ROUND(COALESCE(SUM(ol.gross), 0) * 0.30, 2)::numeric AS cogs,
  ROUND(COALESCE(SUM(ol.gross), 0) * 0.70, 2)::numeric AS gross_profit,
  70.0::numeric AS margin_pct,
  'pos'::text AS data_source,
  (o.closed_at::date) AS date
FROM cdm_orders o
JOIN cdm_order_lines ol ON ol.order_id = o.id
LEFT JOIN cdm_items ci ON ci.id = ol.item_id
WHERE o.closed_at IS NOT NULL
  AND (o.provider IS NOT NULL OR o.integration_account_id IS NOT NULL)
GROUP BY o.org_id, o.location_id, o.closed_at::date,
         ol.item_id, ci.name, ci.category;

-- view: recipe_summary
CREATE VIEW recipe_summary AS
SELECT
  r.id,
  r.group_id,
  r.menu_item_name,
  r.selling_price,
  r.category,
  r.yield_qty,
  r.yield_unit,
  r.is_sub_recipe,
  r.created_at,
  COALESCE(ic.cnt, 0)::integer AS ingredient_count,
  get_recipe_food_cost(r.id) AS food_cost,
  CASE WHEN COALESCE(r.selling_price, 0) > 0
    THEN ROUND(get_recipe_food_cost(r.id) / r.selling_price * 100, 1)
    ELSE 0 END AS food_cost_pct
FROM recipes r
LEFT JOIN LATERAL (
  SELECT COUNT(*)::integer AS cnt
  FROM recipe_ingredients ri2
  WHERE ri2.menu_item_id = r.id
) ic ON true;

-- view: sales_daily_unified
CREATE VIEW sales_daily_unified AS
-- Demo data
SELECT
  ds.org_id, ds.location_id,
  ds.day AS date,
  COALESCE(ds.net_sales, 0)::numeric AS net_sales,
  COALESCE(ds.gross_sales, 0)::numeric AS gross_sales,
  COALESCE(ds.orders_count, 0)::integer AS orders_count,
  CASE WHEN COALESCE(ds.orders_count, 0) > 0
       THEN (ds.net_sales / ds.orders_count)::numeric ELSE 0 END AS avg_check,
  COALESCE(ds.payments_cash, ROUND(ds.payments_total * 0.25, 2), 0)::numeric AS payments_cash,
  COALESCE(ds.payments_card, ROUND(ds.payments_total * 0.75, 2), 0)::numeric AS payments_card,
  0::numeric AS payments_other,
  COALESCE(ds.refunds, 0)::numeric AS refunds_amount,
  GREATEST(1, COALESCE(ds.orders_count, 0) / 50)::integer AS refunds_count,
  COALESCE(ds.discounts, 0)::numeric AS discounts_amount,
  COALESCE(ds.comps, 0)::numeric AS comps_amount,
  COALESCE(ds.voids, 0)::numeric AS voids_amount,
  COALESCE(lab.labour_cost, 0)::numeric AS labor_cost,
  COALESCE(lab.labour_hours, 0)::numeric AS labor_hours,
  'demo'::text AS data_source
FROM daily_sales ds
LEFT JOIN (
  SELECT te.org_id, te.location_id,
    (te.clock_in AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date AS day,
    SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0) AS labour_hours,
    SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0 
        * COALESCE(e.hourly_cost, 14.50)) AS labour_cost
  FROM time_entries te
  JOIN locations l ON l.id = te.location_id
  LEFT JOIN employees e ON e.id = te.employee_id
  WHERE te.clock_out IS NOT NULL
  GROUP BY te.org_id, te.location_id,
           (te.clock_in AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date
) lab ON lab.org_id = ds.org_id AND lab.location_id = ds.location_id AND lab.day = ds.day
UNION ALL
-- POS data
SELECT
  o.org_id, o.location_id,
  (o.closed_at::date) AS date,
  COALESCE(SUM(o.net_sales), 0)::numeric AS net_sales,
  COALESCE(SUM(COALESCE(o.gross_sales, o.net_sales)), 0)::numeric AS gross_sales,
  COUNT(*)::integer AS orders_count,
  CASE WHEN COUNT(*) > 0
       THEN (SUM(o.net_sales) / COUNT(*))::numeric ELSE 0 END AS avg_check,
  ROUND(COALESCE(SUM(o.payments_total), 0) * 0.25, 2)::numeric AS payments_cash,
  ROUND(COALESCE(SUM(o.payments_total), 0) * 0.75, 2)::numeric AS payments_card,
  0::numeric AS payments_other,
  COALESCE(SUM(o.refunds), 0)::numeric AS refunds_amount,
  0::integer AS refunds_count,
  COALESCE(SUM(o.discounts), 0)::numeric AS discounts_amount,
  COALESCE(SUM(o.comps), 0)::numeric AS comps_amount,
  COALESCE(SUM(o.voids), 0)::numeric AS voids_amount,
  0::numeric AS labor_cost,
  0::numeric AS labor_hours,
  'pos'::text AS data_source
FROM cdm_orders o
WHERE o.closed_at IS NOT NULL
  AND (o.provider IS NOT NULL OR o.integration_account_id IS NOT NULL)
GROUP BY o.org_id, o.location_id, o.closed_at::date;

-- view: sales_hourly_unified
CREATE OR REPLACE VIEW sales_hourly_unified AS
SELECT
  mv.org_id, mv.location_id, mv.day, mv.hour_bucket, mv.hour_of_day,
  mv.net_sales, mv.gross_sales, mv.orders_count, mv.covers, mv.avg_check,
  mv.discounts, mv.refunds,
  'demo'::text AS data_source
FROM sales_hourly_unified_mv mv
UNION ALL
SELECT
  o.org_id,
  o.location_id,
  (o.closed_at::date) AS day,
  date_trunc('hour', o.closed_at)::timestamptz AS hour_bucket,
  EXTRACT(HOUR FROM o.closed_at)::integer AS hour_of_day,
  COALESCE(SUM(o.net_sales), 0)::numeric AS net_sales,
  COALESCE(SUM(COALESCE(o.gross_sales, o.net_sales)), 0)::numeric AS gross_sales,
  COUNT(*)::integer AS orders_count,
  COUNT(*)::integer AS covers,
  CASE WHEN COUNT(*) > 0 THEN (SUM(o.net_sales) / COUNT(*))::numeric ELSE 0 END AS avg_check,
  COALESCE(SUM(o.discounts), 0)::numeric AS discounts,
  COALESCE(SUM(o.refunds), 0)::numeric AS refunds,
  'pos'::text AS data_source
FROM cdm_orders o
WHERE o.closed_at IS NOT NULL
  AND (o.provider IS NOT NULL OR o.integration_account_id IS NOT NULL)
GROUP BY o.org_id, o.location_id, o.closed_at::date,
         date_trunc('hour', o.closed_at), EXTRACT(HOUR FROM o.closed_at);


-- ═══════════════════════════════════════════════════════════════════════════
-- MATERIALIZED VIEWS (5)
-- ═══════════════════════════════════════════════════════════════════════════

-- materialized view: if
CREATE MATERIALIZED VIEW IF NOT EXISTS mart_sales_category_daily_mv AS
SELECT
  p.org_id,
  p.location_id,
  p.day AS date,
  p.product_id,
  p.product_name,
  p.product_category AS category,
  p.units_sold,
  p.net_sales,
  (p.net_sales * COALESCE(ls.default_cogs_percent, 30) / 100.0) AS cogs,
  'estimated'::text AS cogs_source
FROM product_sales_daily_unified p
LEFT JOIN location_settings ls ON ls.location_id = p.location_id;

-- materialized view: mart_kpi_daily_mv
CREATE MATERIALIZED VIEW mart_kpi_daily_mv AS
SELECT org_id, location_id, date, net_sales, gross_sales, orders_count,
       avg_check, labor_cost, labor_hours, data_source
FROM sales_daily_unified;

-- materialized view: mart_sales_category_daily_mv
CREATE MATERIALIZED VIEW mart_sales_category_daily_mv AS
SELECT
  p.org_id,
  p.location_id,
  p.day AS date,
  p.product_id,
  p.product_name,
  p.product_category AS category,
  p.units_sold,
  p.net_sales,
  (p.net_sales * COALESCE(ls.default_cogs_percent, 30) / 100.0) AS cogs,
  'estimated'::text AS cogs_source
FROM product_sales_daily_unified p
LEFT JOIN location_settings ls ON ls.location_id = p.location_id;

-- materialized view: product_sales_daily_unified_mv
CREATE MATERIALIZED VIEW product_sales_daily_unified_mv AS
SELECT
  o.org_id,
  o.location_id,
  (o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date AS day,
  COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
  COALESCE(ci.name, 'Unknown') AS product_name,
  COALESCE(ci.category, 'Other') AS product_category,
  COALESCE(SUM(ol.qty), 0)::integer AS units_sold,
  COALESCE(SUM(ol.gross), 0) AS net_sales,
  -- Estimated COGS by category
  ROUND(
    COALESCE(SUM(ol.gross), 0) *
    CASE COALESCE(ci.category, 'Other')
      WHEN 'Bebidas' THEN 0.25
      WHEN 'Postres' THEN 0.28
      WHEN 'Entrantes' THEN 0.30
      WHEN 'Pastas' THEN 0.30
      WHEN 'Carnes' THEN 0.35
      WHEN 'Pescados' THEN 0.38
      ELSE 0.32
    END, 2
  ) AS cogs,
  ROUND(
    COALESCE(SUM(ol.gross), 0) * (1 -
    CASE COALESCE(ci.category, 'Other')
      WHEN 'Bebidas' THEN 0.25
      WHEN 'Postres' THEN 0.28
      WHEN 'Entrantes' THEN 0.30
      WHEN 'Pastas' THEN 0.30
      WHEN 'Carnes' THEN 0.35
      WHEN 'Pescados' THEN 0.38
      ELSE 0.32
    END), 2
  ) AS gross_profit,
  ROUND(
    (1 - CASE COALESCE(ci.category, 'Other')
      WHEN 'Bebidas' THEN 0.25
      WHEN 'Postres' THEN 0.28
      WHEN 'Entrantes' THEN 0.30
      WHEN 'Pastas' THEN 0.30
      WHEN 'Carnes' THEN 0.35
      WHEN 'Pescados' THEN 0.38
      ELSE 0.32
    END) * 100, 1
  ) AS margin_pct,
  'simulated' AS data_source
FROM cdm_orders o
JOIN cdm_order_lines ol ON ol.order_id = o.id
LEFT JOIN cdm_items ci ON ci.id = ol.item_id
LEFT JOIN locations l ON l.id = o.location_id
WHERE o.closed_at IS NOT NULL
GROUP BY o.org_id, o.location_id, day, ol.item_id, ci.name, ci.category, l.timezone;

-- materialized view: sales_hourly_unified_mv
CREATE MATERIALIZED VIEW sales_hourly_unified_mv AS
SELECT
  o.org_id,
  o.location_id,
  (o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date     AS day,
  date_trunc('hour', o.closed_at)                                            AS hour_bucket,
  EXTRACT(HOUR FROM o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::integer AS hour_of_day,
  COALESCE(SUM(o.net_sales), 0)::numeric                                    AS net_sales,
  COALESCE(SUM(o.gross_sales), 0)::numeric                                  AS gross_sales,
  COUNT(*)::integer                                                          AS orders_count,
  0::integer                                                                 AS covers,
  CASE WHEN COUNT(*) > 0
       THEN (SUM(o.net_sales) / COUNT(*))::numeric ELSE 0 END               AS avg_check,
  COALESCE(SUM(o.discounts), 0)::numeric                                    AS discounts,
  0::numeric                                                                 AS refunds,
  'simulated'::text                                                          AS data_source
FROM cdm_orders o
JOIN locations l ON l.id = o.location_id
WHERE o.closed_at IS NOT NULL
GROUP BY o.org_id, o.location_id,
  (o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date,
  date_trunc('hour', o.closed_at),
  EXTRACT(HOUR FROM o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'));


-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS (45)
-- ═══════════════════════════════════════════════════════════════════════════

-- function: add_loyalty_points
CREATE OR REPLACE FUNCTION add_loyalty_points(
  p_member_id uuid,
  p_points integer,
  p_type text DEFAULT 'earned',
  p_description text DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_ticket_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$ SELECT '{"ok":true,"stub":true}'::jsonb; $$;

-- function: audit_data_coherence
CREATE OR REPLACE FUNCTION audit_data_coherence(
  p_org_id uuid,
  p_location_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_checks jsonb := '[]'::jsonb;
  v_pass   boolean := true;
  v_cnt    bigint;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM daily_sales
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids);
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'check','sales_data_exists','passed',v_cnt>0,'detail',format('%s rows',v_cnt)));
  IF v_cnt = 0 THEN v_pass := false; END IF;

  SELECT COUNT(*) INTO v_cnt FROM time_entries
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids);
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'check','labour_data_exists','passed',v_cnt>0,'detail',format('%s rows',v_cnt)));

  SELECT COUNT(*) INTO v_cnt FROM forecast_points fp
  JOIN forecast_runs fr ON fr.id = fp.forecast_run_id
  WHERE fp.org_id = p_org_id AND fp.location_id = ANY(p_location_ids) AND fr.status='finished';
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'check','forecast_data_exists','passed',v_cnt>0,'detail',format('%s rows',v_cnt)));

  SELECT COUNT(*) INTO v_cnt FROM budget_days
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids);
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'check','budget_data_exists','passed',v_cnt>0,'detail',format('%s rows',v_cnt)));

  RETURN jsonb_build_object('allPass', v_pass, 'checks', v_checks);
END;
$$;

-- function: calculate_schedule_efficiency
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

-- function: calculate_tip_distribution
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

-- function: check_labour_compliance
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

-- function: deduct_recipe_from_inventory
CREATE OR REPLACE FUNCTION deduct_recipe_from_inventory(
  p_recipe_id uuid,
  p_location_id uuid,
  p_qty numeric DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_row record;
  v_recipe_yield numeric;
  v_scale numeric;
BEGIN
  SELECT COALESCE(yield_qty, 1) INTO v_recipe_yield FROM recipes WHERE id = p_recipe_id;
  v_scale := p_qty / GREATEST(v_recipe_yield, 0.001);

  FOR v_row IN
    SELECT ri.inventory_item_id, ri.sub_recipe_id, ri.qty_gross
    FROM recipe_ingredients ri
    WHERE ri.menu_item_id = p_recipe_id
  LOOP
    IF v_row.sub_recipe_id IS NOT NULL THEN
      PERFORM deduct_recipe_from_inventory(
        v_row.sub_recipe_id, p_location_id, v_row.qty_gross * v_scale
      );
    ELSE
      UPDATE inventory_item_location
        SET on_hand = GREATEST(on_hand - (v_row.qty_gross * v_scale), 0)
        WHERE item_id = v_row.inventory_item_id AND location_id = p_location_id;

      INSERT INTO stock_movements (
        org_id, location_id, inventory_item_id,
        movement_type, qty_delta, unit_cost, notes
      )
      SELECT l.org_id, p_location_id, v_row.inventory_item_id,
        'sale_estimate', -(v_row.qty_gross * v_scale),
        COALESCE(ii.last_cost, 0),
        'BOM auto-deduction: recipe ' || p_recipe_id::text
      FROM locations l
      CROSS JOIN inventory_items ii
      WHERE l.id = p_location_id AND ii.id = v_row.inventory_item_id;
    END IF;
  END LOOP;
END;
$$;

-- function: generate_daily_data
CREATE OR REPLACE FUNCTION public.generate_daily_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date date := CURRENT_DATE;
  v_forecast_date date := CURRENT_DATE + 30;
  v_loc record;
  v_nm numeric;
  v_ns numeric;
  v_gs numeric;
  v_oc integer;
  v_pc numeric;
  v_pk numeric;
  v_po numeric;
  v_ra numeric;
  v_da numeric;
  v_ca numeric;
  v_va numeric;
  v_lh numeric;
  v_lc numeric;
  v_cg numeric;
  v_fs numeric;
  v_fo integer;
  v_plh numeric;
  v_plc numeric;
  v_hr numeric;
  v_dow integer;
  v_sb numeric := 0;
  v_sr numeric := 0;
  v_ob integer := 0;
  v_ors integer := 0;
  v_lhb numeric := 0;
  v_lr numeric := 0;
  v_fdow integer;
  v_fsb numeric := 0;
  v_fsr numeric := 0;
  v_fob integer := 0;
  v_fors integer := 0;
  v_flhb numeric := 0;
  v_flr numeric := 0;
  v_fnm numeric;
  v_fhr numeric;
  v_fns numeric;
  v_foc integer;
  v_flh numeric;
  v_fplh numeric;
  v_fplc numeric;
BEGIN
  v_dow := EXTRACT(DOW FROM v_date)::int;

  IF v_dow = 0 THEN v_sb:=1100; v_sr:=400; v_ob:=55; v_ors:=25; v_lhb:=18; v_lr:=6;
  ELSIF v_dow = 1 THEN v_sb:=1200; v_sr:=300; v_ob:=60; v_ors:=20; v_lhb:=20; v_lr:=5;
  ELSIF v_dow = 2 THEN v_sb:=1350; v_sr:=350; v_ob:=68; v_ors:=22; v_lhb:=22; v_lr:=5;
  ELSIF v_dow = 3 THEN v_sb:=1450; v_sr:=350; v_ob:=72; v_ors:=22; v_lhb:=24; v_lr:=5;
  ELSIF v_dow = 4 THEN v_sb:=1650; v_sr:=400; v_ob:=82; v_ors:=25; v_lhb:=28; v_lr:=6;
  ELSIF v_dow = 5 THEN v_sb:=2400; v_sr:=600; v_ob:=120; v_ors:=35; v_lhb:=36; v_lr:=8;
  ELSIF v_dow = 6 THEN v_sb:=2800; v_sr:=700; v_ob:=140; v_ors:=40; v_lhb:=40; v_lr:=10;
  END IF;

  v_fdow := EXTRACT(DOW FROM v_forecast_date)::int;
  IF v_fdow = 0 THEN v_fsb:=1100; v_fsr:=400; v_fob:=55; v_fors:=25; v_flhb:=18; v_flr:=6;
  ELSIF v_fdow = 1 THEN v_fsb:=1200; v_fsr:=300; v_fob:=60; v_fors:=20; v_flhb:=20; v_flr:=5;
  ELSIF v_fdow = 2 THEN v_fsb:=1350; v_fsr:=350; v_fob:=68; v_fors:=22; v_flhb:=22; v_flr:=5;
  ELSIF v_fdow = 3 THEN v_fsb:=1450; v_fsr:=350; v_fob:=72; v_fors:=22; v_flhb:=24; v_flr:=5;
  ELSIF v_fdow = 4 THEN v_fsb:=1650; v_fsr:=400; v_fob:=82; v_fors:=25; v_flhb:=28; v_flr:=6;
  ELSIF v_fdow = 5 THEN v_fsb:=2400; v_fsr:=600; v_fob:=120; v_fors:=35; v_flhb:=36; v_flr:=8;
  ELSIF v_fdow = 6 THEN v_fsb:=2800; v_fsr:=700; v_fob:=140; v_fors:=40; v_flhb:=40; v_flr:=10;
  END IF;

  FOR v_loc IN
    SELECT id,
      CASE id
        WHEN '57f62bae-4d5b-44b0-8055-fdde12ee5a96' THEN 1.15
        WHEN '9c501324-66e4-40e8-bfcb-7cc855f3754e' THEN 1.00
        WHEN '9469ef7a-c1b1-4314-8349-d0ea253ba483' THEN 0.90
        WHEN 'fe0717f7-6fa7-4e5e-8467-6c9585b03022' THEN 0.85
        ELSE 1.0
      END AS lm
    FROM locations
    WHERE active = true
      AND id IN (
        '57f62bae-4d5b-44b0-8055-fdde12ee5a96',
        '9c501324-66e4-40e8-bfcb-7cc855f3754e',
        '9469ef7a-c1b1-4314-8349-d0ea253ba483',
        'fe0717f7-6fa7-4e5e-8467-6c9585b03022'
      )
  LOOP
    v_nm := 1.0 + (random() - 0.5) * 0.24;
    v_hr := 13.5 + random() * 3.0;

    v_ns := ROUND((v_sb + random() * v_sr) * v_loc.lm * v_nm, 2);
    v_oc := GREATEST(1, FLOOR((v_ob + random() * v_ors) * v_loc.lm * v_nm))::integer;
    v_gs := ROUND(v_ns * (1.03 + random() * 0.03), 2);
    v_pc := ROUND(v_ns * (0.20 + random() * 0.10), 2);
    v_pk := ROUND(v_ns * (0.62 + random() * 0.10), 2);
    v_po := ROUND(GREATEST(0, v_ns - v_pc - v_pk), 2);
    v_ra := ROUND(v_ns * (0.002 + random() * 0.006), 2);
    v_da := ROUND(v_ns * (0.015 + random() * 0.020), 2);
    v_ca := ROUND(v_ns * (0.005 + random() * 0.010), 2);
    v_va := ROUND(v_ns * (0.004 + random() * 0.008), 2);
    v_lh := ROUND((v_lhb + random() * v_lr) * v_loc.lm * v_nm, 2);
    v_lc := ROUND(v_lh * v_hr, 2);
    v_cg := ROUND(v_ns * (0.26 + random() * 0.04), 2);
    v_fs := ROUND(v_ns * (0.88 + random() * 0.24), 2);
    v_fo := GREATEST(1, ROUND(v_oc * (0.90 + random() * 0.20)))::integer;
    v_plh := ROUND(v_lh * (0.90 + random() * 0.20), 2);
    v_plc := ROUND(v_plh * v_hr, 2);

    INSERT INTO pos_daily_finance (id, date, location_id, net_sales, gross_sales, orders_count,
      payments_cash, payments_card, payments_other, refunds_amount, refunds_count,
      discounts_amount, comps_amount, voids_amount, created_at, data_source)
    VALUES (gen_random_uuid(), v_date, v_loc.id, v_ns, v_gs, v_oc,
      v_pc, v_pk, v_po, v_ra, FLOOR(random()*3)::integer,
      v_da, v_ca, v_va, NOW(), 'demo')
    ON CONFLICT (date, location_id, data_source) DO UPDATE
      SET net_sales=EXCLUDED.net_sales, gross_sales=EXCLUDED.gross_sales, orders_count=EXCLUDED.orders_count;

    INSERT INTO labour_daily (id, date, location_id, labour_cost, labour_hours, created_at)
    VALUES (gen_random_uuid(), v_date, v_loc.id, v_lc, v_lh, NOW())
    ON CONFLICT (date, location_id) DO UPDATE
      SET labour_cost=EXCLUDED.labour_cost, labour_hours=EXCLUDED.labour_hours;

    INSERT INTO cogs_daily (location_id, date, cogs_amount)
    VALUES (v_loc.id, v_date, v_cg)
    ON CONFLICT DO NOTHING;

    INSERT INTO forecast_daily_metrics (id, date, location_id, forecast_sales, forecast_orders,
      planned_labor_hours, planned_labor_cost, created_at)
    VALUES (gen_random_uuid(), v_date, v_loc.id, v_fs, v_fo, v_plh, v_plc, NOW())
    ON CONFLICT DO NOTHING;

    INSERT INTO budgets_daily (id, date, location_id, budget_sales, budget_labour, budget_cogs, created_at)
    VALUES (gen_random_uuid(), v_date, v_loc.id,
      ROUND(v_sb * v_loc.lm * 1.05, 2),
      ROUND(v_sb * v_loc.lm * 0.22, 2),
      ROUND(v_sb * v_loc.lm * 0.28, 2), NOW())
    ON CONFLICT DO NOTHING;

    -- Forecast day +30
    v_fnm := 1.0 + (random() - 0.5) * 0.10;
    v_fhr := 14.0 + random() * 2.0;
    v_fns := ROUND((v_fsb + random() * v_fsr) * v_loc.lm * v_fnm, 2);
    v_foc := GREATEST(1, FLOOR((v_fob + random() * v_fors) * v_loc.lm * v_fnm))::integer;
    v_flh := ROUND((v_flhb + random() * v_flr) * v_loc.lm * v_fnm, 2);
    v_fplh := v_flh;
    v_fplc := ROUND(v_fplh * v_fhr, 2);

    INSERT INTO forecast_daily_metrics (id, date, location_id, forecast_sales, forecast_orders,
      planned_labor_hours, planned_labor_cost, created_at)
    VALUES (gen_random_uuid(), v_forecast_date, v_loc.id, v_fns, v_foc, v_fplh, v_fplc, NOW())
    ON CONFLICT DO NOTHING;

  END LOOP;

  RAISE NOTICE 'Daily data generated for % + forecast for %', v_date, v_forecast_date;
END;
$$;

-- function: generate_pos_daily_data
CREATE OR REPLACE FUNCTION public.generate_pos_daily_data(p_target_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org  record;
  v_loc  record;
  v_date date := COALESCE(p_target_date, CURRENT_DATE);
  v_dow  int;
  v_base_sales  numeric;
  v_sales_range numeric;
  v_base_orders int;
  v_order_range int;
  v_base_hours  numeric;
  v_hour_range  numeric;
  v_noise       numeric;
  v_order_count int;
  v_labour_h    numeric;
  v_labour_c    numeric;
  v_cogs_amt    numeric;
  v_hourly_rate numeric;
  v_order_id    uuid;
  v_h           int;
  v_order_net   numeric;
  v_order_gross numeric;
  v_items_per   int;
  v_qty         int;
  v_line_gross  numeric;
  v_line_net    numeric;
  v_total_net   numeric;
  v_total_gross numeric;
  v_total_orders int;
  v_item_ids    uuid[];
  v_item_names  text[];
  v_item_count  int;
  v_idx         int;
  v_cash_amt    numeric;
  v_f_sales     numeric;
  v_f_orders    int;
  v_f_labour_h  numeric;
  v_waste_val   numeric;
  v_inv_item    record;
BEGIN
  v_dow := EXTRACT(DOW FROM v_date)::int;

  CASE v_dow
    WHEN 0 THEN v_base_sales:=1100; v_sales_range:=400; v_base_orders:=45; v_order_range:=20; v_base_hours:=16; v_hour_range:=4;
    WHEN 1 THEN v_base_sales:=1200; v_sales_range:=350; v_base_orders:=50; v_order_range:=18; v_base_hours:=18; v_hour_range:=4;
    WHEN 2 THEN v_base_sales:=1350; v_sales_range:=400; v_base_orders:=55; v_order_range:=20; v_base_hours:=20; v_hour_range:=4;
    WHEN 3 THEN v_base_sales:=1450; v_sales_range:=400; v_base_orders:=60; v_order_range:=22; v_base_hours:=22; v_hour_range:=5;
    WHEN 4 THEN v_base_sales:=1700; v_sales_range:=500; v_base_orders:=70; v_order_range:=25; v_base_hours:=26; v_hour_range:=5;
    WHEN 5 THEN v_base_sales:=2500; v_sales_range:=700; v_base_orders:=100; v_order_range:=35; v_base_hours:=34; v_hour_range:=8;
    WHEN 6 THEN v_base_sales:=2800; v_sales_range:=800; v_base_orders:=120; v_order_range:=40; v_base_hours:=38; v_hour_range:=8;
  END CASE;

  FOR v_org IN
    SELECT DISTINCT i.org_id, ia.id AS account_id
    FROM integrations i
    JOIN integration_accounts ia ON ia.integration_id = i.id
    WHERE i.provider = 'square' AND i.status = 'active' AND i.is_enabled = true
  LOOP
    SELECT array_agg(id), array_agg(name)
    INTO v_item_ids, v_item_names
    FROM cdm_items WHERE org_id = v_org.org_id AND is_active = true;

    v_item_count := COALESCE(array_length(v_item_ids, 1), 0);
    IF v_item_count = 0 THEN CONTINUE; END IF;

    FOR v_loc IN
      SELECT id, name FROM locations WHERE group_id = v_org.org_id AND active = true
    LOOP
      -- Skip if already seeded
      PERFORM 1 FROM cdm_orders
      WHERE org_id = v_org.org_id AND location_id = v_loc.id
        AND closed_at::date = v_date AND integration_account_id = v_org.account_id LIMIT 1;
      IF FOUND THEN CONTINUE; END IF;

      v_noise := (1.0 + (random() - 0.5) * 0.30)::numeric;
      v_hourly_rate := (12.5 + random() * 3.5)::numeric;
      v_order_count := GREATEST(10, floor((v_base_orders + random() * v_order_range) * v_noise)::int);
      v_total_net := 0; v_total_gross := 0; v_total_orders := 0;

      -- ═══ CDM Orders + Lines ═══
      FOR i IN 1..v_order_count LOOP
        v_order_id := gen_random_uuid();
        IF random() < 0.60 THEN v_h := 12 + floor(random()*4)::int;
        ELSIF random() < 0.875 THEN v_h := 19 + floor(random()*4)::int;
        ELSE v_h := 10 + floor(random()*2)::int;
        END IF;

        v_order_net := 0; v_order_gross := 0;
        v_items_per := 1 + floor(random()*4)::int;

        INSERT INTO cdm_orders (
          id, org_id, location_id, external_id, opened_at, closed_at,
          net_sales, tax, tips, discounts, comps, voids, refunds, payments_total, gross_sales,
          provider, integration_account_id
        ) VALUES (
          v_order_id, v_org.org_id, v_loc.id,
          'pg_' || v_date || '_' || v_loc.id || '_' || i,
          v_date + make_interval(hours => v_h, mins => floor(random()*55)::int),
          v_date + make_interval(hours => v_h, mins => floor(random()*55)::int + 5),
          0, 0, 0, 0, 0, 0, 0, 0, 0, 'square', v_org.account_id
        );

        FOR j IN 1..v_items_per LOOP
          v_idx := 1 + floor(random() * v_item_count)::int;
          v_qty := 1 + floor(random()*3)::int;
          v_line_gross := round(((6.0 + random()*22.0) * v_qty)::numeric, 2);
          v_line_net := round(v_line_gross * 0.90, 2);

          INSERT INTO cdm_order_lines (
            id, org_id, order_id, item_id, name, qty, gross, net, discount, tax,
            provider, integration_account_id
          ) VALUES (
            gen_random_uuid(), v_org.org_id, v_order_id, v_item_ids[v_idx], v_item_names[v_idx],
            v_qty, v_line_gross, v_line_net,
            CASE WHEN random() > 0.90 THEN round(v_line_gross * 0.10, 2) ELSE 0 END,
            round(v_line_gross * 0.10, 2), 'square', v_org.account_id
          );
          v_order_net := v_order_net + v_line_net;
          v_order_gross := v_order_gross + v_line_gross;
        END LOOP;

        UPDATE cdm_orders SET
          net_sales = v_order_net, gross_sales = v_order_gross,
          tax = round(v_order_net * 0.10, 2),
          tips = CASE WHEN random() > 0.75 THEN round(v_order_net * 0.05, 2) ELSE 0 END,
          discounts = CASE WHEN random() > 0.85 THEN round(v_order_net * 0.08, 2) ELSE 0 END,
          refunds = CASE WHEN random() > 0.97 THEN round(v_order_net * 0.15, 2) ELSE 0 END,
          payments_total = v_order_net + round(v_order_net * 0.10, 2)
        WHERE id = v_order_id;

        v_total_net := v_total_net + v_order_net;
        v_total_gross := v_total_gross + v_order_gross;
        v_total_orders := v_total_orders + 1;
      END LOOP;

      -- ═══ Labour ═══
      v_labour_h := round(((v_base_hours + random() * v_hour_range) * v_noise)::numeric, 2);
      v_labour_c := round(v_labour_h * v_hourly_rate, 2);
      DELETE FROM labour_daily WHERE date = v_date AND location_id = v_loc.id;
      INSERT INTO labour_daily (id, date, location_id, labour_cost, labour_hours, created_at)
      VALUES (gen_random_uuid(), v_date, v_loc.id, v_labour_c, v_labour_h, NOW());

      -- Note: cogs_daily is a VIEW (auto-computed), no insert needed

      -- ═══ Cash ═══
      v_cash_amt := round(v_total_net * (0.18 + random() * 0.12)::numeric, 2);
      DELETE FROM cash_counts_daily WHERE date = v_date AND location_id = v_loc.id;
      INSERT INTO cash_counts_daily (id, date, location_id, cash_counted, created_at)
      VALUES (gen_random_uuid(), v_date, v_loc.id, v_cash_amt, NOW());

      -- ═══ Forecast ═══
      v_f_sales := round((v_total_net * (0.90 + random() * 0.20))::numeric, 2);
      v_f_orders := GREATEST(1, floor(v_total_orders * (0.88 + random() * 0.24))::int);
      v_f_labour_h := round((v_labour_h * (0.92 + random() * 0.16))::numeric, 2);
      DELETE FROM forecast_daily_metrics WHERE date = v_date AND location_id = v_loc.id;
      INSERT INTO forecast_daily_metrics (
        id, date, location_id, forecast_sales, forecast_orders,
        planned_labor_hours, planned_labor_cost, created_at
      ) VALUES (
        gen_random_uuid(), v_date, v_loc.id, v_f_sales, v_f_orders,
        v_f_labour_h, round(v_f_labour_h * v_hourly_rate, 2), NOW()
      );

      -- ═══ Budgets ═══
      DELETE FROM budgets_daily WHERE date = v_date AND location_id = v_loc.id;
      INSERT INTO budgets_daily (id, date, location_id, budget_sales, budget_labour, budget_cogs, created_at)
      VALUES (gen_random_uuid(), v_date, v_loc.id,
        round(v_base_sales * 1.05, 2), round(v_base_sales * 0.22, 2), round(v_base_sales * 0.28, 2), NOW());

      -- ═══ Waste events (2-5/day) ═══
      FOR w IN 1..(2 + floor(random()*4)::int) LOOP
        FOR v_inv_item IN SELECT id, last_cost FROM inventory_items WHERE group_id=v_org.org_id ORDER BY random() LIMIT 1 LOOP
          v_waste_val := round((v_inv_item.last_cost * (0.5 + random()*2.0))::numeric, 2);
          INSERT INTO waste_events (id, location_id, inventory_item_id, quantity, reason, waste_value, created_at)
          VALUES (gen_random_uuid(), v_loc.id, v_inv_item.id,
            round((0.2 + random()*2.0)::numeric, 2),
            (ARRAY['Caducado','Dañado','Sobreproducción','Error preparación','Merma natural'])[1+floor(random()*5)::int],
            v_waste_val, NOW());
        END LOOP;
      END LOOP;

      -- ═══ Reviews (1-3/day) ═══
      FOR r IN 1..(1 + floor(random()*3)::int) LOOP
        INSERT INTO reviews (id, org_id, location_id, platform, rating, review_text, sentiment, reviewer_name, review_date, created_at)
        VALUES (gen_random_uuid(), v_org.org_id, v_loc.id,
          (ARRAY['google','tripadvisor','yelp','thefork'])[1+floor(random()*4)::int],
          (3.0 + round((random()*2.0)::numeric, 1)),
          (ARRAY['Excelente comida y servicio, volveremos seguro.','Muy buena relación calidad-precio.','Ambiente acogedor y personal atento.','La carne estaba en su punto.','Buen restaurante pero un poco ruidoso.','Comida correcta, nada especial pero cumple.','El servicio fue un poco lento pero la comida compensó.','Volveremos. Los postres caseros son espectaculares.','Menú del día muy completo por buen precio.','Buenas tapas y buen ambiente.'])[1+floor(random()*10)::int],
          CASE WHEN random()>0.3 THEN 'positive' WHEN random()>0.5 THEN 'neutral' ELSE 'negative' END,
          (ARRAY['María G.','Carlos R.','Ana L.','Pedro M.','Laura S.','José A.','Marta V.','Pablo D.'])[1+floor(random()*8)::int],
          v_date, NOW());
      END LOOP;

      -- ═══ Stock movements (3-6/day) ═══
      FOR s IN 1..(3 + floor(random()*4)::int) LOOP
        FOR v_inv_item IN SELECT id, last_cost FROM inventory_items WHERE group_id=v_org.org_id ORDER BY random() LIMIT 1 LOOP
          INSERT INTO stock_movements (id, org_id, location_id, item_id, movement_type, qty_delta, unit_cost, reason, source_ref, created_at)
          VALUES (gen_random_uuid(), v_org.org_id, v_loc.id, v_inv_item.id,
            (ARRAY['purchase','waste','sale_estimate','adjustment'])[1+floor(random()*4)::int]::stock_movement_type,
            round((1+random()*10)::numeric, 2),
            round((v_inv_item.last_cost)::numeric, 2),
            'Auto POS data', 'pos_gen',
            v_date + make_interval(hours => 10+floor(random()*12)::int));
        END LOOP;
      END LOOP;

    END LOOP; -- locations
  END LOOP; -- orgs
END;
$$;

-- function: get_dead_stock
CREATE OR REPLACE FUNCTION get_dead_stock(
  p_org_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  item_id uuid,
  item_name text,
  category text,
  on_hand numeric,
  last_cost numeric,
  stock_value numeric,
  last_movement_at timestamptz,
  days_idle integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ii.id AS item_id,
    ii.name AS item_name,
    COALESCE(ic.name, 'Sin categoría') AS category,
    COALESCE(il.on_hand, ii.current_stock, 0) AS on_hand,
    COALESCE(ii.last_cost, 0) AS last_cost,
    COALESCE(il.on_hand, ii.current_stock, 0) * COALESCE(ii.last_cost, 0) AS stock_value,
    MAX(sm.created_at) AS last_movement_at,
    EXTRACT(DAY FROM now() - COALESCE(MAX(sm.created_at), ii.created_at))::integer AS days_idle
  FROM inventory_items ii
  LEFT JOIN inventory_item_location il
    ON il.item_id = ii.id
    AND (p_location_id IS NULL OR il.location_id = p_location_id)
  LEFT JOIN inventory_categories ic ON ic.id = ii.category_id
  LEFT JOIN stock_movements sm
    ON sm.item_id = ii.id
    AND (p_location_id IS NULL OR sm.location_id = p_location_id)
  WHERE ii.org_id = p_org_id
    AND ii.is_active = true
    AND COALESCE(il.on_hand, ii.current_stock, 0) > 0
  GROUP BY ii.id, ii.name, ic.name, il.on_hand, ii.current_stock, ii.last_cost, ii.created_at
  HAVING EXTRACT(DAY FROM now() - COALESCE(MAX(sm.created_at), ii.created_at)) >= p_days
  ORDER BY (COALESCE(il.on_hand, ii.current_stock, 0) * COALESCE(ii.last_cost, 0)) DESC;
END;
$$;

-- function: get_employee_revenue_scores
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

-- function: get_forecast_items_mix_unified
CREATE OR REPLACE FUNCTION get_forecast_items_mix_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date,
  p_horizon_days integer DEFAULT 14,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE v_ds jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);
  RETURN jsonb_build_object(
    'data_source',v_ds->>'data_source','mode',v_ds->>'mode',
    'reason',v_ds->>'reason','last_synced_at',v_ds->>'last_synced_at',
    'hist_window', jsonb_build_object('from',p_from,'to',p_to),
    'horizon',     jsonb_build_object('from',p_to+1,'to',p_to+p_horizon_days),
    'items','[]'::jsonb
  );
END;
$$;

-- function: get_instant_pnl_unified
CREATE OR REPLACE FUNCTION get_instant_pnl_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE v_ds jsonb; v_locs jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb) INTO v_locs
  FROM (
    SELECT
      l.id AS location_id, l.name AS location_name,
      COALESCE(s.net_sales,0)::numeric   AS actual_sales,
      COALESCE(f.fc_sales,0)::numeric    AS forecast_sales,
      COALESCE(lab.cost,0)::numeric      AS actual_labour,
      ROUND(COALESCE(f.fc_sales,0)*0.28,2)::numeric AS forecast_labour,
      COALESCE(cg.cogs_est,0)::numeric   AS actual_cogs,
      (COALESCE(s.net_sales,0) - COALESCE(lab.cost,0) - COALESCE(cg.cogs_est,0))::numeric AS gp_value,
      true AS estimated_cogs
    FROM locations l
    LEFT JOIN (SELECT location_id, SUM(net_sales) AS net_sales FROM daily_sales
               WHERE org_id=p_org_id AND day BETWEEN p_from AND p_to GROUP BY 1) s ON s.location_id=l.id
    LEFT JOIN (SELECT fp.location_id, SUM(fp.yhat) AS fc_sales
               FROM forecast_points fp
               JOIN forecast_runs fr ON fr.id=fp.forecast_run_id AND fr.status='finished'
               WHERE fp.org_id=p_org_id AND fp.day BETWEEN p_from AND p_to GROUP BY 1) f ON f.location_id=l.id
    LEFT JOIN (SELECT te.location_id,
                 SUM(EXTRACT(EPOCH FROM (te.clock_out-te.clock_in))/3600.0
                     * COALESCE(e.hourly_cost, 14.50)) AS cost
               FROM time_entries te
               LEFT JOIN employees e ON e.id = te.employee_id
               WHERE te.org_id=p_org_id AND te.clock_out IS NOT NULL
                 AND te.clock_in::date BETWEEN p_from AND p_to GROUP BY 1) lab ON lab.location_id=l.id
    LEFT JOIN (SELECT sm.location_id, SUM(ABS(sm.qty_delta)*COALESCE(sm.unit_cost,0)) AS cogs_est
               FROM stock_movements sm
               JOIN locations loc2 ON loc2.id = sm.location_id
               WHERE loc2.org_id=p_org_id
                 AND sm.movement_type IN ('waste','sale_estimate')
                 AND sm.created_at::date BETWEEN p_from AND p_to GROUP BY 1) cg ON cg.location_id=l.id
    WHERE l.id = ANY(p_location_ids) AND l.active = true
  ) r;

  RETURN jsonb_build_object(
    'data_source',v_ds->>'data_source','mode',v_ds->>'mode',
    'reason',v_ds->>'reason','last_synced_at',v_ds->>'last_synced_at',
    'locations',v_locs
  );
END;
$$;

-- function: get_labor_plan_unified
CREATE OR REPLACE FUNCTION get_labor_plan_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'metadata', jsonb_build_object(
      'org_id', p_org_id, 'locations', to_jsonb(p_location_ids),
      'from', p_from, 'to', p_to,
      'target_col_pct', 28, 'avg_hourly_rate', 14.50
    ),
    'daily', COALESCE((
      SELECT jsonb_agg(row_to_json(d)::jsonb ORDER BY d.day)
      FROM (
        SELECT fdu.day, fdu.location_id,
          COALESCE(fdu.forecast_sales,0)       AS forecast_sales,
          COALESCE(fdu.planned_labor_hours,0)   AS planned_hours,
          COALESCE(fdu.planned_labor_cost,0)    AS planned_cost,
          ROUND(COALESCE(fdu.planned_labor_hours,0)*0.6,1) AS foh_hours,
          ROUND(COALESCE(fdu.planned_labor_hours,0)*0.4,1) AS boh_hours
        FROM forecast_daily_unified fdu
        WHERE fdu.org_id = p_org_id AND fdu.location_id = ANY(p_location_ids)
          AND fdu.day BETWEEN p_from AND p_to
      ) d
    ), '[]'::jsonb),
    'hourly', '[]'::jsonb,
    'flags', jsonb_build_object('estimated_rates', true, 'data_sufficiency_level', 'medium')
  );
END;
$$;

-- function: get_labour_cost_by_date
CREATE OR REPLACE FUNCTION get_labour_cost_by_date(
  p_location_ids uuid[],
  p_date date
)
RETURNS TABLE(location_id uuid, labour_cost numeric)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    ps.location_id,
    COALESCE(SUM(ps.planned_hours * COALESCE(e.hourly_cost, 0)), 0) AS labour_cost
  FROM planned_shifts ps
  JOIN employees e ON e.id = ps.employee_id
  WHERE ps.location_id = ANY(p_location_ids)
    AND ps.shift_date = p_date
  GROUP BY ps.location_id;
$$;

-- function: get_labour_kpis
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

-- function: get_labour_locations_table
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

-- function: get_labour_rule
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

-- function: get_labour_timeseries
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

-- function: get_payroll_forecast
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
    (SELECT rule_value::numeric FROM labour_rules
     WHERE rule_key = 'monthly_labour_budget'
       AND location_id = p_location_id
       AND org_id = p_org_id
     LIMIT 1),
    (SELECT rule_value::numeric FROM labour_rules
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

-- function: get_recipe_food_cost
CREATE OR REPLACE FUNCTION public.get_recipe_food_cost(p_recipe_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_cost numeric := 0;
BEGIN
  SELECT COALESCE(SUM(
    COALESCE(ri.qty_gross, ri.quantity, 0) * COALESCE(ii.last_cost, ii.price, 0)
  ), 0)
  INTO v_cost
  FROM recipe_ingredients ri
  JOIN inventory_items ii ON ii.id = ri.inventory_item_id
  WHERE ri.recipe_id = p_recipe_id;

  RETURN ROUND(v_cost, 2);
END;
$$;

-- function: get_sales_timeseries_unified
CREATE OR REPLACE FUNCTION get_sales_timeseries_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_ds     jsonb;
  v_kpis   jsonb;
  v_daily  jsonb;
  v_hourly jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  -- KPIs from sales_daily_unified
  SELECT jsonb_build_object(
    'actual_sales',       COALESCE(SUM(net_sales), 0),
    'forecast_sales',     COALESCE(SUM(fc.forecast_sales), 0),
    'actual_orders',      COALESCE(SUM(orders_count), 0),
    'forecast_orders',    COALESCE(SUM(fc.forecast_orders), 0),
    'avg_check_actual',   CASE WHEN COALESCE(SUM(orders_count), 0) > 0
                               THEN SUM(net_sales) / SUM(orders_count) ELSE 0 END,
    'avg_check_forecast', CASE WHEN COALESCE(SUM(fc.forecast_orders), 0) > 0
                               THEN SUM(fc.forecast_sales) / SUM(fc.forecast_orders) ELSE 0 END
  ) INTO v_kpis
  FROM sales_daily_unified s
  LEFT JOIN (
    SELECT location_id, day, forecast_sales, forecast_orders
    FROM forecast_daily_unified
    WHERE org_id = p_org_id AND location_id = ANY(p_location_ids)
      AND day BETWEEN p_from AND p_to
  ) fc ON fc.location_id = s.location_id AND fc.day = s.date
  WHERE s.org_id = p_org_id AND s.location_id = ANY(p_location_ids)
    AND s.date BETWEEN p_from AND p_to;

  -- Daily timeseries
  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.date), '[]'::jsonb) INTO v_daily
  FROM (
    SELECT
      s.date,
      SUM(COALESCE(s.net_sales, 0))::numeric     AS actual_sales,
      SUM(COALESCE(s.orders_count, 0))::integer   AS actual_orders,
      COALESCE(SUM(fc.forecast_sales), 0)::numeric AS forecast_sales,
      COALESCE(SUM(fc.forecast_orders), 0)::integer AS forecast_orders,
      COALESCE(SUM(fc.forecast_sales_lower), 0)::numeric AS lower,
      COALESCE(SUM(fc.forecast_sales_upper), 0)::numeric AS upper
    FROM sales_daily_unified s
    LEFT JOIN (
      SELECT location_id, day,
             forecast_sales, forecast_orders,
             forecast_sales_lower, forecast_sales_upper
      FROM forecast_daily_unified
      WHERE org_id = p_org_id AND location_id = ANY(p_location_ids)
        AND day BETWEEN p_from AND p_to
    ) fc ON fc.location_id = s.location_id AND fc.day = s.date
    WHERE s.org_id = p_org_id AND s.location_id = ANY(p_location_ids)
      AND s.date BETWEEN p_from AND p_to
    GROUP BY s.date
  ) d;

  -- Hourly from sales_hourly_unified
  SELECT COALESCE(jsonb_agg(row_to_json(h)::jsonb ORDER BY h.ts_hour), '[]'::jsonb) INTO v_hourly
  FROM (
    SELECT
      hour_bucket AS ts_hour,
      SUM(net_sales)::numeric      AS actual_sales,
      SUM(orders_count)::integer   AS actual_orders,
      0::numeric AS forecast_sales,
      0::integer AS forecast_orders,
      0::numeric AS lower,
      0::numeric AS upper
    FROM sales_hourly_unified
    WHERE org_id = p_org_id AND location_id = ANY(p_location_ids)
      AND day BETWEEN p_from AND p_to
    GROUP BY hour_bucket
  ) h;

  RETURN jsonb_build_object(
    'data_source',    v_ds->>'data_source',
    'mode',           v_ds->>'mode',
    'reason',         v_ds->>'reason',
    'last_synced_at', v_ds->>'last_synced_at',
    'kpis',           v_kpis,
    'daily',          v_daily,
    'hourly',         v_hourly,
    'busy_hours',     '[]'::jsonb
  );
END;
$$;

-- function: get_staffing_heatmap
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
    (SELECT rule_value::numeric FROM labour_rules
     WHERE rule_key = 'target_splh' AND location_id = p_location_id AND org_id = p_org_id LIMIT 1),
    (SELECT rule_value::numeric FROM labour_rules
     WHERE rule_key = 'target_splh' AND location_id IS NULL AND org_id = p_org_id LIMIT 1),
    (SELECT rule_value::numeric FROM labour_rules
     WHERE rule_key = 'target_splh' AND location_id IS NULL AND org_id IS NULL LIMIT 1),
    60
  ) INTO v_target_splh;

  -- Get opening/closing from labour_rules if available
  SELECT COALESCE(
    (SELECT rule_value::int FROM labour_rules
     WHERE rule_key = 'opening_hour' AND location_id = p_location_id AND org_id = p_org_id LIMIT 1),
    10
  ) INTO v_opening_hour;

  SELECT COALESCE(
    (SELECT rule_value::int FROM labour_rules
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
        daily_agg.dow,
        daily_agg.avg_sales,
        COALESCE(staff_agg.avg_staff, 0) AS avg_staff
      FROM (
        SELECT
          EXTRACT(DOW FROM s.date)::int AS dow,
          AVG(s.net_sales) AS avg_sales
        FROM sales_daily_unified s
        WHERE s.location_id = p_location_id
          AND s.date BETWEEN v_date_from AND v_date_to
        GROUP BY EXTRACT(DOW FROM s.date)::int
      ) daily_agg
      LEFT JOIN (
        SELECT
          EXTRACT(DOW FROM ps.shift_date)::int AS dow,
          AVG(day_cnt.staff_cnt) AS avg_staff
        FROM (
          SELECT shift_date, COUNT(DISTINCT employee_id) AS staff_cnt
          FROM planned_shifts
          WHERE location_id = p_location_id
            AND shift_date BETWEEN v_date_from AND v_date_to
          GROUP BY shift_date
        ) day_cnt
        CROSS JOIN LATERAL (SELECT EXTRACT(DOW FROM day_cnt.shift_date)::int AS dow_val) dw
        JOIN planned_shifts ps ON ps.shift_date = day_cnt.shift_date AND ps.location_id = p_location_id
        GROUP BY EXTRACT(DOW FROM ps.shift_date)::int
      ) staff_agg ON staff_agg.dow = daily_agg.dow
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

-- function: get_staffing_recommendation
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

-- function: get_top_products_unified
CREATE OR REPLACE FUNCTION get_top_products_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_ds jsonb;
  v_total numeric;
  v_items jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  SELECT COALESCE(SUM(net_sales),0) INTO v_total
  FROM daily_sales
  WHERE org_id = p_org_id AND location_id = ANY(p_location_ids) AND day BETWEEN p_from AND p_to;

  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb), '[]'::jsonb) INTO v_items
  FROM (
    SELECT
      COALESCE(ol.item_id,'00000000-0000-0000-0000-000000000000')::text AS product_id,
      COALESCE(mi.name, ci.name, 'Unknown')        AS name,
      COALESCE(mi.category, ci.category, 'Other')  AS category,
      SUM(COALESCE(ol.gross,0))::numeric AS sales,
      SUM(COALESCE(ol.qty,0))::numeric         AS qty,
      CASE WHEN v_total > 0 THEN SUM(COALESCE(ol.gross,0))/v_total ELSE 0 END AS share
    FROM cdm_orders o
    JOIN cdm_order_lines ol ON ol.order_id = o.id
    LEFT JOIN cdm_items ci ON ci.id = ol.item_id
    LEFT JOIN menu_items mi ON mi.id = ol.item_id
    WHERE o.org_id = p_org_id AND o.location_id = ANY(p_location_ids)
      AND o.closed_at::date BETWEEN p_from AND p_to AND o.closed_at IS NOT NULL
    GROUP BY 1,2,3
    ORDER BY sales DESC
    LIMIT p_limit
  ) p;

  RETURN jsonb_build_object(
    'data_source',v_ds->>'data_source','mode',v_ds->>'mode',
    'reason',v_ds->>'reason','last_synced_at',v_ds->>'last_synced_at',
    'total_sales',v_total,'items',v_items
  );
END;
$$;

-- function: get_user_accessible_locations
CREATE OR REPLACE FUNCTION get_user_accessible_locations(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM org_memberships WHERE user_id = _user_id AND role IN ('owner', 'manager')) THEN
    RETURN QUERY
      SELECT l.id FROM locations l
      JOIN org_memberships om ON om.org_id = l.org_id
      WHERE om.user_id = _user_id AND l.active = true;
  ELSE
    RETURN QUERY
      SELECT lm.location_id FROM location_memberships lm
      JOIN locations l ON l.id = lm.location_id
      WHERE lm.user_id = _user_id AND l.active = true;
  END IF;
END;
$$;

-- function: get_user_has_global_scope
CREATE OR REPLACE FUNCTION get_user_has_global_scope(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_memberships WHERE user_id = _user_id AND role IN ('owner', 'manager')
  );
$$;

-- function: get_user_permissions
CREATE OR REPLACE FUNCTION get_user_permissions(_user_id uuid)
RETURNS TABLE(permission_key text, module text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT om.role::text INTO v_role
  FROM org_memberships om WHERE om.user_id = _user_id
  ORDER BY CASE om.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
  LIMIT 1;

  IF v_role IS NULL THEN
    SELECT lm.role::text INTO v_role
    FROM location_memberships lm WHERE lm.user_id = _user_id
    ORDER BY CASE lm.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
    LIMIT 1;
  END IF;

  IF v_role = 'owner' THEN
    RETURN QUERY VALUES
      ('sales.view','sales'),('sales.export','sales'),
      ('labour.view','labour'),('labour.manage','labour'),
      ('inventory.view','inventory'),('inventory.manage','inventory'),
      ('menu.view','menu'),('menu.manage','menu'),
      ('settings.view','settings'),('settings.manage','settings'),
      ('team.view','team'),('team.manage','team'),
      ('payroll.view','payroll'),('payroll.manage','payroll'),
      ('reports.view','reports'),('forecast.view','forecast'),
      ('ai.view','ai'),('integrations.manage','integrations');
  ELSIF v_role = 'manager' THEN
    RETURN QUERY VALUES
      ('sales.view','sales'),('sales.export','sales'),
      ('labour.view','labour'),('labour.manage','labour'),
      ('inventory.view','inventory'),('inventory.manage','inventory'),
      ('menu.view','menu'),('menu.manage','menu'),
      ('settings.view','settings'),('team.view','team'),
      ('payroll.view','payroll'),('reports.view','reports'),
      ('forecast.view','forecast'),('ai.view','ai');
  ELSIF v_role = 'staff' THEN
    RETURN QUERY VALUES
      ('sales.view','sales'),('labour.view','labour'),
      ('inventory.view','inventory'),('menu.view','menu'),
      ('reports.view','reports');
  END IF;
  RETURN;
END;
$$;

-- function: get_user_roles_with_scope
CREATE OR REPLACE FUNCTION get_user_roles_with_scope(_user_id uuid)
RETURNS TABLE(role_name text, role_id uuid, location_id uuid, location_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    -- Org-level roles
    SELECT om.role::text, om.org_id, NULL::uuid, NULL::text
    FROM org_memberships om
    WHERE om.user_id = _user_id
  UNION ALL
    -- Location-level roles
    SELECT lm.role::text, lm.location_id, lm.location_id, l.name::text
    FROM location_memberships lm
    JOIN locations l ON l.id = lm.location_id
    WHERE lm.user_id = _user_id;
END;
$$;

-- function: get_variance_summary
CREATE OR REPLACE FUNCTION get_variance_summary(
  p_org_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_from_date date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_to_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  item_id uuid,
  item_name text,
  category text,
  stock_expected numeric,
  stock_actual numeric,
  variance numeric,
  variance_pct numeric,
  unit_cost numeric,
  financial_loss numeric,
  count_date date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.item_id,
    ii.name AS item_name,
    COALESCE(cat.name, 'Sin categoría') AS category,
    c.stock_expected,
    c.stock_actual,
    c.variance,
    c.variance_pct,
    c.unit_cost,
    ABS(c.variance) * c.unit_cost AS financial_loss,
    c.count_date
  FROM inventory_counts c
  JOIN inventory_items ii ON ii.id = c.item_id
  LEFT JOIN inventory_categories cat ON cat.id = ii.category_id
  WHERE c.org_id = p_org_id
    AND (p_location_id IS NULL OR c.location_id = p_location_id)
    AND c.count_date BETWEEN p_from_date AND p_to_date
  ORDER BY ABS(c.variance_pct) DESC;
END;
$$;

-- function: is_org_admin
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = p_org_id 
      AND m.user_id = p_user_id
      AND m.role IN ('owner', 'admin')
  )
$$;

-- function: is_org_member
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = p_org_id AND m.user_id = p_user_id
  )
$$;

-- function: is_owner
CREATE OR REPLACE FUNCTION is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_memberships WHERE user_id = _user_id AND role = 'owner'
  );
$$;

-- function: menu_engineering_summary
CREATE OR REPLACE FUNCTION menu_engineering_summary(
  p_date_from date,
  p_date_to date,
  p_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    WITH product_data AS (
      SELECT
        COALESCE(ol.item_id,'00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
        COALESCE(mi.name, ci.name, 'Unknown')        AS product_name,
        COALESCE(mi.category, ci.category, 'Other')  AS product_category,
        COALESCE(SUM(ol.qty),0)::bigint               AS units_sold,
        COALESCE(SUM(ol.gross),0)                      AS net_sales,
        0::numeric                                      AS cogs,
        COALESCE(SUM(ol.gross),0)                      AS gross_profit,
        100::numeric                                    AS margin_pct
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id
      LEFT JOIN menu_items mi ON mi.id = ol.item_id
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to
        AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
      GROUP BY 1,2,3
    ),
    stats AS (
      SELECT AVG(margin_pct) AS avg_m, AVG(units_sold) AS avg_p FROM product_data
    )
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT pd.product_id, pd.product_name, pd.product_category,
        pd.units_sold, pd.net_sales, pd.cogs, pd.gross_profit, pd.margin_pct,
        CASE
          WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'star'
          WHEN pd.margin_pct <  COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'plow_horse'
          WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold <  COALESCE(s.avg_p,0) THEN 'puzzle'
          ELSE 'dog' END AS classification
      FROM product_data pd, stats s
      ORDER BY pd.net_sales DESC
    ) r
  );
END;
$$;

-- function: ops.refresh_all_mvs
CREATE OR REPLACE FUNCTION ops.refresh_all_mvs(p_triggered_by text DEFAULT 'manual')
RETURNS jsonb AS $$
DECLARE
  t_start   timestamptz;
  log_id    bigint;
  results   jsonb := '[]'::jsonb;
  mv_name   text;
  mv_start  timestamptz;
  mv_ms     integer;
  mv_rows   bigint;
  mv_list   text[] := ARRAY[
    'product_sales_daily_unified_mv',
    'sales_hourly_unified_mv',
    'product_sales_daily_unified_mv_v2',
    'sales_hourly_unified_mv_v2',
    'mart_kpi_daily_mv',
    'mart_sales_category_daily_mv'
  ];
BEGIN
  t_start := clock_timestamp();

  INSERT INTO ops.mv_refresh_log (triggered_by, status)
  VALUES (p_triggered_by, 'running')
  RETURNING id INTO log_id;

  FOREACH mv_name IN ARRAY mv_list LOOP
    -- Skip safely if MV does not exist
    IF to_regclass(mv_name) IS NULL THEN
      results := results || jsonb_build_object(
        'view', mv_name, 'skipped', true, 'reason', 'missing'
      );
      CONTINUE;
    END IF;

    mv_start := clock_timestamp();

    -- Check row count: CONCURRENTLY requires >= 1 existing row
    EXECUTE format('SELECT count(*) FROM %I', mv_name) INTO mv_rows;

    IF mv_rows = 0 THEN
      EXECUTE format('REFRESH MATERIALIZED VIEW %I', mv_name);
    ELSE
      EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', mv_name);
    END IF;

    mv_ms := extract(milliseconds from clock_timestamp() - mv_start)::integer;
    results := results || jsonb_build_object(
      'view', mv_name, 'ms', mv_ms,
      'mode', CASE WHEN mv_rows = 0 THEN 'full' ELSE 'concurrent' END
    );
  END LOOP;

  UPDATE ops.mv_refresh_log SET
    finished_at = clock_timestamp(),
    duration_ms = extract(milliseconds from clock_timestamp() - t_start)::integer,
    views_refreshed = mv_list,
    status = 'success',
    metadata = jsonb_build_object('details', results)
  WHERE id = log_id;

  RETURN jsonb_build_object(
    'log_id', log_id,
    'duration_ms', extract(milliseconds from clock_timestamp() - t_start)::integer,
    'views', results
  );

EXCEPTION WHEN OTHERS THEN
  UPDATE ops.mv_refresh_log SET
    finished_at = clock_timestamp(),
    status = 'error',
    error_message = SQLERRM
  WHERE id = log_id;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- function: org_role_of
CREATE OR REPLACE FUNCTION public.org_role_of(p_org_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
  FROM public.org_memberships m
  WHERE m.org_id = p_org_id AND m.user_id = p_user_id
  LIMIT 1
$$;

-- function: process_refresh_mvs_jobs
CREATE OR REPLACE FUNCTION public.process_refresh_mvs_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job   record;
  v_result jsonb;
  v_count integer := 0;
BEGIN
  FOR v_job IN
    SELECT id, org_id, payload
    FROM jobs
    WHERE job_type = 'refresh_mvs'
      AND status = 'queued'
      AND run_after <= now()
    ORDER BY priority DESC, created_at ASC
    LIMIT 5
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Mark running
    UPDATE jobs SET status = 'running', locked_at = now()
    WHERE id = v_job.id;

    BEGIN
      v_result := ops.refresh_all_mvs(
        COALESCE(v_job.payload->>'triggered_by', 'job_worker')
      );

      UPDATE jobs SET
        status = 'succeeded',
        finished_at = now(),
        payload = v_job.payload || jsonb_build_object('result', v_result)
      WHERE id = v_job.id;

      v_count := v_count + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE jobs SET
        status = 'failed',
        finished_at = now(),
        last_error = SQLERRM,
        attempts = attempts + 1
      WHERE id = v_job.id;
    END;
  END LOOP;

  RETURN jsonb_build_object('processed', v_count);
END;
$$;

-- function: redeem_loyalty_reward
CREATE OR REPLACE FUNCTION redeem_loyalty_reward(
  p_member_id uuid,
  p_reward_id uuid,
  p_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$ SELECT '{"ok":true,"stub":true}'::jsonb; $$;

-- function: refresh_all_mvs
CREATE OR REPLACE FUNCTION public.refresh_all_mvs(p_triggered_by text DEFAULT 'manual')
RETURNS jsonb AS $$
  SELECT ops.refresh_all_mvs(p_triggered_by);
$$ LANGUAGE sql SECURITY DEFINER;

-- function: resolve_data_source
CREATE OR REPLACE FUNCTION public.resolve_data_source(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_mode             text;
  v_threshold_hours  int;
  v_last_synced_at   timestamptz;
  v_last_pos_order   timestamptz;
  v_last_activity    timestamptz;
  v_within_threshold boolean;
  v_pos_has_data     boolean;
  v_has_active_integ boolean;
BEGIN
  -- 1. Read org settings
  SELECT
    COALESCE(os.data_source_mode, 'auto'),
    COALESCE(os.demo_fallback_after_hours, 24)
  INTO v_mode, v_threshold_hours
  FROM org_settings os
  WHERE os.org_id = p_org_id;

  IF NOT FOUND THEN
    v_mode := 'auto';
    v_threshold_hours := 24;
  END IF;

  -- 2. Check if there is an ACTIVE integration
  SELECT EXISTS(
    SELECT 1 FROM integrations i
    WHERE i.org_id = p_org_id
      AND i.status = 'active'
  ) INTO v_has_active_integ;

  -- 3. Compute last_synced_at (only from active integrations)
  SELECT GREATEST(
    MAX((i.metadata->>'last_synced_at')::timestamptz),
    MAX((i.metadata->>'last_sync_ended_at')::timestamptz),
    MAX(isr.finished_at)
  )
  INTO v_last_synced_at
  FROM integrations i
  LEFT JOIN integration_sync_runs isr ON isr.integration_id = i.id
  WHERE i.org_id = p_org_id
    AND i.status = 'active';

  -- 4. Compute last POS order
  SELECT MAX(o.closed_at)
  INTO v_last_pos_order
  FROM cdm_orders o
  WHERE o.org_id = p_org_id
    AND (o.provider IS NOT NULL OR o.integration_account_id IS NOT NULL);

  -- POS is available ONLY if integration is active AND orders exist
  v_pos_has_data := (v_has_active_integ AND v_last_pos_order IS NOT NULL);

  -- 5. Determine threshold
  v_last_activity := GREATEST(v_last_synced_at, v_last_pos_order);
  v_within_threshold := (
    v_last_activity IS NOT NULL
    AND v_last_activity >= (now() - make_interval(hours => v_threshold_hours))
  );

  -- 6. Apply rules

  -- A) manual_demo — always demo
  IF v_mode = 'manual_demo' THEN
    RETURN jsonb_build_object(
      'data_source',    'demo',
      'mode',           'manual',
      'reason',         'manual_demo',
      'blocked',        false,
      'last_synced_at', v_last_synced_at
    );
  END IF;

  -- B) manual_pos
  IF v_mode = 'manual_pos' THEN
    IF v_pos_has_data AND v_within_threshold THEN
      RETURN jsonb_build_object(
        'data_source',    'pos',
        'mode',           'manual',
        'reason',         'manual_pos_recent',
        'blocked',        false,
        'last_synced_at', v_last_synced_at
      );
    ELSE
      RETURN jsonb_build_object(
        'data_source',    'demo',
        'mode',           'manual',
        'reason',         'manual_pos_blocked_no_sync',
        'blocked',        true,
        'last_synced_at', v_last_synced_at
      );
    END IF;
  END IF;

  -- C) auto (default)
  IF v_pos_has_data AND v_within_threshold THEN
    RETURN jsonb_build_object(
      'data_source',    'pos',
      'mode',           'auto',
      'reason',         'auto_pos_recent',
      'blocked',        false,
      'last_synced_at', v_last_synced_at
    );
  ELSE
    RETURN jsonb_build_object(
      'data_source',    'demo',
      'mode',           'auto',
      'reason',         'auto_demo_no_sync',
      'blocked',        false,
      'last_synced_at', v_last_synced_at
    );
  END IF;
END;
$fn$;


-- function: rpc_data_health
CREATE OR REPLACE FUNCTION rpc_data_health(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_last_refresh jsonb;
  v_last_pos_order jsonb;
  v_kpi_coverage jsonb;
  v_inventory jsonb;
  v_stock_counts jsonb;
BEGIN
  -- 1. Last MV refresh from ops.mv_refresh_log
  SELECT COALESCE(
    (SELECT jsonb_build_object(
      'status', rl.status,
      'finished_at', rl.finished_at,
      'duration_ms', rl.duration_ms,
      'views_refreshed', rl.views_refreshed,
      'triggered_by', rl.triggered_by,
      'error_message', rl.error_message
    )
    FROM ops.mv_refresh_log rl
    ORDER BY rl.id DESC
    LIMIT 1),
    jsonb_build_object('status', 'never', 'finished_at', null)
  ) INTO v_last_refresh;

  -- 2. Last POS order (from cdm_orders)
  SELECT jsonb_build_object(
    'last_closed_at', MAX(o.closed_at),
    'orders_7d', COUNT(*) FILTER (WHERE o.closed_at >= now() - interval '7 days')
  ) INTO v_last_pos_order
  FROM cdm_orders o
  WHERE o.org_id = p_org_id AND o.closed_at IS NOT NULL;

  -- 3. KPI coverage: location-days with data in last 30d
  SELECT jsonb_build_object(
    'location_days_30d', COUNT(*),
    'distinct_locations', COUNT(DISTINCT s.location_id)
  ) INTO v_kpi_coverage
  FROM sales_daily_unified s
  WHERE s.org_id = p_org_id
    AND s.date >= (current_date - 30);

  -- 4. Inventory health
  SELECT jsonb_build_object(
    'total_items', COUNT(*),
    'with_recipes', COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM recipes r WHERE r.menu_item_name = ii.name AND r.group_id = p_org_id
    )),
    'with_par_level', COUNT(*) FILTER (WHERE ii.par_level IS NOT NULL AND ii.par_level > 0),
    'with_cost', COUNT(*) FILTER (WHERE ii.last_cost IS NOT NULL AND ii.last_cost > 0)
  ) INTO v_inventory
  FROM inventory_items ii
  WHERE ii.group_id = p_org_id;

  -- 5. Stock counts
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'last_30d', COUNT(*) FILTER (WHERE sc.start_date >= (current_date - 30)),
    'distinct_locations', COUNT(DISTINCT sc.location_id)
  ) INTO v_stock_counts
  FROM stock_counts sc
  WHERE sc.group_id = p_org_id;

  RETURN jsonb_build_object(
    'last_mv_refresh', v_last_refresh,
    'last_pos_order', v_last_pos_order,
    'kpi_coverage', v_kpi_coverage,
    'inventory', v_inventory,
    'stock_counts', v_stock_counts
  );
END;
$$;

-- function: rpc_kpi_range_summary
CREATE OR REPLACE FUNCTION public.rpc_kpi_range_summary(
  p_org_id uuid,
  p_location_ids text[] DEFAULT NULL,
  p_from date DEFAULT CURRENT_DATE - INTERVAL '7 days',
  p_to date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_days int;
  v_current jsonb;
  v_previous jsonb;
  v_loc_filter uuid[];
BEGIN
  v_days := (p_to - p_from) + 1;

  -- Resolve location filter (cast text[] to uuid[])
  IF p_location_ids IS NOT NULL AND array_length(p_location_ids, 1) > 0 THEN
    v_loc_filter := p_location_ids::uuid[];
  ELSE
    SELECT array_agg(id) INTO v_loc_filter
    FROM locations
    WHERE group_id = p_org_id AND active = true;
  END IF;

  -- If no locations, return zeros
  IF v_loc_filter IS NULL OR array_length(v_loc_filter, 1) IS NULL THEN
    v_current := jsonb_build_object(
      'net_sales', 0, 'orders_count', 0, 'covers', 0, 'avg_check', 0,
      'labour_cost', null, 'labour_hours', null, 'cogs', 0,
      'col_percent', null, 'gp_percent', null
    );
    RETURN jsonb_build_object(
      'current', v_current,
      'previous', v_current,
      'period', jsonb_build_object('from', p_from, 'to', p_to, 'days', v_days),
      'previousPeriod', jsonb_build_object('from', p_from, 'to', p_to)
    );
  END IF;

  -- ── ACTUAL (current period) ─────────────────────────────────
  WITH sales AS (
    SELECT
      COALESCE(SUM(net_sales), 0) AS total_sales,
      COALESCE(SUM(orders_count), 0) AS total_orders
    FROM sales_daily_unified
    WHERE location_id::uuid = ANY(v_loc_filter)
      AND date BETWEEN p_from AND p_to
  ),
  -- Labour from planned_shifts × employees.hourly_cost
  labour AS (
    SELECT
      COALESCE(SUM(ps.planned_hours * COALESCE(e.hourly_cost, 0)), 0) AS total_cost,
      COALESCE(SUM(ps.planned_hours), 0) AS total_hours
    FROM planned_shifts ps
    JOIN employees e ON e.id = ps.employee_id
    WHERE ps.location_id::uuid = ANY(v_loc_filter)
      AND ps.shift_date BETWEEN p_from AND p_to
  ),
  cogs AS (
    SELECT COALESCE(SUM(cogs_amount), 0) AS total_cogs
    FROM cogs_daily
    WHERE location_id::uuid = ANY(v_loc_filter)
      AND date BETWEEN p_from AND p_to
  ),
  -- FIX: Use period_year and period_month (correct column names)
  monthly_cogs AS (
    SELECT COALESCE(SUM(amount), 0) AS total_manual_cogs
    FROM monthly_cost_entries
    WHERE location_id::uuid = ANY(v_loc_filter)
      AND period_year = EXTRACT(YEAR FROM p_from)
      AND period_month = EXTRACT(MONTH FROM p_from)
  )
  SELECT jsonb_build_object(
    'net_sales', s.total_sales,
    'orders_count', s.total_orders,
    'covers', s.total_orders,
    'avg_check', CASE WHEN s.total_orders > 0 THEN ROUND(s.total_sales / s.total_orders, 2) ELSE 0 END,
    'labour_cost', CASE WHEN l.total_cost > 0 THEN l.total_cost ELSE null END,
    'labour_hours', CASE WHEN l.total_hours > 0 THEN l.total_hours ELSE null END,
    'cogs', GREATEST(c.total_cogs, mc.total_manual_cogs),
    'col_percent', CASE WHEN s.total_sales > 0 AND l.total_cost > 0
      THEN ROUND((l.total_cost / s.total_sales) * 100, 1) ELSE null END,
    'gp_percent', CASE WHEN s.total_sales > 0
      THEN ROUND(((s.total_sales - GREATEST(c.total_cogs, mc.total_manual_cogs)) / s.total_sales) * 100, 1)
      ELSE null END,
    'cogs_source_mixed', false,
    'labour_source_mixed', false
  )
  INTO v_current
  FROM sales s, labour l, cogs c, monthly_cogs mc;

  -- ── FORECAST (same date range from forecast_daily_metrics) ──
  WITH fc AS (
    SELECT
      COALESCE(SUM(forecast_sales), 0) AS fc_sales,
      COALESCE(SUM(forecast_orders), 0) AS fc_orders,
      COALESCE(SUM(planned_labor_hours), 0) AS fc_hours,
      COALESCE(SUM(planned_labor_cost), 0) AS fc_cost
    FROM forecast_daily_metrics
    WHERE location_id::uuid = ANY(v_loc_filter)
      AND date BETWEEN p_from AND p_to
  ),
  cogs AS (
    SELECT COALESCE(SUM(forecast_sales * 0.28), 0) AS fc_cogs
    FROM forecast_daily_metrics
    WHERE location_id::uuid = ANY(v_loc_filter)
      AND date BETWEEN p_from AND p_to
  )
  SELECT jsonb_build_object(
    'net_sales', fc.fc_sales,
    'orders_count', fc.fc_orders,
    'covers', fc.fc_orders,
    'avg_check', CASE WHEN fc.fc_orders > 0 THEN ROUND(fc.fc_sales / fc.fc_orders, 2) ELSE 0 END,
    'labour_cost', CASE WHEN fc.fc_cost > 0 THEN fc.fc_cost ELSE null END,
    'labour_hours', CASE WHEN fc.fc_hours > 0 THEN fc.fc_hours ELSE null END,
    'cogs', c.fc_cogs,
    'col_percent', CASE WHEN fc.fc_sales > 0 THEN ROUND((fc.fc_cost / fc.fc_sales) * 100, 1) ELSE null END,
    'gp_percent', CASE WHEN fc.fc_sales > 0 THEN ROUND(((fc.fc_sales - c.fc_cogs) / fc.fc_sales) * 100, 1) ELSE null END
  )
  INTO v_previous
  FROM fc, cogs c;

  RETURN jsonb_build_object(
    'current', v_current,
    'previous', v_previous,
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'days', v_days),
    'previousPeriod', jsonb_build_object('from', p_from, 'to', p_to)
  );
END;
$$;

-- function: rpc_reconciliation_summary
CREATE OR REPLACE FUNCTION rpc_reconciliation_summary(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_headers jsonb;
  v_lines jsonb;
  v_totals jsonb;
BEGIN
  -- Count headers
  SELECT COALESCE(jsonb_agg(row_to_json(h)::jsonb ORDER BY h.start_date DESC), '[]'::jsonb)
  INTO v_headers
  FROM (
    SELECT
      mh.id, mh.location_id, mh.location_name,
      mh.start_date, mh.end_date, mh.status,
      mh.line_count, mh.total_variance_qty,
      mh.created_at
    FROM mart_stock_count_headers mh
    WHERE mh.group_id = p_org_id
      AND (p_location_ids IS NULL OR mh.location_id = ANY(p_location_ids))
      AND mh.start_date >= p_from
      AND mh.end_date <= p_to
      AND (p_status IS NULL OR mh.status = p_status)
  ) h;

  -- Aggregated lines by item (across multiple stock counts)
  SELECT COALESCE(jsonb_agg(row_to_json(li)::jsonb ORDER BY li.item_name), '[]'::jsonb)
  INTO v_lines
  FROM (
    SELECT
      el.inventory_item_id,
      el.item_name,
      el.unit,
      el.unit_cost,
      SUM(el.opening_qty)::numeric AS opening_qty,
      SUM(el.deliveries_qty)::numeric AS deliveries_qty,
      SUM(el.transfers_net_qty)::numeric AS transfers_net_qty,
      SUM(el.closing_qty)::numeric AS closing_qty,
      SUM(el.used_qty)::numeric AS used_qty,
      SUM(el.sales_qty)::numeric AS sales_qty,
      SUM(el.variance_qty)::numeric AS variance_qty,
      SUM(el.batch_balance)::numeric AS batch_balance,
      SUM(el.variance_value)::numeric AS variance_value
    FROM mart_stock_count_lines_enriched el
    WHERE el.group_id = p_org_id
      AND (p_location_ids IS NULL OR el.location_id = ANY(p_location_ids))
      AND el.start_date >= p_from
      AND el.end_date <= p_to
      AND (p_status IS NULL OR el.count_status = p_status)
    GROUP BY el.inventory_item_id, el.item_name, el.unit, el.unit_cost
  ) li;

  -- Totals
  SELECT jsonb_build_object(
    'opening_qty', COALESCE(SUM(el.opening_qty), 0),
    'deliveries_qty', COALESCE(SUM(el.deliveries_qty), 0),
    'transfers_net_qty', COALESCE(SUM(el.transfers_net_qty), 0),
    'closing_qty', COALESCE(SUM(el.closing_qty), 0),
    'used_qty', COALESCE(SUM(el.used_qty), 0),
    'sales_qty', COALESCE(SUM(el.sales_qty), 0),
    'variance_qty', COALESCE(SUM(el.variance_qty), 0),
    'batch_balance', COALESCE(SUM(el.batch_balance), 0),
    'variance_value', COALESCE(SUM(el.variance_value), 0)
  )
  INTO v_totals
  FROM mart_stock_count_lines_enriched el
  WHERE el.group_id = p_org_id
    AND (p_location_ids IS NULL OR el.location_id = ANY(p_location_ids))
    AND el.start_date >= p_from
    AND el.end_date <= p_to
    AND (p_status IS NULL OR el.count_status = p_status);

  RETURN jsonb_build_object(
    'count_headers', v_headers,
    'lines', v_lines,
    'totals', v_totals
  );
END;
$$;

-- function: trg_compute_variance
CREATE OR REPLACE FUNCTION trg_compute_variance()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.variance := NEW.stock_actual - NEW.stock_expected;
  IF NEW.stock_expected > 0 THEN
    NEW.variance_pct := ROUND((NEW.stock_actual - NEW.stock_expected) / NEW.stock_expected * 100, 1);
  ELSE
    NEW.variance_pct := 0;
  END IF;
  RETURN NEW;
END;
$$;

-- function: trg_enqueue_refresh_mvs
CREATE OR REPLACE FUNCTION public.trg_enqueue_refresh_mvs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id   uuid;
  v_provider text;
  v_existing bigint;
BEGIN
  -- Look up the integration to get org_id and provider
  SELECT i.org_id, i.provider::text
  INTO v_org_id, v_provider
  FROM integrations i
  WHERE i.id = NEW.integration_id;

  IF v_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Dedup: skip if a queued refresh_mvs job exists for this org in last 10 min
  SELECT count(*) INTO v_existing
  FROM jobs
  WHERE job_type = 'refresh_mvs'
    AND org_id = v_org_id
    AND status = 'queued'
    AND created_at >= (now() - interval '10 minutes');

  IF v_existing > 0 THEN
    RETURN NEW;
  END IF;

  -- Insert the job
  INSERT INTO jobs (job_type, org_id, status, priority, payload, provider)
  VALUES (
    'refresh_mvs',
    v_org_id,
    'queued',
    50,
    jsonb_build_object('org_id', v_org_id, 'triggered_by', 'sync_success'),
    v_provider::integration_provider
  );

  RETURN NEW;
END;
$$;

-- function: trg_waste_auto_decrement
CREATE OR REPLACE FUNCTION trg_waste_auto_decrement()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NEW.movement_type = 'waste' THEN
    UPDATE inventory_item_location
      SET on_hand = GREATEST(on_hand + NEW.qty_delta, 0),
          updated_at = now()
      WHERE item_id = NEW.item_id
        AND location_id = NEW.location_id;

    UPDATE inventory_items
      SET current_stock = GREATEST(COALESCE(current_stock, 0) + NEW.qty_delta, 0)
      WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS (3)
-- ═══════════════════════════════════════════════════════════════════════════

-- trigger: trg_inventory_counts_variance
CREATE TRIGGER trg_inventory_counts_variance
  BEFORE INSERT OR UPDATE ON inventory_counts
  FOR EACH ROW
  EXECUTE FUNCTION trg_compute_variance();

-- trigger: trg_stock_waste_decrement
CREATE TRIGGER trg_stock_waste_decrement
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  WHEN (NEW.movement_type = 'waste')
  EXECUTE FUNCTION trg_waste_auto_decrement();

-- trigger: trg_sync_success_refresh_mvs
CREATE TRIGGER trg_sync_success_refresh_mvs
  AFTER UPDATE OF status ON public.integration_sync_runs
  FOR EACH ROW
  WHEN (
    (NEW.status)::text = 'success'
    AND (OLD.status)::text IS DISTINCT FROM (NEW.status)::text
  )
  EXECUTE FUNCTION public.trg_enqueue_refresh_mvs();


-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — POLICIES (63)
-- ═══════════════════════════════════════════════════════════════════════════

-- policy: 380cc102d31d3eb731f52bfad60b9306
CREATE POLICY "Users can manage own org counts"
  ON inventory_counts FOR ALL
  USING (true);

-- policy: breaks_delete
CREATE POLICY "breaks_delete" ON employee_breaks
  FOR DELETE TO authenticated USING (true);

-- policy: breaks_insert
CREATE POLICY "breaks_insert" ON employee_breaks
  FOR INSERT TO authenticated WITH CHECK (true);

-- policy: breaks_select
CREATE POLICY "breaks_select" ON employee_breaks
  FOR SELECT TO authenticated USING (true);

-- policy: breaks_update
CREATE POLICY "breaks_update" ON employee_breaks
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- policy: budget_days_read
CREATE POLICY budget_days_read ON budget_days FOR SELECT TO authenticated USING (true);

-- policy: budget_drivers_read
CREATE POLICY budget_drivers_read ON budget_drivers FOR SELECT TO authenticated USING (true);

-- policy: budget_metrics_read
CREATE POLICY budget_metrics_read ON budget_metrics FOR SELECT TO authenticated USING (true);

-- policy: budget_versions_read
CREATE POLICY budget_versions_read ON budget_versions FOR SELECT TO authenticated USING (true);

-- policy: cash_counts_daily_read
CREATE POLICY cash_counts_daily_read ON cash_counts_daily FOR SELECT TO authenticated USING (true);

-- policy: cash_counts_daily_write
CREATE POLICY cash_counts_daily_write ON cash_counts_daily FOR INSERT TO authenticated WITH CHECK (true);

-- policy: clock_records_delete
CREATE POLICY "clock_records_delete" ON employee_clock_records
  FOR DELETE TO authenticated
  USING (true);

-- policy: clock_records_insert
CREATE POLICY "clock_records_insert" ON employee_clock_records
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- policy: clock_records_select
CREATE POLICY "clock_records_select" ON employee_clock_records
  FOR SELECT TO authenticated
  USING (true);

-- policy: clock_records_update
CREATE POLICY "clock_records_update" ON employee_clock_records
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- policy: compliance_tokens_delete
CREATE POLICY "compliance_tokens_delete" ON compliance_tokens
  FOR DELETE TO authenticated
  USING (true);

-- policy: compliance_tokens_insert
CREATE POLICY "compliance_tokens_insert" ON compliance_tokens
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- policy: compliance_tokens_select
CREATE POLICY "compliance_tokens_select" ON compliance_tokens
  FOR SELECT TO authenticated
  USING (true);

-- policy: compliance_tokens_update
CREATE POLICY "compliance_tokens_update" ON compliance_tokens
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- policy: conversations_delete
CREATE POLICY "conversations_delete" ON ai_conversations FOR DELETE TO authenticated USING (true);

-- policy: conversations_insert
CREATE POLICY "conversations_insert" ON ai_conversations FOR INSERT TO authenticated WITH CHECK (true);

-- policy: conversations_select
CREATE POLICY "conversations_select" ON ai_conversations FOR SELECT TO authenticated USING (true);

-- policy: conversations_update
CREATE POLICY "conversations_update" ON ai_conversations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- policy: events_delete
CREATE POLICY "events_delete" ON event_calendar FOR DELETE TO authenticated USING (true);

-- policy: events_insert
CREATE POLICY "events_insert" ON event_calendar FOR INSERT TO authenticated WITH CHECK (true);

-- policy: events_select
CREATE POLICY "events_select" ON event_calendar FOR SELECT TO authenticated USING (true);

-- policy: events_update
CREATE POLICY "events_update" ON event_calendar FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- policy: integrations_write
CREATE POLICY integrations_write ON integrations
  FOR ALL
  USING (is_org_member(org_id, auth.uid()))
  WITH CHECK (is_org_member(org_id, auth.uid()));

-- policy: inventory_item_location_read
CREATE POLICY inventory_item_location_read ON inventory_item_location FOR SELECT TO authenticated USING (true);

-- policy: inventory_item_location_write
CREATE POLICY inventory_item_location_write ON inventory_item_location FOR INSERT TO authenticated WITH CHECK (true);

-- policy: inventory_items_read
CREATE POLICY inventory_items_read ON inventory_items FOR SELECT TO authenticated USING (true);

-- policy: inventory_items_write
CREATE POLICY inventory_items_write ON inventory_items FOR INSERT TO authenticated WITH CHECK (true);

-- policy: logbook_delete
CREATE POLICY "logbook_delete" ON manager_logbook
  FOR DELETE TO authenticated USING (true);

-- policy: logbook_insert
CREATE POLICY "logbook_insert" ON manager_logbook
  FOR INSERT TO authenticated WITH CHECK (true);

-- policy: logbook_select
CREATE POLICY "logbook_select" ON manager_logbook
  FOR SELECT TO authenticated USING (true);

-- policy: logbook_update
CREATE POLICY "logbook_update" ON manager_logbook
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- policy: messages_insert
CREATE POLICY "messages_insert" ON ai_messages FOR INSERT TO authenticated WITH CHECK (true);

-- policy: messages_select
CREATE POLICY "messages_select" ON ai_messages FOR SELECT TO authenticated USING (true);

-- policy: order_guide_items_delete
CREATE POLICY "order_guide_items_delete" ON ai_order_guide_items
  FOR DELETE TO authenticated USING (true);

-- policy: order_guide_items_insert
CREATE POLICY "order_guide_items_insert" ON ai_order_guide_items
  FOR INSERT TO authenticated WITH CHECK (true);

-- policy: order_guide_items_select
CREATE POLICY "order_guide_items_select" ON ai_order_guide_items
  FOR SELECT TO authenticated USING (true);

-- policy: order_guide_items_update
CREATE POLICY "order_guide_items_update" ON ai_order_guide_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- policy: order_guides_delete
CREATE POLICY "order_guides_delete" ON ai_order_guides
  FOR DELETE TO authenticated USING (true);

-- policy: order_guides_insert
CREATE POLICY "order_guides_insert" ON ai_order_guides
  FOR INSERT TO authenticated WITH CHECK (true);

-- policy: order_guides_select
CREATE POLICY "order_guides_select" ON ai_order_guides
  FOR SELECT TO authenticated USING (true);

-- policy: order_guides_update
CREATE POLICY "order_guides_update" ON ai_order_guides
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- policy: org_settings_upsert_member
CREATE POLICY org_settings_upsert_member ON org_settings
  FOR ALL
  USING (is_org_member(org_id, auth.uid()))
  WITH CHECK (is_org_member(org_id, auth.uid()));

-- policy: reviews_delete
CREATE POLICY "reviews_delete" ON employee_reviews
  FOR DELETE TO authenticated USING (true);

-- policy: reviews_insert
CREATE POLICY "reviews_insert" ON employee_reviews
  FOR INSERT TO authenticated WITH CHECK (true);

-- policy: reviews_select
CREATE POLICY "reviews_select" ON employee_reviews
  FOR SELECT TO authenticated USING (true);

-- policy: reviews_update
CREATE POLICY "reviews_update" ON employee_reviews
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- policy: stock_movements_read
CREATE POLICY stock_movements_read ON stock_movements FOR SELECT TO authenticated USING (true);

-- policy: stock_movements_write
CREATE POLICY stock_movements_write ON stock_movements FOR INSERT TO authenticated WITH CHECK (true);

-- policy: training_delete
CREATE POLICY "training_delete" ON training_records FOR DELETE TO authenticated USING (true);

-- policy: training_insert
CREATE POLICY "training_insert" ON training_records FOR INSERT TO authenticated WITH CHECK (true);

-- policy: training_select
CREATE POLICY "training_select" ON training_records FOR SELECT TO authenticated USING (true);

-- policy: training_update
CREATE POLICY "training_update" ON training_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- policy: waste_events_delete
CREATE POLICY waste_events_delete ON waste_events FOR DELETE TO authenticated USING (true);

-- policy: waste_events_read
CREATE POLICY waste_events_read ON waste_events FOR SELECT TO authenticated USING (true);

-- policy: waste_events_write
CREATE POLICY waste_events_write ON waste_events FOR INSERT TO authenticated WITH CHECK (true);

-- policy: weather_insert
CREATE POLICY "weather_insert" ON weather_cache
  FOR INSERT TO authenticated WITH CHECK (true);

-- policy: weather_select
CREATE POLICY "weather_select" ON weather_cache
  FOR SELECT TO authenticated USING (true);

-- policy: weather_update
CREATE POLICY "weather_update" ON weather_cache
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTS (83)
-- ═══════════════════════════════════════════════════════════════════════════

GRANT SELECT ON groups TO anon, authenticated;
GRANT SELECT ON sales_daily_unified TO anon, authenticated;
GRANT SELECT ON sales_hourly_unified TO anon, authenticated;
GRANT SELECT ON product_sales_daily_unified TO anon, authenticated;
GRANT SELECT ON labour_daily_unified TO anon, authenticated;
GRANT SELECT ON forecast_daily_unified TO anon, authenticated;
GRANT SELECT ON budget_daily_unified TO anon, authenticated;
GRANT SELECT ON cogs_daily TO anon, authenticated;
GRANT SELECT ON inventory_position_unified TO anon, authenticated;
GRANT SELECT ON low_stock_unified TO anon, authenticated;
GRANT SELECT ON mart_kpi_daily TO anon, authenticated;
GRANT SELECT ON mart_sales_category_daily TO anon, authenticated;
GRANT USAGE ON SCHEMA ops TO service_role, authenticated;
GRANT SELECT ON ops.mv_refresh_log TO authenticated;
GRANT ALL ON ops.mv_refresh_log TO service_role;
GRANT SELECT ON product_sales_daily_unified_mv TO anon, authenticated;
GRANT SELECT ON sales_hourly_unified_mv TO anon, authenticated;
GRANT SELECT ON mart_kpi_daily_mv TO anon, authenticated;
GRANT SELECT ON mart_sales_category_daily_mv TO anon, authenticated;
GRANT EXECUTE ON FUNCTION ops.refresh_all_mvs(text) TO service_role;
GRANT EXECUTE ON FUNCTION ops.refresh_all_mvs(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_mvs(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_mvs(text) TO authenticated;
GRANT SELECT ON mart_stock_count_headers TO anon, authenticated;
GRANT SELECT ON mart_stock_count_lines_enriched TO anon, authenticated;
GRANT SELECT ON recipe_summary TO anon, authenticated;
GRANT SELECT ON reviews TO anon, authenticated;
GRANT ALL ON reviews TO service_role;
GRANT SELECT ON announcements TO anon, authenticated;
GRANT ALL ON announcements TO service_role;
GRANT SELECT ON payslip_lines TO anon, authenticated;
GRANT ALL ON payslip_lines TO service_role;
GRANT EXECUTE ON FUNCTION get_labour_kpis(date, date, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_labour_timeseries(date, date, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_labour_locations_table(date, date, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_data_source(uuid) TO anon, authenticated;
GRANT SELECT ON sales_hourly_unified_mv_v2 TO anon, authenticated;
GRANT SELECT ON product_sales_daily_unified_mv_v2 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION ops.refresh_all_mvs(text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_mvs(text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION get_sales_timeseries_unified(uuid, uuid[], date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_products_unified(uuid, uuid[], date, date, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION process_refresh_mvs_jobs() TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON monthly_cost_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON labour_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON labour_rules TO authenticated;
GRANT EXECUTE ON FUNCTION get_labour_rule(uuid, uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION check_labour_compliance(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_staffing_recommendation(uuid, uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_revenue_scores(uuid, uuid, date, date) TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tip_distribution_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tip_role_weights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tip_entries TO authenticated;
GRANT SELECT, INSERT ON tip_distributions TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_tip_distribution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_payroll_forecast(uuid, uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_staffing_heatmap(uuid, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_labour_cost_by_date(uuid[], date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kpi_range_summary(uuid, uuid[], date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kpi_range_summary(uuid, text[], date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_instant_pnl_unified(uuid, text[], date, date) TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON announcements TO authenticated;
GRANT ALL ON employee_clock_records TO authenticated;
GRANT ALL ON compliance_tokens TO authenticated;
GRANT ALL ON employee_breaks TO authenticated;
GRANT ALL ON manager_logbook TO authenticated;
GRANT ALL ON ai_order_guides TO authenticated;
GRANT ALL ON ai_order_guide_items TO authenticated;
GRANT ALL ON weather_cache TO authenticated;
GRANT ALL ON employee_reviews TO authenticated;
GRANT ALL ON event_calendar TO authenticated;
GRANT ALL ON training_records TO authenticated;
GRANT ALL ON ai_conversations TO authenticated;
GRANT ALL ON ai_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON waste_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_item_location TO authenticated;
GRANT SELECT, INSERT, UPDATE ON budget_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON budget_days TO authenticated;
GRANT SELECT, INSERT, UPDATE ON budget_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON budget_drivers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON cash_counts_daily TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA & CONFIGURATION (20)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO budget_versions (org_id, name, start_date, end_date, status, scope)
SELECT
  g.id,
  'Budget Febrero 2026',
  '2026-02-01',
  '2026-02-28',
  'published',
  'org'
FROM groups g
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO location_settings (location_id, target_col_percent, splh_goal)
SELECT l.id, 30, 50
FROM locations l
LEFT JOIN location_settings ls ON ls.location_id = l.id
WHERE l.active = true AND ls.location_id IS NULL;

INSERT INTO budgets_daily (date, location_id, budget_sales, budget_labour, budget_cogs)
SELECT
  bd.day,
  bd.location_id,
  bdr.target_covers * bdr.target_avg_check,           -- budget_sales
  bdr.target_labour_hours * bdr.target_hourly_rate,    -- budget_labour (= hours × rate)
  (bdr.target_covers * bdr.target_avg_check) * bdr.target_cogs_pct / 100  -- budget_cogs
FROM budget_days bd
JOIN budget_drivers bdr ON bdr.budget_day_id = bd.id
WHERE bd.location_id IS NOT NULL;

INSERT INTO event_calendar (org_id, event_date, name, event_type, impact_multiplier, recurrence, city, source)
SELECT
  '00000000-0000-0000-0000-000000000000',
  d.event_date,
  d.name,
  d.event_type,
  d.impact,
  d.rec,
  d.city,
  'system'
FROM (VALUES
  ('2025-01-01'::date, 'Año Nuevo', 'holiday', 0.60, 'yearly', NULL),
  ('2025-01-06'::date, 'Reyes Magos', 'holiday', 0.70, 'yearly', NULL),
  ('2025-03-19'::date, 'San José (Fallas)', 'festival', 1.30, 'yearly', 'Valencia'),
  ('2025-04-18'::date, 'Viernes Santo', 'holiday', 0.75, 'yearly', NULL),
  ('2025-05-01'::date, 'Día del Trabajo', 'holiday', 0.80, 'yearly', NULL),
  ('2025-05-15'::date, 'San Isidro', 'festival', 1.25, 'yearly', 'Madrid'),
  ('2025-06-24'::date, 'San Juan', 'festival', 1.15, 'yearly', 'Barcelona'),
  ('2025-08-15'::date, 'Asunción', 'holiday', 0.85, 'yearly', NULL),
  ('2025-10-12'::date, 'Fiesta Nacional', 'holiday', 0.80, 'yearly', NULL),
  ('2025-11-01'::date, 'Todos los Santos', 'holiday', 0.75, 'yearly', NULL),
  ('2025-12-06'::date, 'Constitución', 'holiday', 0.80, 'yearly', NULL),
  ('2025-12-08'::date, 'Inmaculada', 'holiday', 0.80, 'yearly', NULL),
  ('2025-12-24'::date, 'Nochebuena', 'holiday', 1.40, 'yearly', NULL),
  ('2025-12-25'::date, 'Navidad', 'holiday', 0.50, 'yearly', NULL),
  ('2025-12-31'::date, 'Nochevieja', 'holiday', 1.50, 'yearly', NULL),
  ('2025-04-26'::date, 'Champions League QF', 'sports', 1.30, 'none', 'Madrid'),
  ('2025-06-01'::date, 'Champions League Final', 'sports', 1.40, 'none', 'Madrid'),
  ('2025-10-11'::date, 'Liga Clásico', 'sports', 1.25, 'none', 'Madrid'),
  ('2026-05-15'::date, 'San Isidro 2026', 'festival', 1.25, 'none', 'Madrid'),
  ('2026-06-24'::date, 'San Juan 2026', 'festival', 1.15, 'none', 'Barcelona')
) AS d(event_date, name, event_type, impact, rec, city)
ON CONFLICT DO NOTHING;

INSERT INTO budget_versions (id, org_id, location_id, name, period_start, period_end, status, created_at)
SELECT
  md5(l.id::text || '-demo-budget-v1')::uuid,
  l.org_id,
  l.id,
  'Budget ' || to_char(date_trunc('month', CURRENT_DATE), 'Mon YYYY'),
  (CURRENT_DATE - 30)::date,
  (CURRENT_DATE + 7)::date,
  'published',
  now()
FROM locations l
WHERE l.active = true
ON CONFLICT DO NOTHING;

INSERT INTO budget_days (id, budget_version_id, org_id, location_id, day)
SELECT
  md5(l.id::text || '-bday-' || d.day::text)::uuid,
  md5(l.id::text || '-demo-budget-v1')::uuid,
  l.org_id,
  l.id,
  d.day::date
FROM locations l
CROSS JOIN generate_series(CURRENT_DATE - 30, CURRENT_DATE + 7, '1 day'::interval) AS d(day)
WHERE l.active = true
ON CONFLICT DO NOTHING;

INSERT INTO budget_metrics (id, budget_day_id, metric, value, layer)
SELECT
  md5(bd.id::text || '-sales_net')::uuid,
  bd.id,
  'sales_net',
  CASE 
    WHEN EXTRACT(DOW FROM bd.day) IN (5, 6) THEN 3400 + (EXTRACT(DOY FROM bd.day)::int * 7 % 400)
    WHEN EXTRACT(DOW FROM bd.day) = 0 THEN 2800 + (EXTRACT(DOY FROM bd.day)::int * 7 % 300)
    ELSE 2200 + (EXTRACT(DOW FROM bd.day)::int * 100) + (EXTRACT(DOY FROM bd.day)::int * 3 % 200)
  END,
  'final'
FROM budget_days bd
WHERE bd.budget_version_id IN (SELECT id FROM budget_versions WHERE status = 'published')
ON CONFLICT DO NOTHING;

INSERT INTO budget_metrics (id, budget_day_id, metric, value, layer)
SELECT
  md5(bd.id::text || '-labour_cost')::uuid,
  bd.id,
  'labour_cost',
  CASE 
    WHEN EXTRACT(DOW FROM bd.day) IN (5, 6) THEN 952 + (EXTRACT(DOY FROM bd.day)::int * 5 % 112)
    WHEN EXTRACT(DOW FROM bd.day) = 0 THEN 784 + (EXTRACT(DOY FROM bd.day)::int * 5 % 84)
    ELSE 616 + (EXTRACT(DOW FROM bd.day)::int * 28) + (EXTRACT(DOY FROM bd.day)::int * 2 % 56)
  END,
  'final'
FROM budget_days bd
WHERE bd.budget_version_id IN (SELECT id FROM budget_versions WHERE status = 'published')
ON CONFLICT DO NOTHING;

INSERT INTO budget_metrics (id, budget_day_id, metric, value, layer)
SELECT
  md5(bd.id::text || '-cogs')::uuid,
  bd.id,
  'cogs',
  CASE 
    WHEN EXTRACT(DOW FROM bd.day) IN (5, 6) THEN 1020 + (EXTRACT(DOY FROM bd.day)::int * 5 % 120)
    WHEN EXTRACT(DOW FROM bd.day) = 0 THEN 840 + (EXTRACT(DOY FROM bd.day)::int * 5 % 90)
    ELSE 660 + (EXTRACT(DOW FROM bd.day)::int * 30) + (EXTRACT(DOY FROM bd.day)::int * 2 % 60)
  END,
  'final'
FROM budget_days bd
WHERE bd.budget_version_id IN (SELECT id FROM budget_versions WHERE status = 'published')
ON CONFLICT DO NOTHING;

INSERT INTO budget_drivers (id, budget_day_id, target_covers, target_avg_check, target_cogs_pct, target_labour_hours, target_hourly_rate)
SELECT
  md5(bd.id::text || '-drivers')::uuid,
  bd.id,
  CASE WHEN EXTRACT(DOW FROM bd.day) IN (5, 6) THEN 140 WHEN EXTRACT(DOW FROM bd.day) = 0 THEN 110 ELSE 90 END,
  26.50,
  30.0,
  CASE WHEN EXTRACT(DOW FROM bd.day) IN (5, 6) THEN 65 WHEN EXTRACT(DOW FROM bd.day) = 0 THEN 54 ELSE 43 END,
  14.50
FROM budget_days bd
WHERE bd.budget_version_id IN (SELECT id FROM budget_versions WHERE status = 'published')
ON CONFLICT DO NOTHING;

INSERT INTO inventory_items (id, org_id, name, category_name, unit, par_level, last_cost)
SELECT
  md5('demo-inv-' || item.name)::uuid,
  l.org_id,
  item.name,
  item.cat,
  item.unit,
  item.par,
  item.cost
FROM (VALUES
  ('Jamón Ibérico', 'Proteínas', 'kg', 5.0, 42.00),
  ('Chuletón de Buey', 'Proteínas', 'kg', 8.0, 32.00),
  ('Bacalao', 'Proteínas', 'kg', 6.0, 18.00),
  ('Pulpo', 'Proteínas', 'kg', 4.0, 22.00),
  ('Cerveza Estrella Galicia', 'Bebidas', 'unidad', 120.0, 0.85),
  ('Ribera del Duero', 'Vinos', 'botella', 24.0, 8.50),
  ('Tomates', 'Frescos', 'kg', 10.0, 2.50),
  ('Aceite de Oliva Virgen', 'Despensa', 'litro', 15.0, 4.50),
  ('Patatas', 'Frescos', 'kg', 25.0, 1.20),
  ('Lechuga', 'Frescos', 'kg', 8.0, 2.00),
  ('Queso Manchego', 'Lácteos', 'kg', 4.0, 14.00),
  ('Nata', 'Lácteos', 'litro', 6.0, 3.20),
  ('Chocolate Valrhona', 'Pastelería', 'kg', 3.0, 24.00),
  ('Tarta de Queso (base)', 'Pastelería', 'unidad', 10.0, 4.50)
) AS item(name, cat, unit, par, cost)
CROSS JOIN (SELECT DISTINCT org_id FROM locations WHERE active = true LIMIT 1) l
ON CONFLICT DO NOTHING;

INSERT INTO waste_events (id, org_id, location_id, inventory_item_id, quantity, waste_value, reason, created_at)
SELECT
  md5(l.id::text || '-waste-' || d::text || '-' || seq::text)::uuid,
  l.org_id,
  l.id,
  md5('demo-inv-' || (ARRAY['Lechuga', 'Tomates', 'Nata', 'Tarta de Queso (base)', 'Bacalao', 'Patatas', 'Cerveza Estrella Galicia'])[1 + (seq + EXTRACT(DOY FROM d)::int) % 7])::uuid,
  (1 + (seq * 7 + EXTRACT(DOY FROM d)::int) % 5)::numeric * 0.5,
  (3 + (seq * 13 + EXTRACT(DOY FROM d)::int * 3) % 22)::numeric,
  CASE 
    WHEN seq <= 3 THEN 'end_of_day'
    WHEN seq = 4 THEN 'expired'
    WHEN seq = 5 THEN 'broken'
    WHEN seq = 6 THEN 'expired'
    ELSE 'other'
  END,
  d + (10 + seq)::int * interval '1 hour'
FROM locations l
CROSS JOIN generate_series(CURRENT_DATE - 30, CURRENT_DATE, '1 day'::interval) AS d
CROSS JOIN generate_series(1, 7) AS seq
WHERE l.active = true
ON CONFLICT DO NOTHING;

INSERT INTO stock_movements (id, org_id, location_id, item_id, movement_type, qty_delta, unit_cost, created_at)
SELECT
  md5(l.id::text || '-sm-sale-' || d::text || '-' || item.name)::uuid,
  l.org_id,
  l.id,
  md5('demo-inv-' || item.name)::uuid,
  'sale_estimate',
  -(item.daily_usage + (EXTRACT(DOY FROM d)::int * 3 % item.var)::numeric),
  item.cost,
  d + interval '22 hours'
FROM locations l
CROSS JOIN generate_series(CURRENT_DATE - 30, CURRENT_DATE, '1 day'::interval) AS d
CROSS JOIN (VALUES
  ('Jamón Ibérico', 42.00, 1.5, 1),
  ('Chuletón de Buey', 32.00, 3.0, 2),
  ('Bacalao', 18.00, 2.0, 1),
  ('Tomates', 2.50, 5.0, 3),
  ('Patatas', 1.20, 8.0, 4),
  ('Cerveza Estrella Galicia', 0.85, 40.0, 15),
  ('Aceite de Oliva Virgen', 4.50, 1.5, 1),
  ('Queso Manchego', 14.00, 0.8, 1),
  ('Chocolate Valrhona', 24.00, 0.3, 1)
) AS item(name, cost, daily_usage, var)
WHERE l.active = true
ON CONFLICT DO NOTHING;

INSERT INTO inventory_item_location (id, item_id, location_id, on_hand, reorder_point, safety_stock)
SELECT
  md5(ii.id::text || '-' || l.id::text)::uuid,
  ii.id,
  l.id,
  ROUND(ii.par_level * (0.6 + (EXTRACT(DOY FROM CURRENT_DATE)::int * 7 % 60)::numeric / 100.0), 1),
  ROUND(ii.par_level * 0.4, 1),
  ROUND(ii.par_level * 0.2, 1)
FROM inventory_items ii
CROSS JOIN locations l
WHERE l.active = true
  AND ii.org_id = l.org_id
ON CONFLICT DO NOTHING;

INSERT INTO cash_counts_daily (id, org_id, location_id, date, cash_expected, cash_counted, variance)
SELECT
  md5(l.id::text || '-cashcount-' || d::text)::uuid,
  l.org_id,
  l.id,
  d::date,
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 850
    WHEN EXTRACT(DOW FROM d) = 0 THEN 700
    ELSE 550
  END,
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 850 + (EXTRACT(DOY FROM d)::int % 20 - 10)
    WHEN EXTRACT(DOW FROM d) = 0 THEN 700 + (EXTRACT(DOY FROM d)::int % 16 - 8)
    ELSE 550 + (EXTRACT(DOY FROM d)::int % 12 - 6)
  END,
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (EXTRACT(DOY FROM d)::int % 20 - 10)
    WHEN EXTRACT(DOW FROM d) = 0 THEN (EXTRACT(DOY FROM d)::int % 16 - 8)
    ELSE (EXTRACT(DOY FROM d)::int % 12 - 6)
  END
FROM locations l
CROSS JOIN generate_series(CURRENT_DATE - 30, CURRENT_DATE, '1 day'::interval) AS d
WHERE l.active = true
ON CONFLICT (location_id, date) DO NOTHING;

INSERT INTO daily_sales (org_id, location_id, day, net_sales, gross_sales, orders_count, payments_total, payments_cash, payments_card, refunds, discounts, comps, voids)
SELECT
  l.org_id,
  l.id,
  d::date,
  -- Net sales: €2,200-3,800 depending on day of week
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)
    WHEN EXTRACT(DOW FROM d) = 0 THEN 2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)
    ELSE 2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)
  END::numeric,
  -- Gross sales: net + 5%
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN ROUND((3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 1.05, 2)
    WHEN EXTRACT(DOW FROM d) = 0 THEN ROUND((2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 1.05, 2)
    ELSE ROUND((2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 1.05, 2)
  END::numeric,
  -- Orders: covers / 2.5 avg party size
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 56 + (EXTRACT(DOY FROM d)::int % 10)
    WHEN EXTRACT(DOW FROM d) = 0 THEN 44 + (EXTRACT(DOY FROM d)::int % 8)
    ELSE 36 + (EXTRACT(DOW FROM d)::int * 2)
  END::integer,
  -- Payments total = net_sales
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)
    WHEN EXTRACT(DOW FROM d) = 0 THEN 2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)
    ELSE 2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)
  END::numeric,
  -- payments_cash: 25% of total
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.25
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.25
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.25
  END, 2)::numeric,
  -- payments_card: 75% of total
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.75
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.75
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.75
  END, 2)::numeric,
  -- Refunds: 0.5% of net
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.005
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.005
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.005
  END, 2)::numeric,
  -- Discounts: 3%
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.03
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.03
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.03
  END, 2)::numeric,
  -- Comps: 1%
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.01
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.01
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.01
  END, 2)::numeric,
  -- Voids: 0.2%
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.002
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.002
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.002
  END, 2)::numeric
FROM locations l
CROSS JOIN generate_series(CURRENT_DATE - 30, CURRENT_DATE + 7, '1 day'::interval) AS d
WHERE l.active = true
ON CONFLICT DO NOTHING;

INSERT INTO budget_days (id, budget_version_id, org_id, location_id, day)
SELECT
  md5(bv.id::text || '-' || l.id::text || '-' || d::text)::uuid,
  bv.id,
  bv.org_id,
  l.id,
  d::date
FROM budget_versions bv
CROSS JOIN locations l
CROSS JOIN generate_series(CURRENT_DATE - 30, CURRENT_DATE + 7, interval '1 day') AS d
WHERE bv.status IN ('published', 'frozen')
  AND l.active = true
  AND l.org_id = bv.org_id
ON CONFLICT DO NOTHING;

INSERT INTO budget_metrics (budget_day_id, metric, value, layer)
SELECT
  bd.id,
  'sales_net',
  CASE 
    WHEN EXTRACT(DOW FROM bd.day) IN (5, 6) THEN 3400 + (EXTRACT(DOY FROM bd.day)::int * 7 % 400)
    WHEN EXTRACT(DOW FROM bd.day) = 0 THEN 2800 + (EXTRACT(DOY FROM bd.day)::int * 7 % 300)
    ELSE 2200 + (EXTRACT(DOW FROM bd.day)::int * 100) + (EXTRACT(DOY FROM bd.day)::int * 3 % 200)
  END,
  'final'
FROM budget_days bd
LEFT JOIN budget_metrics ex ON ex.budget_day_id = bd.id AND ex.metric = 'sales_net' AND ex.layer = 'final'
WHERE ex.budget_day_id IS NULL AND bd.day >= CURRENT_DATE - 30
ON CONFLICT DO NOTHING;

INSERT INTO budget_metrics (budget_day_id, metric, value, layer)
SELECT
  bd.id,
  'labour_cost',
  CASE 
    WHEN EXTRACT(DOW FROM bd.day) IN (5, 6) THEN 952 + (EXTRACT(DOY FROM bd.day)::int * 5 % 112)
    WHEN EXTRACT(DOW FROM bd.day) = 0 THEN 784 + (EXTRACT(DOY FROM bd.day)::int * 5 % 84)
    ELSE 616 + (EXTRACT(DOW FROM bd.day)::int * 28) + (EXTRACT(DOY FROM bd.day)::int * 2 % 56)
  END,
  'final'
FROM budget_days bd
LEFT JOIN budget_metrics ex ON ex.budget_day_id = bd.id AND ex.metric = 'labour_cost' AND ex.layer = 'final'
WHERE ex.budget_day_id IS NULL AND bd.day >= CURRENT_DATE - 30
ON CONFLICT DO NOTHING;

INSERT INTO budget_metrics (budget_day_id, metric, value, layer)
SELECT
  bd.id,
  'cogs',
  CASE 
    WHEN EXTRACT(DOW FROM bd.day) IN (5, 6) THEN 1020 + (EXTRACT(DOY FROM bd.day)::int * 5 % 120)
    WHEN EXTRACT(DOW FROM bd.day) = 0 THEN 840 + (EXTRACT(DOY FROM bd.day)::int * 5 % 90)
    ELSE 660 + (EXTRACT(DOW FROM bd.day)::int * 30) + (EXTRACT(DOY FROM bd.day)::int * 2 % 60)
  END,
  'final'
FROM budget_days bd
LEFT JOIN budget_metrics ex ON ex.budget_day_id = bd.id AND ex.metric = 'cogs' AND ex.layer = 'final'
WHERE ex.budget_day_id IS NULL AND bd.day >= CURRENT_DATE - 30
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- CRON JOBS (4)
-- ═══════════════════════════════════════════════════════════════════════════

SELECT cron.schedule(
  'generate-daily-data',
  '5 0 * * *',           -- 00:05 UTC every day
  'SELECT generate_daily_data()'
);

SELECT cron.schedule(
  'refresh-marts-every-15m',
  '*/15 * * * *',
  $$SELECT refresh_all_mvs('cron')$$
);

SELECT cron.schedule(
  'process-refresh-jobs-every-5m',
  '*/5 * * * *',
  $$SELECT process_refresh_mvs_jobs()$$
);

SELECT cron.schedule(
  'generate-pos-daily-data',
  '10 0 * * *',
  'SELECT generate_pos_daily_data()'
);


-- ═══════════════════════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';