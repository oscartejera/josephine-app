-- =========================================================
-- Forecast Cron Job
-- Runs Prophet forecast daily at 3:00 AM UTC
-- Requires pg_cron and pg_net extensions (enabled by default on Supabase)
-- =========================================================

-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily forecast at 3:00 AM UTC
-- This calls the Edge Function which proxies to the Prophet service
SELECT cron.schedule(
  'daily-prophet-forecast',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate_forecast_v5',
    body := '{"horizon_days": 90}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);

-- Also schedule a weekly full retrain (Sunday 2:00 AM) with longer horizon
SELECT cron.schedule(
  'weekly-prophet-forecast-full',
  '0 2 * * 0',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate_forecast_v5',
    body := '{"horizon_days": 180, "sync": true}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);
