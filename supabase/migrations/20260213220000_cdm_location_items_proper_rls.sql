-- ============================================================
-- cdm_location_items — proper table + multi-tenant RLS
--
-- Bridge table: which cdm_items are available at which
-- locations, with location-specific pricing/cost.
--
-- Replaces the permissive USING(true) policy created in
-- 20260213100000_guard_cdm_items_schema.sql with real
-- multi-tenant RLS that enforces:
--   READ  → user belongs to same group + has location access
--   WRITE → same + user has a write-capable role
--
-- Write roles: owner, admin, ops_manager, store_manager
-- Read-only:   finance, hr_payroll, employee, viewer
--
-- Depends on:
--   - public.get_accessible_location_ids()
--   - public.roles (name-based RBAC)
--   - public.user_roles (role_id FK + location_id scope)
--   - public.trigger_set_updated_at()
-- ============================================================

-- ===================== 0. SCHEMA GUARD =====================
-- Assert cdm_items has org_id, NOT location_id.
-- Wrapped in a DO block so it won't break envs where
-- cdm_items doesn't exist yet (e.g. fresh local dev).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cdm_items'
  ) THEN
    -- org_id must exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'cdm_items'
        AND column_name  = 'org_id'
    ) THEN
      RAISE EXCEPTION 'cdm_items is missing org_id — schema is broken';
    END IF;

    -- location_id must NOT exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'cdm_items'
        AND column_name  = 'location_id'
    ) THEN
      RAISE EXCEPTION 'cdm_items has location_id — items are org-scoped; use cdm_location_items';
    END IF;
  END IF;
END $$;


-- ================== 1. TABLE (idempotent) ==================
CREATE TABLE IF NOT EXISTS public.cdm_location_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID        NOT NULL REFERENCES public.locations(id)  ON DELETE CASCADE,
  item_id       UUID        NOT NULL REFERENCES public.cdm_items(id)  ON DELETE CASCADE,
  price         NUMERIC     NULL,
  cost_price    NUMERIC     NULL,
  is_available  BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, item_id)
);

-- Idempotent column adds (in case table was created with fewer cols)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'cdm_location_items'
      AND column_name  = 'cost_price'
  ) THEN
    ALTER TABLE public.cdm_location_items ADD COLUMN cost_price NUMERIC NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'cdm_location_items'
      AND column_name  = 'is_available'
  ) THEN
    ALTER TABLE public.cdm_location_items
      ADD COLUMN is_available BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;


-- ===================== 2. INDICES ==========================
CREATE INDEX IF NOT EXISTS idx_cdm_loc_items_location
  ON public.cdm_location_items(location_id);

CREATE INDEX IF NOT EXISTS idx_cdm_loc_items_item
  ON public.cdm_location_items(item_id);

CREATE INDEX IF NOT EXISTS idx_cdm_loc_items_available
  ON public.cdm_location_items(location_id)
  WHERE is_available = true;


-- ================= 3. TRIGGER updated_at ===================
-- Reuse the repo-standard trigger_set_updated_at() function.
DROP TRIGGER IF EXISTS set_cdm_location_items_updated_at
  ON public.cdm_location_items;

CREATE TRIGGER set_cdm_location_items_updated_at
  BEFORE UPDATE ON public.cdm_location_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();


-- ======================= 4. RLS ============================
ALTER TABLE public.cdm_location_items ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (prevents bypass via service_role
-- being accidentally used in app code that should respect RLS).
ALTER TABLE public.cdm_location_items FORCE ROW LEVEL SECURITY;

-- 4a. Drop ALL existing policies (clean slate)
DO $$
DECLARE
  _pol RECORD;
BEGIN
  FOR _pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'cdm_location_items'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.cdm_location_items',
      _pol.policyname
    );
  END LOOP;
END $$;


-- 4b. SELECT — multi-tenant + location access
-- Uses get_accessible_location_ids() which already enforces:
--   - location.group_id = user's group_id (multi-tenant)
--   - is_owner() OR is_admin_or_ops() OR user_locations match
CREATE POLICY "cdm_loc_items_select"
  ON public.cdm_location_items
  FOR SELECT
  TO authenticated
  USING (
    location_id IN (SELECT public.get_accessible_location_ids())
  );


-- 4c. INSERT — location access + write role
CREATE POLICY "cdm_loc_items_insert"
  ON public.cdm_location_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must have access to the target location
    location_id IN (SELECT public.get_accessible_location_ids())
    -- Must have a write-capable role
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('owner', 'admin', 'ops_manager', 'store_manager')
    )
  );


-- 4d. UPDATE — location access + write role (both USING and WITH CHECK)
CREATE POLICY "cdm_loc_items_update"
  ON public.cdm_location_items
  FOR UPDATE
  TO authenticated
  USING (
    location_id IN (SELECT public.get_accessible_location_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('owner', 'admin', 'ops_manager', 'store_manager')
    )
  )
  WITH CHECK (
    location_id IN (SELECT public.get_accessible_location_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('owner', 'admin', 'ops_manager', 'store_manager')
    )
  );


-- 4e. DELETE — location access + write role
CREATE POLICY "cdm_loc_items_delete"
  ON public.cdm_location_items
  FOR DELETE
  TO authenticated
  USING (
    location_id IN (SELECT public.get_accessible_location_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('owner', 'admin', 'ops_manager', 'store_manager')
    )
  );


-- ===================== 5. COMMENTS =========================
COMMENT ON TABLE public.cdm_location_items IS
  'Bridge: which cdm_items are available at which locations, with location-specific pricing. RLS enforces multi-tenant isolation + role-based write access.';

COMMENT ON COLUMN public.cdm_location_items.price IS
  'Location-specific selling price (overrides cdm_items.price if set)';

COMMENT ON COLUMN public.cdm_location_items.cost_price IS
  'Location-specific cost price for margin calculations';

COMMENT ON COLUMN public.cdm_location_items.is_available IS
  'Whether this item is currently available at this location';


-- ===================== 6. GRANTS ===========================
-- authenticated can interact (RLS policies control what they see/do)
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.cdm_location_items
  TO authenticated;
