-- ============================================================
-- Demo Seed Coherence: Populate ALL pages with realistic data
-- 
-- Fixes pages showing 0: Budgets, Cash Management, Waste,
-- COGS, and ensures data cross-reference is consistent.
--
-- All INSERT use ON CONFLICT DO NOTHING for idempotency.
-- CREATE TABLE IF NOT EXISTS for safety.
-- ============================================================


-- ─── 0. ENSURE ALL TABLES EXIST ──────────────────────────────

-- Budget system tables
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

CREATE TABLE IF NOT EXISTS budget_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_version_id uuid NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  location_id uuid NOT NULL,
  day date NOT NULL,
  UNIQUE(budget_version_id, location_id, day)
);

CREATE TABLE IF NOT EXISTS budget_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_day_id uuid NOT NULL REFERENCES budget_days(id) ON DELETE CASCADE,
  metric text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  layer text NOT NULL DEFAULT 'final' CHECK (layer IN ('base','adjustment','final')),
  UNIQUE(budget_day_id, metric, layer)
);

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

-- Waste events table
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

-- Stock movements table (for cogs_daily view)
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

-- Inventory items
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

-- Inventory item locations
CREATE TABLE IF NOT EXISTS inventory_item_location (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  location_id uuid NOT NULL,
  on_hand numeric DEFAULT 0,
  reorder_point numeric DEFAULT 0,
  safety_stock numeric DEFAULT 0,
  UNIQUE(item_id, location_id)
);

-- Cash counts table
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

-- RLS for new tables
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

-- Grant everything to authenticated
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


-- ─── 1. BUDGET DATA ─────────────────────────────────────────

-- 1a. Budget version per location
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

-- 1b. Budget days
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

-- 1c. Budget metrics: sales_net
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

-- 1d. Budget metrics: labour_cost (~28% of sales)
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

-- 1e. Budget metrics: cogs (~30% of sales)
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

-- 1f. Budget drivers
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


-- ─── 2. INVENTORY ITEMS ──────────────────────────────────────

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


-- ─── 3. WASTE EVENTS ─────────────────────────────────────────

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


-- ─── 4. STOCK MOVEMENTS (for cogs_daily view) ───────────────

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


-- ─── 5. INVENTORY POSITIONING ────────────────────────────────

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


-- ─── 6. CASH/CARD SPLIT IN daily_sales ───────────────────────
-- Add cash/card columns + populate them for Cash Management page

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

-- Ensure refunds/discounts/comps/voids have realistic values
UPDATE daily_sales
SET
  refunds = COALESCE(ROUND(net_sales * 0.005, 2), 0),
  discounts = COALESCE(ROUND(net_sales * 0.03, 2), 0),
  comps = COALESCE(ROUND(net_sales * 0.01, 2), 0),
  voids = COALESCE(ROUND(net_sales * 0.002, 2), 0)
WHERE (refunds IS NULL OR refunds = 0)
  AND net_sales > 0;


-- ─── 7. FIX sales_daily_unified VIEW (cash/card split) ──────

DROP VIEW IF EXISTS mart_kpi_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mart_kpi_daily_mv CASCADE;
DROP VIEW IF EXISTS sales_daily_unified CASCADE;

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

GRANT SELECT ON sales_daily_unified TO anon, authenticated;

-- Recreate mart_kpi_daily
CREATE MATERIALIZED VIEW mart_kpi_daily_mv AS
SELECT org_id, location_id, date, net_sales, gross_sales, orders_count,
       avg_check, labor_cost, labor_hours, data_source
FROM sales_daily_unified;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mkd_mv ON mart_kpi_daily_mv (org_id, location_id, date, data_source);
CREATE OR REPLACE VIEW mart_kpi_daily AS SELECT * FROM mart_kpi_daily_mv;
GRANT SELECT ON mart_kpi_daily_mv TO anon, authenticated;
GRANT SELECT ON mart_kpi_daily TO anon, authenticated;


-- ─── 8. CASH COUNTS ─────────────────────────────────────────

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


-- ─── 9. RELOAD SCHEMA ───────────────────────────────────────
NOTIFY pgrst, 'reload schema';
