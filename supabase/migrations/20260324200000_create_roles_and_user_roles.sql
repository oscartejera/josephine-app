-- ============================================================
-- Migration: Create roles & user_roles tables
-- Purpose:   TeamManager and UsersRolesManager query these
--            tables but they never existed (or exist with
--            a different schema).  This migration ensures they
--            exist with the correct columns, seeds 7 standard
--            roles, sets up RLS, and rewrites
--            get_user_roles_with_scope().
-- ============================================================

-- -------------------------------------------------------
-- 1. ROLES — role catalogue (drop & recreate to ensure schema)
-- -------------------------------------------------------
-- Drop dependent objects first (if any) so we can recreate cleanly
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  is_system   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE roles IS 'System and custom role definitions used by the RBAC layer';

-- -------------------------------------------------------
-- 2. USER_ROLES — assignment of roles to users
-- -------------------------------------------------------
CREATE TABLE user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- A user can hold a given role at most once per location (or once globally when location_id IS NULL)
  UNIQUE (user_id, role_id, location_id)
);

COMMENT ON TABLE user_roles IS 'Maps users to roles, optionally scoped to a location';

CREATE INDEX idx_user_roles_user   ON user_roles (user_id);
CREATE INDEX idx_user_roles_role   ON user_roles (role_id);
CREATE INDEX idx_user_roles_loc    ON user_roles (location_id) WHERE location_id IS NOT NULL;

-- -------------------------------------------------------
-- 3. TRIGGER — employee and store_manager need a location
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION check_location_required_role()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_role_name text;
BEGIN
  SELECT name INTO v_role_name FROM roles WHERE id = NEW.role_id;

  IF v_role_name IN ('employee', 'store_manager') AND NEW.location_id IS NULL THEN
    RAISE EXCEPTION 'Role "%" cannot have global scope — a location_id is required', v_role_name;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_roles_location_check
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION check_location_required_role();

-- -------------------------------------------------------
-- 4. SEED — the 7 standard roles
-- -------------------------------------------------------
INSERT INTO roles (name, description, is_system) VALUES
  ('owner',         'Propietario del grupo — acceso total',                               true),
  ('admin',         'Administrador — acceso completo excepto transferir propiedad',        true),
  ('ops_manager',   'Gerente de operaciones — supervisión de todas las ubicaciones',       true),
  ('store_manager', 'Gerente de tienda — gestión de una ubicación específica',             true),
  ('finance',       'Finanzas — acceso a datos financieros, costes y reportes',            true),
  ('hr_payroll',    'RRHH y Nóminas — gestión de empleados, horarios y nóminas',           true),
  ('employee',      'Empleado — acceso limitado a la ubicación asignada',                  true)
ON CONFLICT (name) DO NOTHING;

-- -------------------------------------------------------
-- 5. RLS POLICIES
-- -------------------------------------------------------

-- 5a. ROLES table — anyone authenticated can read
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY roles_select ON roles
  FOR SELECT TO authenticated
  USING (true);

-- 5b. USER_ROLES table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can see their own role assignments
CREATE POLICY user_roles_select_own ON user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users with owner/admin roles can see all role assignments in their group
CREATE POLICY user_roles_select_admin ON user_roles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN profiles p ON p.id = ur.user_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('owner', 'admin')
        AND p.group_id = (SELECT group_id FROM profiles WHERE id = user_roles.user_id)
    )
  );

-- Owners/admins can insert role assignments
CREATE POLICY user_roles_insert ON user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('owner', 'admin')
    )
  );

-- Owners/admins can delete role assignments
CREATE POLICY user_roles_delete ON user_roles
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('owner', 'admin')
    )
  );

-- -------------------------------------------------------
-- 6. REWRITE get_user_roles_with_scope()
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_roles_with_scope(_user_id uuid)
RETURNS TABLE(role_name text, role_id uuid, location_id uuid, location_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT
      r.name::text       AS role_name,
      ur.role_id,
      ur.location_id,
      l.name::text       AS location_name
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    LEFT JOIN locations l ON l.id = ur.location_id
    WHERE ur.user_id = _user_id;
END;
$$;

-- -------------------------------------------------------
-- 7. AUTO-ASSIGN OWNER ROLE to existing group creators
-- -------------------------------------------------------
DO $$
DECLARE
  v_owner_role_id uuid;
  v_profile RECORD;
BEGIN
  SELECT id INTO v_owner_role_id FROM roles WHERE name = 'owner';

  IF v_owner_role_id IS NULL THEN
    RAISE NOTICE 'owner role not found — skipping auto-assignment';
    RETURN;
  END IF;

  FOR v_profile IN
    SELECT DISTINCT ON (group_id) id, group_id
    FROM profiles
    WHERE group_id IS NOT NULL
    ORDER BY group_id, created_at ASC
  LOOP
    INSERT INTO user_roles (user_id, role_id)
    VALUES (v_profile.id, v_owner_role_id)
    ON CONFLICT (user_id, role_id, location_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Auto-assigned owner roles to group creators';
END;
$$;

-- Grant access to PostgREST / Supabase client
GRANT SELECT ON roles TO authenticated, anon;
GRANT SELECT, INSERT, DELETE ON user_roles TO authenticated;
