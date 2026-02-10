-- ====================================================================
-- FIX: Repopulate ALL daily tables with realistic casual dining Madrid data
--
-- Problem: seed_demo_labour_data() used inflated base sales (€22K-€30K/day)
-- causing Feb 1-8 to show ~€40K-€70K/day (all 3 locations combined).
-- After that, only the daily cron generated data at ~60% of forecast,
-- creating a visible cliff in the charts.
--
-- Solution: Regenerate ALL daily data for the entire available range
-- using realistic values for a casual dining restaurant group in Madrid.
--
-- Expected output per location:
--   Weekday:  €3,500 - €5,500/day
--   Friday:   €6,000 - €8,000/day
--   Saturday: €6,500 - €8,500/day
--   Sunday:   €5,000 - €6,500/day
--   Monthly:  €130,000 - €170,000 per location
--   3 locations combined: ~€400,000 - €500,000/month
--
-- Affects ALL 9 Insights pages:
--   Sales, Labour, Instant P&L, Budgets, Cash Management,
--   Inventory, Waste, Menu Engineering (indirect), Reviews (no DB)
-- ====================================================================

-- Step 1: Recreate seed_demo_labour_data with realistic base values
CREATE OR REPLACE FUNCTION public.seed_demo_labour_data(
  p_days int DEFAULT 30,
  p_locations int DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_location RECORD;
  v_day date;
  v_base_sales numeric;
  v_sales_multiplier numeric;
  v_seasonal_mult numeric;
  v_net_sales numeric;
  v_gross_sales numeric;
  v_orders numeric;
  v_avg_check numeric;
  v_labor_hours numeric;
  v_labor_cost numeric;
  v_blended_rate numeric;
  v_col_pct numeric;
  v_forecast_sales numeric;
  v_forecast_orders numeric;
  v_planned_hours numeric;
  v_planned_cost numeric;
  v_dow int;
  v_month int;
  v_locations_count int := 0;
  v_days_count int := 0;
BEGIN
  v_group_id := get_user_group_id();
  IF v_group_id IS NULL THEN
    RETURN jsonb_build_object('seeded', false, 'error', 'No group found');
  END IF;

  -- Clear existing data for this group's locations
  DELETE FROM pos_daily_metrics
  WHERE location_id IN (SELECT id FROM locations WHERE group_id = v_group_id);
  DELETE FROM forecast_daily_metrics
  WHERE location_id IN (SELECT id FROM locations WHERE group_id = v_group_id);
  DELETE FROM pos_daily_finance
  WHERE location_id IN (SELECT id FROM locations WHERE group_id = v_group_id);
  DELETE FROM labour_daily
  WHERE location_id IN (SELECT id FROM locations WHERE group_id = v_group_id);
  DELETE FROM cogs_daily
  WHERE location_id IN (SELECT id FROM locations WHERE group_id = v_group_id);
  DELETE FROM budgets_daily
  WHERE location_id IN (SELECT id FROM locations WHERE group_id = v_group_id);
  DELETE FROM cash_counts_daily
  WHERE location_id IN (SELECT id FROM locations WHERE group_id = v_group_id);

  FOR v_location IN
    SELECT id, name FROM locations WHERE group_id = v_group_id
  LOOP
    v_locations_count := v_locations_count + 1;

    -- Realistic casual dining Madrid base sales (per day, per location)
    -- These represent the average weekday base before DOW/seasonal adjustments
    v_base_sales := CASE
      WHEN v_location.name ILIKE '%Centro%' OR v_location.name ILIKE '%Taberna%' THEN 5500  -- Premium location
      WHEN v_location.name ILIKE '%Chamberí%' THEN 5000   -- Mid-range
      WHEN v_location.name ILIKE '%Malasaña%' THEN 4500   -- Casual
      ELSE 5000  -- Default mid-range
    END;

    -- Avg check varies by location tier
    v_avg_check := CASE
      WHEN v_location.name ILIKE '%Centro%' OR v_location.name ILIKE '%Taberna%' THEN 26  -- Premium
      WHEN v_location.name ILIKE '%Chamberí%' THEN 24   -- Mid-range
      WHEN v_location.name ILIKE '%Malasaña%' THEN 22   -- Casual
      ELSE 24
    END;

    v_blended_rate := 14.5; -- €14.50 average hourly wage across all roles

    FOR v_day IN SELECT generate_series(
      CURRENT_DATE - (p_days || ' days')::interval,
      CURRENT_DATE - interval '1 day',
      '1 day'
    )::date
    LOOP
      v_dow := EXTRACT(DOW FROM v_day);
      v_month := EXTRACT(MONTH FROM v_day);

      -- Day-of-week multiplier (realistic restaurant pattern)
      v_sales_multiplier := CASE v_dow
        WHEN 5 THEN 1.35 + random() * 0.10  -- Friday: +35-45%
        WHEN 6 THEN 1.45 + random() * 0.15  -- Saturday: +45-60%
        WHEN 0 THEN 1.10 + random() * 0.10  -- Sunday: +10-20%
        WHEN 1 THEN 0.78 + random() * 0.08  -- Monday: -22% (slowest)
        WHEN 2 THEN 0.88 + random() * 0.08  -- Tuesday
        WHEN 3 THEN 0.92 + random() * 0.08  -- Wednesday
        ELSE 1.00 + random() * 0.08          -- Thursday
      END;

      -- Seasonal multiplier (Madrid pattern)
      v_seasonal_mult := CASE
        WHEN v_month IN (6, 7, 8) THEN 1.15 + random() * 0.10   -- Summer terrace boost
        WHEN v_month IN (3, 4, 5) THEN 1.05 + random() * 0.05   -- Spring
        WHEN v_month IN (12)      THEN 1.10 + random() * 0.10   -- Christmas
        WHEN v_month IN (1, 2)    THEN 0.88 + random() * 0.08   -- Winter low
        ELSE 1.00
      END;

      -- Calculate daily net sales with natural variance (±8%)
      v_net_sales := ROUND((v_base_sales * v_sales_multiplier * v_seasonal_mult * (0.92 + random() * 0.16))::numeric, 2);
      v_gross_sales := ROUND((v_net_sales * 1.05)::numeric, 2);

      -- Orders from avg check with small variance
      v_orders := GREATEST(1, ROUND(v_net_sales / (v_avg_check + (random() - 0.5) * 4)));

      -- Labour: COL% target 28%, actual varies 26-31%
      v_col_pct := 0.28 + (random() - 0.5) * 0.05;
      v_labor_cost := ROUND((v_net_sales * v_col_pct)::numeric, 2);
      v_labor_hours := ROUND((v_labor_cost / v_blended_rate)::numeric, 1);

      -- Forecast: ±5-7% variance from actuals (simulating Prophet output)
      v_forecast_sales := ROUND((v_net_sales * (0.93 + random() * 0.14))::numeric, 2);
      v_forecast_orders := GREATEST(1, ROUND(v_orders * (0.93 + random() * 0.14)));
      v_planned_hours := ROUND((v_forecast_sales * 0.28 / v_blended_rate)::numeric, 1);
      v_planned_cost := ROUND((v_planned_hours * v_blended_rate)::numeric, 2);

      -- ═══════════════════════════════════════════════════════════════
      -- INSERT INTO ALL 7 DAILY TABLES
      -- ═══════════════════════════════════════════════════════════════

      -- 1) pos_daily_metrics (Labour page via sales_daily_unified view)
      INSERT INTO pos_daily_metrics (date, location_id, net_sales, orders, labor_hours, labor_cost)
      VALUES (v_day, v_location.id, v_net_sales, v_orders, v_labor_hours, v_labor_cost)
      ON CONFLICT (date, location_id) DO UPDATE SET
        net_sales = EXCLUDED.net_sales, orders = EXCLUDED.orders,
        labor_hours = EXCLUDED.labor_hours, labor_cost = EXCLUDED.labor_cost;

      -- 2) forecast_daily_metrics (Sales, Labour, Instant P&L)
      INSERT INTO forecast_daily_metrics (date, location_id, forecast_sales, forecast_orders,
        planned_labor_hours, planned_labor_cost, model_version)
      VALUES (v_day, v_location.id, v_forecast_sales, v_forecast_orders,
        v_planned_hours, v_planned_cost, 'Prophet v5')
      ON CONFLICT (date, location_id) DO UPDATE SET
        forecast_sales = EXCLUDED.forecast_sales, forecast_orders = EXCLUDED.forecast_orders,
        planned_labor_hours = EXCLUDED.planned_labor_hours, planned_labor_cost = EXCLUDED.planned_labor_cost,
        model_version = EXCLUDED.model_version;

      -- 3) pos_daily_finance (Sales, Cash Management, Instant P&L, Waste, Inventory)
      INSERT INTO pos_daily_finance (date, location_id, net_sales, gross_sales, orders_count,
        payments_cash, payments_card, payments_other, refunds_amount, refunds_count,
        discounts_amount, comps_amount, voids_amount)
      VALUES (v_day, v_location.id, v_net_sales, v_gross_sales, v_orders,
        ROUND(v_net_sales * 0.25, 2),   -- 25% cash
        ROUND(v_net_sales * 0.70, 2),   -- 70% card
        ROUND(v_net_sales * 0.05, 2),   -- 5% other
        ROUND(v_net_sales * 0.005, 2),  -- 0.5% refunds
        GREATEST(1, FLOOR(v_orders * 0.02)),  -- ~2% of orders refunded
        ROUND(v_net_sales * 0.03, 2),   -- 3% discounts
        ROUND(v_net_sales * 0.01, 2),   -- 1% comps
        ROUND(v_net_sales * 0.008, 2))  -- 0.8% voids
      ON CONFLICT (date, location_id) DO UPDATE SET
        net_sales = EXCLUDED.net_sales, gross_sales = EXCLUDED.gross_sales,
        orders_count = EXCLUDED.orders_count, payments_cash = EXCLUDED.payments_cash,
        payments_card = EXCLUDED.payments_card, payments_other = EXCLUDED.payments_other,
        refunds_amount = EXCLUDED.refunds_amount, refunds_count = EXCLUDED.refunds_count,
        discounts_amount = EXCLUDED.discounts_amount, comps_amount = EXCLUDED.comps_amount,
        voids_amount = EXCLUDED.voids_amount;

      -- 4) labour_daily (Budgets page)
      INSERT INTO labour_daily (date, location_id, labour_cost, labour_hours)
      VALUES (v_day, v_location.id, v_labor_cost, v_labor_hours)
      ON CONFLICT (date, location_id) DO UPDATE SET
        labour_cost = EXCLUDED.labour_cost, labour_hours = EXCLUDED.labour_hours;

      -- 5) cogs_daily (Budgets, Inventory)
      INSERT INTO cogs_daily (date, location_id, cogs_amount)
      VALUES (v_day, v_location.id, ROUND(v_net_sales * 0.28, 2))
      ON CONFLICT (date, location_id) DO UPDATE SET
        cogs_amount = EXCLUDED.cogs_amount;

      -- 6) budgets_daily (Budgets)
      --    Budget targets are slightly above actuals (management optimism)
      INSERT INTO budgets_daily (date, location_id, budget_sales, budget_labour, budget_cogs)
      VALUES (v_day, v_location.id,
        ROUND((v_net_sales * (1.02 + 0.03 * SIN(EXTRACT(DOY FROM v_day))))::numeric, 2),
        ROUND((v_labor_cost * (0.96 + 0.02 * COS(EXTRACT(DOY FROM v_day))))::numeric, 2),
        ROUND((v_net_sales * 0.27)::numeric, 2))
      ON CONFLICT (date, location_id) DO UPDATE SET
        budget_sales = EXCLUDED.budget_sales, budget_labour = EXCLUDED.budget_labour,
        budget_cogs = EXCLUDED.budget_cogs;

      -- 7) cash_counts_daily (Cash Management)
      --    Physical count ≈ expected cash with tiny variance (±0.5%)
      INSERT INTO cash_counts_daily (date, location_id, cash_counted)
      VALUES (v_day, v_location.id,
        ROUND((v_net_sales * 0.25 * (0.995 + random() * 0.01))::numeric, 2))
      ON CONFLICT (date, location_id) DO UPDATE SET
        cash_counted = EXCLUDED.cash_counted;

      v_days_count := v_days_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'seeded', true,
    'locations', v_locations_count,
    'days', v_days_count / GREATEST(v_locations_count, 1),
    'base_sales', 'casual_dining_madrid_4500_5500_per_location'
  );
