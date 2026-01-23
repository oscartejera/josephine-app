-- Simplificar la política RLS para locations INSERT
-- Usar subqueries directas en lugar de funciones que pueden fallar silenciosamente

DROP POLICY IF EXISTS "Owners can insert locations" ON locations;

CREATE POLICY "Owners can insert locations" ON locations
FOR INSERT WITH CHECK (
  group_id = (SELECT group_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'owner'
  )
);