-- ============================================================
-- JOSEPHINE: Complete Seed for Team Portal + Dashboard
-- Paste this ENTIRE script in Supabase SQL Editor and click Run
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: GROUP + LOCATIONS
-- ============================================================
DO $$
DECLARE
  v_group_id uuid;
BEGIN
  -- Get or create group
  SELECT id INTO v_group_id FROM public.groups LIMIT 1;
  IF v_group_id IS NULL THEN
    INSERT INTO public.groups (name) VALUES ('La Taberna') RETURNING id INTO v_group_id;
  END IF;
  PERFORM set_config('seed.group_id', v_group_id::text, true);

  -- Clean demo locations (cascade deletes employees, shifts, clock records)
  DELETE FROM public.locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña');

  -- Create 3 locations
  INSERT INTO public.locations (group_id, name, city, timezone, currency) VALUES
    (v_group_id, 'La Taberna Centro', 'Madrid', 'Europe/Madrid', 'EUR'),
    (v_group_id, 'Chamberí', 'Madrid', 'Europe/Madrid', 'EUR'),
    (v_group_id, 'Malasaña', 'Madrid', 'Europe/Madrid', 'EUR');

  RAISE NOTICE 'Step 1 OK: Group + 3 locations created';
END $$;

-- ============================================================
-- STEP 2: EMPLOYEES (30 per location = 90 total)
-- ============================================================
DO $$
DECLARE
  v_loc_centro uuid;
  v_loc_chamberi uuid;
  v_loc_malasana uuid;
BEGIN
  SELECT id INTO v_loc_centro FROM public.locations WHERE name = 'La Taberna Centro';
  SELECT id INTO v_loc_chamberi FROM public.locations WHERE name = 'Chamberí';
  SELECT id INTO v_loc_malasana FROM public.locations WHERE name = 'Malasaña';

  -- Centro employees
  INSERT INTO public.employees (location_id, full_name, role_name, hourly_cost, active) VALUES
    -- Chefs (€18/h)
    (v_loc_centro, 'Carlos García', 'Chef', 18.00, true),
    (v_loc_centro, 'María López', 'Chef', 18.00, true),
    (v_loc_centro, 'Juan Martínez', 'Chef', 18.00, true),
    (v_loc_centro, 'Ana Torres', 'Chef', 18.00, true),
    (v_loc_centro, 'Pedro Sánchez', 'Chef', 18.00, true),
    (v_loc_centro, 'Laura Fernández', 'Chef', 18.00, true),
    (v_loc_centro, 'Miguel Ruiz', 'Chef', 18.00, true),
    (v_loc_centro, 'Carmen Díaz', 'Chef', 18.00, true),
    -- Servers (€12/h)
    (v_loc_centro, 'David Rodríguez', 'Server', 12.00, true),
    (v_loc_centro, 'Sara Gómez', 'Server', 12.00, true),
    (v_loc_centro, 'Pablo Jiménez', 'Server', 12.00, true),
    (v_loc_centro, 'Elena Moreno', 'Server', 12.00, true),
    (v_loc_centro, 'Jorge Álvarez', 'Server', 12.00, true),
    (v_loc_centro, 'Lucía Romero', 'Server', 12.00, true),
    (v_loc_centro, 'Alberto Navarro', 'Server', 12.00, true),
    (v_loc_centro, 'Isabel Gil', 'Server', 12.00, true),
    (v_loc_centro, 'Francisco Serrano', 'Server', 12.00, true),
    (v_loc_centro, 'Patricia Molina', 'Server', 12.00, true),
    (v_loc_centro, 'Antonio Castro', 'Server', 12.00, true),
    (v_loc_centro, 'Rosa Ortiz', 'Server', 12.00, true),
    -- Bartenders (€14/h)
    (v_loc_centro, 'Manuel Rubio', 'Bartender', 14.00, true),
    (v_loc_centro, 'Teresa Vega', 'Bartender', 14.00, true),
    (v_loc_centro, 'Luis Ramos', 'Bartender', 14.00, true),
    (v_loc_centro, 'Cristina Herrera', 'Bartender', 14.00, true),
    (v_loc_centro, 'Javier Mendoza', 'Bartender', 14.00, true),
    -- Hosts (€11/h)
    (v_loc_centro, 'Beatriz Cruz', 'Host', 11.00, true),
    (v_loc_centro, 'Raúl Delgado', 'Host', 11.00, true),
    (v_loc_centro, 'Sofía Vargas', 'Host', 11.00, true),
    -- Managers (€25/h)
    (v_loc_centro, 'Fernando Iglesias', 'Manager', 25.00, true),
    (v_loc_centro, 'Marta Cortés', 'Manager', 25.00, true);

  -- Chamberí employees (same names + suffix)
  INSERT INTO public.employees (location_id, full_name, role_name, hourly_cost, active)
  SELECT v_loc_chamberi, full_name || ' B.', role_name, hourly_cost, active
  FROM public.employees WHERE location_id = v_loc_centro;

  -- Malasaña employees
  INSERT INTO public.employees (location_id, full_name, role_name, hourly_cost, active)
  SELECT v_loc_malasana, full_name || ' M.', role_name, hourly_cost, active
  FROM public.employees WHERE location_id = v_loc_centro;

  RAISE NOTICE 'Step 2 OK: 90 employees created';
