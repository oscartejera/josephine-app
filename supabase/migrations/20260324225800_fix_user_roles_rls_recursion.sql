-- ============================================================
-- Migration: Fix infinite recursion in user_roles RLS policies
-- Problem:   user_roles_select_admin, user_roles_insert, and
--            user_roles_delete policies query user_roles itself,
--            causing Postgres error 42P17 "infinite recursion
--            detected in policy for relation user_roles".
-- Fix:       Create a SECURITY DEFINER helper function that
--            bypasses RLS to check if user is owner/admin,
--            then rewrite policies to use that function.
-- ============================================================

-- -------------------------------------------------------
-- 1. Helper: check if a user has owner/admin role (bypasses RLS)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin_or_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND r.name IN ('owner', 'admin')
  );
$$;

COMMENT ON FUNCTION is_admin_or_owner IS
  'Returns TRUE if the user holds an owner or admin role. SECURITY DEFINER to avoid RLS recursion.';

GRANT EXECUTE ON FUNCTION is_admin_or_owner(uuid) TO authenticated;

-- -------------------------------------------------------
-- 2. Drop old policies that cause infinite recursion
-- -------------------------------------------------------
DROP POLICY IF EXISTS user_roles_select_admin ON user_roles;
DROP POLICY IF EXISTS user_roles_insert ON user_roles;
DROP POLICY IF EXISTS user_roles_delete ON user_roles;

-- -------------------------------------------------------
-- 3. Recreate policies using the helper function
-- -------------------------------------------------------

-- Admin/owner can see all role assignments in their group
CREATE POLICY user_roles_select_admin ON user_roles
  FOR SELECT TO authenticated
  USING (
    is_admin_or_owner(auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = user_roles.user_id
        AND p.group_id = (SELECT group_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Owners/admins can insert role assignments
CREATE POLICY user_roles_insert ON user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_or_owner(auth.uid())
  );

-- Owners/admins can delete role assignments
CREATE POLICY user_roles_delete ON user_roles
  FOR DELETE TO authenticated
  USING (
    is_admin_or_owner(auth.uid())
  );
