-- Fix infinite recursion in user_roles RLS policies

-- 1. Create SECURITY DEFINER function to check owner/admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_owner_or_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id 
      AND r.name IN ('owner', 'admin')
  )
$$;

-- 2. Update is_admin_or_ops to use role_id correctly with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_admin_or_ops()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
      AND r.name IN ('owner', 'admin', 'ops_manager')
  )
$$;

-- 3. Drop problematic policies on user_roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- 4. Create new non-recursive policies
-- Users can always see their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins/owners can view all roles (uses SECURITY DEFINER function)
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_owner_or_admin());

-- Admins/owners can manage all roles
CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.is_owner_or_admin())
WITH CHECK (public.is_owner_or_admin());