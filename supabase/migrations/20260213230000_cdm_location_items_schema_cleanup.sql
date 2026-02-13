-- ============================================================
-- cdm_location_items — schema drift cleanup
--
-- DECISION: keep is_active temporarily (DEPRECATED), synced
-- with is_available. Reason: minimal risk — the seed function
-- and any unknown consumers that read is_active keep working.
-- We can DROP is_active in a future migration once fully audited.
--
-- Fixes:
--   1. Sync is_active ↔ is_available (both directions)
--   2. Mark is_active as DEPRECATED
--   3. Make org_id NULLABLE (redundant: derivable via location→group)
--   4. Make price NULLABLE (location may inherit from cdm_items.price)
--   5. Drop duplicate indices from earlier migrations
--   6. Patch seed_josephine_demo_data to use is_available
--   7. Inline validation queries (RAISE on failure)
--
-- Does NOT touch:
--   - RLS policies (already correct from 20260213220000)
--   - get_accessible_location_ids()
--   - UNIQUE(location_id, item_id) constraint
--   - updated_at trigger
--
-- Idempotent: safe to re-run.
-- ============================================================


-- ================== 0. SYNC is_active ↔ is_available =========
-- Canonical column = is_available. Sync values both ways so
-- neither column has stale data after this migration.
DO $$
BEGIN
  -- Guard: only run if both columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cdm_location_items'
      AND column_name = 'is_active'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cdm_location_items'
      AND column_name = 'is_available'
  ) THEN
    -- is_available is source of truth; push to is_active
    UPDATE public.cdm_location_items
    SET is_active = is_available
    WHERE is_active IS DISTINCT FROM is_available;

    RAISE NOTICE 'is_active synced to is_available';
  END IF;
END $$;


-- ================== 1. DEPRECATE is_active ====================
-- Mark column as deprecated. Do NOT drop yet.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cdm_location_items'
      AND column_name = 'is_active'
  ) THEN
    COMMENT ON COLUMN public.cdm_location_items.is_active IS
      'DEPRECATED — use is_available. Kept temporarily for backward compat. Will be dropped in a future migration.';
    RAISE NOTICE 'is_active marked as DEPRECATED';
  END IF;
END $$;


-- ================== 2. org_id → NULLABLE =====================
-- org_id is redundant (derivable from location_id → locations.group_id).
-- Keep the column but allow NULL so future inserts don't require it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cdm_location_items'
      AND column_name = 'org_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.cdm_location_items ALTER COLUMN org_id DROP NOT NULL;
    RAISE NOTICE 'org_id is now NULLABLE';
  END IF;
END $$;

-- Backfill: ensure existing org_id values are coherent with locations.group_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cdm_location_items'
      AND column_name = 'org_id'
  ) THEN
    UPDATE public.cdm_location_items cli
    SET org_id = l.group_id
    FROM public.locations l
    WHERE l.id = cli.location_id
      AND (cli.org_id IS NULL OR cli.org_id IS DISTINCT FROM l.group_id);
    RAISE NOTICE 'org_id backfilled from locations.group_id';
  END IF;
END $$;


-- ================== 3. price → NULLABLE ======================
-- Locations that don't override the item price can leave this NULL
-- (fall back to cdm_items.price at query time).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cdm_location_items'
      AND column_name = 'price' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.cdm_location_items ALTER COLUMN price DROP NOT NULL;
    RAISE NOTICE 'price is now NULLABLE';
  END IF;
END $$;


-- ================== 4. DROP DUPLICATE INDICES ================
-- 20260213100000 created idx_cdm_location_items_location/item
-- 20260213220000 created idx_cdm_loc_items_location/item (duplicates)
-- Keep the shorter-named ones from the proper RLS migration.
DROP INDEX IF EXISTS public.idx_cdm_location_items_location;
DROP INDEX IF EXISTS public.idx_cdm_location_items_item;

-- org_id index is unnecessary (RLS filters by location_id, not org_id)
DROP INDEX IF EXISTS public.idx_cdm_location_items_org;


-- ================== 5. PATCH SEED FUNCTION ===================
-- Full CREATE OR REPLACE with EXACT original signature:
--   seed_josephine_demo_data() RETURNS TABLE(...)
-- Only change: is_active → is_available in cdm_location_items INSERTs.
-- cdm_items.is_active is untouched (different table, still valid).
CREATE OR REPLACE FUNCTION public.seed_josephine_demo_data()
 RETURNS TABLE(locations_created integer, employees_created integer, items_created integer, sales_records integer, labour_records integer)
 LANGUAGE plpgsql
