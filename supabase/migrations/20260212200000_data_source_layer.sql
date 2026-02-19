-- ============================================================
-- Data Source Layer: org_settings + resolve_data_source RPC
-- Centralizes demo vs POS decision in DB instead of frontend
-- ============================================================

-- 1. org_settings table
CREATE TABLE IF NOT EXISTS org_settings (
  org_id    uuid PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  data_source_mode   text NOT NULL DEFAULT 'auto'
    CHECK (data_source_mode IN ('auto', 'manual')),
  manual_data_source  text
    CHECK (manual_data_source IS NULL OR manual_data_source IN ('demo', 'pos')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: authenticated users can read their org's settings
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own org settings"
  ON org_settings FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT group_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners can update own org settings"
  ON org_settings FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT group_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert own org settings"
  ON org_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT group_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 2. Index on integrations for fast lookup
CREATE INDEX IF NOT EXISTS idx_integrations_org_provider_status
  ON integrations(org_id, provider, status);

-- 3. Add data_source column to tables that don't have it yet
ALTER TABLE forecast_daily_metrics
  ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'demo'
  CHECK (data_source IN ('demo', 'pos'));

ALTER TABLE forecast_hourly_metrics
  ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'demo'
  CHECK (data_source IN ('demo', 'pos'));

-- 4. RPC: resolve_data_source
CREATE OR REPLACE FUNCTION resolve_data_source(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_mode         text;
  v_manual_src   text;
  v_last_synced  timestamptz;
  v_data_source  text;
  v_reason       text;
BEGIN
  -- Read org_settings (default to 'auto' if no row)
  SELECT data_source_mode, manual_data_source
    INTO v_mode, v_manual_src
    FROM org_settings
   WHERE org_id = p_org_id;

  IF NOT FOUND THEN
    v_mode := 'auto';
    v_manual_src := NULL;
  END IF;

  -- Find latest sync timestamp from active Square integrations
  SELECT max((metadata->>'last_synced_at')::timestamptz)
    INTO v_last_synced
    FROM integrations
   WHERE org_id = p_org_id
     AND provider = 'square'
     AND status = 'active'
     AND metadata ? 'last_synced_at';

  -- Resolve based on mode
  IF v_mode = 'auto' THEN
    IF v_last_synced IS NOT NULL
       AND v_last_synced >= now() - interval '24 hours' THEN
      v_data_source := 'pos';
      v_reason := 'auto_pos_recent';
    ELSE
      v_data_source := 'demo';
      v_reason := 'auto_demo_no_sync';
    END IF;

  ELSE  -- manual
    IF v_manual_src = 'demo' THEN
      v_data_source := 'demo';
      v_reason := 'manual_demo';
    ELSIF v_manual_src = 'pos' THEN
      IF v_last_synced IS NOT NULL
         AND v_last_synced >= now() - interval '24 hours' THEN
        v_data_source := 'pos';
        v_reason := 'manual_pos_recent';
      ELSE
        v_data_source := 'demo';
        v_reason := 'manual_pos_blocked_no_sync';
      END IF;
    ELSE
      -- manual mode but no manual_data_source set: fallback auto
      v_data_source := 'demo';
      v_reason := 'auto_demo_no_sync';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'data_source',   v_data_source,
    'mode',          v_mode,
    'reason',        v_reason,
    'last_synced_at', v_last_synced
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION resolve_data_source(uuid) TO authenticated;
