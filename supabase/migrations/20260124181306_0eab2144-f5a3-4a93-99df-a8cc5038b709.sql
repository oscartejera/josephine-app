-- =============================================
-- FASE 0: AGREGAR user_id A employees
-- =============================================

ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);

-- =============================================
-- FASE 1: ACTUALIZAR FUNCIONES DE SEGURIDAD
-- =============================================

CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
      AND r.name = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_owner_or_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
      AND r.name IN ('owner', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_ops(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
      AND r.name IN ('owner', 'admin', 'ops_manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid,
  _permission_key text,
  _location_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN public.is_owner(_user_id) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON ur.role_id = rp.role_id
      JOIN public.permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = _user_id
        AND p.key = _permission_key
        AND (
          ur.location_id IS NULL 
          OR _location_id IS NULL 
          OR ur.location_id = _location_id
        )
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.get_user_has_global_scope(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
      AND ur.location_id IS NULL
      AND r.name IN ('owner', 'admin', 'ops_manager', 'finance', 'hr_payroll')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_primary_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.name
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = _user_id
  ORDER BY 
    CASE r.name
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'ops_manager' THEN 3
      WHEN 'finance' THEN 4
      WHEN 'hr_payroll' THEN 5
      WHEN 'store_manager' THEN 6
      WHEN 'employee' THEN 7
      ELSE 8
    END
  LIMIT 1
$$;

-- =============================================
-- FASE 2: CREAR TABLA DE FICHAJE
-- =============================================

CREATE TABLE IF NOT EXISTS public.employee_clock_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  clock_in_lat numeric,
  clock_in_lng numeric,
  clock_out_lat numeric,
  clock_out_lng numeric,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'geo', 'kiosk', 'app')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clock_records_employee ON public.employee_clock_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_clock_records_location ON public.employee_clock_records(location_id);
CREATE INDEX IF NOT EXISTS idx_clock_records_date ON public.employee_clock_records(clock_in DESC);

ALTER TABLE public.employee_clock_records ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Managers can view clock records" ON public.employee_clock_records;
CREATE POLICY "Managers can view clock records"
ON public.employee_clock_records FOR SELECT
TO authenticated
USING (
  public.is_owner_or_admin(auth.uid())
  OR public.can_access_location(auth.uid(), location_id)
);

DROP POLICY IF EXISTS "Employees can view own clock records" ON public.employee_clock_records;
CREATE POLICY "Employees can view own clock records"
ON public.employee_clock_records FOR SELECT
TO authenticated
USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Employees can clock in" ON public.employee_clock_records;
CREATE POLICY "Employees can clock in"
ON public.employee_clock_records FOR INSERT
TO authenticated
WITH CHECK (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Employees can clock out" ON public.employee_clock_records;
CREATE POLICY "Employees can clock out"
ON public.employee_clock_records FOR UPDATE
TO authenticated
USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  AND clock_out IS NULL
)
WITH CHECK (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

DROP TRIGGER IF EXISTS update_clock_records_updated_at ON public.employee_clock_records;
CREATE TRIGGER update_clock_records_updated_at
  BEFORE UPDATE ON public.employee_clock_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FASE 3: INSERTAR PERMISOS POR ROL
-- =============================================

DO $$
DECLARE
  v_admin_id uuid;
  v_ops_id uuid;
  v_store_id uuid;
  v_finance_id uuid;
  v_hr_id uuid;
  v_employee_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM public.roles WHERE name = 'admin';
  SELECT id INTO v_ops_id FROM public.roles WHERE name = 'ops_manager';
  SELECT id INTO v_store_id FROM public.roles WHERE name = 'store_manager';
  SELECT id INTO v_finance_id FROM public.roles WHERE name = 'finance';
  SELECT id INTO v_hr_id FROM public.roles WHERE name = 'hr_payroll';
  SELECT id INTO v_employee_id FROM public.roles WHERE name = 'employee';

  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_admin_id, p.id FROM public.permissions p
    WHERE p.key NOT LIKE 'settings.billing%'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_ops_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_ops_id, p.id FROM public.permissions p
    WHERE p.key IN (
      'dashboard.view', 'dashboard.export', 'insights.view',
      'sales.view', 'sales.export', 'labour.view', 'labour.export',
      'instant_pl.view', 'instant_pl.export',
      'reviews.view', 'reviews.reply.generate', 'reviews.reply.submit', 'reviews.export',
      'scheduling.view', 'scheduling.create', 'scheduling.edit', 'scheduling.publish', 'scheduling.undo',
      'availability.view', 'availability.edit',
      'inventory.view', 'inventory.reconciliation.export',
      'waste.view', 'waste.edit',
      'procurement.view', 'procurement.order.create', 'procurement.order.edit', 'procurement.order.place', 'procurement.order.pay', 'procurement.order.history.view',
      'menu_engineering.view', 'menu_engineering.edit',
      'integrations.view', 'integrations.health.view'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_store_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_store_id, p.id FROM public.permissions p
    WHERE p.key IN (
      'dashboard.view', 'insights.view', 'sales.view', 'labour.view',
      'scheduling.view', 'scheduling.create', 'scheduling.edit',
      'availability.view', 'availability.edit',
      'inventory.view', 'waste.view', 'waste.edit',
      'procurement.view', 'procurement.order.create', 'procurement.order.edit',
      'reviews.view'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_finance_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_finance_id, p.id FROM public.permissions p
    WHERE p.key IN (
      'dashboard.view', 'dashboard.export', 'insights.view',
      'sales.view', 'sales.export', 'labour.view', 'labour.export',
      'instant_pl.view', 'instant_pl.export',
      'payroll.view', 'payroll.export'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_hr_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_hr_id, p.id FROM public.permissions p
    WHERE p.key IN (
      'scheduling.view', 'scheduling.create', 'scheduling.edit', 'scheduling.publish',
      'availability.view', 'availability.edit',
      'payroll.view', 'payroll.export', 'payroll.approve_hours'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_employee_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_employee_id, p.id FROM public.permissions p
    WHERE p.key IN ('availability.view')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_clock_records;