END;
$$;


-- ====================================================================
-- Step 2: Repopulate ALL daily tables for the full historical range
--         Uses the same realistic values from the updated function.
-- ====================================================================

DO $$
DECLARE
  v_location RECORD;
  v_day date;
  v_base_sales numeric;
  v_avg_check numeric;
  v_sales_multiplier numeric;
  v_seasonal_mult numeric;
  v_net_sales numeric;
  v_gross_sales numeric;
  v_orders numeric;
  v_labor_hours numeric;
  v_labor_cost numeric;
  v_col_pct numeric;
  v_forecast_sales numeric;
  v_forecast_orders numeric;
  v_planned_hours numeric;
  v_planned_cost numeric;
  v_dow int;
  v_month int;
  v_blended_rate numeric := 14.5;
  v_count int := 0;
  v_min_date date;
  v_max_date date;
BEGIN
  -- Find the date range from existing facts_sales_15m data
  SELECT MIN(DATE(ts_bucket)), MAX(DATE(ts_bucket))
  INTO v_min_date, v_max_date
  FROM facts_sales_15m;

  -- If no facts data, use a sensible default (last 395 days to cover 13 months)
  IF v_min_date IS NULL THEN
    v_min_date := CURRENT_DATE - interval '395 days';
    v_max_date := CURRENT_DATE;
  END IF;

  -- Extend to include forecast period (30 days ahead for forecast)
  v_max_date := GREATEST(v_max_date, CURRENT_DATE + interval '30 days');

  RAISE NOTICE 'Repopulating daily tables from % to %', v_min_date, v_max_date;

  -- Clear existing daily data for ALL locations with demo names
  DELETE FROM pos_daily_metrics WHERE location_id IN (
    SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña'));
  DELETE FROM forecast_daily_metrics WHERE location_id IN (
    SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña'));
  DELETE FROM pos_daily_finance WHERE location_id IN (
    SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña'));
  DELETE FROM labour_daily WHERE location_id IN (
    SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña'));
  DELETE FROM cogs_daily WHERE location_id IN (
    SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña'));
  DELETE FROM budgets_daily WHERE location_id IN (
    SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña'));
  DELETE FROM cash_counts_daily WHERE location_id IN (
    SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña'));

  RAISE NOTICE 'Existing daily data cleared. Generating new data...';

  FOR v_location IN
    SELECT id, name FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
  LOOP
    -- Realistic casual dining Madrid base sales per location
    v_base_sales := CASE
      WHEN v_location.name = 'La Taberna Centro' THEN 5500   -- Premium
      WHEN v_location.name = 'Chamberí' THEN 5000            -- Mid-range
      WHEN v_location.name = 'Malasaña' THEN 4500            -- Casual
      ELSE 5000
    END;

    v_avg_check := CASE
      WHEN v_location.name = 'La Taberna Centro' THEN 26
      WHEN v_location.name = 'Chamberí' THEN 24
      WHEN v_location.name = 'Malasaña' THEN 22
      ELSE 24
    END;

    RAISE NOTICE 'Generating data for % (base: €%/day, avg check: €%)', v_location.name, v_base_sales, v_avg_check;

    FOR v_day IN SELECT generate_series(v_min_date, v_max_date, '1 day')::date
    LOOP
      v_dow := EXTRACT(DOW FROM v_day);
      v_month := EXTRACT(MONTH FROM v_day);

      -- Day-of-week multiplier
      v_sales_multiplier := CASE v_dow
        WHEN 5 THEN 1.35 + random() * 0.10  -- Friday
        WHEN 6 THEN 1.45 + random() * 0.15  -- Saturday
        WHEN 0 THEN 1.10 + random() * 0.10  -- Sunday
        WHEN 1 THEN 0.78 + random() * 0.08  -- Monday
        WHEN 2 THEN 0.88 + random() * 0.08  -- Tuesday
        WHEN 3 THEN 0.92 + random() * 0.08  -- Wednesday
        ELSE 1.00 + random() * 0.08          -- Thursday
      END;

      -- Seasonal multiplier
      v_seasonal_mult := CASE
        WHEN v_month IN (6, 7, 8) THEN 1.15 + random() * 0.10   -- Summer
        WHEN v_month IN (3, 4, 5) THEN 1.05 + random() * 0.05   -- Spring
        WHEN v_month = 12         THEN 1.10 + random() * 0.10   -- Christmas
        WHEN v_month IN (1, 2)    THEN 0.88 + random() * 0.08   -- Winter
        ELSE 1.00
      END;

      -- YoY growth: +12% for 2026 vs 2025
      IF EXTRACT(YEAR FROM v_day) = 2026 THEN
        v_seasonal_mult := v_seasonal_mult * 1.12;
      END IF;

      v_net_sales := ROUND((v_base_sales * v_sales_multiplier * v_seasonal_mult * (0.92 + random() * 0.16))::numeric, 2);
      v_gross_sales := ROUND((v_net_sales * 1.05)::numeric, 2);
      v_orders := GREATEST(1, ROUND(v_net_sales / (v_avg_check + (random() - 0.5) * 4)));

      -- Labour
      v_col_pct := 0.28 + (random() - 0.5) * 0.05;
      v_labor_cost := ROUND((v_net_sales * v_col_pct)::numeric, 2);
      v_labor_hours := ROUND((v_labor_cost / v_blended_rate)::numeric, 1);

      -- Forecast
      v_forecast_sales := ROUND((v_net_sales * (0.93 + random() * 0.14))::numeric, 2);
      v_forecast_orders := GREATEST(1, ROUND(v_orders * (0.93 + random() * 0.14)));
      v_planned_hours := ROUND((v_forecast_sales * 0.28 / v_blended_rate)::numeric, 1);
      v_planned_cost := ROUND((v_planned_hours * v_blended_rate)::numeric, 2);

      -- For future dates (> today): only insert forecast, no actuals
      IF v_day <= CURRENT_DATE THEN
        -- pos_daily_metrics
        INSERT INTO pos_daily_metrics (date, location_id, net_sales, orders, labor_hours, labor_cost)
        VALUES (v_day, v_location.id, v_net_sales, v_orders, v_labor_hours, v_labor_cost)
        ON CONFLICT (date, location_id) DO UPDATE SET
          net_sales = EXCLUDED.net_sales, orders = EXCLUDED.orders,
          labor_hours = EXCLUDED.labor_hours, labor_cost = EXCLUDED.labor_cost;

        -- pos_daily_finance
        INSERT INTO pos_daily_finance (date, location_id, net_sales, gross_sales, orders_count,
          payments_cash, payments_card, payments_other, refunds_amount, refunds_count,
          discounts_amount, comps_amount, voids_amount)
        VALUES (v_day, v_location.id, v_net_sales, v_gross_sales, v_orders,
          ROUND(v_net_sales * 0.25, 2), ROUND(v_net_sales * 0.70, 2), ROUND(v_net_sales * 0.05, 2),
          ROUND(v_net_sales * 0.005, 2), GREATEST(1, FLOOR(v_orders * 0.02)),
          ROUND(v_net_sales * 0.03, 2), ROUND(v_net_sales * 0.01, 2), ROUND(v_net_sales * 0.008, 2))
        ON CONFLICT (date, location_id) DO UPDATE SET
          net_sales = EXCLUDED.net_sales, gross_sales = EXCLUDED.gross_sales,
          orders_count = EXCLUDED.orders_count, payments_cash = EXCLUDED.payments_cash,
          payments_card = EXCLUDED.payments_card, payments_other = EXCLUDED.payments_other,
          refunds_amount = EXCLUDED.refunds_amount, refunds_count = EXCLUDED.refunds_count,
          discounts_amount = EXCLUDED.discounts_amount, comps_amount = EXCLUDED.comps_amount,
          voids_amount = EXCLUDED.voids_amount;

        -- labour_daily
        INSERT INTO labour_daily (date, location_id, labour_cost, labour_hours)
        VALUES (v_day, v_location.id, v_labor_cost, v_labor_hours)
        ON CONFLICT (date, location_id) DO UPDATE SET
          labour_cost = EXCLUDED.labour_cost, labour_hours = EXCLUDED.labour_hours;

        -- cogs_daily
        INSERT INTO cogs_daily (date, location_id, cogs_amount)
        VALUES (v_day, v_location.id, ROUND(v_net_sales * 0.28, 2))
        ON CONFLICT (date, location_id) DO UPDATE SET
          cogs_amount = EXCLUDED.cogs_amount;

        -- cash_counts_daily
        INSERT INTO cash_counts_daily (date, location_id, cash_counted)
        VALUES (v_day, v_location.id,
          ROUND((v_net_sales * 0.25 * (0.995 + random() * 0.01))::numeric, 2))
        ON CONFLICT (date, location_id) DO UPDATE SET
          cash_counted = EXCLUDED.cash_counted;
      END IF;

      -- forecast_daily_metrics (for ALL dates including future)
      INSERT INTO forecast_daily_metrics (date, location_id, forecast_sales, forecast_orders,
        planned_labor_hours, planned_labor_cost, model_version)
      VALUES (v_day, v_location.id, v_forecast_sales, v_forecast_orders,
        v_planned_hours, v_planned_cost, 'Prophet v5')
      ON CONFLICT (date, location_id) DO UPDATE SET
        forecast_sales = EXCLUDED.forecast_sales, forecast_orders = EXCLUDED.forecast_orders,
        planned_labor_hours = EXCLUDED.planned_labor_hours, planned_labor_cost = EXCLUDED.planned_labor_cost,
        model_version = EXCLUDED.model_version;

      -- budgets_daily (for ALL dates)
      INSERT INTO budgets_daily (date, location_id, budget_sales, budget_labour, budget_cogs)
      VALUES (v_day, v_location.id,
        ROUND((v_net_sales * (1.02 + 0.03 * SIN(EXTRACT(DOY FROM v_day))))::numeric, 2),
        ROUND((v_labor_cost * (0.96 + 0.02 * COS(EXTRACT(DOY FROM v_day))))::numeric, 2),
        ROUND((v_net_sales * 0.27)::numeric, 2))
      ON CONFLICT (date, location_id) DO UPDATE SET
        budget_sales = EXCLUDED.budget_sales, budget_labour = EXCLUDED.budget_labour,
        budget_cogs = EXCLUDED.budget_cogs;

      v_count := v_count + 1;
      IF v_count % 500 = 0 THEN
        RAISE NOTICE 'Generated % day-location records...', v_count;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ Done! Generated % day-location records with realistic casual dining Madrid data.', v_count;
END;
$$;
