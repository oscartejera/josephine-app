-- =============================================
-- FISCAL MODULE TABLES
-- =============================================

-- fiscal_periods - Control de trimestres fiscales
CREATE TABLE public.fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'submitted')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, year, quarter)
);

-- fiscal_invoices - Registro de facturas (emitidas y recibidas)
CREATE TABLE public.fiscal_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('issued', 'received')),
  supplier_name TEXT,
  customer_name TEXT,
  base_amount NUMERIC(12,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
  tax_amount NUMERIC(12,2) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accounted', 'paid')),
  document_url TEXT,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- fiscal_model303 - Histórico de declaraciones
CREATE TABLE public.fiscal_model303 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  fiscal_period_id UUID REFERENCES public.fiscal_periods(id) ON DELETE CASCADE,
  base_21 NUMERIC(12,2) DEFAULT 0,
  iva_21 NUMERIC(12,2) DEFAULT 0,
  base_10 NUMERIC(12,2) DEFAULT 0,
  iva_10 NUMERIC(12,2) DEFAULT 0,
  base_4 NUMERIC(12,2) DEFAULT 0,
  iva_4 NUMERIC(12,2) DEFAULT 0,
  total_repercutido NUMERIC(12,2) DEFAULT 0,
  total_soportado NUMERIC(12,2) DEFAULT 0,
  result NUMERIC(12,2) DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  confirmation_code TEXT
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_model303 ENABLE ROW LEVEL SECURITY;

-- fiscal_periods policies
CREATE POLICY "Users can view fiscal periods in their group" 
ON public.fiscal_periods FOR SELECT 
USING (group_id = public.get_user_group_id());

CREATE POLICY "Owners/Admins can insert fiscal periods" 
ON public.fiscal_periods FOR INSERT 
WITH CHECK (group_id = public.get_user_group_id() AND public.is_owner_or_admin(auth.uid()));

CREATE POLICY "Owners/Admins can update fiscal periods" 
ON public.fiscal_periods FOR UPDATE 
USING (group_id = public.get_user_group_id() AND public.is_owner_or_admin(auth.uid()));

-- fiscal_invoices policies
CREATE POLICY "Users can view invoices in their group" 
ON public.fiscal_invoices FOR SELECT 
USING (group_id = public.get_user_group_id());

CREATE POLICY "Owners/Admins can insert invoices" 
ON public.fiscal_invoices FOR INSERT 
WITH CHECK (group_id = public.get_user_group_id() AND public.is_owner_or_admin(auth.uid()));

CREATE POLICY "Owners/Admins can update invoices" 
ON public.fiscal_invoices FOR UPDATE 
USING (group_id = public.get_user_group_id() AND public.is_owner_or_admin(auth.uid()));

CREATE POLICY "Owners/Admins can delete invoices" 
ON public.fiscal_invoices FOR DELETE 
USING (group_id = public.get_user_group_id() AND public.is_owner_or_admin(auth.uid()));

-- fiscal_model303 policies
CREATE POLICY "Users can view model303 in their group" 
ON public.fiscal_model303 FOR SELECT 
USING (group_id = public.get_user_group_id());

CREATE POLICY "Owners/Admins can insert model303" 
ON public.fiscal_model303 FOR INSERT 
WITH CHECK (group_id = public.get_user_group_id() AND public.is_owner_or_admin(auth.uid()));

CREATE POLICY "Owners/Admins can update model303" 
ON public.fiscal_model303 FOR UPDATE 
USING (group_id = public.get_user_group_id() AND public.is_owner_or_admin(auth.uid()));

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_fiscal_periods_group_year ON public.fiscal_periods(group_id, year);
CREATE INDEX idx_fiscal_invoices_group_date ON public.fiscal_invoices(group_id, invoice_date);
CREATE INDEX idx_fiscal_invoices_type ON public.fiscal_invoices(type);
CREATE INDEX idx_fiscal_model303_period ON public.fiscal_model303(fiscal_period_id);

-- =============================================
-- ADD FISCAL PERMISSIONS
-- =============================================

INSERT INTO public.permissions (key, module, description) VALUES
  ('fiscal.view', 'fiscal', 'View fiscal data and dashboard'),
  ('fiscal.edit', 'fiscal', 'Edit invoices and declarations'),
  ('fiscal.export', 'fiscal', 'Export fiscal reports')
ON CONFLICT (key) DO NOTHING;

-- Assign fiscal permissions to appropriate roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM public.roles r, public.permissions p
WHERE r.name = 'owner' AND p.key IN ('fiscal.view', 'fiscal.edit', 'fiscal.export')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM public.roles r, public.permissions p
WHERE r.name = 'admin' AND p.key IN ('fiscal.view', 'fiscal.edit', 'fiscal.export')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM public.roles r, public.permissions p
WHERE r.name = 'finance' AND p.key IN ('fiscal.view', 'fiscal.edit', 'fiscal.export')
ON CONFLICT DO NOTHING;