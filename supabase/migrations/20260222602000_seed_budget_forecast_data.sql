-- ============================================================
-- Emergency Seeding: Budget + Forecast data for all locations
-- Populates budget_versions, budget_days, budget_drivers,
-- and forecast_daily_metrics so the UI shows real numbers.
-- ============================================================

-- 1. Create a budget version for the current month
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

-- 2. Create budget_days + budget_drivers for each location for the current week
-- Using a DO block to dynamically iterate all active locations
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

-- 3. Update location_settings with target COL% = 30% for all locations
UPDATE location_settings
SET target_col_percent = 30,
    splh_goal = 50
WHERE location_id IN (SELECT id FROM locations WHERE active = true);

-- Also insert for locations that don't have settings yet
INSERT INTO location_settings (location_id, target_col_percent, splh_goal)
SELECT l.id, 30, 50
FROM locations l
LEFT JOIN location_settings ls ON ls.location_id = l.id
WHERE l.active = true AND ls.location_id IS NULL;

-- 4. Populate budgets_daily (legacy table used by some views)
DELETE FROM budgets_daily
WHERE location_id IN (SELECT id FROM locations WHERE active = true)
  AND date BETWEEN '2026-02-01' AND '2026-02-28';

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
