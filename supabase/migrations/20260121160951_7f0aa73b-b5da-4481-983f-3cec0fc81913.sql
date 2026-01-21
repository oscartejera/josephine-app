-- =============================================
-- SEED ROLES AND PERMISSIONS FUNCTION (idempotent)
-- =============================================

CREATE OR REPLACE FUNCTION public.seed_roles_and_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_owner uuid;
  v_role_admin uuid;
  v_role_ops_manager uuid;
  v_role_store_manager uuid;
  v_role_finance uuid;
  v_role_hr_payroll uuid;
  v_role_employee uuid;
  v_perm_id uuid;
BEGIN
  -- =============================================
  -- INSERT ROLES (idempotent - skip if exists)
  -- =============================================
  INSERT INTO public.roles (name, description, is_system)
  VALUES 
    ('owner', 'Full access to everything, bypass all restrictions', true),
    ('admin', 'Administrative access, most permissions except billing', true),
    ('ops_manager', 'Operations manager with broad access across locations', true),
    ('store_manager', 'Manager of a specific store/location', true),
    ('finance', 'Finance team - access to financial data and reports', true),
    ('hr_payroll', 'HR and Payroll team - manage schedules and payroll', true),
    ('employee', 'Regular employee - limited access', true)
  ON CONFLICT (name) DO NOTHING;

  -- Get role IDs
  SELECT id INTO v_role_owner FROM public.roles WHERE name = 'owner';
  SELECT id INTO v_role_admin FROM public.roles WHERE name = 'admin';
  SELECT id INTO v_role_ops_manager FROM public.roles WHERE name = 'ops_manager';
  SELECT id INTO v_role_store_manager FROM public.roles WHERE name = 'store_manager';
  SELECT id INTO v_role_finance FROM public.roles WHERE name = 'finance';
  SELECT id INTO v_role_hr_payroll FROM public.roles WHERE name = 'hr_payroll';
  SELECT id INTO v_role_employee FROM public.roles WHERE name = 'employee';

  -- =============================================
  -- INSERT PERMISSIONS (idempotent - skip if exists)
  -- =============================================
  
  -- Dashboard
  INSERT INTO public.permissions (key, module, description) VALUES
    ('dashboard.view', 'dashboard', 'View dashboard'),
    ('dashboard.export', 'dashboard', 'Export dashboard data')
  ON CONFLICT (key) DO NOTHING;

  -- Insights (parent folder)
  INSERT INTO public.permissions (key, module, description) VALUES
    ('insights.view', 'insights', 'View insights section')
  ON CONFLICT (key) DO NOTHING;

  -- Sales
  INSERT INTO public.permissions (key, module, description) VALUES
    ('sales.view', 'sales', 'View sales data'),
    ('sales.export', 'sales', 'Export sales data')
  ON CONFLICT (key) DO NOTHING;

  -- Labour
  INSERT INTO public.permissions (key, module, description) VALUES
    ('labour.view', 'labour', 'View labour data'),
    ('labour.export', 'labour', 'Export labour data')
  ON CONFLICT (key) DO NOTHING;

  -- Instant P&L
  INSERT INTO public.permissions (key, module, description) VALUES
    ('instant_pl.view', 'instant_pl', 'View Instant P&L'),
    ('instant_pl.export', 'instant_pl', 'Export Instant P&L')
  ON CONFLICT (key) DO NOTHING;

  -- Reviews
  INSERT INTO public.permissions (key, module, description) VALUES
    ('reviews.view', 'reviews', 'View customer reviews'),
    ('reviews.reply.generate', 'reviews', 'Generate AI replies'),
    ('reviews.reply.submit', 'reviews', 'Submit replies to platforms'),
    ('reviews.export', 'reviews', 'Export reviews data')
  ON CONFLICT (key) DO NOTHING;

  -- Scheduling
  INSERT INTO public.permissions (key, module, description) VALUES
    ('scheduling.view', 'scheduling', 'View schedules'),
    ('scheduling.create', 'scheduling', 'Create schedules'),
    ('scheduling.edit', 'scheduling', 'Edit schedules'),
    ('scheduling.publish', 'scheduling', 'Publish schedules'),
    ('scheduling.undo', 'scheduling', 'Undo schedule changes')
  ON CONFLICT (key) DO NOTHING;

  -- Availability
  INSERT INTO public.permissions (key, module, description) VALUES
    ('availability.view', 'availability', 'View availability'),
    ('availability.edit', 'availability', 'Edit availability')
  ON CONFLICT (key) DO NOTHING;

  -- Inventory
  INSERT INTO public.permissions (key, module, description) VALUES
    ('inventory.view', 'inventory', 'View inventory'),
    ('inventory.reconciliation.export', 'inventory', 'Export reconciliation')
  ON CONFLICT (key) DO NOTHING;

  -- Waste
  INSERT INTO public.permissions (key, module, description) VALUES
    ('waste.view', 'waste', 'View waste data'),
    ('waste.edit', 'waste', 'Log/edit waste')
  ON CONFLICT (key) DO NOTHING;

  -- Procurement
  INSERT INTO public.permissions (key, module, description) VALUES
    ('procurement.view', 'procurement', 'View procurement'),
    ('procurement.order.create', 'procurement', 'Create purchase orders'),
    ('procurement.order.edit', 'procurement', 'Edit purchase orders'),
    ('procurement.order.place', 'procurement', 'Place purchase orders'),
    ('procurement.order.pay', 'procurement', 'Pay for orders'),
    ('procurement.order.history.view', 'procurement', 'View order history')
  ON CONFLICT (key) DO NOTHING;

  -- Menu Engineering
  INSERT INTO public.permissions (key, module, description) VALUES
    ('menu_engineering.view', 'menu_engineering', 'View menu engineering'),
    ('menu_engineering.edit', 'menu_engineering', 'Edit menu items')
  ON CONFLICT (key) DO NOTHING;

  -- Integrations
  INSERT INTO public.permissions (key, module, description) VALUES
    ('integrations.view', 'integrations', 'View integrations'),
    ('integrations.connect', 'integrations', 'Connect integrations'),
    ('integrations.disconnect', 'integrations', 'Disconnect integrations'),
    ('integrations.health.view', 'integrations', 'View integration health')
  ON CONFLICT (key) DO NOTHING;

  -- Payroll
  INSERT INTO public.permissions (key, module, description) VALUES
    ('payroll.view', 'payroll', 'View payroll'),
    ('payroll.export', 'payroll', 'Export payroll data'),
    ('payroll.approve_hours', 'payroll', 'Approve work hours')
  ON CONFLICT (key) DO NOTHING;

  -- Settings
  INSERT INTO public.permissions (key, module, description) VALUES
    ('settings.view', 'settings', 'View settings'),
    ('settings.users.manage', 'settings', 'Manage users and roles'),
    ('settings.roles.manage', 'settings', 'Manage role permissions'),
    ('settings.billing.manage', 'settings', 'Manage billing')
  ON CONFLICT (key) DO NOTHING;

  -- =============================================
  -- ASSIGN PERMISSIONS TO ROLES
  -- =============================================

  -- Clear existing role_permissions for system roles (to reset)
  DELETE FROM public.role_permissions 
  WHERE role_id IN (v_role_owner, v_role_admin, v_role_ops_manager, v_role_store_manager, v_role_finance, v_role_hr_payroll, v_role_employee);

  -- OWNER: Gets ALL permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_owner, id FROM public.permissions;

  -- ADMIN: All except billing
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_admin, id FROM public.permissions WHERE key != 'settings.billing.manage';

  -- OPS_MANAGER permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_ops_manager, id FROM public.permissions 
  WHERE key IN (
    'dashboard.view', 'dashboard.export',
    'insights.view',
    'sales.view', 'sales.export',
    'labour.view', 'labour.export',
    'instant_pl.view', 'instant_pl.export',
    'reviews.view', 'reviews.reply.generate',
    'scheduling.view', 'scheduling.create', 'scheduling.edit', 'scheduling.publish', 'scheduling.undo',
    'availability.view',
    'inventory.view',
    'waste.view',
    'procurement.view', 'procurement.order.create', 'procurement.order.edit', 'procurement.order.place', 'procurement.order.history.view',
    'menu_engineering.view',
    'integrations.view', 'integrations.health.view',
    'settings.view'
  );

  -- STORE_MANAGER permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_store_manager, id FROM public.permissions 
  WHERE key IN (
    'dashboard.view',
    'insights.view',
    'sales.view',
    'labour.view',
    'instant_pl.view',
    'reviews.view', 'reviews.reply.generate', 'reviews.reply.submit',
    'scheduling.view', 'scheduling.create', 'scheduling.edit', 'scheduling.publish', 'scheduling.undo',
    'availability.view', 'availability.edit',
    'inventory.view',
    'waste.view', 'waste.edit',
    'procurement.view', 'procurement.order.create', 'procurement.order.edit', 'procurement.order.place', 'procurement.order.history.view'
  );

  -- FINANCE permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_finance, id FROM public.permissions 
  WHERE key IN (
    'dashboard.view', 'dashboard.export',
    'insights.view',
    'sales.view', 'sales.export',
    'instant_pl.view', 'instant_pl.export',
    'procurement.view', 'procurement.order.history.view',
    'payroll.view', 'payroll.export'
  );

  -- HR_PAYROLL permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_hr_payroll, id FROM public.permissions 
  WHERE key IN (
    'scheduling.view', 'scheduling.publish',
    'availability.view',
    'payroll.view', 'payroll.export', 'payroll.approve_hours'
  );

  -- EMPLOYEE permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_employee, id FROM public.permissions 
  WHERE key IN (
    'scheduling.view',
    'availability.view', 'availability.edit'
  );

