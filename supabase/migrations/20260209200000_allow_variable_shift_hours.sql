-- =============================================================
-- Allow variable shift durations (Nory-style scheduling)
-- Drop the trigger that enforces exactly 8-hour shifts.
-- Restaurants need flexible shift lengths: 4.5h-8h
-- =============================================================

-- Drop the 8-hour enforcement trigger
DROP TRIGGER IF EXISTS tr_enforce_8h_shift ON public.planned_shifts;

-- Drop all older versions of similar triggers
DROP TRIGGER IF EXISTS enforce_8h_shifts ON public.planned_shifts;
DROP TRIGGER IF EXISTS tr_validate_shift ON public.planned_shifts;

-- Replace the function with a flexible validator
-- (allows 4-12 hour shifts, auto-calculates planned_cost)
CREATE OR REPLACE FUNCTION public.validate_planned_shift()
RETURNS TRIGGER AS $$
DECLARE
  calculated_hours NUMERIC;
  v_hourly_cost NUMERIC;
BEGIN
  -- Calculate hours from start_time and end_time
  IF NEW.end_time >= NEW.start_time THEN
    calculated_hours := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600;
  ELSE
    calculated_hours := EXTRACT(EPOCH FROM ('24:00:00'::time - NEW.start_time + NEW.end_time)) / 3600;
  END IF;

  -- Allow flexible shift durations (4-12 hours)
  IF calculated_hours < 3.5 OR calculated_hours > 13 THEN
    RAISE EXCEPTION 'Shift duration must be between 4 and 12 hours. Got % hours', ROUND(calculated_hours::numeric, 2);
  END IF;

  -- Auto-set planned_hours from actual duration if not matching
  NEW.planned_hours := ROUND(calculated_hours::numeric, 2);

  -- Auto-calculate planned_cost if not provided
  IF NEW.planned_cost IS NULL OR NEW.planned_cost = 0 THEN
    SELECT COALESCE(e.hourly_cost, ls.default_hourly_cost, 15.0)
    INTO v_hourly_cost
    FROM public.employees e
    LEFT JOIN public.location_settings ls ON ls.location_id = e.location_id
    WHERE e.id = NEW.employee_id;

    IF v_hourly_cost IS NOT NULL THEN
      NEW.planned_cost := ROUND(NEW.planned_hours * v_hourly_cost, 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the new flexible trigger
DROP TRIGGER IF EXISTS tr_validate_planned_shift ON public.planned_shifts;
CREATE TRIGGER tr_validate_planned_shift
  BEFORE INSERT OR UPDATE ON public.planned_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_planned_shift();
