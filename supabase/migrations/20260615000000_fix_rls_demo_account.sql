-- Fix: employees_self_read used profile_user_id (column that doesn't match
-- the iOS app's query). Update to use user_id = auth.uid().
DROP POLICY IF EXISTS "employees_self_read" ON employees;
CREATE POLICY "employees_self_read" ON employees
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Fix: tip_distributions had RLS enabled with NO policies → all reads blocked.
DROP POLICY IF EXISTS "tip_distributions_select" ON tip_distributions;
CREATE POLICY "tip_distributions_select" ON tip_distributions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "tip_distributions_insert" ON tip_distributions;
CREATE POLICY "tip_distributions_insert" ON tip_distributions
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "tip_distributions_update" ON tip_distributions;
CREATE POLICY "tip_distributions_update" ON tip_distributions
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "tip_distributions_delete" ON tip_distributions;
CREATE POLICY "tip_distributions_delete" ON tip_distributions
  FOR DELETE TO authenticated
  USING (true);
