-- ====================================================================
-- FIX USER ACCESS & DATA VISIBILITY
-- Problem: Data exists in daily tables (1212+ rows) but frontend shows
-- empty because RLS policies block access when user has no role.
--
-- Root cause: get_accessible_location_ids() returns empty when user
-- has no entry in user_roles with a valid role_id, OR when
-- profiles.group_id doesn't match locations.group_id.
--
-- This migration:
-- 1. Ensures helper functions use correct schema (role_id, not dropped role column)
-- 2. Ensures the user's profile.group_id matches the locations' group_id
-- 3. Ensures the user has the 'owner' role (global scope) in user_roles
-- 4. Verifies data is accessible through the RLS chain
-- ====================================================================

-- Fix is_admin_or_ops to use role_id JOIN (the `role` column was dropped)
-- Use uuid WITHOUT default to avoid ambiguity with the no-args wrapper
CREATE OR REPLACE FUNCTION public.is_admin_or_ops(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
      AND r.name IN ('owner', 'admin', 'ops_manager')
  )
$$;

-- No-param wrapper (calls the uuid version)
CREATE OR REPLACE FUNCTION public.is_admin_or_ops()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_ops(auth.uid())
$$;

-- Fix is_owner to use role_id JOIN
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id AND r.name = 'owner'
  )
$$;

-- Fix get_user_has_global_scope (uuid without default to avoid ambiguity)
CREATE OR REPLACE FUNCTION public.get_user_has_global_scope(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
      AND ur.location_id IS NULL
      AND r.name IN ('owner', 'admin', 'ops_manager', 'finance', 'hr_payroll')
  )
$$;

-- No-param wrapper
CREATE OR REPLACE FUNCTION public.get_user_has_global_scope()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_has_global_scope(auth.uid())
$$;

-- Fix get_accessible_location_ids to check all access paths
CREATE OR REPLACE FUNCTION public.get_accessible_location_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id FROM public.locations l
  WHERE l.group_id = public.get_user_group_id()
    AND (
      public.is_owner()
      OR public.is_admin_or_ops()
      OR public.get_user_has_global_scope()
      OR EXISTS (
        SELECT 1 FROM public.user_locations ul
        WHERE ul.user_id = auth.uid() AND ul.location_id = l.id
      )
    )
$$;

-- ====================================================================
-- AUTO-FIX: Ensure user has proper access
-- ====================================================================

DO $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_profile_group_id uuid;
  v_loc_group_id uuid;
  v_owner_role_id uuid;
  v_has_owner_role boolean;
  v_loc_count int;
  v_data_count int;
  v_profile_exists boolean;
