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
-- Flow: pg_cron → pg_net → square-daily-simulator Edge Function → Square API → square-sync
--
-- Management:
--   SELECT * FROM cron.job WHERE jobname = 'square-daily-simulator';
--   SELECT cron.unschedule('square-daily-simulator');
--   SELECT * FROM cron.job_run_details
--     WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'square-daily-simulator')
--     ORDER BY start_time DESC LIMIT 20;

SELECT cron.schedule(
  'square-daily-simulator',
  '*/15 8-21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qzrbvjklgorfoqersdpx.supabase.co/functions/v1/square-daily-simulator',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
