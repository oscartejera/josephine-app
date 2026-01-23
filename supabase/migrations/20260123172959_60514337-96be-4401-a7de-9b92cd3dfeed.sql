-- Fix infinite recursion in roles, permissions, and role_permissions RLS policies

-- =============================================
-- 1. FIX ROLES TABLE POLICIES
-- =============================================
-- Drop the recursive policy
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.roles;

-- Keep the view policy as-is (anyone can view roles - no recursion)
-- CREATE POLICY "Anyone can view roles" already exists with USING (true)

-- Create new non-recursive admin management policy
CREATE POLICY "Admins can manage roles"
ON public.roles FOR ALL
TO authenticated
USING (public.is_owner_or_admin())
WITH CHECK (public.is_owner_or_admin());

-- =============================================
-- 2. FIX PERMISSIONS TABLE POLICIES
-- =============================================
-- Drop the recursive policy
DROP POLICY IF EXISTS "Only admins can manage permissions" ON public.permissions;

-- Keep the view policy as-is (anyone can view permissions - no recursion)
-- CREATE POLICY "Anyone can view permissions" already exists with USING (true)

-- Create new non-recursive admin management policy
CREATE POLICY "Admins can manage permissions"
ON public.permissions FOR ALL
TO authenticated
USING (public.is_owner_or_admin())
WITH CHECK (public.is_owner_or_admin());

-- =============================================
-- 3. FIX ROLE_PERMISSIONS TABLE POLICIES
-- =============================================
-- Drop the recursive policy
DROP POLICY IF EXISTS "Only admins can manage role_permissions" ON public.role_permissions;

-- Keep the view policy as-is (anyone can view role_permissions - no recursion)
-- CREATE POLICY "Anyone can view role_permissions" already exists with USING (true)

-- Create new non-recursive admin management policy
CREATE POLICY "Admins can manage role_permissions"
ON public.role_permissions FOR ALL
TO authenticated
USING (public.is_owner_or_admin())
WITH CHECK (public.is_owner_or_admin());

-- =============================================
-- 4. FIX LOCATIONS INSERT POLICY (avoid JOIN roles)
-- =============================================
-- Drop the current INSERT policy that uses JOIN roles
DROP POLICY IF EXISTS "Owners can insert locations" ON public.locations;

-- Create new INSERT policy using SECURITY DEFINER function
CREATE POLICY "Owners can insert locations"
ON public.locations FOR INSERT
TO authenticated
WITH CHECK (
  group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid())
  AND public.is_owner()
);