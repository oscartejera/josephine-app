-- ====================================================================
-- REPOPULATE DAILY TABLES FROM FACTS TABLES
-- After cleanup, facts_sales_15m (66k rows) and facts_labor_daily (1.2k rows)
-- have data, but the daily aggregate tables that the frontend queries are empty.
-- This migration repopulates them.
-- ====================================================================

-- 1. Populate pos_daily_finance from facts_sales_15m
INSERT INTO pos_daily_finance (date, location_id, net_sales, gross_sales, orders_count,
  payments_cash, payments_card, payments_other,
  refunds_amount, refunds_count, discounts_amount, comps_amount, voids_amount)
SELECT
  (ts_bucket AT TIME ZONE 'Europe/Madrid')::date AS date,
  location_id,
  ROUND(SUM(sales_net)::numeric, 2) AS net_sales,
  ROUND(SUM(sales_gross)::numeric, 2) AS gross_sales,
  SUM(tickets) AS orders_count,
  ROUND((SUM(sales_net) * 0.20)::numeric, 2) AS payments_cash,
  ROUND((SUM(sales_net) * 0.75)::numeric, 2) AS payments_card,
  ROUND((SUM(sales_net) * 0.05)::numeric, 2) AS payments_other,
  ROUND(SUM(COALESCE(refunds, 0))::numeric, 2) AS refunds_amount,
  0 AS refunds_count,
  ROUND(SUM(COALESCE(discounts, 0))::numeric, 2) AS discounts_amount,
  ROUND(SUM(COALESCE(comps, 0))::numeric, 2) AS comps_amount,
  ROUND(SUM(COALESCE(voids, 0))::numeric, 2) AS voids_amount
FROM facts_sales_15m
GROUP BY (ts_bucket AT TIME ZONE 'Europe/Madrid')::date, location_id
ON CONFLICT (date, location_id) DO NOTHING;

-- 2. Populate labour_daily from facts_labor_daily
INSERT INTO labour_daily (date, location_id, labour_cost, labour_hours)
SELECT day, location_id, labor_cost_est, actual_hours
FROM facts_labor_daily
ON CONFLICT (date, location_id) DO NOTHING;

-- 3. Populate pos_daily_metrics from facts_sales_15m + facts_labor_daily
INSERT INTO pos_daily_metrics (date, location_id, net_sales, orders, labor_hours, labor_cost)
SELECT
  f.date,
  f.location_id,
  f.net_sales,
  f.orders,
  COALESCE(l.actual_hours, 0) AS labor_hours,
  COALESCE(l.labor_cost_est, 0) AS labor_cost
FROM (
  SELECT
    (ts_bucket AT TIME ZONE 'Europe/Madrid')::date AS date,
    location_id,
    ROUND(SUM(sales_net)::numeric, 2) AS net_sales,
    SUM(tickets) AS orders
  FROM facts_sales_15m
  GROUP BY (ts_bucket AT TIME ZONE 'Europe/Madrid')::date, location_id
) f
LEFT JOIN facts_labor_daily l ON l.day = f.date AND l.location_id = f.location_id
ON CONFLICT (date, location_id) DO NOTHING;

-- 4. Populate cogs_daily using location_settings COGS %
INSERT INTO cogs_daily (date, location_id, cogs_amount)
SELECT
  pdf.date,
  pdf.location_id,
  ROUND((pdf.net_sales * COALESCE(ls.default_cogs_percent, 30) / 100)::numeric, 2) AS cogs_amount
FROM pos_daily_finance pdf
LEFT JOIN location_settings ls ON ls.location_id = pdf.location_id
ON CONFLICT (date, location_id) DO NOTHING;

