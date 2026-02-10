-- ====================================================================
-- REPOPULATE DAILY TABLES FROM FACTS TABLES
-- After data cleanup, facts_sales_15m and facts_labor_daily retained
-- data but the daily aggregate tables the frontend queries were emptied.
-- This migration repopulates them AND upgrades the seed RPC so the
-- "Generate Demo Data" button fills ALL tables at once.
-- ====================================================================

-- 1) pos_daily_finance ← aggregate facts_sales_15m by day
INSERT INTO pos_daily_finance (date, location_id, net_sales, gross_sales, orders_count,
  payments_cash, payments_card, payments_other,
  refunds_amount, refunds_count, discounts_amount, comps_amount, voids_amount)
SELECT
  DATE(ts_bucket)        AS date,
  location_id,
  SUM(sales_net)         AS net_sales,
  SUM(sales_gross)       AS gross_sales,
  SUM(tickets)           AS orders_count,
  ROUND(SUM(sales_net) * 0.25, 2) AS payments_cash,
  ROUND(SUM(sales_net) * 0.70, 2) AS payments_card,
  ROUND(SUM(sales_net) * 0.05, 2) AS payments_other,
  COALESCE(SUM(refunds), 0)       AS refunds_amount,
  GREATEST(1, FLOOR(SUM(refunds) / NULLIF(SUM(sales_net), 0) * SUM(tickets)))::int AS refunds_count,
  COALESCE(SUM(discounts), 0)     AS discounts_amount,
  COALESCE(SUM(comps), 0)         AS comps_amount,
  COALESCE(SUM(voids), 0)         AS voids_amount
FROM facts_sales_15m
GROUP BY DATE(ts_bucket), location_id
ON CONFLICT (date, location_id) DO UPDATE SET
  net_sales = EXCLUDED.net_sales, gross_sales = EXCLUDED.gross_sales,
  orders_count = EXCLUDED.orders_count, payments_cash = EXCLUDED.payments_cash,
  payments_card = EXCLUDED.payments_card, payments_other = EXCLUDED.payments_other,
  refunds_amount = EXCLUDED.refunds_amount, refunds_count = EXCLUDED.refunds_count,
  discounts_amount = EXCLUDED.discounts_amount, comps_amount = EXCLUDED.comps_amount,
  voids_amount = EXCLUDED.voids_amount;

-- 2) labour_daily ← from facts_labor_daily
INSERT INTO labour_daily (date, location_id, labour_cost, labour_hours)
SELECT day AS date, location_id, labor_cost_est AS labour_cost, actual_hours AS labour_hours
FROM facts_labor_daily
ON CONFLICT (date, location_id) DO UPDATE SET
  labour_cost = EXCLUDED.labour_cost, labour_hours = EXCLUDED.labour_hours;

-- 3) pos_daily_metrics ← combine facts_sales_15m (sales) + facts_labor_daily (labor)
INSERT INTO pos_daily_metrics (date, location_id, net_sales, orders, labor_cost, labor_hours)
SELECT s.date, s.location_id, s.net_sales, s.orders_count AS orders,
  COALESCE(l.labor_cost_est, 0) AS labor_cost, COALESCE(l.actual_hours, 0) AS labor_hours
FROM (
  SELECT DATE(ts_bucket) AS date, location_id,
         SUM(sales_net) AS net_sales, SUM(tickets) AS orders_count
  FROM facts_sales_15m GROUP BY DATE(ts_bucket), location_id
) s
LEFT JOIN facts_labor_daily l ON l.day = s.date AND l.location_id = s.location_id
ON CONFLICT (date, location_id) DO UPDATE SET
  net_sales = EXCLUDED.net_sales, orders = EXCLUDED.orders,
  labor_cost = EXCLUDED.labor_cost, labor_hours = EXCLUDED.labor_hours;

-- 4) cogs_daily ← estimate as ~28% of net_sales
INSERT INTO cogs_daily (date, location_id, cogs_amount)
SELECT date, location_id, ROUND(net_sales::numeric * 0.28, 2) AS cogs_amount
FROM pos_daily_finance
ON CONFLICT (date, location_id) DO UPDATE SET cogs_amount = EXCLUDED.cogs_amount;

-- 5) budgets_daily ← actuals with realistic budget variance
INSERT INTO budgets_daily (date, location_id, budget_sales, budget_labour, budget_cogs)
SELECT pdf.date, pdf.location_id,
  ROUND((pdf.net_sales * (1.0 + 0.03 * SIN(EXTRACT(DOY FROM pdf.date))))::numeric, 2),
  ROUND((COALESCE(ld.labour_cost, 0) * (1.0 - 0.02 * COS(EXTRACT(DOY FROM pdf.date))))::numeric, 2),
  ROUND((pdf.net_sales * 0.28 * (1.0 + 0.02 * SIN(EXTRACT(DOY FROM pdf.date) + 1)))::numeric, 2)
