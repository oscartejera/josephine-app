
-- =============================================
-- CASH MANAGEMENT TABLES
-- =============================================

-- Daily finance aggregates from POS
CREATE TABLE IF NOT EXISTS public.pos_daily_finance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  net_sales NUMERIC NOT NULL DEFAULT 0,
  gross_sales NUMERIC NOT NULL DEFAULT 0,
  orders_count NUMERIC NOT NULL DEFAULT 0,
  payments_cash NUMERIC NOT NULL DEFAULT 0,
  payments_card NUMERIC NOT NULL DEFAULT 0,
  payments_other NUMERIC NOT NULL DEFAULT 0,
  refunds_amount NUMERIC NOT NULL DEFAULT 0,
  refunds_count NUMERIC NOT NULL DEFAULT 0,
  discounts_amount NUMERIC NOT NULL DEFAULT 0,
  comps_amount NUMERIC NOT NULL DEFAULT 0,
  voids_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, location_id)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_pos_daily_finance_date_location 
  ON public.pos_daily_finance(date, location_id);

-- Enable RLS
ALTER TABLE public.pos_daily_finance ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view pos_daily_finance for accessible locations"
  ON public.pos_daily_finance FOR SELECT
  USING (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Managers can manage pos_daily_finance"
  ON public.pos_daily_finance FOR ALL
  USING (is_admin_or_ops() AND location_id IN (SELECT get_accessible_location_ids()));

-- Cash counts for variance tracking
CREATE TABLE IF NOT EXISTS public.cash_counts_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  cash_counted NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, location_id)
);

CREATE INDEX IF NOT EXISTS idx_cash_counts_daily_date_location 
  ON public.cash_counts_daily(date, location_id);

ALTER TABLE public.cash_counts_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cash_counts for accessible locations"
  ON public.cash_counts_daily FOR SELECT
  USING (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Managers can manage cash_counts"
  ON public.cash_counts_daily FOR ALL
  USING (is_admin_or_ops() AND location_id IN (SELECT get_accessible_location_ids()));

-- =============================================
-- BUDGETS TABLES
-- =============================================

-- Daily budgets
CREATE TABLE IF NOT EXISTS public.budgets_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  budget_sales NUMERIC NOT NULL DEFAULT 0,
  budget_labour NUMERIC NOT NULL DEFAULT 0,
  budget_cogs NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, location_id)
);

CREATE INDEX IF NOT EXISTS idx_budgets_daily_date_location 
  ON public.budgets_daily(date, location_id);

ALTER TABLE public.budgets_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view budgets for accessible locations"
  ON public.budgets_daily FOR SELECT
  USING (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Managers can manage budgets"
  ON public.budgets_daily FOR ALL
  USING (is_admin_or_ops() AND location_id IN (SELECT get_accessible_location_ids()));

-- Daily labour (if not exists - complement to pos_daily_metrics)
CREATE TABLE IF NOT EXISTS public.labour_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  labour_cost NUMERIC NOT NULL DEFAULT 0,
  labour_hours NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, location_id)
);

CREATE INDEX IF NOT EXISTS idx_labour_daily_date_location 
  ON public.labour_daily(date, location_id);

ALTER TABLE public.labour_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view labour_daily for accessible locations"
  ON public.labour_daily FOR SELECT
  USING (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Managers can manage labour_daily"
  ON public.labour_daily FOR ALL
  USING (is_admin_or_ops() AND location_id IN (SELECT get_accessible_location_ids()));

-- Daily COGS
CREATE TABLE IF NOT EXISTS public.cogs_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  cogs_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, location_id)
);

CREATE INDEX IF NOT EXISTS idx_cogs_daily_date_location 
  ON public.cogs_daily(date, location_id);

ALTER TABLE public.cogs_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cogs_daily for accessible locations"
  ON public.cogs_daily FOR SELECT
  USING (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Managers can manage cogs_daily"
  ON public.cogs_daily FOR ALL
  USING (is_admin_or_ops() AND location_id IN (SELECT get_accessible_location_ids()));

-- =============================================
-- PERMISSIONS
-- =============================================

-- Cash Management permissions
INSERT INTO public.permissions (key, module, description) VALUES
  ('cash_management.view', 'cash_management', 'View cash management data'),
  ('cash_management.export', 'cash_management', 'Export cash management data')
ON CONFLICT (key) DO NOTHING;

-- Budgets permissions
INSERT INTO public.permissions (key, module, description) VALUES
  ('budgets.view', 'budgets', 'View budgets data'),
  ('budgets.edit', 'budgets', 'Edit budgets'),
  ('budgets.export', 'budgets', 'Export budgets data')
ON CONFLICT (key) DO NOTHING;

-- Assign permissions to roles
DO $$
DECLARE
  v_role_owner uuid;
  v_role_admin uuid;
  v_role_ops_manager uuid;
  v_role_store_manager uuid;
  v_role_finance uuid;
BEGIN
  SELECT id INTO v_role_owner FROM public.roles WHERE name = 'owner';
  SELECT id INTO v_role_admin FROM public.roles WHERE name = 'admin';
  SELECT id INTO v_role_ops_manager FROM public.roles WHERE name = 'ops_manager';
  SELECT id INTO v_role_store_manager FROM public.roles WHERE name = 'store_manager';
  SELECT id INTO v_role_finance FROM public.roles WHERE name = 'finance';

  -- Owner gets all
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_owner, id FROM public.permissions WHERE key LIKE 'cash_management.%' OR key LIKE 'budgets.%'
  ON CONFLICT DO NOTHING;

  -- Admin gets all
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_admin, id FROM public.permissions WHERE key LIKE 'cash_management.%' OR key LIKE 'budgets.%'
  ON CONFLICT DO NOTHING;

  -- Ops Manager gets view + export
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_ops_manager, id FROM public.permissions WHERE key IN ('cash_management.view', 'cash_management.export', 'budgets.view', 'budgets.export')
  ON CONFLICT DO NOTHING;

  -- Store Manager gets view
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_store_manager, id FROM public.permissions WHERE key IN ('cash_management.view', 'budgets.view')
  ON CONFLICT DO NOTHING;

  -- Finance gets all
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_finance, id FROM public.permissions WHERE key LIKE 'cash_management.%' OR key LIKE 'budgets.%'
  ON CONFLICT DO NOTHING;
END $$;
