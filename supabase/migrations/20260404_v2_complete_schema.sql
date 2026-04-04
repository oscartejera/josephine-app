-- ============================================================================
-- V2 COMPLETE SCHEMA + DEMO DATA — Josephine v2 — 2026-04-04
-- Creates ALL missing tables + inserts demo data for Josephine Demo Group
-- ============================================================================

-- 1. SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  integration_type text NOT NULL DEFAULT 'manual' CHECK (integration_type IN ('api','edi','email','manual')),
  api_endpoint text,
  api_format text DEFAULT 'json' CHECK (api_format IN ('json','xml','edifact')),
  order_email text,
  order_whatsapp text,
  customer_id text,
  website text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_org_read" ON suppliers FOR SELECT USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "suppliers_org_write" ON suppliers FOR ALL USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

-- 2. SUPPLIER_ITEMS
CREATE TABLE IF NOT EXISTS supplier_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  supplier_sku text,
  unit_price numeric(10,2),
  pack_size text,
  lead_time_days int DEFAULT 1,
  is_preferred boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, inventory_item_id)
);
ALTER TABLE supplier_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "si_read" ON supplier_items FOR SELECT USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "si_write" ON supplier_items FOR ALL USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

-- 3. PURCHASE_ORDERS + LINES
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id),
  location_id uuid REFERENCES locations(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','confirmed','received','cancelled')),
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery date,
  total_amount numeric(12,2) DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES inventory_items(id),
  quantity numeric(10,2) NOT NULL,
  unit_price numeric(10,2),
  total_price numeric(12,2),
  received_quantity numeric(10,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_read" ON purchase_orders FOR SELECT USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "po_write" ON purchase_orders FOR ALL USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "pol_read" ON purchase_order_lines FOR SELECT USING (purchase_order_id IN (SELECT id FROM purchase_orders WHERE org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "pol_write" ON purchase_order_lines FOR ALL USING (purchase_order_id IN (SELECT id FROM purchase_orders WHERE org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid())));

-- 4. PAYROLL
CREATE TABLE IF NOT EXISTS payroll_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  base_hours numeric(8,2) DEFAULT 0,
  overtime_hours numeric(8,2) DEFAULT 0,
  base_pay numeric(10,2) DEFAULT 0,
  overtime_pay numeric(10,2) DEFAULT 0,
  gross_pay numeric(10,2) DEFAULT 0,
  deductions numeric(10,2) DEFAULT 0,
  net_pay numeric(10,2) DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_entry_id uuid REFERENCES payroll_entries(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('bonus','deduction','tip','absence','holiday')),
  description text,
  amount numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pe_read" ON payroll_entries FOR SELECT USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "pe_write" ON payroll_entries FOR ALL USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "pa_read" ON payroll_adjustments FOR SELECT USING (payroll_entry_id IN (SELECT id FROM payroll_entries WHERE org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "pa_write" ON payroll_adjustments FOR ALL USING (payroll_entry_id IN (SELECT id FROM payroll_entries WHERE org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid())));

-- 5. COGS_ENTRIES
CREATE TABLE IF NOT EXISTS cogs_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id),
  period_month date NOT NULL,
  category text NOT NULL DEFAULT 'food' CHECK (category IN ('food','beverage','packaging','supplies','other')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cogs_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce_read" ON cogs_entries FOR SELECT USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "ce_write" ON cogs_entries FOR ALL USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

-- 6. DATA_HEALTH_CHECKS
CREATE TABLE IF NOT EXISTS data_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  check_name text NOT NULL,
  check_type text NOT NULL DEFAULT 'completeness',
  status text NOT NULL DEFAULT 'pass' CHECK (status IN ('pass','warning','fail')),
  details jsonb DEFAULT '{}',
  checked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE data_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dhc_read" ON data_health_checks FOR SELECT USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "dhc_write" ON data_health_checks FOR ALL USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

-- 7. ONBOARDING_PROGRESS
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  org_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  steps_completed jsonb DEFAULT '[]',
  current_step text DEFAULT 'welcome',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onb_own" ON onboarding_progress FOR ALL USING (user_id = auth.uid());

-- 8. FORECAST_ACCURACY_DAILY
CREATE TABLE IF NOT EXISTS forecast_accuracy_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id),
  date date NOT NULL,
  metric text NOT NULL DEFAULT 'sales' CHECK (metric IN ('sales','orders','labour')),
  forecast_value numeric(12,2),
  actual_value numeric(12,2),
  error_pct numeric(8,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, location_id, date, metric)
);
ALTER TABLE forecast_accuracy_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fad_read" ON forecast_accuracy_daily FOR SELECT USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "fad_write" ON forecast_accuracy_daily FOR ALL USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

