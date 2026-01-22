-- Fix security warnings: Set search_path for functions

-- 1. Fix validate_planned_shift_hours
CREATE OR REPLACE FUNCTION public.validate_planned_shift_hours()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Spanish labor law: standard shifts must be exactly 8 hours
  IF NEW.planned_hours != 8 THEN
    RAISE EXCEPTION 'Los turnos deben ser exactamente 8 horas según la legislación laboral española. Recibido: % horas', NEW.planned_hours;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Fix set_planned_shift_cost
CREATE OR REPLACE FUNCTION public.set_planned_shift_cost()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_hourly_cost numeric;
  v_default_cost numeric;
BEGIN
  -- Get employee hourly cost
  SELECT hourly_cost INTO v_hourly_cost
  FROM employees 
  WHERE id = NEW.employee_id;
  
  -- If employee hourly_cost is null, use location default
  IF v_hourly_cost IS NULL THEN
    SELECT default_hourly_cost INTO v_default_cost
    FROM location_settings
    WHERE location_id = NEW.location_id;
    
    v_hourly_cost := COALESCE(v_default_cost, 15.00);
  END IF;
  
  -- Calculate planned cost
  NEW.planned_cost := ROUND(NEW.planned_hours * v_hourly_cost, 2);
  
  RETURN NEW;
END;
$$;