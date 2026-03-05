-- ============================================================================
-- JOSEPHINE — Cron Jobs Definition
-- ============================================================================
-- Run this in Supabase SQL Editor or apply via supabase CLI.
-- These use pg_cron extension (must be enabled in Supabase Dashboard first).
-- ============================================================================

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 1. Daily Forecast Generation (2:00 AM every day) ──
-- Triggers the forecast edge function for all active locations
SELECT cron.schedule(
  'generate-forecast-daily',
  '0 2 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/generate_forecast_v6',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{"all_locations": true}'::jsonb
    );
  $$
);

-- ── 2. Auto-Retrain Model (Sunday 3:00 AM) ──
SELECT cron.schedule(
  'auto-retrain-weekly',
  '0 3 * * 0',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/auto_retrain',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ── 3. Daily Report Email (7:00 AM every day) ──
SELECT cron.schedule(
  'send-daily-report',
  '0 7 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send_daily_report',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ── 4. Weekly Report Email (Monday 8:00 AM) ──
SELECT cron.schedule(
  'send-weekly-report',
  '0 8 * * 1',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send_weekly_report',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ── 5. KPI Alerts (every hour) ──
SELECT cron.schedule(
  'send-kpi-alerts',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send_kpi_alerts',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ── 6. Refresh Data Marts (every 15 minutes) ──
SELECT cron.schedule(
  'refresh-data-marts',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/refresh_marts',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ── 7. Forecast Accuracy Backfill (6:00 AM daily) ──
-- Updates forecast_accuracy table with actual vs predicted
SELECT cron.schedule(
  'backfill-accuracy',
  '0 6 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/forecast_audit',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ── List all scheduled jobs ──
-- SELECT * FROM cron.job ORDER BY jobid;