-- 5. Populate budgets_daily (budget = actual with slight optimistic variance)
INSERT INTO budgets_daily (date, location_id, budget_sales, budget_labour, budget_cogs)
SELECT
  pdf.date,
  pdf.location_id,
  ROUND((pdf.net_sales * (1.02 + random() * 0.06))::numeric, 2) AS budget_sales,
  ROUND((COALESCE(ld.labour_cost, pdf.net_sales * 0.25) * (0.95 + random() * 0.10))::numeric, 2) AS budget_labour,
  ROUND((COALESCE(cd.cogs_amount, pdf.net_sales * 0.30) * (0.95 + random() * 0.10))::numeric, 2) AS budget_cogs
FROM pos_daily_finance pdf
LEFT JOIN labour_daily ld ON ld.date = pdf.date AND ld.location_id = pdf.location_id
LEFT JOIN cogs_daily cd ON cd.date = pdf.date AND cd.location_id = pdf.location_id
ON CONFLICT (date, location_id) DO NOTHING;

-- 6. Populate cash_counts_daily
INSERT INTO cash_counts_daily (date, location_id, cash_counted)
SELECT
  date,
  location_id,
  ROUND((payments_cash * (0.97 + random() * 0.06))::numeric, 2) AS cash_counted
FROM pos_daily_finance
ON CONFLICT (date, location_id) DO NOTHING;

-- 7. Populate forecast_daily_metrics (forecast = actual with slight variance)
INSERT INTO forecast_daily_metrics (date, location_id, forecast_sales, forecast_orders, planned_labor_hours, planned_labor_cost)
SELECT
  pdf.date,
  pdf.location_id,
  ROUND((pdf.net_sales * (0.95 + random() * 0.10))::numeric, 2) AS forecast_sales,
  ROUND((pdf.orders_count * (0.95 + random() * 0.10))::numeric) AS forecast_orders,
  ROUND((COALESCE(ld.labour_hours, pdf.net_sales / 100) * (0.95 + random() * 0.10))::numeric, 2) AS planned_labor_hours,
  ROUND((COALESCE(ld.labour_cost, pdf.net_sales * 0.25) * (0.95 + random() * 0.10))::numeric, 2) AS planned_labor_cost
FROM pos_daily_finance pdf
LEFT JOIN labour_daily ld ON ld.date = pdf.date AND ld.location_id = pdf.location_id
ON CONFLICT (date, location_id) DO NOTHING;

-- Analyze tables for query performance
ANALYZE pos_daily_finance;
ANALYZE pos_daily_metrics;
ANALYZE labour_daily;
ANALYZE cogs_daily;
ANALYZE budgets_daily;
ANALYZE cash_counts_daily;
ANALYZE forecast_daily_metrics;

-- Verification
DO $$
DECLARE
  v_pdf INT; v_pdm INT; v_ld INT; v_cd INT; v_bd INT; v_ccd INT; v_fdm INT;
BEGIN
  SELECT COUNT(*) INTO v_pdf FROM pos_daily_finance;
  SELECT COUNT(*) INTO v_pdm FROM pos_daily_metrics;
  SELECT COUNT(*) INTO v_ld FROM labour_daily;
  SELECT COUNT(*) INTO v_cd FROM cogs_daily;
  SELECT COUNT(*) INTO v_bd FROM budgets_daily;
  SELECT COUNT(*) INTO v_ccd FROM cash_counts_daily;
  SELECT COUNT(*) INTO v_fdm FROM forecast_daily_metrics;

  RAISE NOTICE '=== REPOPULATION SUMMARY ===';
  RAISE NOTICE 'pos_daily_finance: % rows', v_pdf;
  RAISE NOTICE 'pos_daily_metrics: % rows', v_pdm;
  RAISE NOTICE 'labour_daily: % rows', v_ld;
  RAISE NOTICE 'cogs_daily: % rows', v_cd;
  RAISE NOTICE 'budgets_daily: % rows', v_bd;
  RAISE NOTICE 'cash_counts_daily: % rows', v_ccd;
  RAISE NOTICE 'forecast_daily_metrics: % rows', v_fdm;
  RAISE NOTICE '============================';
END $$;
