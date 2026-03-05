-- ============================================================================
-- Daily forecast cron job
-- Calls generate_forecast_v6 Edge Function every morning at 04:00 UTC
-- Also calls backfill_forecast_accuracy to update accuracy metrics
-- ============================================================================

-- 1. Daily forecast generation at 04:00 UTC (6:00 AM Madrid time)
-- Uses pg_net extension to call the Edge Function
SELECT cron.schedule(
  'generate-forecast-daily',
  '0 4 * * *',           -- 04:00 UTC daily
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/generate_forecast_v6',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{"horizon_days": 90}'::jsonb
    );
  $$
);

-- 2. Backfill forecast accuracy at 05:00 UTC (after forecasts are generated)
SELECT cron.schedule(
  'backfill-forecast-accuracy',
  '0 5 * * *',           -- 05:00 UTC daily
  'SELECT backfill_forecast_accuracy()'
);
