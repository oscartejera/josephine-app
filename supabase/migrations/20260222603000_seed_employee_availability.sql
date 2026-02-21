-- ============================================================
-- Auto-seed employee_availability for all active employees
-- Gives every employee default commercial-hours availability
-- so the schedule generator has "raw material" to work with.
-- ============================================================

DO $$
DECLARE
  v_emp record;
  v_dow int; -- 0=Sunday, 1=Monday, ..., 6=Saturday
BEGIN
  FOR v_emp IN
    SELECT e.id AS emp_id, e.location_id
    FROM employees e
    WHERE e.active = true
      AND e.location_id IS NOT NULL
  LOOP
    -- Insert availability for Monday(1) through Sunday(0)
    FOR v_dow IN 0..6 LOOP
      -- Skip if availability already exists for this employee+day+location
      IF NOT EXISTS (
        SELECT 1 FROM employee_availability
        WHERE employee_id = v_emp.emp_id
          AND location_id = v_emp.location_id
          AND day_of_week = v_dow
      ) THEN
        INSERT INTO employee_availability (employee_id, location_id, day_of_week, start_time, end_time, is_available)
        VALUES (
          v_emp.emp_id,
          v_emp.location_id,
          v_dow,
          (CASE
            WHEN v_dow IN (0) THEN '10:00'
            ELSE '09:00'
          END)::time,
          (CASE
            WHEN v_dow IN (5, 6) THEN '01:00'
            WHEN v_dow = 0 THEN '22:00'
            ELSE '23:30'
          END)::time,
          true
        );
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Employee availability seeded for all active employees';
END $$;
