-- ============================================
-- JOSEPHINE: Seed Team Portal Data
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================

BEGIN;

-- ============================================
-- 1. CREATE ANNOUNCEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  pinned boolean DEFAULT false,
  author text NOT NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_read" ON public.announcements;
DROP POLICY IF EXISTS "announcements_write" ON public.announcements;

CREATE POLICY "announcements_read" ON public.announcements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "announcements_write" ON public.announcements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 2. LINK DEMO AUTH USERS TO EMPLOYEES
-- ============================================

-- Clear previous links for demo users
UPDATE public.employees SET user_id = NULL
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN (
    'employee.centro@demo.com',
    'manager.centro@demo.com',
    'manager.salamanca@demo.com'
  )
);

-- Link employee.centro@demo.com → Server at La Taberna Centro
UPDATE public.employees
SET user_id = (SELECT id FROM auth.users WHERE email = 'employee.centro@demo.com')
WHERE id = (
  SELECT e.id FROM public.employees e
  JOIN public.locations l ON e.location_id = l.id
  WHERE l.name = 'La Taberna Centro'
  AND e.role_name = 'Server'
  AND e.user_id IS NULL
  AND e.active = true
  LIMIT 1
);

-- Link manager.centro@demo.com → Manager at La Taberna Centro
UPDATE public.employees
SET user_id = (SELECT id FROM auth.users WHERE email = 'manager.centro@demo.com')
WHERE id = (
  SELECT e.id FROM public.employees e
  JOIN public.locations l ON e.location_id = l.id
  WHERE l.name = 'La Taberna Centro'
  AND e.role_name = 'Manager'
  AND e.user_id IS NULL
  AND e.active = true
  LIMIT 1
);

-- Link manager.salamanca@demo.com → Manager at Chamberí
UPDATE public.employees
SET user_id = (SELECT id FROM auth.users WHERE email = 'manager.salamanca@demo.com')
WHERE id = (
  SELECT e.id FROM public.employees e
  JOIN public.locations l ON e.location_id = l.id
  WHERE l.name ilike '%Chamb%'
  AND e.role_name = 'Manager'
  AND e.user_id IS NULL
  AND e.active = true
  LIMIT 1
);

-- ============================================
-- 3. SEED PLANNED SHIFTS (28 days: -14 to +14)
-- ============================================

-- Clean existing shifts in this date range
DELETE FROM public.planned_shifts
WHERE shift_date >= CURRENT_DATE - INTERVAL '14 days'
AND shift_date <= CURRENT_DATE + INTERVAL '14 days';

DO $$
DECLARE
  emp RECORD;
  d DATE;
  shift_start TIME;
  shift_end TIME;
  hours NUMERIC;
  shift_type INT;
BEGIN
  FOR emp IN
    SELECT e.id AS employee_id, e.location_id, e.role_name, e.hourly_cost
    FROM public.employees e
    WHERE e.active = true
  LOOP
    FOR d IN
      SELECT dd::date FROM generate_series(
        CURRENT_DATE - INTERVAL '14 days',
        CURRENT_DATE + INTERVAL '14 days',
        INTERVAL '1 day'
      ) dd
    LOOP
      -- ~5 days/week: skip 2 days based on employee+date hash
      IF abs(hashtext(emp.employee_id::text || d::text)) % 7 < 2 THEN
        CONTINUE;
      END IF;

      shift_type := abs(hashtext(emp.employee_id::text || d::text || 'shift')) % 3;

      CASE emp.role_name
        WHEN 'Chef' THEN
          IF shift_type = 0 THEN shift_start := '09:00'; shift_end := '16:00'; hours := 7;
          ELSIF shift_type = 1 THEN shift_start := '15:00'; shift_end := '23:00'; hours := 8;
          ELSE shift_start := '10:00'; shift_end := '17:00'; hours := 7;
          END IF;
        WHEN 'Manager' THEN
          IF shift_type = 0 THEN shift_start := '10:00'; shift_end := '18:00'; hours := 8;
          ELSIF shift_type = 1 THEN shift_start := '14:00'; shift_end := '23:00'; hours := 9;
          ELSE shift_start := '11:00'; shift_end := '19:00'; hours := 8;
          END IF;
        WHEN 'Server' THEN
          IF shift_type = 0 THEN shift_start := '12:00'; shift_end := '17:00'; hours := 5;
          ELSIF shift_type = 1 THEN shift_start := '18:00'; shift_end := '23:30'; hours := 5.5;
          ELSE shift_start := '12:00'; shift_end := '20:00'; hours := 8;
          END IF;
        WHEN 'Bartender' THEN
          IF shift_type = 0 THEN shift_start := '17:00'; shift_end := '23:30'; hours := 6.5;
          ELSIF shift_type = 1 THEN shift_start := '12:00'; shift_end := '18:00'; hours := 6;
          ELSE shift_start := '18:00'; shift_end := '23:00'; hours := 5;
          END IF;
        WHEN 'Host' THEN
          IF shift_type = 0 THEN shift_start := '12:00'; shift_end := '16:00'; hours := 4;
          ELSIF shift_type = 1 THEN shift_start := '19:00'; shift_end := '23:00'; hours := 4;
          ELSE shift_start := '12:00'; shift_end := '20:00'; hours := 8;
          END IF;
        ELSE
          shift_start := '10:00'; shift_end := '18:00'; hours := 8;
      END CASE;

      INSERT INTO public.planned_shifts (
        employee_id, location_id, shift_date, start_time, end_time,
        planned_hours, planned_cost, role, status
      ) VALUES (
        emp.employee_id, emp.location_id, d, shift_start, shift_end,
        hours, hours * COALESCE(emp.hourly_cost, 14), emp.role_name, 'published'
      );
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 4. SEED CLOCK RECORDS (past 14 days)
-- ============================================

