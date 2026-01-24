-- En lugar de eliminar, recreamos la función sin argumentos para que use auth.uid()
-- Esto resuelve el conflicto de "not unique" porque ahora es un wrapper claro
CREATE OR REPLACE FUNCTION public.is_admin_or_ops()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_ops(auth.uid())
$$;