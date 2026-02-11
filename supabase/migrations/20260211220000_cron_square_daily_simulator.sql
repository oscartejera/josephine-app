-- Schedule Square Daily Simulator
-- Runs every day at 21:30 UTC (22:30 Madrid) to create simulated orders
-- in Square Production, building up realistic historical POS data.
--
-- The Edge Function creates 70-90 orders/day (adjusted by day-of-week
-- and seasonal multipliers), then triggers square-sync to import them.
--
-- To disable: SELECT cron.unschedule('square-daily-simulator');
-- To check status: SELECT * FROM cron.job WHERE jobname = 'square-daily-simulator';
-- To see run history: SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'square-daily-simulator') ORDER BY start_time DESC LIMIT 10;

SELECT cron.schedule(
  'square-daily-simulator',
  '30 21 * * *',
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