FROM pos_daily_finance pdf
LEFT JOIN labour_daily ld ON ld.date = pdf.date AND ld.location_id = pdf.location_id
ON CONFLICT (date, location_id) DO UPDATE SET
  budget_sales = EXCLUDED.budget_sales, budget_labour = EXCLUDED.budget_labour,
  budget_cogs = EXCLUDED.budget_cogs;

-- 6) cash_counts_daily ← cash payments with small variance
INSERT INTO cash_counts_daily (date, location_id, cash_counted, notes)
SELECT date, location_id,
  ROUND((payments_cash * (1.0 + 0.01 * SIN(EXTRACT(DOY FROM date) * 3)))::numeric, 2), NULL
FROM pos_daily_finance
ON CONFLICT (date, location_id) DO UPDATE SET cash_counted = EXCLUDED.cash_counted;

-- 7) forecast_daily_metrics ← actuals with forecast variance (~±5%)
INSERT INTO forecast_daily_metrics (date, location_id, forecast_sales, forecast_orders,
  planned_labor_cost, planned_labor_hours, model_version)
SELECT pdm.date, pdm.location_id,
  ROUND((pdm.net_sales * (1.0 + 0.05 * SIN(EXTRACT(DOY FROM pdm.date) * 2)))::numeric, 2),
  ROUND((pdm.orders * (1.0 + 0.04 * COS(EXTRACT(DOY FROM pdm.date) * 2)))::numeric, 0),
  ROUND((pdm.labor_cost * (1.0 - 0.03 * SIN(EXTRACT(DOY FROM pdm.date))))::numeric, 2),
  ROUND((pdm.labor_hours * (1.0 - 0.03 * COS(EXTRACT(DOY FROM pdm.date))))::numeric, 2),
  'LR+SI v3'
FROM pos_daily_metrics pdm
ON CONFLICT (date, location_id) DO UPDATE SET
  forecast_sales = EXCLUDED.forecast_sales, forecast_orders = EXCLUDED.forecast_orders,
  planned_labor_cost = EXCLUDED.planned_labor_cost, planned_labor_hours = EXCLUDED.planned_labor_hours,
  model_version = EXCLUDED.model_version;

-- ====================================================================
-- 8) UPGRADE seed_demo_labour_data RPC to populate ALL 7 daily tables
--    So clicking "Generate Demo Data" on ANY page fills everything.
--    Base sales: realistic casual dining Madrid (~€4,500-€5,500/day/location)
-- ====================================================================
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
  v_net_sales numeric;
  v_gross_sales numeric;
  v_orders numeric;
  v_labor_hours numeric;
  v_labor_cost numeric;
  v_blended_rate numeric;
  v_forecast_sales numeric;
  v_forecast_orders numeric;
  v_planned_hours numeric;
  v_planned_cost numeric;
  v_dow int;
  v_locations_count int := 0;
  v_days_count int := 0;
