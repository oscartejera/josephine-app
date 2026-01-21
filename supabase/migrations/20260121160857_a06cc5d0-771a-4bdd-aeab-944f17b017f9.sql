-- =============================================
-- COMPREHENSIVE PERMISSIONS SYSTEM
-- =============================================

-- 1) Create roles table (separate from user_roles which stores assignments)
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  is_system boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2) Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  module text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- 3) Create role_permissions junction table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4) Modify user_roles to reference roles table and add location scope
-- First, drop existing constraints if they exist
ALTER TABLE public.user_roles 
  DROP COLUMN IF EXISTS role CASCADE;

-- Add role_id column referencing roles table
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE;

-- Add location_id for scope (NULL = all locations, NOT NULL = specific location)
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE;

-- 5) Create indices for performance
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_permissions_key ON public.permissions(key);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions(module);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_location_id ON public.user_roles(location_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);

-- 6) Create constraint function to prevent employee/store_manager from having NULL location_id
CREATE OR REPLACE FUNCTION public.check_location_scope_constraint()
RETURNS TRIGGER AS $$
DECLARE
  v_role_name text;
BEGIN
  -- Get the role name
  SELECT name INTO v_role_name FROM public.roles WHERE id = NEW.role_id;
  
  -- Check if employee or store_manager has NULL location_id
  IF v_role_name IN ('employee', 'store_manager') AND NEW.location_id IS NULL THEN
    RAISE EXCEPTION 'Role "%" cannot have global scope (location_id NULL). Must be assigned to a specific location.', v_role_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for the constraint
DROP TRIGGER IF EXISTS trg_check_location_scope ON public.user_roles;
CREATE TRIGGER trg_check_location_scope
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_location_scope_constraint();

-- 7) Enable RLS on new tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 8) RLS policies for roles table (viewable by all authenticated, manageable by owner_admin)
CREATE POLICY "Anyone can view roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage roles"
  ON public.roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'owner'
    )
  );

-- 9) RLS policies for permissions table
CREATE POLICY "Anyone can view permissions"
  ON public.permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage permissions"
  ON public.permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'owner'
    )
  );

-- 10) RLS policies for role_permissions table
CREATE POLICY "Anyone can view role_permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage role_permissions"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'owner'
    )
  );

-- 11) Update user_roles RLS to be more permissive for viewing own roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can manage user roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );