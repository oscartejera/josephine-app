-- =====================================================
-- PAYROLL MODULE - PART 2: FUNCTIONS AND RLS POLICIES
-- =====================================================

-- Check if user has payroll access
CREATE OR REPLACE FUNCTION public.has_payroll_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('owner_admin', 'payroll_admin', 'payroll_operator')
  );
END;
$$;

-- Check if user is payroll admin
CREATE OR REPLACE FUNCTION public.is_payroll_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('owner_admin', 'payroll_admin')
  );
END;
$$;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- LEGAL ENTITIES
CREATE POLICY "Users can view legal entities" ON public.legal_entities
  FOR SELECT USING (group_id = get_user_group_id());

CREATE POLICY "Payroll admins can manage legal entities" ON public.legal_entities
  FOR ALL USING (group_id = get_user_group_id() AND is_payroll_admin());

-- SOCIAL SECURITY ACCOUNTS
CREATE POLICY "Users can view SS accounts" ON public.social_security_accounts
  FOR SELECT USING (
    legal_entity_id IN (SELECT id FROM public.legal_entities WHERE group_id = get_user_group_id())
  );

CREATE POLICY "Payroll admins can manage SS accounts" ON public.social_security_accounts
  FOR ALL USING (
    legal_entity_id IN (SELECT id FROM public.legal_entities WHERE group_id = get_user_group_id())
    AND is_payroll_admin()
  );

-- TAX ACCOUNTS
CREATE POLICY "Users can view tax accounts" ON public.tax_accounts
  FOR SELECT USING (
    legal_entity_id IN (SELECT id FROM public.legal_entities WHERE group_id = get_user_group_id())
  );

CREATE POLICY "Payroll admins can manage tax accounts" ON public.tax_accounts
  FOR ALL USING (
    legal_entity_id IN (SELECT id FROM public.legal_entities WHERE group_id = get_user_group_id())
    AND is_payroll_admin()
  );

-- EMPLOYEE LEGAL (sensitive - only payroll roles can view)
CREATE POLICY "Payroll roles can view employee legal" ON public.employee_legal
  FOR SELECT USING (
    has_payroll_role() AND
    legal_entity_id IN (SELECT id FROM public.legal_entities WHERE group_id = get_user_group_id())
  );

CREATE POLICY "Payroll admins can manage employee legal" ON public.employee_legal
  FOR ALL USING (
    is_payroll_admin() AND
    legal_entity_id IN (SELECT id FROM public.legal_entities WHERE group_id = get_user_group_id())
  );

-- EMPLOYMENT CONTRACTS
CREATE POLICY "Users can view contracts" ON public.employment_contracts
  FOR SELECT USING (
    legal_entity_id IN (SELECT id FROM public.legal_entities WHERE group_id = get_user_group_id())
  );

CREATE POLICY "Payroll admins can manage contracts" ON public.employment_contracts
  FOR ALL USING (
    is_payroll_admin() AND
    legal_entity_id IN (SELECT id FROM public.legal_entities WHERE group_id = get_user_group_id())
  );

-- PAYROLL CONCEPTS
CREATE POLICY "Users can view concepts" ON public.payroll_concepts
  FOR SELECT USING (group_id = get_user_group_id());

CREATE POLICY "Payroll admins can manage concepts" ON public.payroll_concepts
  FOR ALL USING (group_id = get_user_group_id() AND is_payroll_admin());

-- CONVENIO RULES
CREATE POLICY "Users can view convenio rules" ON public.convenio_rules
  FOR SELECT USING (group_id = get_user_group_id());

CREATE POLICY "Payroll admins can manage convenio rules" ON public.convenio_rules
  FOR ALL USING (group_id = get_user_group_id() AND is_payroll_admin());

-- PAYROLL INPUTS
CREATE POLICY "Payroll roles can view inputs" ON public.payroll_inputs
  FOR SELECT USING (
    has_payroll_role() AND
    employee_id IN (
      SELECT e.id FROM public.employees e
      JOIN public.locations l ON e.location_id = l.id
      WHERE l.group_id = get_user_group_id()
    )
  );

