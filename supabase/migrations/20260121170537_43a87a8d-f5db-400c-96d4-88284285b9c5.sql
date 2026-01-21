
-- Fix get_accessible_location_ids to include owners
CREATE OR REPLACE FUNCTION public.get_accessible_location_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id FROM public.locations l
  WHERE l.group_id = public.get_user_group_id()
    AND (
      -- Owners have access to all locations
      public.is_owner()
      -- Admins and ops managers have access to all locations
      OR public.is_admin_or_ops()
      -- Global scope users have access to all locations
      OR public.get_user_has_global_scope()
      -- Users with explicit location assignments
      OR EXISTS (
        SELECT 1 FROM public.user_locations ul
        WHERE ul.user_id = auth.uid() AND ul.location_id = l.id
      )
    )
$$;
