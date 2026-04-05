-- =============================================================================
-- JOSEPHINE DB v2 — VIEWS & MATERIALIZED VIEWS
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- DROP existing views first to allow column changes
-- (PostgreSQL does not allow CREATE OR REPLACE VIEW to remove/reorder columns)
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop materialized views first (they depend on base views)
DROP MATERIALIZED VIEW IF EXISTS product_sales_daily_unified_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS product_sales_daily_unified_mv_v2 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sales_hourly_unified_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sales_hourly_unified_mv_v2 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mart_kpi_daily_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mart_sales_category_daily_mv CASCADE;

-- Drop base views (CASCADE handles any remaining deps)
DROP VIEW IF EXISTS low_stock_unified CASCADE;
DROP VIEW IF EXISTS sales_daily_unified CASCADE;
DROP VIEW IF EXISTS sales_hourly_unified CASCADE;
DROP VIEW IF EXISTS labour_daily_unified CASCADE;
DROP VIEW IF EXISTS forecast_daily_unified CASCADE;
DROP VIEW IF EXISTS budget_daily_unified CASCADE;
DROP VIEW IF EXISTS product_sales_daily_unified CASCADE;
DROP VIEW IF EXISTS cogs_daily_v CASCADE;
DROP VIEW IF EXISTS inventory_position_unified CASCADE;
DROP VIEW IF EXISTS recipe_summary CASCADE;
DROP VIEW IF EXISTS mart_stock_count_headers CASCADE;
DROP VIEW IF EXISTS mart_stock_count_lines_enriched CASCADE;
DROP VIEW IF EXISTS mart_kpi_daily CASCADE;
DROP VIEW IF EXISTS mart_sales_category_daily CASCADE;
DROP VIEW IF EXISTS v_payroll_monthly_cost CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- UNIFIED VIEWS (frontend contracts)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW sales_daily_unified AS
SELECT
  ds.org_id,
  ds.location_id,
  ds.day AS date,
  ds.net_sales,
  ds.gross_sales,
  ds.orders_count,
  COALESCE(ds.covers, ds.orders_count) AS covers,
  ds.payments_total,
  ds.payments_cash,
  ds.payments_card,
  COALESCE(ds.payments_other, 0) AS payments_other,
  ds.refunds,
  ds.discounts,
  ds.comps,
  ds.voids,
  ds.data_source
FROM daily_sales ds;

CREATE OR REPLACE VIEW sales_hourly_unified AS
SELECT
  s.org_id, s.location_id,
  s.day AS date,
  (s.day || ' ' || lpad(s.hour_of_day::text, 2, '0') || ':00:00')::timestamptz AS hour_bucket,
  s.net_sales, s.orders_count, s.covers, s.data_source
FROM sales_hourly_raw s;

CREATE OR REPLACE VIEW labour_daily_unified AS
SELECT
  l.id, l.location_id,
  loc.org_id,
  l.date,
  l.labour_cost,
  l.labour_hours,
  CASE WHEN l.labour_hours > 0 THEN ROUND(l.labour_cost / l.labour_hours, 2) ELSE 0 END AS avg_hourly_rate
FROM labour_daily l
JOIN locations loc ON loc.id = l.location_id;

CREATE OR REPLACE VIEW forecast_daily_unified AS
SELECT
  f.id, f.location_id,
  loc.org_id,
  f.date,
  f.forecast_sales,
  f.forecast_orders,
  f.planned_labor_hours,
  f.planned_labor_cost
FROM forecast_daily_metrics f
JOIN locations loc ON loc.id = f.location_id;

CREATE OR REPLACE VIEW budget_daily_unified AS
SELECT
  b.id, b.location_id,
  loc.org_id,
  b.date,
  b.budget_sales,
  b.budget_labour,
  b.budget_cogs
FROM budgets_daily b
JOIN locations loc ON loc.id = b.location_id;

CREATE OR REPLACE VIEW product_sales_daily_unified AS
SELECT
  o.org_id,
  o.location_id,
  o.closed_at::date AS day,
  COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
  COALESCE(mi.name, ci.name, ol.name, 'Unknown') AS product_name,
  COALESCE(mi.category, ci.category, 'Other') AS category,
  SUM(ol.qty) AS qty,
  SUM(ol.gross) AS gross,
  SUM(ol.net) AS net,
  'demo' AS data_source