END;
$$;

-- Execute the seed function
SELECT public.seed_roles_and_permissions();

-- =============================================
-- HELPER FUNCTIONS FOR PERMISSION CHECKING
-- =============================================

-- Check if user is owner (full bypass)
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
    WHERE ur.user_id = _user_id AND r.name = 'owner'
  )
$$;

-- Get all accessible location IDs for a user
CREATE OR REPLACE FUNCTION public.get_user_accessible_locations(_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- If owner OR has any role with NULL location_id (global scope) -> return all locations in their group
  SELECT l.id 
  FROM public.locations l
  WHERE l.group_id = public.get_user_group_id()
    AND (
      public.is_owner(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = _user_id AND ur.location_id IS NULL
      )
      OR l.id IN (
        SELECT ur.location_id FROM public.user_roles ur
        WHERE ur.user_id = _user_id AND ur.location_id IS NOT NULL
      )
    )
$$;

-- Check if user has global scope (can see all locations)
CREATE OR REPLACE FUNCTION public.get_user_has_global_scope(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_owner(_user_id) 
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user_id AND ur.location_id IS NULL
    )
$$;

-- Check if user has a specific permission for a location
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid,
  _permission_key text,
  _location_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_perm boolean := false;
BEGIN
  -- Owner has all permissions
  IF public.is_owner(_user_id) THEN
    RETURN true;
  END IF;

  -- Check if user has the permission through any of their roles
  -- that apply to this location (or have global scope)
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id
      AND p.key = _permission_key
      AND (
        ur.location_id IS NULL  -- Global scope
        OR _location_id IS NULL  -- No specific location required
        OR ur.location_id = _location_id  -- Matches specific location
      )
  ) INTO v_has_perm;

  RETURN v_has_perm;
END;
$$;

-- Get all permissions for a user (optionally filtered by location)
CREATE OR REPLACE FUNCTION public.get_user_permissions(
  _user_id uuid DEFAULT auth.uid(),
  _location_id uuid DEFAULT NULL
)
RETURNS TABLE (permission_key text, module text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- If owner, return all permissions
  SELECT DISTINCT p.key, p.module
  FROM public.permissions p
  WHERE public.is_owner(_user_id)
  
  UNION
  
  -- Otherwise, return permissions from assigned roles
  SELECT DISTINCT p.key, p.module
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  JOIN public.role_permissions rp ON rp.role_id = r.id
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = _user_id
    AND NOT public.is_owner(_user_id)
    AND (
      ur.location_id IS NULL
      OR _location_id IS NULL
      OR ur.location_id = _location_id
    )
$$;

-- Get user's roles with location info
CREATE OR REPLACE FUNCTION public.get_user_roles_with_scope(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  role_name text,
  role_id uuid,
  location_id uuid,
  location_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    r.name,
    r.id,
    ur.location_id,
    l.name
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  LEFT JOIN public.locations l ON ur.location_id = l.id
  WHERE ur.user_id = _user_id
$$;