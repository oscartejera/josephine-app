-- ============================================================
--  Demo account for Apple App Store Review
--  Email: demo@josephine.app  |  Password: AppleReview2025!
-- ============================================================
--
--  Run this ONCE against the production Supabase project.
--  The account is read-only (no write permissions beyond clock-in).
--
--  STEP 1: Create the auth user via Supabase Dashboard
--          → Authentication → Create User
--          → email: demo@josephine.app
--          → password: AppleReview2025!
--          → Auto-confirm: ON
--          → Copy the generated UUID below as :demo_user_id
--
--  STEP 2: Run this script replacing :demo_user_id

-- ── Insert employee profile ──
INSERT INTO employees (
    id,
    auth_user_id,
    first_name,
    last_name,
    email,
    phone,
    role,
    department,
    location_id,
    status,
    hire_date,
    hourly_rate,
    created_at
) VALUES (
    gen_random_uuid(),
    :demo_user_id,
    'Demo',
    'Reviewer',
    'demo@josephine.app',
    '+34600000000',
    'staff',
    'Sala',
    (SELECT id FROM locations LIMIT 1),
    'active',
    CURRENT_DATE - INTERVAL '30 days',
    12.50,
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- ── Seed sample shifts (past week + next week) ──
DO $$
DECLARE
    emp_id UUID;
    d DATE;
BEGIN
    SELECT id INTO emp_id FROM employees WHERE email = 'demo@josephine.app';

    -- Past 7 days
    FOR d IN SELECT generate_series(CURRENT_DATE - 7, CURRENT_DATE - 1, '1 day'::interval)::date
    LOOP
        IF EXTRACT(DOW FROM d) NOT IN (0) THEN  -- Skip Sundays
            INSERT INTO planned_shifts (
                employee_id, shift_date, start_time, end_time,
                break_minutes, status, created_at
            ) VALUES (
                emp_id, d, '09:00', '17:00',
                30, 'completed', NOW()
            ) ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- Next 7 days
    FOR d IN SELECT generate_series(CURRENT_DATE, CURRENT_DATE + 6, '1 day'::interval)::date
    LOOP
        IF EXTRACT(DOW FROM d) NOT IN (0) THEN
            INSERT INTO planned_shifts (
                employee_id, shift_date, start_time, end_time,
                break_minutes, status, created_at
            ) VALUES (
                emp_id, d, '10:00', '18:00',
                30, 'scheduled', NOW()
            ) ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END $$;

-- ── Seed a sample clock record (yesterday) ──
INSERT INTO clock_records (
    employee_id,
    clock_in,
    clock_out,
    status,
    created_at
)
SELECT
    id,
    (CURRENT_DATE - 1) + TIME '09:02',
    (CURRENT_DATE - 1) + TIME '17:05',
    'completed',
    NOW()
FROM employees
WHERE email = 'demo@josephine.app'
ON CONFLICT DO NOTHING;

-- ── Seed sample announcement ──
INSERT INTO announcements (
    title,
    body,
    type,
    is_pinned,
    author_name,
    created_at
) VALUES (
    'Bienvenido al equipo',
    'Esta es una cuenta de demostración con datos de ejemplo.',
    'news',
    false,
    'Sistema',
    NOW()
) ON CONFLICT DO NOTHING;

-- ── Seed sample payroll period ──
INSERT INTO payroll_periods (
    employee_id,
    period_start,
    period_end,
    gross_pay,
    net_pay,
    hours_worked,
    status,
    created_at
)
SELECT
    id,
    DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::date,
    (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day')::date,
    1800.00,
    1440.00,
    144.0,
    'paid',
    NOW()
FROM employees
WHERE email = 'demo@josephine.app'
ON CONFLICT DO NOTHING;
