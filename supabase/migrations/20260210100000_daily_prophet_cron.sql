-- ====================================================================
-- Daily Prophet Forecast Automation
-- 1) Cleanup: ensure no actual data exists for future dates
-- 2) Generate today's partial actual data (for demo)
-- 3) Function to call Prophet service via pg_net
-- 4) pg_cron schedule at 5 AM UTC daily
-- ====================================================================

-- 1) CLEANUP: Remove any actual data for dates > today (safety net)
DELETE FROM pos_daily_finance WHERE date > CURRENT_DATE;
DELETE FROM pos_daily_metrics WHERE date > CURRENT_DATE;
DELETE FROM labour_daily WHERE date > CURRENT_DATE;

-- 2) GENERATE TODAY'S PARTIAL DATA (simulates POS data up to "now")
--    In production, this comes from the real POS integration.
--    For demo, we generate ~60% of a typical day's data (simulating mid-afternoon).
INSERT INTO pos_daily_finance (date, location_id, net_sales, gross_sales, orders_count,
  payments_cash, payments_card, payments_other, refunds_amount, refunds_count,
  discounts_amount, comps_amount, voids_amount)
SELECT
  CURRENT_DATE,
  f.location_id,
  ROUND((f.forecast_sales * 0.60 * (0.90 + random() * 0.20))::numeric, 2) AS net_sales,
  ROUND((f.forecast_sales * 0.60 * 1.05 * (0.90 + random() * 0.20))::numeric, 2) AS gross_sales,
  ROUND((f.forecast_orders * 0.60 * (0.90 + random() * 0.20))::numeric, 0) AS orders_count,
  ROUND((f.forecast_sales * 0.60 * 0.25)::numeric, 2),
  ROUND((f.forecast_sales * 0.60 * 0.70)::numeric, 2),
  ROUND((f.forecast_sales * 0.60 * 0.05)::numeric, 2),
  ROUND((f.forecast_sales * 0.60 * 0.005)::numeric, 2),
  1,
  ROUND((f.forecast_sales * 0.60 * 0.03)::numeric, 2),
  ROUND((f.forecast_sales * 0.60 * 0.01)::numeric, 2),
  ROUND((f.forecast_sales * 0.60 * 0.008)::numeric, 2)
FROM forecast_daily_metrics f
WHERE f.date = CURRENT_DATE
ON CONFLICT (date, location_id) DO UPDATE SET
  net_sales = EXCLUDED.net_sales,
  gross_sales = EXCLUDED.gross_sales,
  orders_count = EXCLUDED.orders_count;

INSERT INTO pos_daily_metrics (date, location_id, net_sales, orders, labor_hours, labor_cost)
SELECT
  CURRENT_DATE,
  f.location_id,
  ROUND((f.forecast_sales * 0.60 * (0.90 + random() * 0.20))::numeric, 2),
  ROUND((f.forecast_orders * 0.60 * (0.90 + random() * 0.20))::numeric, 0),
  ROUND((f.planned_labor_hours * 0.60 * (0.90 + random() * 0.15))::numeric, 1),
  ROUND((f.planned_labor_cost * 0.60 * (0.90 + random() * 0.15))::numeric, 2)
FROM forecast_daily_metrics f
WHERE f.date = CURRENT_DATE
ON CONFLICT (date, location_id) DO UPDATE SET
  net_sales = EXCLUDED.net_sales,
  orders = EXCLUDED.orders,
  labor_hours = EXCLUDED.labor_hours,
  labor_cost = EXCLUDED.labor_cost;

INSERT INTO labour_daily (date, location_id, labour_cost, labour_hours)
SELECT
  CURRENT_DATE,
  f.location_id,
  ROUND((f.planned_labor_cost * 0.60 * (0.90 + random() * 0.15))::numeric, 2),
  ROUND((f.planned_labor_hours * 0.60 * (0.90 + random() * 0.15))::numeric, 1)
FROM forecast_daily_metrics f
WHERE f.date = CURRENT_DATE
ON CONFLICT (date, location_id) DO UPDATE SET
  labour_cost = EXCLUDED.labour_cost,
  labour_hours = EXCLUDED.labour_hours;


-- 3) FUNCTION: run_daily_forecast()
--    Called by pg_cron. Uses pg_net to call Prophet for each location.
--    Prophet writes results directly to forecast_daily_metrics.

CREATE OR REPLACE FUNCTION public.run_daily_forecast()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_location RECORD;
  v_supabase_url text := 'https://qixipveebfhurbarksib.supabase.co';
  v_service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpeGlwdmVlYmZodXJiYXJrc2liIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA4OTg5MywiZXhwIjoyMDg2NjY1ODkzfQ.12A4ocHkOX86VnVA2nRm4oxZVL6jEHYE02-rJlVj9Qg';
  v_prophet_url text := 'https://josephine-app.onrender.com/forecast_supabase';
  v_request_id bigint;