FROM cdm_orders o
JOIN cdm_order_lines ol ON ol.order_id = o.id
LEFT JOIN menu_items mi ON mi.id = ol.item_id
LEFT JOIN cdm_items ci ON ci.id = ol.item_id
WHERE o.closed_at IS NOT NULL
GROUP BY o.org_id, o.location_id, o.closed_at::date,
         COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid),
         COALESCE(mi.name, ci.name, ol.name, 'Unknown'),
         COALESCE(mi.category, ci.category, 'Other');

-- COGS view
CREATE OR REPLACE VIEW cogs_daily_v AS
SELECT location_id, date, cogs_amount FROM cogs_daily;

-- Inventory position
CREATE OR REPLACE VIEW inventory_position_unified AS
SELECT
  ii.org_id, il.location_id,
  ii.id AS item_id, ii.name, ii.unit,
  COALESCE(ii.category_name, ii.category, 'Other') AS category,
  il.on_hand, ii.par_level,
  il.reorder_point, il.safety_stock,
  ii.last_cost,
  CASE
    WHEN il.on_hand <= il.safety_stock THEN 'critical'
    WHEN il.on_hand <= il.reorder_point THEN 'low'
    WHEN il.on_hand >= ii.par_level * 1.5 THEN 'excess'
    ELSE 'ok'
  END AS stock_status
FROM inventory_items ii
JOIN inventory_item_location il ON il.item_id = ii.id
WHERE ii.is_active = true;

CREATE OR REPLACE VIEW low_stock_unified AS
SELECT * FROM inventory_position_unified
WHERE stock_status IN ('critical', 'low');

-- Recipe summary
CREATE OR REPLACE VIEW recipe_summary AS
SELECT
  r.id AS recipe_id,
  r.group_id,
  r.menu_item_name,
  r.selling_price,
  r.category,
  r.yield_qty,
  r.yield_unit,
  r.is_sub_recipe,
  COALESCE(SUM(ri.qty_gross * COALESCE(ii.last_cost, 0)), 0) AS total_cost,
  CASE WHEN COALESCE(r.selling_price, 0) > 0
    THEN ROUND(COALESCE(SUM(ri.qty_gross * COALESCE(ii.last_cost, 0)), 0) / r.selling_price * 100, 1)
    ELSE 0 END AS food_cost_pct,
  CASE WHEN COALESCE(r.selling_price, 0) > 0
    THEN ROUND(r.selling_price - COALESCE(SUM(ri.qty_gross * COALESCE(ii.last_cost, 0)), 0), 2)
    ELSE 0 END AS margin
FROM recipes r
LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
LEFT JOIN inventory_items ii ON ii.id = ri.inventory_item_id
GROUP BY r.id;

-- Stock count headers mart
CREATE OR REPLACE VIEW mart_stock_count_headers AS
SELECT
  sc.id, sc.group_id, sc.location_id,
  l.name AS location_name,
  sc.start_date, sc.end_date, sc.status,
  COUNT(scl.id) AS line_count,
  COALESCE(SUM(ABS(scl.variance_qty)), 0) AS total_abs_variance
FROM stock_counts sc
JOIN locations l ON l.id = sc.location_id
LEFT JOIN stock_count_lines scl ON scl.stock_count_id = sc.id
GROUP BY sc.id, l.name;

-- Stock count lines enriched mart
CREATE OR REPLACE VIEW mart_stock_count_lines_enriched AS
SELECT
  scl.id, scl.stock_count_id,
  sc.group_id, sc.location_id,
  l.name AS location_name,
  sc.start_date, sc.end_date,
  sc.status AS count_status,
  scl.inventory_item_id,
  ii.name AS item_name,
  ii.unit,
  COALESCE(ii.last_cost, 0) AS unit_cost,
  scl.opening_qty, scl.deliveries_qty, scl.transfers_net_qty,
  scl.closing_qty, scl.used_qty, scl.sales_qty,
  scl.variance_qty, scl.batch_balance,
  COALESCE(scl.variance_qty * ii.last_cost, 0) AS variance_value