-- 9. CASH_DENOMINATIONS
CREATE TABLE IF NOT EXISTS cash_denominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_count_id uuid REFERENCES cash_counts_daily(id) ON DELETE CASCADE,
  denomination numeric(8,2) NOT NULL,
  quantity int NOT NULL DEFAULT 0,
  total numeric(10,2) GENERATED ALWAYS AS (denomination * quantity) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cash_denominations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cd_read" ON cash_denominations FOR SELECT USING (cash_count_id IN (SELECT id FROM cash_counts_daily WHERE org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "cd_write" ON cash_denominations FOR ALL USING (cash_count_id IN (SELECT id FROM cash_counts_daily WHERE org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid())));

-- 10. MENU_ENGINEERING_SNAPSHOTS
CREATE TABLE IF NOT EXISTS menu_engineering_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id),
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  date_from date NOT NULL,
  date_to date NOT NULL,
  category text,
  data jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE menu_engineering_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mes_read" ON menu_engineering_snapshots FOR SELECT USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "mes_write" ON menu_engineering_snapshots FOR ALL USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

-- 11. AVAILABILITY
CREATE TABLE IF NOT EXISTS availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '17:00',
  is_available boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, day_of_week)
);
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avail_read" ON availability FOR SELECT USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "avail_write" ON availability FOR ALL USING (org_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

-- 12. FIX: menu_engineering_summary RPC
DROP FUNCTION IF EXISTS menu_engineering_summary(date, date, uuid, text, text);
DROP FUNCTION IF EXISTS menu_engineering_summary(date, date, uuid, text);

CREATE OR REPLACE FUNCTION menu_engineering_summary(
  p_date_from date, p_date_to date,
  p_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo',
  p_category text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN (
    WITH product_data AS (
      SELECT COALESCE(ol.item_id,'00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
        COALESCE(mi.name, ci.name, 'Unknown') AS product_name,
        COALESCE(mi.category, ci.category, 'Other') AS product_category,
        COALESCE(SUM(ol.qty),0)::bigint AS units_sold,
        COALESCE(SUM(ol.gross),0) AS net_sales,
        0::numeric AS cogs,
        COALESCE(SUM(ol.gross),0) AS gross_profit,
        100::numeric AS margin_pct
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id
      LEFT JOIN menu_items mi ON mi.id = ol.item_id
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to
        AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
        AND (p_category IS NULL OR COALESCE(mi.category, ci.category, 'Other') = p_category)
      GROUP BY 1,2,3
    ), stats AS (SELECT AVG(margin_pct) AS avg_m, AVG(units_sold) AS avg_p FROM product_data)
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT pd.product_id, pd.product_name AS name, pd.product_category AS category,
        pd.units_sold, pd.net_sales AS sales, pd.cogs, pd.gross_profit AS total_gross_profit,
        pd.margin_pct, pd.net_sales AS selling_price_ex_vat, pd.cogs AS unit_food_cost,
        (pd.gross_profit / GREATEST(pd.units_sold, 1)) AS unit_gross_profit,
        CASE WHEN (SELECT SUM(units_sold) FROM product_data) > 0
             THEN (pd.units_sold::numeric / (SELECT SUM(units_sold) FROM product_data) * 100) ELSE 0 END AS popularity_pct,
        COALESCE(s.avg_p, 0) AS ideal_average_popularity,
        COALESCE((pd.gross_profit / GREATEST(pd.units_sold, 1)), 0) AS average_gross_profit,
        CASE WHEN pd.units_sold >= COALESCE(s.avg_p,0) THEN 'high' ELSE 'low' END AS popularity_class,
        CASE WHEN pd.margin_pct >= COALESCE(s.avg_m,0) THEN 'high' ELSE 'low' END AS profitability_class,
        CASE
          WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'star'
          WHEN pd.margin_pct < COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'plow_horse'
          WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold < COALESCE(s.avg_p,0) THEN 'puzzle'
          ELSE 'dog' END AS classification,
        'Automated classification' AS classification_reason,
        'unknown' AS cost_source, 'low' AS data_confidence,
        CASE
          WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'Proteger'
          WHEN pd.margin_pct < COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'Optimizar coste'
          WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold < COALESCE(s.avg_p,0) THEN 'Promocionar'
          ELSE 'Evaluar' END AS action_tag,
        '[]'::jsonb AS badges, true AS is_canonical
      FROM product_data pd, stats s ORDER BY pd.net_sales DESC
    ) r
  );
END;
$$;
GRANT EXECUTE ON FUNCTION menu_engineering_summary(date, date, uuid, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