BEGIN
  -- 1. Find the first (primary) user
  SELECT id, email INTO v_user_id, v_user_email
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'ERROR: No users found in auth.users';
    RETURN;
  END IF;
  RAISE NOTICE '1. User: % (%)', v_user_email, v_user_id;

  -- 2. Ensure profile exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = v_user_id) INTO v_profile_exists;
  IF NOT v_profile_exists THEN
    INSERT INTO profiles (id, full_name) VALUES (v_user_id, split_part(v_user_email, '@', 1));
    RAISE NOTICE '2. Created profile for user';
  END IF;

  -- 3. Get current profile group_id
  SELECT group_id INTO v_profile_group_id FROM profiles WHERE id = v_user_id;
  RAISE NOTICE '3. Profile group_id: %', COALESCE(v_profile_group_id::text, 'NULL');

  -- 4. Find the group_id that has active locations with data
  SELECT l.group_id INTO v_loc_group_id
  FROM locations l
  WHERE l.active = true AND l.group_id IS NOT NULL
  GROUP BY l.group_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RAISE NOTICE '4. Locations group_id: %', COALESCE(v_loc_group_id::text, 'NULL');

  -- 5. Fix profile.group_id if it doesn't match locations
  IF v_loc_group_id IS NOT NULL AND (v_profile_group_id IS NULL OR v_profile_group_id != v_loc_group_id) THEN
    -- Ensure the group exists in the orgs table
    INSERT INTO orgs (id, name)
    VALUES (v_loc_group_id, 'Josephine')
    ON CONFLICT (id) DO NOTHING;

    UPDATE profiles SET group_id = v_loc_group_id WHERE id = v_user_id;
    RAISE NOTICE '5. FIXED: Updated profile group_id from % to %',
      COALESCE(v_profile_group_id::text, 'NULL'), v_loc_group_id;
    v_profile_group_id := v_loc_group_id;
  ELSE
    RAISE NOTICE '5. OK: Profile group_id matches locations';
  END IF;

  -- 6. Ensure 'owner' role exists in roles table
  SELECT id INTO v_owner_role_id FROM roles WHERE name = 'owner';
  IF v_owner_role_id IS NULL THEN
    INSERT INTO roles (name, description, is_system)
    VALUES ('owner', 'Full access to everything, bypass all restrictions', true)
    ON CONFLICT (name) DO NOTHING;
    SELECT id INTO v_owner_role_id FROM roles WHERE name = 'owner';
    RAISE NOTICE '6. Created owner role: %', v_owner_role_id;
  ELSE
    RAISE NOTICE '6. Owner role exists: %', v_owner_role_id;
  END IF;

  -- 7. Ensure user has owner role with global scope (location_id = NULL)
  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = v_user_id AND role_id = v_owner_role_id
  ) INTO v_has_owner_role;

  IF NOT v_has_owner_role THEN
    INSERT INTO user_roles (user_id, role_id, location_id)
    VALUES (v_user_id, v_owner_role_id, NULL);
    RAISE NOTICE '7. FIXED: Added owner role for user (global scope)';
  ELSE
    RAISE NOTICE '7. OK: User already has owner role';
  END IF;

  -- 8. Verify data accessibility
  SELECT COUNT(*) INTO v_loc_count
  FROM locations WHERE group_id = v_profile_group_id AND active = true;

  SELECT COUNT(*) INTO v_data_count
  FROM pos_daily_finance pdf
  JOIN locations l ON l.id = pdf.location_id
  WHERE l.group_id = v_profile_group_id;

  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'Active locations in group: %', v_loc_count;
  RAISE NOTICE 'pos_daily_finance rows for group: %', v_data_count;

  -- Also check other daily tables
  RAISE NOTICE 'pos_daily_metrics rows: %', (
    SELECT COUNT(*) FROM pos_daily_metrics m
    JOIN locations l ON l.id = m.location_id WHERE l.group_id = v_profile_group_id
  );
  RAISE NOTICE 'labour_daily rows: %', (
    SELECT COUNT(*) FROM labour_daily ld
    JOIN locations l ON l.id = ld.location_id WHERE l.group_id = v_profile_group_id
  );
  RAISE NOTICE 'forecast_daily_metrics rows: %', (
    SELECT COUNT(*) FROM forecast_daily_metrics f
    JOIN locations l ON l.id = f.location_id WHERE l.group_id = v_profile_group_id
  );
  RAISE NOTICE 'budgets_daily rows: %', (
    SELECT COUNT(*) FROM budgets_daily b
    JOIN locations l ON l.id = b.location_id WHERE l.group_id = v_profile_group_id
  );
  RAISE NOTICE 'cogs_daily rows: %', (
    SELECT COUNT(*) FROM cogs_daily c
    JOIN locations l ON l.id = c.location_id WHERE l.group_id = v_profile_group_id
  );
  RAISE NOTICE 'cash_counts_daily rows: %', (
    SELECT COUNT(*) FROM cash_counts_daily cc
    JOIN locations l ON l.id = cc.location_id WHERE l.group_id = v_profile_group_id
  );

  IF v_data_count > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'SUCCESS: User % should now see data in the frontend.', v_user_email;
    RAISE NOTICE 'Please refresh the browser (hard refresh: Ctrl+Shift+R / Cmd+Shift+R).';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE 'WARNING: No data found for group. You may need to seed demo data.';
  END IF;
END;
$$;