FROM stock_count_lines scl
JOIN stock_counts sc ON sc.id = scl.stock_count_id
JOIN locations l ON l.id = sc.location_id
LEFT JOIN inventory_items ii ON ii.id = scl.inventory_item_id;

-- KPI daily mart
CREATE OR REPLACE VIEW mart_kpi_daily AS
SELECT
  ds.org_id, ds.location_id, ds.day AS date,
  ds.net_sales, ds.orders_count,
  COALESCE(ld.labour_cost, 0) AS labour_cost,
  COALESCE(ld.labour_hours, 0) AS labour_hours,
  COALESCE(cd.cogs_amount, 0) AS cogs,
  CASE WHEN ds.net_sales > 0 THEN ROUND(COALESCE(ld.labour_cost,0)/ds.net_sales*100, 1) ELSE 0 END AS col_pct,
  CASE WHEN COALESCE(ld.labour_hours,0) > 0 THEN ROUND(ds.net_sales/ld.labour_hours, 2) ELSE 0 END AS splh,
  ds.data_source
FROM daily_sales ds
LEFT JOIN labour_daily ld ON ld.location_id = ds.location_id AND ld.date = ds.day
LEFT JOIN cogs_daily cd ON cd.location_id = ds.location_id AND cd.date = ds.day;

-- Sales category daily mart
CREATE OR REPLACE VIEW mart_sales_category_daily AS
SELECT
  o.org_id, o.location_id,
  o.closed_at::date AS date,
  COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
  COALESCE(mi.name, ci.name, ol.name, 'Unknown') AS product_name,
  COALESCE(mi.category, ci.category, 'Other') AS category,
  SUM(ol.qty)::bigint AS units_sold,
  SUM(ol.gross) AS gross_sales,
  SUM(ol.net) AS net_sales,
  'demo' AS data_source
FROM cdm_orders o
JOIN cdm_order_lines ol ON ol.order_id = o.id
LEFT JOIN menu_items mi ON mi.id = ol.item_id
LEFT JOIN cdm_items ci ON ci.id = ol.item_id
WHERE o.closed_at IS NOT NULL
GROUP BY 1,2,3,4,5,6;

-- Payroll monthly cost view
CREATE OR REPLACE VIEW v_payroll_monthly_cost AS
SELECT
  pr.period_year, pr.period_month,
  pr.group_id AS org_id,
  pr.legal_entity_id::text AS location_id,
  SUM(COALESCE(ps.gross_pay, 0)) AS total_gross,
  SUM(COALESCE(ps.employer_ss, 0)) AS total_employer_ss,
  SUM(COALESCE(ps.gross_pay, 0)) + SUM(COALESCE(ps.employer_ss, 0)) AS total_cost,
  COUNT(DISTINCT ps.employee_id) AS headcount,
  'payroll'::text AS source
FROM payslips ps
JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
WHERE pr.status IN ('calculated','approved','paid')
GROUP BY pr.period_year, pr.period_month, pr.group_id, pr.legal_entity_id;


-- ═══════════════════════════════════════════════════════════════════════════
-- MATERIALIZED VIEWS (for performance)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS product_sales_daily_unified_mv AS
SELECT * FROM product_sales_daily_unified;

CREATE MATERIALIZED VIEW IF NOT EXISTS sales_hourly_unified_mv AS
SELECT * FROM sales_hourly_unified;

CREATE MATERIALIZED VIEW IF NOT EXISTS mart_kpi_daily_mv AS
SELECT * FROM mart_kpi_daily;

CREATE MATERIALIZED VIEW IF NOT EXISTS mart_sales_category_daily_mv AS
SELECT * FROM mart_sales_category_daily;

-- V2 variants (identical to v1, kept for backward compat with indexes)
CREATE MATERIALIZED VIEW IF NOT EXISTS product_sales_daily_unified_mv_v2 AS
SELECT * FROM product_sales_daily_unified;

CREATE MATERIALIZED VIEW IF NOT EXISTS sales_hourly_unified_mv_v2 AS
SELECT * FROM sales_hourly_unified;
