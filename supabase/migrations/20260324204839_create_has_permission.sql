-- ============================================================
-- Migration: Create has_permission() RPC
-- Purpose:   Required by invite_team_member and ai-tools Edge
--            Functions to check whether a user holds a specific
--            permission.  Permissions are based on the role
--            hierarchy: owner > admin > ops_manager > store_manager
--            > finance / hr_payroll > employee.
--
--            For now we use a simple mapping: each role implies a
--            fixed set of permission keys.  The function returns
--            TRUE if the user's highest-privilege role grants the
--            requested permission at the given location (or globally
--            when _location_id IS NULL).
-- ============================================================

CREATE OR REPLACE FUNCTION has_permission(
  _user_id       uuid,
  _permission_key text,
  _location_id   uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_has boolean := false;
BEGIN
  -- -------------------------------------------------------
  -- Permission matrix (role_name → allowed keys)
  --
  -- 'owner' and 'admin' have ALL permissions.
  -- Other roles have a subset — extend this CASE as needed.
  -- -------------------------------------------------------
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      -- Location scope: global roles (location_id IS NULL) satisfy
      -- any location.  Location-scoped roles only satisfy their own
      -- location or a NULL (global) request.
      AND (
        ur.location_id IS NULL                 -- global scope satisfies everything
        OR _location_id IS NULL                -- request is global → any role matches
        OR ur.location_id = _location_id       -- exact match
      )
      AND (
        -- Owner and admin have all permissions
        r.name IN ('owner', 'admin')
        OR
        -- Map specific permission keys to non-admin roles
        CASE _permission_key
          -- Team / user management
          WHEN 'settings.users.manage' THEN r.name IN ('owner', 'admin', 'ops_manager')
          -- Location management
          WHEN 'settings.locations.manage' THEN r.name IN ('owner', 'admin', 'ops_manager')
          -- Financial data
          WHEN 'finance.view'    THEN r.name IN ('owner', 'admin', 'ops_manager', 'finance')
          WHEN 'finance.edit'    THEN r.name IN ('owner', 'admin', 'finance')
          -- HR / Payroll
          WHEN 'hr.view'         THEN r.name IN ('owner', 'admin', 'ops_manager', 'hr_payroll')
          WHEN 'hr.edit'         THEN r.name IN ('owner', 'admin', 'hr_payroll')
          -- Store operations
          WHEN 'store.manage'    THEN r.name IN ('owner', 'admin', 'ops_manager', 'store_manager')
          WHEN 'store.view'      THEN r.name IN ('owner', 'admin', 'ops_manager', 'store_manager', 'employee')
          -- Inventory / recipes
          WHEN 'inventory.manage' THEN r.name IN ('owner', 'admin', 'ops_manager', 'store_manager')
          WHEN 'inventory.view'   THEN r.name IN ('owner', 'admin', 'ops_manager', 'store_manager', 'employee')
          -- Integrations
          WHEN 'integrations.manage' THEN r.name IN ('owner', 'admin')
          -- AI tools
          WHEN 'ai.use'          THEN r.name IN ('owner', 'admin', 'ops_manager', 'store_manager')
          -- Default: deny
          ELSE false
        END
      )
  ) INTO v_has;

  RETURN v_has;
END;
$$;

-- Grant execute to authenticated users (called via supabase.rpc)
GRANT EXECUTE ON FUNCTION has_permission(uuid, text, uuid) TO authenticated;

COMMENT ON FUNCTION has_permission IS
  'Returns TRUE if the given user holds a role that grants the requested permission key, optionally scoped to a location.';
