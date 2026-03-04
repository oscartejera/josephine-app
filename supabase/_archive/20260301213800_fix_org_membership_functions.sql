-- Fix: org_role_of, is_org_member, is_org_admin reference wrong table
-- The table is org_memberships, NOT org_members
-- ============================================================

-- 1. Fix org_role_of
CREATE OR REPLACE FUNCTION public.org_role_of(p_org_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
  FROM public.org_memberships m
  WHERE m.org_id = p_org_id AND m.user_id = p_user_id
  LIMIT 1
$$;

-- 2. Fix is_org_member
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = p_org_id AND m.user_id = p_user_id
  )
$$;

-- 3. Fix is_org_admin
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = p_org_id 
      AND m.user_id = p_user_id
      AND m.role IN ('owner', 'admin')
  )
$$;

-- 4. Fix org_settings RLS: allow any org member to update (not just admin)
DROP POLICY IF EXISTS org_settings_upsert_admin ON org_settings;
CREATE POLICY org_settings_upsert_member ON org_settings
  FOR ALL
  USING (is_org_member(org_id, auth.uid()))
  WITH CHECK (is_org_member(org_id, auth.uid()));
