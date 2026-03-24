-- Fix: Allow users to view profiles of other members in the same group
-- Root cause: profiles_select_own only allows user_id = auth.uid()
-- This prevents the team list (UsersRolesManager) from showing other group members.
-- 
-- Note: A naive subquery like `group_id IN (SELECT group_id FROM profiles WHERE ...)`
-- causes infinite recursion because it queries the same RLS-protected table.
-- Solution: Use a SECURITY DEFINER function to bypass RLS for the lookup.

-- Step 1: Create a helper function that bypasses RLS to get the user's group_id
CREATE OR REPLACE FUNCTION public.get_user_group_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT group_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Step 2: Drop the overly restrictive policy
DROP POLICY IF EXISTS profiles_select_own ON profiles;

-- Step 3: Create a new policy that allows viewing any profile in the same group
CREATE POLICY profiles_select_same_group ON profiles
  FOR SELECT
  USING (
    group_id = get_user_group_id()
  );

-- Step 4: Fix user_roles visibility — allow members to see roles of users in same group
-- This is needed for UsersRolesManager to display roles of other team members
DROP POLICY IF EXISTS user_roles_select ON user_roles;
CREATE POLICY user_roles_select_same_group ON user_roles
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM profiles WHERE group_id = get_user_group_id()
    )
  );

-- Step 5: Fix broken test profiles from before the upsert→update fix
UPDATE profiles
SET group_id = (
  SELECT group_id FROM profiles WHERE email = 'owner@demo.com' LIMIT 1
)
WHERE group_id IS NULL
  AND email LIKE '%test%';