BEGIN
  -- Call Prophet for each location
  FOR v_location IN
    SELECT id, name FROM locations LIMIT 10
  LOOP
    RAISE NOTICE 'Requesting forecast for location: %', v_location.name;

    -- Use pg_net to make async HTTP POST to Prophet service
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
        'horizon_days', 30,
        'seasonality_mode', 'multiplicative',
        'changepoint_prior_scale', 0.05
      )
    ) INTO v_request_id;

    RAISE NOTICE 'Prophet request sent for %: request_id=%', v_location.name, v_request_id;

    -- Small delay between locations to avoid overwhelming the service
    PERFORM pg_sleep(2);
  END LOOP;

  RAISE NOTICE 'Daily forecast run complete for all locations';
END;
$$;


-- 4) SCHEDULE: pg_cron job at 5 AM UTC daily
--    Unschedule first if exists (idempotent)
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-prophet-forecast') THEN
      PERFORM cron.unschedule('daily-prophet-forecast');
    END IF;
    PERFORM cron.schedule('daily-prophet-forecast', '0 5 * * *', 'SELECT run_daily_forecast()');
  ELSE
    RAISE NOTICE 'pg_cron not available — skipping daily-prophet-forecast schedule';
  END IF;
END $cron$;


-- 5) FUNCTION: simulate_today_partial_data()
--    Called by pg_cron at midnight to create today's initial "actual" row
--    from forecast data. In production, this would come from POS integration.
CREATE OR REPLACE FUNCTION public.simulate_today_partial_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_location RECORD;
  v_progress numeric;
  v_forecast RECORD;
BEGIN
  -- Calculate what fraction of the business day has passed (10am-11pm = 13 hours)
  v_progress := GREATEST(0, LEAST(1,
    (EXTRACT(HOUR FROM NOW()) - 10.0) / 13.0
  ));

  -- If before opening (10am), set small initial values
  IF v_progress <= 0 THEN
    v_progress := 0.02;
  END IF;

  FOR v_location IN SELECT id, name FROM locations LOOP
    SELECT * INTO v_forecast
    FROM forecast_daily_metrics
    WHERE date = CURRENT_DATE AND location_id = v_location.id
    LIMIT 1;

    IF v_forecast IS NULL THEN
      CONTINUE;
    END IF;

    -- Update pos_daily_finance with simulated partial data
    INSERT INTO pos_daily_finance (date, location_id, net_sales, gross_sales, orders_count,
      payments_cash, payments_card, payments_other, refunds_amount, refunds_count,
      discounts_amount, comps_amount, voids_amount)
    VALUES (
      CURRENT_DATE, v_location.id,
      ROUND((v_forecast.forecast_sales * v_progress * (0.92 + random() * 0.16))::numeric, 2),
      ROUND((v_forecast.forecast_sales * v_progress * 1.05 * (0.92 + random() * 0.16))::numeric, 2),
      ROUND((v_forecast.forecast_orders * v_progress * (0.92 + random() * 0.16))::numeric, 0),
      ROUND((v_forecast.forecast_sales * v_progress * 0.25)::numeric, 2),
      ROUND((v_forecast.forecast_sales * v_progress * 0.70)::numeric, 2),
      ROUND((v_forecast.forecast_sales * v_progress * 0.05)::numeric, 2),
      ROUND((v_forecast.forecast_sales * v_progress * 0.005)::numeric, 2),
      1,
      ROUND((v_forecast.forecast_sales * v_progress * 0.03)::numeric, 2),
      ROUND((v_forecast.forecast_sales * v_progress * 0.01)::numeric, 2),
      ROUND((v_forecast.forecast_sales * v_progress * 0.008)::numeric, 2)
    )
    ON CONFLICT (date, location_id) DO UPDATE SET
      net_sales = EXCLUDED.net_sales,
      gross_sales = EXCLUDED.gross_sales,
      orders_count = EXCLUDED.orders_count,
      payments_cash = EXCLUDED.payments_cash,
      payments_card = EXCLUDED.payments_card;

    -- Update pos_daily_metrics
    INSERT INTO pos_daily_metrics (date, location_id, net_sales, orders, labor_hours, labor_cost)
    VALUES (
      CURRENT_DATE, v_location.id,
      ROUND((v_forecast.forecast_sales * v_progress * (0.92 + random() * 0.16))::numeric, 2),
      ROUND((v_forecast.forecast_orders * v_progress * (0.92 + random() * 0.16))::numeric, 0),
      ROUND((v_forecast.planned_labor_hours * v_progress * (0.92 + random() * 0.12))::numeric, 1),
      ROUND((v_forecast.planned_labor_cost * v_progress * (0.92 + random() * 0.12))::numeric, 2)
    )
    ON CONFLICT (date, location_id) DO UPDATE SET
      net_sales = EXCLUDED.net_sales,
      orders = EXCLUDED.orders,
      labor_hours = EXCLUDED.labor_hours,
      labor_cost = EXCLUDED.labor_cost;
  END LOOP;
END;
$$;


-- 6) SCHEDULE: Update today's partial data every 15 minutes during business hours
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'simulate-today-partial') THEN
      PERFORM cron.unschedule('simulate-today-partial');
    END IF;
    PERFORM cron.schedule('simulate-today-partial', '*/15 8-23 * * *', 'SELECT simulate_today_partial_data()');
  ELSE
    RAISE NOTICE 'pg_cron not available — skipping simulate-today-partial schedule';
  END IF;
END $cron$;
