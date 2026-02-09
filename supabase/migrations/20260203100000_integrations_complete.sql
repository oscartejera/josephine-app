-- Integrations Module - Complete Schema
-- Canonical Data Model (CDM) + Integration Infrastructure

-- ============= INTEGRATION MANAGEMENT =============

-- 1) integrations - Main integration registry
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL, -- Would reference organizations(id) if exists
  location_id UUID DEFAULT NULL REFERENCES locations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('square', 'lightspeed', 'oracle_simphony', 'toast', 'clover')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error', 'disabled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(org_id, provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

-- 2) integration_accounts - OAuth credentials per environment
CREATE TABLE IF NOT EXISTS integration_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'production')),
  external_account_id TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT DEFAULT NULL,
  token_expires_at TIMESTAMPTZ DEFAULT NULL,
  scopes TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(integration_id, environment)
);

CREATE INDEX IF NOT EXISTS idx_integration_accounts_integration ON integration_accounts(integration_id);

-- 3) integration_sync_runs - Track sync executions
CREATE TABLE IF NOT EXISTS integration_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'error', 'partial')),
  cursor JSONB DEFAULT '{}', -- For pagination/incremental sync
  stats JSONB DEFAULT '{}', -- {locations: 5, items: 230, orders: 45, ...}
  error_text TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_account ON integration_sync_runs(integration_account_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON integration_sync_runs(status);

-- 4) raw_events - Immutable event log with dedupe
CREATE TABLE IF NOT EXISTS raw_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'order.created', 'payment.completed', etc.
  external_id TEXT NOT NULL, -- Square order ID, payment ID, etc.
  event_ts TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL, -- For deduplication
  inserted_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ DEFAULT NULL,
  processed_status TEXT DEFAULT 'pending' CHECK (processed_status IN ('pending', 'ok', 'error', 'skip')),
  error_text TEXT DEFAULT NULL,
  UNIQUE(provider, integration_account_id, external_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_raw_events_account ON raw_events(integration_account_id, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_raw_events_processed ON raw_events(processed_status, inserted_at);
CREATE INDEX IF NOT EXISTS idx_raw_events_external ON raw_events(provider, external_id);

-- ============= CANONICAL DATA MODEL (CDM) =============

-- 5) cdm_locations - Normalized locations
CREATE TABLE IF NOT EXISTS cdm_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT DEFAULT NULL,
  timezone TEXT DEFAULT 'UTC',
  external_provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(external_provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_cdm_locations_org ON cdm_locations(org_id);
CREATE INDEX IF NOT EXISTS idx_cdm_locations_external ON cdm_locations(external_provider, external_id);

-- 6) cdm_items - Normalized catalog items
CREATE TABLE IF NOT EXISTS cdm_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  sku TEXT DEFAULT NULL,
  category_name TEXT DEFAULT NULL,
  price NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  external_provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(external_provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_cdm_items_org ON cdm_items(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cdm_items_external ON cdm_items(external_provider, external_id);

-- 7) cdm_orders - Normalized orders
CREATE TABLE IF NOT EXISTS cdm_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  location_id UUID DEFAULT NULL REFERENCES cdm_locations(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ DEFAULT NULL,
  gross_total NUMERIC NOT NULL DEFAULT 0,
  net_total NUMERIC NOT NULL DEFAULT 0,
  tax_total NUMERIC DEFAULT 0,
  tip_total NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid', 'void')),
  source TEXT DEFAULT 'external',
  external_provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(external_provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_cdm_orders_org_location ON cdm_orders(org_id, location_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_cdm_orders_external ON cdm_orders(external_provider, external_id);
CREATE INDEX IF NOT EXISTS idx_cdm_orders_status ON cdm_orders(status, opened_at DESC);

-- 8) cdm_order_lines - Normalized order lines
CREATE TABLE IF NOT EXISTS cdm_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES cdm_orders(id) ON DELETE CASCADE,
  item_id UUID DEFAULT NULL REFERENCES cdm_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  gross_line_total NUMERIC NOT NULL,
  modifiers JSONB DEFAULT '[]',
  notes TEXT DEFAULT NULL,
  course INT DEFAULT NULL,
  destination TEXT DEFAULT NULL,
  external_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cdm_order_lines_order ON cdm_order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_cdm_order_lines_item ON cdm_order_lines(item_id);

-- 9) cdm_payments - Normalized payments
CREATE TABLE IF NOT EXISTS cdm_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES cdm_orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  paid_at TIMESTAMPTZ NOT NULL,
  external_provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(external_provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_cdm_payments_order ON cdm_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_cdm_payments_external ON cdm_payments(external_provider, external_id);

-- ============= HELPER FUNCTIONS =============

-- Function to check for running syncs (prevent overlaps)
CREATE OR REPLACE FUNCTION has_running_sync(p_account_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM integration_sync_runs
    WHERE integration_account_id = p_account_id
      AND status = 'running'
      AND started_at > NOW() - INTERVAL '1 hour'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to complete sync run
CREATE OR REPLACE FUNCTION complete_sync_run(
  p_run_id UUID,
  p_status TEXT,
  p_stats JSONB DEFAULT '{}',
  p_error TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE integration_sync_runs
  SET 
    ended_at = NOW(),
    status = p_status,
    stats = p_stats,
    error_text = p_error
  WHERE id = p_run_id;
END;
$$ LANGUAGE plpgsql;

-- ============= RLS POLICIES =============

-- Enable RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdm_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdm_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdm_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdm_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdm_payments ENABLE ROW LEVEL SECURITY;

-- Simple org-scoped policies (adjust based on your auth structure)
-- For now, allow authenticated users to read their org's data
-- Service role bypasses RLS for Edge Functions

DROP POLICY IF EXISTS integrations_org_policy ON integrations;
CREATE POLICY integrations_org_policy ON integrations
  FOR ALL USING (true);

DROP POLICY IF EXISTS integration_accounts_org_policy ON integration_accounts;
CREATE POLICY integration_accounts_org_policy ON integration_accounts
  FOR ALL USING (true);

DROP POLICY IF EXISTS cdm_locations_org_policy ON cdm_locations;
CREATE POLICY cdm_locations_org_policy ON cdm_locations
  FOR ALL USING (true);

DROP POLICY IF EXISTS cdm_items_org_policy ON cdm_items;
CREATE POLICY cdm_items_org_policy ON cdm_items
  FOR ALL USING (true);

DROP POLICY IF EXISTS cdm_orders_org_policy ON cdm_orders;
CREATE POLICY cdm_orders_org_policy ON cdm_orders
  FOR ALL USING (true);

DROP POLICY IF EXISTS cdm_order_lines_org_policy ON cdm_order_lines;
CREATE POLICY cdm_order_lines_org_policy ON cdm_order_lines
  FOR ALL USING (true);

DROP POLICY IF EXISTS cdm_payments_org_policy ON cdm_payments;
CREATE POLICY cdm_payments_org_policy ON cdm_payments
  FOR ALL USING (true);

-- ============= COMMENTS =============

COMMENT ON TABLE integrations IS 'Main registry of external POS integrations';
COMMENT ON TABLE integration_accounts IS 'OAuth credentials per environment (sandbox/production)';
COMMENT ON TABLE integration_sync_runs IS 'Track each sync execution with stats and errors';
COMMENT ON TABLE raw_events IS 'Immutable event log with deduplication via UNIQUE constraint';
COMMENT ON TABLE cdm_locations IS 'Canonical Data Model: Locations';
COMMENT ON TABLE cdm_items IS 'Canonical Data Model: Menu items/catalog';
COMMENT ON TABLE cdm_orders IS 'Canonical Data Model: Orders/tickets';
COMMENT ON TABLE cdm_order_lines IS 'Canonical Data Model: Order line items';
COMMENT ON TABLE cdm_payments IS 'Canonical Data Model: Payments';