END $$;

-- ============================================================
-- STEP 3: LINK AUTH USERS → EMPLOYEES + FIX PROFILES + USER_LOCATIONS
-- ============================================================
DO $$
DECLARE
  v_group_id uuid;
  v_loc_centro uuid;
  v_loc_chamberi uuid;
  v_emp_user uuid;
  v_mgr_centro_user uuid;
  v_mgr_sala_user uuid;
  v_owner_user uuid;
  v_employee_role_id uuid;
BEGIN
  SELECT id INTO v_group_id FROM public.groups LIMIT 1;
  SELECT id INTO v_loc_centro FROM public.locations WHERE name = 'La Taberna Centro';
  SELECT id INTO v_loc_chamberi FROM public.locations WHERE name = 'Chamberí';
  SELECT id INTO v_employee_role_id FROM public.roles WHERE name = 'employee';

  -- Get auth user IDs
  SELECT id INTO v_emp_user FROM auth.users WHERE email = 'employee.centro@demo.com';
  SELECT id INTO v_mgr_centro_user FROM auth.users WHERE email = 'manager.centro@demo.com';
  SELECT id INTO v_mgr_sala_user FROM auth.users WHERE email = 'manager.salamanca@demo.com';
  SELECT id INTO v_owner_user FROM auth.users WHERE email = 'owner@demo.com';

  -- Update ALL profiles with the correct group_id
  UPDATE public.profiles SET group_id = v_group_id WHERE group_id IS NULL OR group_id != v_group_id;

  -- Link employee.centro@demo.com → Server at Centro
  IF v_emp_user IS NOT NULL THEN
    UPDATE public.employees
    SET user_id = v_emp_user
    WHERE id = (
      SELECT id FROM public.employees
      WHERE location_id = v_loc_centro AND role_name = 'Server' AND user_id IS NULL AND active = true
      LIMIT 1
    );

    -- Ensure user_locations entry
    INSERT INTO public.user_locations (user_id, location_id)
    VALUES (v_emp_user, v_loc_centro)
    ON CONFLICT (user_id, location_id) DO NOTHING;

    -- Update user_roles location_id if employee role exists
    UPDATE public.user_roles SET location_id = v_loc_centro
    WHERE user_id = v_emp_user AND role_id = v_employee_role_id AND location_id IS DISTINCT FROM v_loc_centro;

    RAISE NOTICE 'Linked employee.centro@demo.com';
  END IF;

  -- Link manager.centro@demo.com → Manager at Centro
  IF v_mgr_centro_user IS NOT NULL THEN
    UPDATE public.employees
    SET user_id = v_mgr_centro_user
    WHERE id = (
      SELECT id FROM public.employees
      WHERE location_id = v_loc_centro AND role_name = 'Manager' AND user_id IS NULL AND active = true
      LIMIT 1
    );

    INSERT INTO public.user_locations (user_id, location_id)
    VALUES (v_mgr_centro_user, v_loc_centro)
    ON CONFLICT (user_id, location_id) DO NOTHING;

    RAISE NOTICE 'Linked manager.centro@demo.com';
  END IF;

  -- Link manager.salamanca@demo.com → Manager at Chamberí
  IF v_mgr_sala_user IS NOT NULL THEN
    UPDATE public.employees
    SET user_id = v_mgr_sala_user
    WHERE id = (
      SELECT id FROM public.employees
      WHERE location_id = v_loc_chamberi AND role_name = 'Manager' AND user_id IS NULL AND active = true
      LIMIT 1
    );

    INSERT INTO public.user_locations (user_id, location_id)
    VALUES (v_mgr_sala_user, v_loc_chamberi)
    ON CONFLICT (user_id, location_id) DO NOTHING;

    RAISE NOTICE 'Linked manager.salamanca@demo.com';
  END IF;

  -- Give owner access to all locations
  IF v_owner_user IS NOT NULL THEN
    INSERT INTO public.user_locations (user_id, location_id)
    SELECT v_owner_user, id FROM public.locations
    ON CONFLICT (user_id, location_id) DO NOTHING;
    RAISE NOTICE 'Linked owner@demo.com to all locations';
  END IF;

  RAISE NOTICE 'Step 3 OK: Auth users linked';