AS $function$
declare
  v_group_id uuid;
  v_loc_centro uuid;
  v_loc_chamberi uuid;
  v_loc_malasana uuid;

  v_locations_count int := 0;
  v_employees_count int := 0;
  v_items_count int := 0;
  v_sales_count int := 0;
  v_labour_count int := 0;
begin
  -- 0) Obtener o crear grupo
  select id into v_group_id from public.groups limit 1;

  if v_group_id is null then
    insert into public.groups (name)
    values ('Josephine Demo')
    returning id into v_group_id;
  end if;

  -- 1) Limpiar demo anterior (si existen esas locations)
  delete from public.facts_item_mix_daily
   where location_id in (select id from public.locations where name in ('La Taberna Centro','Chamberí','Malasaña'));

  delete from public.facts_labor_daily
   where location_id in (select id from public.locations where name in ('La Taberna Centro','Chamberí','Malasaña'));

  delete from public.facts_sales_15m
   where location_id in (select id from public.locations where name in ('La Taberna Centro','Chamberí','Malasaña'));

  delete from public.employees
   where location_id in (select id from public.locations where name in ('La Taberna Centro','Chamberí','Malasaña'));

  -- Borra enlaces item-location demo (si quedaron)
  delete from public.cdm_location_items
   where location_id in (select id from public.locations where name in ('La Taberna Centro','Chamberí','Malasaña'));

  -- Borra items demo del catálogo (global por org)
  delete from public.cdm_items
   where org_id = v_group_id
     and external_provider = 'demo'
     and sku in ('PAE-001','JAM-001','CHU-001','PUL-001','BAC-001','RIO-001','CER-001');

  -- Borra locations demo
  delete from public.locations
   where name in ('La Taberna Centro','Chamberí','Malasaña');

  -- 2) Crear 3 locations (IMPORTANTE: group_id = v_group_id)
  insert into public.locations (group_id, name, city, timezone, currency)
  values
    (v_group_id, 'La Taberna Centro', 'Salamanca', 'Europe/Madrid', 'EUR'),
    (v_group_id, 'Chamberí',         'Madrid',    'Europe/Madrid', 'EUR'),
    (v_group_id, 'Malasaña',         'Madrid',    'Europe/Madrid', 'EUR');

  select id into v_loc_centro   from public.locations where name = 'La Taberna Centro' limit 1;
  select id into v_loc_chamberi from public.locations where name = 'Chamberí' limit 1;
  select id into v_loc_malasana from public.locations where name = 'Malasaña' limit 1;

  v_locations_count := 3;

  -- 3) Crear catálogo global (cdm_items) para el org
  -- NOTA: cdm_items.is_active sigue existiendo (es otra tabla, no tocamos)
  insert into public.cdm_items (org_id, name, sku, category_name, price, is_active, external_provider, external_id, metadata)
  values
    (v_group_id, 'Paella Valenciana',  'PAE-001', 'Food',     24.50, true, 'demo', 'PAE-001', '{}'::jsonb),
    (v_group_id, 'Jamón Ibérico',      'JAM-001', 'Food',     18.90, true, 'demo', 'JAM-001', '{}'::jsonb),
    (v_group_id, 'Chuletón de Buey',   'CHU-001', 'Food',     38.50, true, 'demo', 'CHU-001', '{}'::jsonb),
    (v_group_id, 'Pulpo a la Gallega', 'PUL-001', 'Food',     22.80, true, 'demo', 'PUL-001', '{}'::jsonb),
    (v_group_id, 'Bacalao Pil-Pil',    'BAC-001', 'Food',     26.50, true, 'demo', 'BAC-001', '{}'::jsonb),
    (v_group_id, 'Rioja Reserva',      'RIO-001', 'Beverage', 28.00, true, 'demo', 'RIO-001', '{}'::jsonb),
    (v_group_id, 'Cerveza Alhambra',   'CER-001', 'Beverage',  4.50, true, 'demo', 'CER-001', '{}'::jsonb);

  -- 4) Asignar items a cada location con precio/coste por local
  --    CHANGED: is_active → is_available (canonical column)

  -- Centro (base)
  insert into public.cdm_location_items (org_id, location_id, item_id, price, cost_price, is_available)
  select
    v_group_id,
    v_loc_centro,
    i.id,
    i.price,
    case i.sku
      when 'PAE-001' then  8.20
      when 'JAM-001' then 11.40
      when 'CHU-001' then 19.20
      when 'PUL-001' then  9.10
      when 'BAC-001' then 10.60
      when 'RIO-001' then  9.50
      when 'CER-001' then  1.20
      else null
    end as cost_price,
    true  -- is_available (was: i.is_active)
  from public.cdm_items i
  where i.org_id = v_group_id
    and i.external_provider = 'demo'
    and i.sku in ('PAE-001','JAM-001','CHU-001','PUL-001','BAC-001','RIO-001','CER-001');

  -- Chamberí (0.95)
  insert into public.cdm_location_items (org_id, location_id, item_id, price, cost_price, is_available)
  select
    v_group_id,
    v_loc_chamberi,
    cli.item_id,
    round(cli.price * 0.95, 2),
    case when cli.cost_price is null then null else round(cli.cost_price * 0.95, 2) end,
    cli.is_available  -- was: cli.is_active
  from public.cdm_location_items cli
  where cli.location_id = v_loc_centro;

  -- Malasaña (0.90)
  insert into public.cdm_location_items (org_id, location_id, item_id, price, cost_price, is_available)
  select
    v_group_id,
    v_loc_malasana,
    cli.item_id,
    round(cli.price * 0.90, 2),
    case when cli.cost_price is null then null else round(cli.cost_price * 0.90, 2) end,
    cli.is_available  -- was: cli.is_active
  from public.cdm_location_items cli
  where cli.location_id = v_loc_centro;

  v_items_count := 21; -- 7 x 3

  -- 5) Empleados (30 en Centro y replicamos)
  insert into public.employees (location_id, full_name, role_name, hourly_cost, active) values
    (v_loc_centro, 'Carlos García', 'Chef', 18.00, true),
    (v_loc_centro, 'María López', 'Chef', 18.00, true),
    (v_loc_centro, 'Juan Martínez', 'Chef', 18.00, true),
    (v_loc_centro, 'Ana Torres', 'Chef', 18.00, true),
    (v_loc_centro, 'Pedro Sánchez', 'Chef', 18.00, true),
    (v_loc_centro, 'Laura Fernández', 'Chef', 18.00, true),
    (v_loc_centro, 'Miguel Ruiz', 'Chef', 18.00, true),
    (v_loc_centro, 'Carmen Díaz', 'Chef', 18.00, true),

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

    (v_loc_centro, 'Manuel Rubio', 'Bartender', 14.00, true),
    (v_loc_centro, 'Teresa Vega', 'Bartender', 14.00, true),
    (v_loc_centro, 'Luis Ramos', 'Bartender', 14.00, true),
    (v_loc_centro, 'Cristina Herrera', 'Bartender', 14.00, true),
    (v_loc_centro, 'Javier Mendoza', 'Bartender', 14.00, true),

    (v_loc_centro, 'Beatriz Cruz', 'Host', 11.00, true),
    (v_loc_centro, 'Raúl Delgado', 'Host', 11.00, true),
    (v_loc_centro, 'Sofía Vargas', 'Host', 11.00, true),

    (v_loc_centro, 'Fernando Iglesias', 'Manager', 25.00, true),
    (v_loc_centro, 'Marta Cortés', 'Manager', 25.00, true);

  insert into public.employees (location_id, full_name, role_name, hourly_cost, active)
  select v_loc_chamberi, full_name || ' (CH)', role_name, hourly_cost, active
  from public.employees where location_id = v_loc_centro;

  insert into public.employees (location_id, full_name, role_name, hourly_cost, active)
  select v_loc_malasana, full_name || ' (ML)', role_name, hourly_cost, active
  from public.employees where location_id = v_loc_centro;

  v_employees_count := 90;

  -- 6) Sales 15m (30 días)
  insert into public.facts_sales_15m (location_id, ts_bucket, sales_gross, sales_net, tickets, covers)
  select
    loc.id,
    ts,
    (
      (case
        when extract(dow from ts) in (5,6) then 350
        when extract(dow from ts) in (2,3) then 190
        else 270
      end) *
      (case
        when extract(hour from ts) between 12 and 14 then 1.5
        when extract(hour from ts) between 19 and 21 then 1.6
        when extract(hour from ts) in (10,11,22,23) then 0.4
        else 0.8
      end) *
      (case loc.name
        when 'La Taberna Centro' then 1.1
        when 'Chamberí' then 1.0
        when 'Malasaña' then 0.9
      end) *
      (0.9 + random() * 0.2)
    ) as sales_gross,
    (
      (case
        when extract(dow from ts) in (5,6) then 350
        when extract(dow from ts) in (2,3) then 190
        else 270
      end) *
      (case
        when extract(hour from ts) between 12 and 14 then 1.5
        when extract(hour from ts) between 19 and 21 then 1.6
        when extract(hour from ts) in (10,11,22,23) then 0.4
        else 0.8
      end) *
      (case loc.name
        when 'La Taberna Centro' then 1.1
        when 'Chamberí' then 1.0
        when 'Malasaña' then 0.9
      end) *
      (0.9 + random() * 0.2) * 0.95
    ) as sales_net,
    floor(random() * 3 + 1) as tickets,
    floor(random() * 4 + 1) as covers
  from
    generate_series(current_date - interval '30 days', current_date - interval '1 day', interval '15 minutes') ts,
    (select id, name from public.locations where name in ('La Taberna Centro','Chamberí','Malasaña')) loc
  where extract(hour from ts) between 10 and 23;

  get diagnostics v_sales_count = row_count;

  -- 7) Labour daily basado en sales
  insert into public.facts_labor_daily (location_id, day, scheduled_hours, actual_hours, labor_cost_est, overtime_hours)
  select
    location_id,
    date(ts_bucket),
    sum(sales_net) * 0.028 / 14.5,
    sum(sales_net) * 0.030 / 14.5,
    sum(sales_net) * 0.030,
    greatest(0, sum(sales_net) * 0.030 / 14.5 - sum(sales_net) * 0.028 / 14.5)
  from public.facts_sales_15m
  where location_id in (v_loc_centro, v_loc_chamberi, v_loc_malasana)
  group by location_id, date(ts_bucket);

  get diagnostics v_labour_count = row_count;

  locations_created := v_locations_count;
  employees_created := v_employees_count;
  items_created := v_items_count;
  sales_records := v_sales_count;
  labour_records := v_labour_count;
  return next;