CREATE POLICY "Payroll roles can manage inputs" ON public.payroll_inputs
  FOR ALL USING (
    has_payroll_role() AND
    employee_id IN (
      SELECT e.id FROM public.employees e
      JOIN public.locations l ON e.location_id = l.id
      WHERE l.group_id = get_user_group_id()
    )
  );

-- PAYROLL RUNS
CREATE POLICY "Payroll roles can view runs" ON public.payroll_runs
  FOR SELECT USING (group_id = get_user_group_id() AND has_payroll_role());

CREATE POLICY "Payroll roles can manage runs" ON public.payroll_runs
  FOR ALL USING (group_id = get_user_group_id() AND has_payroll_role());

-- PAYSLIPS
CREATE POLICY "Payroll roles can view payslips" ON public.payslips
  FOR SELECT USING (
    has_payroll_role() AND
    payroll_run_id IN (SELECT id FROM public.payroll_runs WHERE group_id = get_user_group_id())
  );

CREATE POLICY "Payroll roles can manage payslips" ON public.payslips
  FOR ALL USING (
    has_payroll_role() AND
    payroll_run_id IN (SELECT id FROM public.payroll_runs WHERE group_id = get_user_group_id())
  );

-- PAYSLIP LINES
CREATE POLICY "Payroll roles can view payslip lines" ON public.payslip_lines
  FOR SELECT USING (
    has_payroll_role() AND
    payslip_id IN (
      SELECT p.id FROM public.payslips p
      JOIN public.payroll_runs pr ON p.payroll_run_id = pr.id
      WHERE pr.group_id = get_user_group_id()
    )
  );

CREATE POLICY "Payroll roles can manage payslip lines" ON public.payslip_lines
  FOR ALL USING (
    has_payroll_role() AND
    payslip_id IN (
      SELECT p.id FROM public.payslips p
      JOIN public.payroll_runs pr ON p.payroll_run_id = pr.id
      WHERE pr.group_id = get_user_group_id()
    )
  );

-- COMPLIANCE SUBMISSIONS
CREATE POLICY "Payroll admins can view submissions" ON public.compliance_submissions
  FOR SELECT USING (
    is_payroll_admin() AND
    payroll_run_id IN (SELECT id FROM public.payroll_runs WHERE group_id = get_user_group_id())
  );

CREATE POLICY "Payroll admins can manage submissions" ON public.compliance_submissions
  FOR ALL USING (
    is_payroll_admin() AND
    payroll_run_id IN (SELECT id FROM public.payroll_runs WHERE group_id = get_user_group_id())
  );

-- COMPLIANCE TOKENS (very restricted)
CREATE POLICY "Payroll admins can view tokens" ON public.compliance_tokens
  FOR SELECT USING (
    is_payroll_admin() AND
    legal_entity_id IN (SELECT id FROM public.legal_entities WHERE group_id = get_user_group_id())
  );

CREATE POLICY "Payroll admins can manage tokens" ON public.compliance_tokens
  FOR ALL USING (
    is_payroll_admin() AND
    legal_entity_id IN (SELECT id FROM public.legal_entities WHERE group_id = get_user_group_id())
  );

-- PAYROLL AUDIT
CREATE POLICY "Payroll roles can insert audit" ON public.payroll_audit
  FOR INSERT WITH CHECK (group_id = get_user_group_id() AND has_payroll_role());

CREATE POLICY "Payroll admins can view audit" ON public.payroll_audit
  FOR SELECT USING (group_id = get_user_group_id() AND is_payroll_admin());

-- PAYROLL SETTINGS
CREATE POLICY "Users can view payroll settings" ON public.payroll_settings
  FOR SELECT USING (group_id = get_user_group_id());

CREATE POLICY "Payroll admins can manage payroll settings" ON public.payroll_settings
  FOR ALL USING (group_id = get_user_group_id() AND is_payroll_admin());