BEGIN
  v_group_id := get_user_group_id();
  IF v_group_id IS NULL THEN
    RETURN jsonb_build_object('seeded', false, 'error', 'No group found');
  END IF;

  -- Clear existing data for this group
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

    -- Realistic casual dining Madrid base sales per location
    v_base_sales := CASE
      WHEN v_location.name ILIKE '%Centro%' OR v_location.name ILIKE '%Central%' THEN 5500
      WHEN v_location.name ILIKE '%Chamberí%' THEN 5000
      WHEN v_location.name ILIKE '%Malasaña%' THEN 4500
      ELSE 5000
    END;

    v_blended_rate := 14.5; -- avg hourly wage

    FOR v_day IN SELECT generate_series(
      CURRENT_DATE - (p_days || ' days')::interval,
      CURRENT_DATE - interval '1 day',
      '1 day'
    )::date
    LOOP
      v_dow := EXTRACT(DOW FROM v_day);

      v_sales_multiplier := CASE v_dow
        WHEN 5 THEN 1.35 + random() * 0.10  -- Friday
        WHEN 6 THEN 1.45 + random() * 0.15  -- Saturday
        WHEN 0 THEN 1.10 + random() * 0.10  -- Sunday
        WHEN 1 THEN 0.78 + random() * 0.08  -- Monday (slowest)
        WHEN 2 THEN 0.88 + random() * 0.08  -- Tuesday
        WHEN 3 THEN 0.92 + random() * 0.08  -- Wednesday
        ELSE 1.00 + random() * 0.08          -- Thursday
      END;

      v_net_sales := ROUND((v_base_sales * v_sales_multiplier * (0.92 + random() * 0.16))::numeric, 2);
      v_gross_sales := ROUND((v_net_sales * 1.05)::numeric, 2);
      v_orders := ROUND(v_net_sales / (22 + random() * 6));  -- avg check €22-€28
      v_labor_hours := ROUND((v_net_sales * (0.28 + (random() - 0.5) * 0.04) / v_blended_rate)::numeric, 1); -- COL 26-30%
      v_labor_cost := ROUND((v_labor_hours * v_blended_rate)::numeric, 2);

      v_forecast_sales := ROUND((v_net_sales * (0.93 + random() * 0.14))::numeric, 2);
      v_forecast_orders := ROUND(v_orders * (0.93 + random() * 0.14));
      v_planned_hours := ROUND((v_forecast_sales * 0.28 / v_blended_rate)::numeric, 1);
      v_planned_cost := ROUND((v_planned_hours * v_blended_rate)::numeric, 2);

      -- pos_daily_metrics (Labour page via sales_daily_unified view)
      INSERT INTO pos_daily_metrics (date, location_id, net_sales, orders, labor_hours, labor_cost)
      VALUES (v_day, v_location.id, v_net_sales, v_orders, v_labor_hours, v_labor_cost)
      ON CONFLICT (date, location_id) DO UPDATE SET
        net_sales = EXCLUDED.net_sales, orders = EXCLUDED.orders,
        labor_hours = EXCLUDED.labor_hours, labor_cost = EXCLUDED.labor_cost;

      -- forecast_daily_metrics (Labour + Instant P&L + Sales)
      INSERT INTO forecast_daily_metrics (date, location_id, forecast_sales, forecast_orders, planned_labor_hours, planned_labor_cost)
      VALUES (v_day, v_location.id, v_forecast_sales, v_forecast_orders, v_planned_hours, v_planned_cost)
      ON CONFLICT (date, location_id) DO UPDATE SET
        forecast_sales = EXCLUDED.forecast_sales, forecast_orders = EXCLUDED.forecast_orders,
        planned_labor_hours = EXCLUDED.planned_labor_hours, planned_labor_cost = EXCLUDED.planned_labor_cost;

      -- pos_daily_finance (Sales, Cash Management, Instant P&L, Waste, Inventory)
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

      -- labour_daily (Budgets page)
      INSERT INTO labour_daily (date, location_id, labour_cost, labour_hours)
      VALUES (v_day, v_location.id, v_labor_cost, v_labor_hours)
      ON CONFLICT (date, location_id) DO UPDATE SET
        labour_cost = EXCLUDED.labour_cost, labour_hours = EXCLUDED.labour_hours;

      -- cogs_daily (Budgets, Inventory)
      INSERT INTO cogs_daily (date, location_id, cogs_amount)
      VALUES (v_day, v_location.id, ROUND(v_net_sales * 0.28, 2))
      ON CONFLICT (date, location_id) DO UPDATE SET
        cogs_amount = EXCLUDED.cogs_amount;

      -- budgets_daily (Budgets)
      INSERT INTO budgets_daily (date, location_id, budget_sales, budget_labour, budget_cogs)
      VALUES (v_day, v_location.id,
        ROUND(v_net_sales * (1.0 + 0.03 * SIN(EXTRACT(DOY FROM v_day))), 2),
        ROUND(v_labor_cost * (1.0 - 0.02 * COS(EXTRACT(DOY FROM v_day))), 2),
        ROUND(v_net_sales * 0.28 * (1.0 + 0.02 * SIN(EXTRACT(DOY FROM v_day) + 1)), 2))
      ON CONFLICT (date, location_id) DO UPDATE SET
        budget_sales = EXCLUDED.budget_sales, budget_labour = EXCLUDED.budget_labour,
        budget_cogs = EXCLUDED.budget_cogs;

      -- cash_counts_daily (Cash Management)
      INSERT INTO cash_counts_daily (date, location_id, cash_counted)
      VALUES (v_day, v_location.id,
        ROUND(v_net_sales * 0.25 * (1.0 + 0.01 * SIN(EXTRACT(DOY FROM v_day) * 3)), 2))
      ON CONFLICT (date, location_id) DO UPDATE SET
        cash_counted = EXCLUDED.cash_counted;

      v_days_count := v_days_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'seeded', true,
    'locations', v_locations_count,
    'days', v_days_count / GREATEST(v_locations_count, 1)
  );
END;
$$;
