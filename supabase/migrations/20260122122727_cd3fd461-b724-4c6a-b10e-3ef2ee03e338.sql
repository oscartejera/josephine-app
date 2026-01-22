-- First, remove duplicate shifts keeping only one per (employee_id, location_id, shift_date, start_time)
DELETE FROM public.planned_shifts a
USING public.planned_shifts b
WHERE a.id > b.id 
  AND a.employee_id = b.employee_id
  AND a.location_id = b.location_id
  AND a.shift_date = b.shift_date
  AND a.start_time = b.start_time;

-- Now add the unique constraint
ALTER TABLE public.planned_shifts
ADD CONSTRAINT planned_shifts_unique_employee_date_time 
UNIQUE (employee_id, location_id, shift_date, start_time);

-- Ensure we have index for fast lookups by location and date range
CREATE INDEX IF NOT EXISTS idx_planned_shifts_location_date 
ON public.planned_shifts(location_id, shift_date);

-- Add location_settings default_hourly_cost if not exists
ALTER TABLE public.location_settings 
ADD COLUMN IF NOT EXISTS default_hourly_cost numeric DEFAULT 12.00;

-- Create or replace the trigger function for planned_cost calculation
CREATE OR REPLACE FUNCTION public.set_planned_shift_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_hourly_cost numeric;
  v_default_cost numeric;
BEGIN
  -- Enforce 8-hour shifts
  IF NEW.planned_hours != 8 THEN
    RAISE EXCEPTION 'Los turnos deben ser exactamente 8 horas según la legislación laboral española. Recibido: % horas', NEW.planned_hours;
  END IF;
  
  -- Get employee hourly cost
  SELECT hourly_cost INTO v_hourly_cost
  FROM employees 
  WHERE id = NEW.employee_id;
  
  -- If employee hourly_cost is null, use location default
  IF v_hourly_cost IS NULL THEN
    SELECT default_hourly_cost INTO v_default_cost
    FROM location_settings
    WHERE location_id = NEW.location_id;
    
    v_hourly_cost := COALESCE(v_default_cost, 12.00);
  END IF;
  
  -- Calculate planned cost
  NEW.planned_cost := ROUND(NEW.planned_hours * v_hourly_cost, 2);
  
  RETURN NEW;
END;
$$;

-- Recreate trigger (drop if exists, then create)
DROP TRIGGER IF EXISTS tr_set_planned_shift_cost ON public.planned_shifts;

CREATE TRIGGER tr_set_planned_shift_cost
BEFORE INSERT OR UPDATE ON public.planned_shifts
FOR EACH ROW
EXECUTE FUNCTION public.set_planned_shift_cost();