END $$;

-- ============================================================
-- STEP 4: PLANNED SHIFTS (28 days: -14 to +14, all 8h)
-- ============================================================
DELETE FROM public.planned_shifts
WHERE shift_date >= CURRENT_DATE - INTERVAL '14 days'
AND shift_date <= CURRENT_DATE + INTERVAL '14 days';

DO $$
DECLARE
  emp RECORD;
  d DATE;
  shift_start TIME;
  shift_end TIME;
  shift_type INT;
BEGIN
  FOR emp IN
    SELECT e.id AS employee_id, e.location_id, e.role_name, e.hourly_cost
    FROM public.employees e WHERE e.active = true
  LOOP
    FOR d IN
      SELECT dd::date FROM generate_series(
        CURRENT_DATE - INTERVAL '14 days',
        CURRENT_DATE + INTERVAL '14 days',
        INTERVAL '1 day'
      ) dd
    LOOP
      -- ~5 days/week: skip 2 days
      IF abs(hashtext(emp.employee_id::text || d::text)) % 7 < 2 THEN
        CONTINUE;
      END IF;

      shift_type := abs(hashtext(emp.employee_id::text || d::text || 'shift')) % 3;

      -- All shifts are exactly 8 hours (database trigger requirement)
      CASE emp.role_name
        WHEN 'Chef' THEN
          IF shift_type = 0 THEN shift_start := '08:00'; shift_end := '16:00';
          ELSIF shift_type = 1 THEN shift_start := '15:00'; shift_end := '23:00';
          ELSE shift_start := '09:00'; shift_end := '17:00';
          END IF;
        WHEN 'Manager' THEN
          IF shift_type = 0 THEN shift_start := '10:00'; shift_end := '18:00';
          ELSIF shift_type = 1 THEN shift_start := '14:00'; shift_end := '22:00';
          ELSE shift_start := '11:00'; shift_end := '19:00';
          END IF;
        WHEN 'Server' THEN
          IF shift_type = 0 THEN shift_start := '12:00'; shift_end := '20:00';
          ELSIF shift_type = 1 THEN shift_start := '15:00'; shift_end := '23:00';
          ELSE shift_start := '10:00'; shift_end := '18:00';
          END IF;
        WHEN 'Bartender' THEN
          IF shift_type = 0 THEN shift_start := '15:00'; shift_end := '23:00';
          ELSIF shift_type = 1 THEN shift_start := '12:00'; shift_end := '20:00';
          ELSE shift_start := '16:00'; shift_end := '00:00';
          END IF;
        WHEN 'Host' THEN
          IF shift_type = 0 THEN shift_start := '12:00'; shift_end := '20:00';
          ELSIF shift_type = 1 THEN shift_start := '15:00'; shift_end := '23:00';
          ELSE shift_start := '10:00'; shift_end := '18:00';
          END IF;
        ELSE
          shift_start := '10:00'; shift_end := '18:00';
      END CASE;

      INSERT INTO public.planned_shifts (
        employee_id, location_id, shift_date, start_time, end_time,
        planned_hours, planned_cost, role, status
      ) VALUES (
        emp.employee_id, emp.location_id, d, shift_start, shift_end,
        8, 8 * COALESCE(emp.hourly_cost, 14), emp.role_name, 'published'
      );
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Step 4 OK: Planned shifts created';
END $$;

