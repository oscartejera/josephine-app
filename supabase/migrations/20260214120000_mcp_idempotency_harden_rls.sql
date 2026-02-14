-- ============================================================
-- Harden RLS on mcp_idempotency_keys: server-only access
--
-- Strategy: service_role bypasses RLS, so the permissive policy
-- only needs to exist for completeness. We restrict authenticated
-- and anon roles to prevent accidental reads/deletes of
-- idempotency records from the frontend or anon API calls.
-- ============================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role full access" ON mcp_idempotency_keys;

-- Deny all access to anon
CREATE POLICY "Deny anon access" ON mcp_idempotency_keys
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- Deny all access to authenticated (frontend users should never touch this table)
CREATE POLICY "Deny authenticated access" ON mcp_idempotency_keys
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- service_role bypasses RLS entirely, so no explicit policy needed for it.
-- This ensures only the MCP server (using service_role key) can read/write.

COMMENT ON TABLE mcp_idempotency_keys IS
  'Idempotency guard for josephine-mcp write operations. '
  'Access: service_role only (RLS blocks anon + authenticated). '
  'TTL cleanup: DELETE WHERE created_at < NOW() - INTERVAL ''30 days''.';