-- Clean existing clock records in this range
DELETE FROM public.employee_clock_records
WHERE clock_in >= (CURRENT_DATE - INTERVAL '14 days')::timestamptz;

DO $$
DECLARE
  shift RECORD;
  variance_in INT;
  variance_out INT;
  clock_in_ts TIMESTAMPTZ;
  clock_out_ts TIMESTAMPTZ;
BEGIN
  FOR shift IN
    SELECT ps.employee_id, ps.location_id, ps.shift_date, ps.start_time, ps.end_time
    FROM public.planned_shifts ps
    WHERE ps.shift_date >= CURRENT_DATE - INTERVAL '14 days'
    AND ps.shift_date < CURRENT_DATE
    AND ps.status = 'published'
  LOOP
    -- Variance: clock in 0-8 min early, clock out 0-12 min late
    variance_in := abs(hashtext(shift.employee_id::text || shift.shift_date::text || 'in')) % 8;
    variance_out := abs(hashtext(shift.employee_id::text || shift.shift_date::text || 'out')) % 12;

    clock_in_ts := (shift.shift_date + shift.start_time)::timestamptz - (variance_in || ' minutes')::interval;

    -- Handle shifts that cross midnight
    IF shift.end_time < shift.start_time THEN
      clock_out_ts := (shift.shift_date + INTERVAL '1 day' + shift.end_time)::timestamptz + (variance_out || ' minutes')::interval;
    ELSE
      clock_out_ts := (shift.shift_date + shift.end_time)::timestamptz + (variance_out || ' minutes')::interval;
    END IF;

    INSERT INTO public.employee_clock_records (
      employee_id, location_id, clock_in, clock_out, source
    ) VALUES (
      shift.employee_id,
      shift.location_id,
      clock_in_ts,
      clock_out_ts,
      CASE WHEN abs(hashtext(shift.employee_id::text || shift.shift_date::text)) % 3 = 0 THEN 'geo' ELSE 'manual' END
    );
  END LOOP;
END $$;

-- ============================================
-- 5. SEED ANNOUNCEMENTS
-- ============================================

DELETE FROM public.announcements;

INSERT INTO public.announcements (title, body, type, pinned, author, location_id, created_at) VALUES
(
  'Horario especial San Valentín',
  'El 14 de febrero abrimos de 12:00 a 01:00. Se necesita personal extra para el turno de noche. Si estás disponible, habla con tu encargado.',
  'schedule', true, 'Dirección',
  (SELECT id FROM locations WHERE name = 'La Taberna Centro' LIMIT 1),
  NOW()
),
(
  'Formación de alérgenos obligatoria',
  'Recordatorio: la formación sobre alérgenos del día 20 es obligatoria para todo el personal de sala y cocina. Duración: 2 horas.',
  'important', true, 'Gerencia',
  NULL,
  NOW() - INTERVAL '1 day'
),
(
  'Nuevo menú de temporada',
  'A partir del lunes se incorporan 3 nuevos platos al menú. Habrá una formación el domingo a las 11:00 para todo el equipo de sala y cocina.',
  'info', true, 'Chef ejecutivo',
  NULL,
  NOW() - INTERVAL '1 day'
),
(
  'Empleado del mes: María López',
  'Felicidades a María por su excelente trabajo este mes. Su dedicación y actitud positiva son un ejemplo para todo el equipo.',
  'celebration', false, 'Dirección',
  (SELECT id FROM locations WHERE name = 'La Taberna Centro' LIMIT 1),
  NOW() - INTERVAL '2 days'
),
(
  'Recordatorio: Higiene y seguridad',
  'Recordad usar siempre el EPI correspondiente en cocina. La próxima inspección de sanidad será la semana que viene.',
  'important', false, 'Gerencia',
  NULL,
  NOW() - INTERVAL '3 days'
),
(
  'Cambio de turno disponible',
  'Carlos busca cambio de turno para el viernes 14. Turno de tarde (16:00-23:00) por turno de mañana. Contactad con él directamente.',
  'schedule', false, 'Carlos García',
  (SELECT id FROM locations WHERE name = 'La Taberna Centro' LIMIT 1),
  NOW() - INTERVAL '4 days'
),
(
  'Cena de equipo',
  'El próximo martes después del cierre haremos una cena de equipo para celebrar los buenos resultados del mes. ¡Estáis todos invitados!',
  'celebration', false, 'Dirección',
  NULL,
  NOW() - INTERVAL '5 days'
),
(
  'Nuevos uniformes disponibles',
  'Ya están disponibles los nuevos uniformes de verano. Pasad por el almacén para recoger vuestra talla. Tallas disponibles: S, M, L, XL.',
  'info', false, 'RRHH',
  NULL,
  NOW() - INTERVAL '6 days'
),
(
  'Objetivo mensual superado',
  'Este mes hemos superado el objetivo de ventas en un 12%. Gracias a todo el equipo por el esfuerzo. ¡Seguid así!',
  'celebration', false, 'Dirección',
  NULL,
  NOW() - INTERVAL '8 days'
),
(
  'Actualización del protocolo COVID',
  'Se actualizan las medidas de prevención. Consultar el tablón de la cocina para ver los cambios.',
  'important', false, 'Gerencia',
  NULL,
  NOW() - INTERVAL '10 days'
);

COMMIT;