-- ============================================================
-- STEP 5: CLOCK RECORDS (past 14 days)
-- ============================================================
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
    variance_in := abs(hashtext(shift.employee_id::text || shift.shift_date::text || 'in')) % 8;
    variance_out := abs(hashtext(shift.employee_id::text || shift.shift_date::text || 'out')) % 12;

    clock_in_ts := (shift.shift_date + shift.start_time)::timestamptz - (variance_in || ' minutes')::interval;

    IF shift.end_time < shift.start_time THEN
      clock_out_ts := (shift.shift_date + INTERVAL '1 day' + shift.end_time)::timestamptz + (variance_out || ' minutes')::interval;
    ELSE
      clock_out_ts := (shift.shift_date + shift.end_time)::timestamptz + (variance_out || ' minutes')::interval;
    END IF;

    INSERT INTO public.employee_clock_records (
      employee_id, location_id, clock_in, clock_out, source
    ) VALUES (
      shift.employee_id, shift.location_id, clock_in_ts, clock_out_ts,
      CASE WHEN abs(hashtext(shift.employee_id::text || shift.shift_date::text)) % 3 = 0 THEN 'geo' ELSE 'manual' END
    );
  END LOOP;

  RAISE NOTICE 'Step 5 OK: Clock records created';
END $$;

-- ============================================================
-- STEP 6: ANNOUNCEMENTS
-- ============================================================
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

DELETE FROM public.announcements;

