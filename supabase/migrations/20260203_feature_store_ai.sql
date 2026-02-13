-- Feature Store + AI/Forecast Tables
-- For Nory-style AI Operations Platform

-- ============= FEATURE STORE (Facts Tables) =============

-- 1) facts_sales_15m - Sales aggregated per 15min bucket
CREATE TABLE IF NOT EXISTS facts_sales_15m (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  ts_bucket TIMESTAMPTZ NOT NULL,
  sales_gross NUMERIC DEFAULT 0,
  sales_net NUMERIC DEFAULT 0,
  tickets INT DEFAULT 0,
  covers INT DEFAULT 0,
  discounts NUMERIC DEFAULT 0,
  voids NUMERIC DEFAULT 0,
  comps NUMERIC DEFAULT 0,
  refunds NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, ts_bucket)
);

CREATE INDEX IF NOT EXISTS idx_facts_sales_15m_location_ts ON facts_sales_15m(location_id, ts_bucket DESC);

-- 2) facts_item_mix_daily - Item sales mix per day
CREATE TABLE IF NOT EXISTS facts_item_mix_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  item_id UUID NOT NULL REFERENCES cdm_items(id) ON DELETE CASCADE,
  qty NUMERIC DEFAULT 0,
  revenue_net NUMERIC DEFAULT 0,
  margin_est NUMERIC DEFAULT 0,
  attach_rate NUMERIC DEFAULT 0, -- % of tickets that include this item
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, day, item_id)
);

CREATE INDEX IF NOT EXISTS idx_facts_item_mix_location_day ON facts_item_mix_daily(location_id, day DESC);

-- 3) facts_labor_daily - Labor metrics per day
CREATE TABLE IF NOT EXISTS facts_labor_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  scheduled_hours NUMERIC DEFAULT 0,
  actual_hours NUMERIC DEFAULT 0,
  labor_cost_est NUMERIC DEFAULT 0,
  overtime_hours NUMERIC DEFAULT 0,
  headcount INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, day)
);

CREATE INDEX IF NOT EXISTS idx_facts_labor_location_day ON facts_labor_daily(location_id, day DESC);

-- 4) facts_inventory_daily - Inventory snapshots
CREATE TABLE IF NOT EXISTS facts_inventory_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  item_id UUID NOT NULL REFERENCES cdm_items(id) ON DELETE CASCADE,
  stock_on_hand NUMERIC DEFAULT 0,
  stock_in NUMERIC DEFAULT 0,
  stock_out NUMERIC DEFAULT 0,
  waste_est NUMERIC DEFAULT 0,
  stockout_flag BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, day, item_id)
);

CREATE INDEX IF NOT EXISTS idx_facts_inventory_location_day ON facts_inventory_daily(location_id, day DESC);

-- ============= FORECAST TABLES =============

-- 5) ai_forecasts - Store forecast results
CREATE TABLE IF NOT EXISTS ai_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  horizon_start TIMESTAMPTZ NOT NULL,
  horizon_end TIMESTAMPTZ NOT NULL,
  granularity TEXT NOT NULL CHECK (granularity IN ('15min', '30min', 'hour', 'day')),
  metric TEXT NOT NULL, -- 'sales', 'covers', 'labor_hours', etc.
  forecast_json JSONB NOT NULL, -- Array of {ts, value, lower, upper}
  confidence_p50 NUMERIC DEFAULT NULL,
  confidence_p90 NUMERIC DEFAULT NULL,
  model_version TEXT DEFAULT 'prophet_v1',
  method TEXT DEFAULT 'prophet', -- 'prophet', 'statistical', 'hybrid'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_forecasts_location_metric ON ai_forecasts(location_id, metric, horizon_start DESC);

-- ============= AI RECOMMENDATIONS & ACTIONS =============

-- 6) ai_recommendations - AI-generated recommendations
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'adjust_staff', 'create_order', 'push_menu_item', 'alert_variance'
  location_id UUID DEFAULT NULL REFERENCES locations(id) ON DELETE CASCADE,
  payload_json JSONB NOT NULL,
  rationale TEXT NOT NULL, -- AI explanation
  expected_impact JSONB DEFAULT '{}', -- {revenue_delta: 250, labor_savings: 120}
  confidence NUMERIC DEFAULT NULL, -- 0-1
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_recommendations_location_status ON ai_recommendations(location_id, status, created_at DESC);

-- 7) ai_actions - Approved recommendations → actions
CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES ai_recommendations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  execute_mode TEXT NOT NULL CHECK (execute_mode IN ('suggest', 'auto')),
  guardrails_json JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'blocked')),
  executed_at TIMESTAMPTZ DEFAULT NULL,
  error_text TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actions_recommendation ON ai_actions(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON ai_actions(status, created_at DESC);

-- 8) ai_action_results - Measure impact after execution
CREATE TABLE IF NOT EXISTS ai_action_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES ai_actions(id) ON DELETE CASCADE,
  measured_impact_json JSONB NOT NULL,
  before_after_json JSONB DEFAULT '{}',
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_results_action ON ai_action_results(action_id);

-- ============= ENABLE RLS =============

ALTER TABLE facts_sales_15m ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts_item_mix_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts_labor_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts_inventory_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_action_results ENABLE ROW LEVEL SECURITY;

-- Simple policies (adjust based on org structure)
DROP POLICY IF EXISTS facts_sales_policy ON facts_sales_15m;
CREATE POLICY facts_sales_policy ON facts_sales_15m FOR ALL USING (true);
DROP POLICY IF EXISTS facts_item_mix_policy ON facts_item_mix_daily;
CREATE POLICY facts_item_mix_policy ON facts_item_mix_daily FOR ALL USING (true);
DROP POLICY IF EXISTS facts_labor_policy ON facts_labor_daily;
CREATE POLICY facts_labor_policy ON facts_labor_daily FOR ALL USING (true);
DROP POLICY IF EXISTS facts_inventory_policy ON facts_inventory_daily;
CREATE POLICY facts_inventory_policy ON facts_inventory_daily FOR ALL USING (true);
DROP POLICY IF EXISTS forecasts_policy ON ai_forecasts;
CREATE POLICY forecasts_policy ON ai_forecasts FOR ALL USING (true);
DROP POLICY IF EXISTS recommendations_policy ON ai_recommendations;
CREATE POLICY recommendations_policy ON ai_recommendations FOR ALL USING (true);
DROP POLICY IF EXISTS actions_policy ON ai_actions;
CREATE POLICY actions_policy ON ai_actions FOR ALL USING (true);
DROP POLICY IF EXISTS action_results_policy ON ai_action_results;
CREATE POLICY action_results_policy ON ai_action_results FOR ALL USING (true);

COMMENT ON TABLE facts_sales_15m IS 'Sales metrics aggregated per 15-minute bucket for forecasting';
COMMENT ON TABLE ai_forecasts IS 'Prophet/Statistical forecasts with confidence intervals';
COMMENT ON TABLE ai_recommendations IS 'AI-generated recommendations with rationale';
COMMENT ON TABLE ai_actions IS 'Approved recommendations converted to executable actions';
