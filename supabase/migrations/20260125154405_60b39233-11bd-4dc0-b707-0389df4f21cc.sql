-- Fix missing no-arg wrapper used by RLS policies
-- Some policies call get_user_has_global_scope() with no args, while the canonical function expects a user_id.
-- We add a compatibility wrapper to prevent PostgREST 404/42883 errors.

CREATE OR REPLACE FUNCTION public.get_user_has_global_scope()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_has_global_scope(auth.uid());
$$;