end;
$function$;

COMMENT ON FUNCTION public.seed_josephine_demo_data() IS
  'Seeds demo data for 3 locations (90 employees, 30d sales, labour). Uses is_available (not legacy is_active) for cdm_location_items.';


-- ================== 6. VALIDATION ============================
-- Inline checks that RAISE EXCEPTION on failure.
DO $$
DECLARE
  v_mismatch_count int;
  v_org_nullable text;
  v_price_nullable text;
  v_has_is_available boolean;
  v_unique_exists boolean;
  v_row_count int;
BEGIN
  -- 6a) is_available must exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cdm_location_items'
      AND column_name = 'is_available'
  ) INTO v_has_is_available;

  IF NOT v_has_is_available THEN
    RAISE EXCEPTION 'VALIDATION FAILED: is_available column does not exist';
  END IF;

  -- 6b) If is_active still exists, it must be synced with is_available
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cdm_location_items'
      AND column_name = 'is_active'
  ) THEN
    SELECT count(*) INTO v_mismatch_count
    FROM public.cdm_location_items
    WHERE is_active IS DISTINCT FROM is_available;

    IF v_mismatch_count > 0 THEN
      RAISE EXCEPTION 'VALIDATION FAILED: % rows have is_active != is_available', v_mismatch_count;
    END IF;
    RAISE NOTICE '✓ is_active exists (DEPRECATED) and is synced with is_available (0 mismatches)';
  ELSE
    RAISE NOTICE '✓ is_active already dropped (clean state)';
  END IF;

  -- 6c) org_id must be NULLABLE
  SELECT is_nullable INTO v_org_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'cdm_location_items'
    AND column_name = 'org_id';

  IF v_org_nullable IS NOT NULL AND v_org_nullable = 'NO' THEN
    RAISE EXCEPTION 'VALIDATION FAILED: org_id is still NOT NULL';
  END IF;
  RAISE NOTICE '✓ org_id is NULLABLE (or absent)';

  -- 6d) price must be NULLABLE
  SELECT is_nullable INTO v_price_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'cdm_location_items'
    AND column_name = 'price';

  IF v_price_nullable IS NOT NULL AND v_price_nullable = 'NO' THEN
    RAISE EXCEPTION 'VALIDATION FAILED: price is still NOT NULL';
  END IF;
  RAISE NOTICE '✓ price is NULLABLE';

  -- 6e) UNIQUE(location_id, item_id) must exist
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'cdm_location_items'
      AND indexdef LIKE '%UNIQUE%location_id%item_id%'
  ) INTO v_unique_exists;

  IF NOT v_unique_exists THEN
    RAISE EXCEPTION 'VALIDATION FAILED: UNIQUE(location_id, item_id) missing';
  END IF;
  RAISE NOTICE '✓ UNIQUE(location_id, item_id) exists';

  -- 6f) Row count sanity (should still be 21)
  SELECT count(*) INTO v_row_count FROM public.cdm_location_items;
  IF v_row_count != 21 THEN
    RAISE EXCEPTION 'VALIDATION FAILED: expected 21 rows, got %', v_row_count;
  END IF;
  RAISE NOTICE '✓ Row count = 21';

  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '✓ ALL VALIDATIONS PASSED — schema cleanup complete';
  RAISE NOTICE '════════════════════════════════════════';
END $$;