INSERT INTO public.announcements (title, body, type, pinned, author, location_id, created_at) VALUES
(
  'Horario especial San Valentín',
  'El 14 de febrero abrimos de 12:00 a 01:00. Se necesita personal extra para el turno de noche. Si estás disponible, habla con tu encargado.',
  'schedule', true, 'Dirección',
  (SELECT id FROM public.locations WHERE name = 'La Taberna Centro' LIMIT 1),
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
  (SELECT id FROM public.locations WHERE name = 'La Taberna Centro' LIMIT 1),
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
  'Carlos busca cambio de turno para el viernes 14. Turno de tarde (15:00-23:00) por turno de mañana. Contactad con él directamente.',
  'schedule', false, 'Carlos García',
  (SELECT id FROM public.locations WHERE name = 'La Taberna Centro' LIMIT 1),
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

-- ============================================================
-- STEP 7: SEED DASHBOARD DATA (sales + labour)
-- ============================================================
DO $$
DECLARE
  v_group_id uuid;
  v_loc_centro uuid;
  v_loc_chamberi uuid;
  v_loc_malasana uuid;
BEGIN
  SELECT id INTO v_group_id FROM public.groups LIMIT 1;
  SELECT id INTO v_loc_centro FROM public.locations WHERE name = 'La Taberna Centro';
  SELECT id INTO v_loc_chamberi FROM public.locations WHERE name = 'Chamberí';
  SELECT id INTO v_loc_malasana FROM public.locations WHERE name = 'Malasaña';

  -- Clean existing dashboard data
  DELETE FROM public.facts_sales_15m WHERE location_id IN (v_loc_centro, v_loc_chamberi, v_loc_malasana);
  DELETE FROM public.facts_labor_daily WHERE location_id IN (v_loc_centro, v_loc_chamberi, v_loc_malasana);

  -- CDM Items
  DELETE FROM public.cdm_items WHERE location_id IN (v_loc_centro, v_loc_chamberi, v_loc_malasana);
  INSERT INTO public.cdm_items (org_id, location_id, name, category_name, unit_price, cost_price, active) VALUES
    (v_group_id, v_loc_centro, 'Paella Valenciana', 'Food', 24.50, 8.20, true),
    (v_group_id, v_loc_centro, 'Jamón Ibérico', 'Food', 18.90, 11.40, true),
    (v_group_id, v_loc_centro, 'Chuletón de Buey', 'Food', 38.50, 19.20, true),
    (v_group_id, v_loc_centro, 'Pulpo a la Gallega', 'Food', 22.80, 9.10, true),
    (v_group_id, v_loc_centro, 'Bacalao Pil-Pil', 'Food', 26.50, 10.60, true),
    (v_group_id, v_loc_centro, 'Rioja Reserva', 'Beverage', 28.00, 9.50, true),
    (v_group_id, v_loc_centro, 'Cerveza Alhambra', 'Beverage', 4.50, 1.20, true);

  INSERT INTO public.cdm_items (org_id, location_id, name, category_name, unit_price, cost_price, active)
  SELECT v_group_id, v_loc_chamberi, name, category_name, unit_price * 0.95, cost_price * 0.95, active
  FROM public.cdm_items WHERE location_id = v_loc_centro;

  INSERT INTO public.cdm_items (org_id, location_id, name, category_name, unit_price, cost_price, active)
  SELECT v_group_id, v_loc_malasana, name, category_name, unit_price * 0.90, cost_price * 0.90, active
  FROM public.cdm_items WHERE location_id = v_loc_centro;

  -- Sales data (30 days)
  INSERT INTO public.facts_sales_15m (location_id, ts_bucket, sales_gross, sales_net, tickets, covers)
  SELECT
    loc.id,
    ts,
    (CASE
      WHEN EXTRACT(DOW FROM ts) IN (5, 6) THEN 350
      WHEN EXTRACT(DOW FROM ts) IN (2, 3) THEN 190
      ELSE 270
    END *
    CASE
      WHEN EXTRACT(HOUR FROM ts) BETWEEN 12 AND 14 THEN 1.5
      WHEN EXTRACT(HOUR FROM ts) BETWEEN 19 AND 21 THEN 1.6
      WHEN EXTRACT(HOUR FROM ts) IN (10, 11, 22, 23) THEN 0.4
      ELSE 0.8
    END *
    CASE loc.name
      WHEN 'La Taberna Centro' THEN 1.1
      WHEN 'Chamberí' THEN 1.0
      WHEN 'Malasaña' THEN 0.9
    END *
    (0.9 + random() * 0.2)),
    (CASE
      WHEN EXTRACT(DOW FROM ts) IN (5, 6) THEN 350
      WHEN EXTRACT(DOW FROM ts) IN (2, 3) THEN 190
      ELSE 270
    END *
    CASE
      WHEN EXTRACT(HOUR FROM ts) BETWEEN 12 AND 14 THEN 1.5
      WHEN EXTRACT(HOUR FROM ts) BETWEEN 19 AND 21 THEN 1.6
      WHEN EXTRACT(HOUR FROM ts) IN (10, 11, 22, 23) THEN 0.4
      ELSE 0.8
    END *
    CASE loc.name
      WHEN 'La Taberna Centro' THEN 1.1
      WHEN 'Chamberí' THEN 1.0
      WHEN 'Malasaña' THEN 0.9
    END *
    (0.9 + random() * 0.2) * 0.95),
    FLOOR(random() * 3 + 1)::int,
    FLOOR(random() * 4 + 1)::int
  FROM
    generate_series(
      CURRENT_DATE - INTERVAL '30 days',
      CURRENT_DATE - INTERVAL '1 day',
      INTERVAL '15 minutes'
    ) ts,
    (SELECT id, name FROM public.locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')) loc
  WHERE EXTRACT(HOUR FROM ts) BETWEEN 10 AND 23;

  -- Labour daily
  INSERT INTO public.facts_labor_daily (location_id, day, scheduled_hours, actual_hours, labor_cost_est, overtime_hours)
  SELECT
    location_id,
    DATE(ts_bucket),
    SUM(sales_net) * 0.028 / 14.5,
    SUM(sales_net) * 0.030 / 14.5,
    SUM(sales_net) * 0.030,
    GREATEST(0, SUM(sales_net) * 0.030 / 14.5 - SUM(sales_net) * 0.028 / 14.5)
  FROM public.facts_sales_15m
  WHERE location_id IN (v_loc_centro, v_loc_chamberi, v_loc_malasana)
  GROUP BY location_id, DATE(ts_bucket);

  RAISE NOTICE 'Step 7 OK: Dashboard data created';
END $$;

COMMIT;
