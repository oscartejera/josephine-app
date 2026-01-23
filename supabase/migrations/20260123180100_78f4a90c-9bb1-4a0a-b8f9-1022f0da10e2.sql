-- =====================================================
-- SIMPLIFY AUTHENTICATION: Single User Type with Full Access
-- Any authenticated user now has owner-level permissions
-- =====================================================

-- Drop functions that need signature changes first
DROP FUNCTION IF EXISTS public.get_user_has_global_scope(uuid);

-- 1. Simplify is_owner: any authenticated user = owner
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
$$;

-- 2. Simplify is_owner_or_admin: any authenticated user = true
CREATE OR REPLACE FUNCTION public.is_owner_or_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
$$;

-- 3. Simplify is_admin_or_ops: any authenticated user = true
CREATE OR REPLACE FUNCTION public.is_admin_or_ops(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
$$;

-- 4. Simplify has_permission: any authenticated user has all permissions
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
  SELECT _user_id IS NOT NULL
$$;

-- 5. Simplify get_user_has_global_scope: any authenticated user has global scope
CREATE OR REPLACE FUNCTION public.get_user_has_global_scope(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
$$;

-- 6. Simplify can_access_location: any authenticated user can access any location in their group
CREATE OR REPLACE FUNCTION public.can_access_location(_user_id uuid, _location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.locations l ON l.group_id = p.group_id
    WHERE p.id = _user_id AND l.id = _location_id
  )
$$;