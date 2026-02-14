-- ============================================================
-- MCP idempotency keys table
--
-- Used by josephine-mcp server to ensure write operations are
-- idempotent. Each (tool_name, idempotency_key) pair is unique.
-- A request_hash detects payload changes for the same key
-- (conflict vs replay).
-- ============================================================

CREATE TABLE IF NOT EXISTS mcp_idempotency_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name       TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'completed',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_json      JSONB DEFAULT NULL,
  reason          TEXT NOT NULL,
  result_json     JSONB DEFAULT NULL
);

-- Unique constraint for idempotency lookup
CREATE UNIQUE INDEX IF NOT EXISTS uq_mcp_idempotency_tool_key
  ON mcp_idempotency_keys (tool_name, idempotency_key);

-- Index for TTL cleanup (optional cron)
CREATE INDEX IF NOT EXISTS idx_mcp_idempotency_created
  ON mcp_idempotency_keys (created_at);

-- RLS: only service_role should access this table
ALTER TABLE mcp_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (bypasses RLS anyway, but explicit)
CREATE POLICY "Service role full access" ON mcp_idempotency_keys
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE mcp_idempotency_keys IS
  'Idempotency guard for josephine-mcp write operations. TTL cleanup: DELETE WHERE created_at < NOW() - INTERVAL ''30 days''.';
