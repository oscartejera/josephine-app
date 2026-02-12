-- Square Daily Simulator — Intraday Cron
--
-- Runs every 15 minutes during business hours (08:00-21:59 UTC) which covers
-- 10:00-23:00 Madrid time in both CET (winter) and CEST (summer).
--
-- Each invocation creates a small batch of orders for the current 15-min slot,
-- distributed according to hourly demand weights (lunch + dinner peaks).
-- The daily target (~74-100 orders) is deterministic per date via a seeded PRNG,
-- so all 52 invocations in a day agree on the total without shared state.
--
-- Flow: pg_cron → pg_net → square-daily-simulator → Square API → square-sync → etl_cdm_to_facts_sales_15m → Prophet
--
-- Management:
--   SELECT * FROM cron.job WHERE jobname = 'square-daily-simulator';
--   SELECT cron.unschedule('square-daily-simulator');
--   SELECT * FROM cron.job_run_details
--     WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'square-daily-simulator')
--     ORDER BY start_time DESC LIMIT 20;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'square-daily-simulator') THEN
      PERFORM cron.unschedule('square-daily-simulator');
    END IF;
    PERFORM cron.schedule(
      'square-daily-simulator',
      '*/15 8-21 * * *',
      E'SELECT net.http_post(\n'
      || E'  url := ''https://qzrbvjklgorfoqersdpx.supabase.co/functions/v1/square-daily-simulator'',\n'
      || E'  headers := jsonb_build_object(\n'
      || E'    ''Authorization'', ''Bearer '' || current_setting(''app.settings.service_role_key'', true),\n'
      || E'    ''Content-Type'', ''application/json''\n'
      || E'  ),\n'
      || E'  body := ''{}''::jsonb\n'
      || E');'
    );
  ELSE
    RAISE NOTICE 'pg_cron not available — skipping square-daily-simulator schedule';
  END IF;
END $cron$;
