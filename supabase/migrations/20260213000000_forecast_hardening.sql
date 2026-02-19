-- ============================================================
-- Forecast Hardening: location_hours + model_runs traceability
--
-- 1) location_hours — open/close + prep windows per location
-- 2) forecast_model_runs — new columns for data sufficiency audit
-- 3) run_hourly_forecast() — patched to resolve and send data_source
-- ============================================================

-- ─── 1) location_hours ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.location_hours (
  location_id  uuid PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  tz           text        NOT NULL DEFAULT 'Europe/Madrid',
  open_time    time        NOT NULL DEFAULT '12:00',
  close_time   time        NOT NULL DEFAULT '23:00',
  prep_start   time        NOT NULL DEFAULT '09:00',
  prep_end     time        NOT NULL DEFAULT '12:00',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at (reuse existing trigger function)
CREATE TRIGGER set_location_hours_updated_at
  BEFORE UPDATE ON location_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- RLS
ALTER TABLE location_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view location_hours for accessible locations"
  ON location_hours FOR SELECT
  USING (
    location_id IN (
      SELECT ul.location_id FROM user_locations ul WHERE ul.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage location_hours"
  ON location_hours FOR ALL
  USING (true)
  WITH CHECK (true);


-- ─── 2) forecast_model_runs: traceability columns ────────────
ALTER TABLE forecast_model_runs
  ADD COLUMN IF NOT EXISTS data_sufficiency_level text
    NOT NULL DEFAULT 'LOW'
    CHECK (data_sufficiency_level IN ('LOW', 'MID', 'HIGH'));

ALTER TABLE forecast_model_runs
  ADD COLUMN IF NOT EXISTS blend_ratio numeric;

ALTER TABLE forecast_model_runs
  ADD COLUMN IF NOT EXISTS total_days int NOT NULL DEFAULT 0;

ALTER TABLE forecast_model_runs
  ADD COLUMN IF NOT EXISTS min_bucket_samples int NOT NULL DEFAULT 0;


-- ─── 3) Patch run_hourly_forecast() to send data_source ──────
CREATE OR REPLACE FUNCTION public.run_hourly_forecast()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_location   RECORD;
  v_supabase_url text := current_setting('app.settings.supabase_url', true);
  v_service_key  text := current_setting('app.settings.service_role_key', true);
  v_prophet_url  text := 'https://josephine-app.onrender.com/forecast_hourly';
  v_request_id   bigint;
  v_group_id     uuid;
  v_ds_json      jsonb;
  v_data_source  text;
BEGIN
  -- Fallback to hardcoded values if app settings not available
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'https://qixipveebfhurbarksib.supabase.co';
  END IF;
  IF v_service_key IS NULL OR v_service_key = '' THEN
    v_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpeGlwdmVlYmZodXJiYXJrc2liIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA4OTg5MywiZXhwIjoyMDg2NjY1ODkzfQ.12A4ocHkOX86VnVA2nRm4oxZVL6jEHYE02-rJlVj9Qg';
  END IF;

  FOR v_location IN
    SELECT l.id, l.name, l.group_id FROM locations l LIMIT 10
  LOOP
    -- Resolve data_source for this location's org
    v_group_id := v_location.group_id;
    BEGIN
      v_ds_json := resolve_data_source(v_group_id);
      v_data_source := v_ds_json->>'data_source';
    EXCEPTION WHEN OTHERS THEN
      v_data_source := 'demo';
    END;

    RAISE NOTICE '[HOURLY] Requesting hourly forecast for %: ds=%', v_location.name, v_data_source;

    SELECT net.http_post(
      url := v_prophet_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'supabase_url', v_supabase_url,
        'supabase_key', v_service_key,
        'location_id', v_location.id::text,
        'location_name', v_location.name,
        'horizon_days', 14,
        'data_source', v_data_source,
        'org_id', v_group_id::text
      )
    ) INTO v_request_id;

    RAISE NOTICE '[HOURLY] Request sent for %: request_id=%', v_location.name, v_request_id;
    PERFORM pg_sleep(3);
  END LOOP;

  RAISE NOTICE '[HOURLY] Hourly forecast run complete for all locations';
END;
$$;
