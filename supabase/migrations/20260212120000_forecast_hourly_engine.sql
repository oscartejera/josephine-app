-- ====================================================================
-- Hourly Forecast Engine v1.0
-- Champion/Challenger per bucket (DOW × HOUR) per location
--
-- New tables:
--   1) forecast_hourly_metrics  — hourly forecast storage
--   2) forecast_model_registry  — champion model per (location, dow, hour)
-- New function:
--   3) run_hourly_forecast()    — pg_cron entrypoint
-- ====================================================================

-- ─── 1) forecast_hourly_metrics ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.forecast_hourly_metrics (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_date date        NOT NULL,
  hour_of_day   smallint    NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),

  -- Core forecast values
  forecast_sales        numeric NOT NULL DEFAULT 0,
  forecast_sales_lower  numeric,
  forecast_sales_upper  numeric,
  forecast_orders       numeric NOT NULL DEFAULT 0,
  forecast_covers       numeric NOT NULL DEFAULT 0,

  -- Model that produced this prediction
  model_type      text    NOT NULL DEFAULT 'seasonal_naive',  -- lgbm | seasonal_naive | ets
  model_version   text    DEFAULT 'v1.0',
  generated_at    timestamptz DEFAULT now(),

  -- Bucket-level quality metrics (from evaluation)
  bucket_wmape    numeric,
  bucket_mase     numeric,

  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE(location_id, forecast_date, hour_of_day)
);

CREATE INDEX IF NOT EXISTS idx_fhm_location_date
  ON forecast_hourly_metrics(location_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_fhm_date_hour
  ON forecast_hourly_metrics(forecast_date, hour_of_day);

-- RLS
ALTER TABLE forecast_hourly_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view hourly forecasts for accessible locations"
  ON forecast_hourly_metrics FOR SELECT
  USING (
    location_id IN (
      SELECT ul.location_id FROM user_locations ul WHERE ul.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage hourly forecasts"
  ON forecast_hourly_metrics FOR ALL
  USING (true)
  WITH CHECK (true);


-- ─── 2) forecast_model_registry ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.forecast_model_registry (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week     smallint    NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  hour_of_day     smallint    NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),

  -- Champion model info
  champion_model              text    NOT NULL DEFAULT 'seasonal_naive',
  champion_wmape              numeric,
  champion_mase               numeric,
  champion_bias               numeric,
  champion_directional_acc    numeric,
  champion_calibration        numeric,

  -- Challenger model info (for audit / comparison)
  challenger_model            text,
  challenger_wmape            numeric,
  challenger_mase             numeric,

  -- Training metadata
  training_samples    int,
  last_evaluated_at   timestamptz DEFAULT now(),

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),

  UNIQUE(location_id, day_of_week, hour_of_day)
);

CREATE INDEX IF NOT EXISTS idx_fmr_location
  ON forecast_model_registry(location_id);

-- RLS
ALTER TABLE forecast_model_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view model registry for accessible locations"
  ON forecast_model_registry FOR SELECT
  USING (
    location_id IN (
      SELECT ul.location_id FROM user_locations ul WHERE ul.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage model registry"
  ON forecast_model_registry FOR ALL
  USING (true)
  WITH CHECK (true);


-- ─── 3) run_hourly_forecast() — pg_cron entrypoint ─────────────────
CREATE OR REPLACE FUNCTION public.run_hourly_forecast()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_location RECORD;
  v_supabase_url text := 'https://qzrbvjklgorfoqersdpx.supabase.co';
  v_service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cmJ2amtsZ29yZm9xZXJzZHB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI5NDYwMywiZXhwIjoyMDg1ODcwNjAzfQ.UgpxcrpVnrxaOlQHCcs4-5c4LABnHvFAysCbTrFLy3c';
  v_prophet_url text := 'https://josephine-app.onrender.com/forecast_hourly';
  v_request_id bigint;
BEGIN
  FOR v_location IN
    SELECT id, name FROM locations LIMIT 10
  LOOP
    RAISE NOTICE '[HOURLY] Requesting hourly forecast for location: %', v_location.name;

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
        'horizon_days', 14
      )
    ) INTO v_request_id;

    RAISE NOTICE '[HOURLY] Request sent for %: request_id=%', v_location.name, v_request_id;
    PERFORM pg_sleep(3);
  END LOOP;

  RAISE NOTICE '[HOURLY] Hourly forecast run complete for all locations';
END;
$$;


-- ─── 4) pg_cron: 5:30 AM UTC daily (30 min after daily Prophet) ────
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hourly-forecast') THEN
      PERFORM cron.unschedule('hourly-forecast');
    END IF;
    PERFORM cron.schedule('hourly-forecast', '30 5 * * *', 'SELECT run_hourly_forecast()');
  ELSE
    RAISE NOTICE 'pg_cron not available — skipping hourly-forecast schedule';
  END IF;
END $cron$;
