-- =============================================
-- FASE B: Payroll Settings & Employee Payroll Tables
-- =============================================

-- 1) payroll_location_settings: defaults editables por location
CREATE TABLE IF NOT EXISTS public.payroll_location_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id uuid NOT NULL UNIQUE REFERENCES public.locations(id) ON DELETE CASCADE,
  contingencias_comunes_employer numeric NOT NULL DEFAULT 0.2360,
  desempleo_employer_indefinido numeric NOT NULL DEFAULT 0.0550,
  desempleo_employer_temporal numeric NOT NULL DEFAULT 0.0670,
  fogasa_employer numeric NOT NULL DEFAULT 0.0020,
  formacion_employer numeric NOT NULL DEFAULT 0.0060,
  mei_employer numeric NOT NULL DEFAULT 0.0067,
  accident_rate_employer numeric NOT NULL DEFAULT 0.0150,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) employee_payroll: datos salariales por empleado
CREATE TABLE IF NOT EXISTS public.employee_payroll (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  contract_type text NOT NULL DEFAULT 'indefinido' CHECK (contract_type IN ('indefinido', 'temporal')),
  pay_type text NOT NULL DEFAULT 'monthly' CHECK (pay_type IN ('monthly', 'annual')),
  gross_monthly numeric NULL,
  gross_annual numeric NULL,
  payments_per_year integer NOT NULL DEFAULT 14 CHECK (payments_per_year IN (12, 14)),
  weekly_hours numeric NOT NULL DEFAULT 40,
  hourly_override numeric NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Enable RLS on new tables
ALTER TABLE public.payroll_location_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payroll ENABLE ROW LEVEL SECURITY;

-- 4) RLS Policies for payroll_location_settings
CREATE POLICY "Users can view payroll settings for accessible locations"
  ON public.payroll_location_settings FOR SELECT
  USING (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Admins can manage payroll settings"
  ON public.payroll_location_settings FOR ALL
  USING (is_admin_or_ops() AND location_id IN (SELECT get_accessible_location_ids()));

-- 5) RLS Policies for employee_payroll
CREATE POLICY "Users can view employee payroll for accessible locations"
  ON public.employee_payroll FOR SELECT
  USING (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Admins can manage employee payroll"
  ON public.employee_payroll FOR ALL
  USING (is_admin_or_ops() AND location_id IN (SELECT get_accessible_location_ids()));

-- 6) Function to compute hourly_cost from employee_payroll + payroll_location_settings
CREATE OR REPLACE FUNCTION public.compute_hourly_cost(p_employee_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ep employee_payroll%ROWTYPE;
  v_settings payroll_location_settings%ROWTYPE;
  v_annual_hours numeric;
  v_gross_annual numeric;
  v_gross_hourly numeric;
  v_employer_rate numeric;
  v_hourly_cost numeric;
BEGIN
  -- Get employee payroll data
  SELECT * INTO v_ep FROM employee_payroll WHERE employee_id = p_employee_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- If hourly_override exists, use it directly
  IF v_ep.hourly_override IS NOT NULL THEN
    RETURN v_ep.hourly_override;
  END IF;

  -- Get location settings (or use defaults)
  SELECT * INTO v_settings FROM payroll_location_settings WHERE location_id = v_ep.location_id;
  
  -- Calculate annual hours
  v_annual_hours := v_ep.weekly_hours * 52;
  
  -- Calculate gross annual
  IF v_ep.pay_type = 'annual' THEN
    v_gross_annual := COALESCE(v_ep.gross_annual, 0);
  ELSE
    v_gross_annual := COALESCE(v_ep.gross_monthly, 0) * v_ep.payments_per_year;
  END IF;
  
  -- Calculate gross hourly
  IF v_annual_hours > 0 THEN
    v_gross_hourly := v_gross_annual / v_annual_hours;
  ELSE
    v_gross_hourly := 0;
  END IF;
  
  -- Calculate employer rate (using defaults if no settings)
  v_employer_rate := 
    COALESCE(v_settings.contingencias_comunes_employer, 0.2360) +
    COALESCE(v_settings.fogasa_employer, 0.0020) +
    COALESCE(v_settings.formacion_employer, 0.0060) +
    COALESCE(v_settings.mei_employer, 0.0067) +
    COALESCE(v_settings.accident_rate_employer, 0.0150) +
    CASE 
      WHEN v_ep.contract_type = 'indefinido' THEN COALESCE(v_settings.desempleo_employer_indefinido, 0.0550)
      ELSE COALESCE(v_settings.desempleo_employer_temporal, 0.0670)
    END;
  
  -- Final hourly cost
  v_hourly_cost := v_gross_hourly * (1 + v_employer_rate);
  
  RETURN ROUND(v_hourly_cost, 4);
END;
$$;

-- 7) Function to update employees.hourly_cost when employee_payroll changes
CREATE OR REPLACE FUNCTION public.sync_employee_hourly_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hourly_cost numeric;
BEGIN
  v_hourly_cost := compute_hourly_cost(NEW.employee_id);
  
  UPDATE employees
  SET hourly_cost = v_hourly_cost
  WHERE id = NEW.employee_id;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 8) Trigger on employee_payroll to sync hourly_cost
DROP TRIGGER IF EXISTS tr_sync_employee_hourly_cost ON employee_payroll;
CREATE TRIGGER tr_sync_employee_hourly_cost
  AFTER INSERT OR UPDATE ON employee_payroll
  FOR EACH ROW
  EXECUTE FUNCTION sync_employee_hourly_cost();

-- 9) Function to set planned_cost on planned_shifts
CREATE OR REPLACE FUNCTION public.set_planned_shift_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hourly_cost numeric;
BEGIN
  SELECT hourly_cost INTO v_hourly_cost
  FROM employees
  WHERE id = NEW.employee_id;
  
  IF v_hourly_cost IS NOT NULL THEN
    NEW.planned_cost := ROUND(NEW.planned_hours * v_hourly_cost, 2);
  ELSE
    NEW.planned_cost := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 10) Trigger on planned_shifts to auto-calculate planned_cost
DROP TRIGGER IF EXISTS tr_set_planned_shift_cost ON planned_shifts;
CREATE TRIGGER tr_set_planned_shift_cost
  BEFORE INSERT OR UPDATE ON planned_shifts
  FOR EACH ROW
  EXECUTE FUNCTION set_planned_shift_cost();

-- 11) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_payroll_location ON employee_payroll(location_id);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_employee ON employee_payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_location_settings_location ON payroll_location_settings(location_id);

-- 12) Update timestamps trigger for new tables
CREATE TRIGGER update_payroll_location_settings_updated_at
  BEFORE UPDATE ON payroll_location_settings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER update_employee_payroll_updated_at
  BEFORE UPDATE ON employee_payroll
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();