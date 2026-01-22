-- Fix search_path for the enforce_8h_shift function
CREATE OR REPLACE FUNCTION public.enforce_8h_shift()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  duration_interval INTERVAL;
  duration_hours NUMERIC;
BEGIN
  -- Calculate duration from start_time and end_time
  -- Handle overnight shifts (end_time < start_time)
  IF NEW.end_time < NEW.start_time THEN
    duration_interval := (NEW.end_time::time + INTERVAL '24 hours') - NEW.start_time::time;
  ELSE
    duration_interval := NEW.end_time::time - NEW.start_time::time;
  END IF;
  
  duration_hours := EXTRACT(EPOCH FROM duration_interval) / 3600;
  
  -- Enforce exactly 8 hours (with small tolerance for rounding)
  IF ABS(duration_hours - 8) > 0.01 THEN
    RAISE EXCEPTION 'Shift duration must be exactly 8 hours. Got % hours (% to %)', 
      ROUND(duration_hours::numeric, 2), NEW.start_time, NEW.end_time;
  END IF;
  
  -- Also enforce planned_hours = 8
  IF NEW.planned_hours != 8 THEN
    -- Auto-correct planned_hours instead of failing
    NEW.planned_hours := 8;
  END IF;
  
  RETURN NEW;
END;
$$;