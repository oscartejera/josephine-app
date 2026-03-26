-- ============================================================
--  Demo account for Apple App Store Review
--  Email: demo@josephine.app  |  Password: AppleReview2025!
-- ============================================================
--
--  Auth user already created in Supabase Dashboard:
--    UID:  97de0d62-b79f-45f4-801b-d4d6ba0f2caf
--    Org:  7bca34d5-4448-40b8-bb7f-55f1417aeccd
--    Employee ID: c69a7b1a-4b2c-4c25-a4cc-6daab6bc5f8f
--
--  This script is IDEMPOTENT — safe to run multiple times.
--  It updates the existing demo employee and refreshes sample data.
-- ============================================================

-- ── Constants ──
DO $$
DECLARE
    v_emp_id   UUID := 'c69a7b1a-4b2c-4c25-a4cc-6daab6bc5f8f';
    v_org_id   UUID := '7bca34d5-4448-40b8-bb7f-55f1417aeccd';
    v_auth_uid UUID := '97de0d62-b79f-45f4-801b-d4d6ba0f2caf';
    v_loc_id   UUID := '13f383c6-0171-4c1f-9ee4-6ef6a6f04b36';  -- La Taberna Centro
    d          DATE;
BEGIN
    -- ══════════════════════════════════════
    --  1. FIX THE DEMO EMPLOYEE
    -- ══════════════════════════════════════
    --  Ensure location_id is set (required by iOS Employee model),
    --  role_name is set, and user_id is correctly linked.
    UPDATE employees SET
        location_id         = v_loc_id,
        role_name           = 'Camarero',
        hourly_rate         = 12.50,
        hourly_cost         = 12.50,
        contract_type       = 'full_time',
        contracted_hours    = 40,
        contract_hours_week = 40,
        active              = true
    WHERE id = v_emp_id;

    -- ══════════════════════════════════════
    --  2. CLEAN OLD DEMO DATA
    -- ══════════════════════════════════════
    DELETE FROM planned_shifts
    WHERE employee_id = v_emp_id;

    DELETE FROM employee_clock_records
    WHERE employee_id = v_emp_id;

    DELETE FROM announcements
    WHERE org_id = v_org_id
      AND author_name = 'Sistema';

    -- ══════════════════════════════════════
    --  3. SEED PUBLISHED SHIFTS (past 7 + next 7 days)
    -- ══════════════════════════════════════
    --  The iOS app filters: status == 'published'
    --  HomeView shows todayShift + upcomingShifts
    --  ScheduleView shows the weekly calendar

    -- Past 7 days (completed shifts)
    FOR d IN SELECT generate_series(
        CURRENT_DATE - 7,
        CURRENT_DATE - 1,
        '1 day'::interval
    )::date
    LOOP
        IF EXTRACT(DOW FROM d) NOT IN (0) THEN  -- Skip Sundays
            INSERT INTO planned_shifts (
                employee_id, location_id, shift_date,
                start_time, end_time,
                planned_hours, planned_cost,
                role, status
            ) VALUES (
                v_emp_id, v_loc_id, d,
                '09:00'::time, '17:00'::time,
                8.0, 100.00,
                'Camarero', 'published'
            );
        END IF;
    END LOOP;

    -- Today
    INSERT INTO planned_shifts (
        employee_id, location_id, shift_date,
        start_time, end_time,
        planned_hours, planned_cost,
        role, status
    ) VALUES (
        v_emp_id, v_loc_id, CURRENT_DATE,
        '10:00'::time, '18:00'::time,
        8.0, 100.00,
        'Camarero', 'published'
    );

    -- Next 6 days (upcoming shifts)
    FOR d IN SELECT generate_series(
        CURRENT_DATE + 1,
        CURRENT_DATE + 6,
        '1 day'::interval
    )::date
    LOOP
        IF EXTRACT(DOW FROM d) NOT IN (0) THEN
            INSERT INTO planned_shifts (
                employee_id, location_id, shift_date,
                start_time, end_time,
                planned_hours, planned_cost,
                role, status
            ) VALUES (
                v_emp_id, v_loc_id, d,
                '10:00'::time, '18:00'::time,
                8.0, 100.00,
                'Camarero', 'published'
            );
        END IF;
    END LOOP;

    -- ══════════════════════════════════════
    --  4. SEED CLOCK RECORDS (past 5 work days)
    -- ══════════════════════════════════════
    --  Table: employee_clock_records
    --  source must be: 'manual' | 'geo' | 'kiosk' | 'api'

    FOR d IN SELECT generate_series(
        CURRENT_DATE - 5,
        CURRENT_DATE - 1,
        '1 day'::interval
    )::date
    LOOP
        IF EXTRACT(DOW FROM d) NOT IN (0, 6) THEN  -- Mon-Fri only
            INSERT INTO employee_clock_records (
                employee_id, location_id,
                clock_in, clock_out,
                clock_in_lat, clock_in_lng,
                clock_out_lat, clock_out_lng,
                source, notes
            ) VALUES (
                v_emp_id, v_loc_id,
                (d + TIME '09:02')::timestamptz,
                (d + TIME '17:05')::timestamptz,
                40.4168, -3.7038,   -- Madrid Centro coords
                40.4168, -3.7038,
                'geo',
                NULL
            );
        END IF;
    END LOOP;

    -- ══════════════════════════════════════
    --  5. SEED ANNOUNCEMENTS
    -- ══════════════════════════════════════
    --  type: 'info' | any text (default 'info')
    --  pinned: boolean (default false)

    INSERT INTO announcements (
        org_id, location_id,
        title, body, type, pinned,
        author_name
    ) VALUES
    (
        v_org_id, NULL,
        'Bienvenido al equipo',
        'Esta es una cuenta de demostración con datos de ejemplo para la revisión de Apple.',
        'info', false,
        'Sistema'
    ),
    (
        v_org_id, v_loc_id,
        'Horario de verano',
        'A partir de julio cambiamos a horario de verano. Consulta tu turno actualizado.',
        'info', true,
        'Sistema'
    );

END $$;
