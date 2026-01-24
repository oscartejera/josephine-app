-- 1) Quitar temporalmente la política que depende de is_admin_or_ops(uuid)
DROP POLICY IF EXISTS "Admins can manage loyalty members" ON public.loyalty_members;

-- 2) Eliminar la función con DEFAULT (causa ambigüedad)
DROP FUNCTION IF EXISTS public.is_admin_or_ops(uuid);

-- 3) Recrear la función SIN DEFAULT
CREATE FUNCTION public.is_admin_or_ops(_user_id uuid)
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
    WHERE ur.user_id = _user_id
      AND r.name IN ('owner', 'admin', 'ops_manager')
  )
$$;

-- 4) Mantener/asegurar el wrapper sin argumentos
CREATE OR REPLACE FUNCTION public.is_admin_or_ops()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_ops(auth.uid())
$$;

-- 5) Restaurar la política exactamente como estaba
CREATE POLICY "Admins can manage loyalty members"
ON public.loyalty_members
AS PERMISSIVE
FOR ALL
TO public
USING ((group_id = get_user_group_id()) AND is_admin_or_ops(auth.uid()))
WITH CHECK ((group_id = get_user_group_id()) AND is_admin_or_ops(auth.uid()));