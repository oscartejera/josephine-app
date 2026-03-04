-- ============================================================================
-- FIX: backfill_forecast_accuracy — remove reference to non-existent column
-- 
-- forecast_daily_metrics does NOT have a model_version column in production.
-- This patch:
--   1. Adds model_version column to forecast_daily_metrics (for future use)
--   2. Fixes backfill_forecast_accuracy to handle missing column gracefully
-- ============================================================================

-- Add model_version column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE public.forecast_daily_metrics
    ADD COLUMN IF NOT EXISTS model_version text DEFAULT 'prophet_v4';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'model_version column: %', SQLERRM;
END $$;

-- Recreate the function with fix
CREATE OR REPLACE FUNCTION public.backfill_forecast_accuracy()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
  v_updated  integer := 0;
  v_has_forecast boolean;
  v_has_facts boolean;
  v_has_tickets boolean;
  v_has_model_col boolean;
BEGIN
  -- Check which tables exist
  v_has_forecast := to_regclass('public.forecast_daily_metrics') IS NOT NULL;
  v_has_facts    := to_regclass('public.facts_sales_15m') IS NOT NULL;
  v_has_tickets  := to_regclass('public.tickets') IS NOT NULL;

  IF NOT v_has_forecast THEN
    RETURN jsonb_build_object(
      'predictions_logged', 0,
      'actuals_backfilled', 0,
      'message', 'forecast_daily_metrics table not found',
      'run_at', now()
    );
  END IF;

  -- Check if model_version column exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'forecast_daily_metrics'
      AND column_name = 'model_version'
  ) INTO v_has_model_col;

  -- Step 1: Insert new rows from forecast_daily_metrics for past dates
  IF v_has_model_col THEN
    EXECUTE '
      INSERT INTO public.forecast_accuracy_log (location_id, date, model_name, predicted)
      SELECT
        f.location_id, f.date,
        COALESCE(f.model_version, ''prophet_v4''),
        f.forecast_sales
      FROM public.forecast_daily_metrics f
      WHERE f.date < CURRENT_DATE
        AND f.forecast_sales > 0
        AND NOT EXISTS (
          SELECT 1 FROM public.forecast_accuracy_log a
          WHERE a.location_id = f.location_id
            AND a.date = f.date
            AND a.model_name = COALESCE(f.model_version, ''prophet_v4'')
        )
      ON CONFLICT (location_id, date, model_name) DO NOTHING
    ';
  ELSE
    -- model_version column doesn't exist — use hardcoded default
    EXECUTE '
      INSERT INTO public.forecast_accuracy_log (location_id, date, model_name, predicted)
      SELECT
        f.location_id, f.date,
        ''prophet_v4'',
        f.forecast_sales
      FROM public.forecast_daily_metrics f
      WHERE f.date < CURRENT_DATE
        AND f.forecast_sales > 0
        AND NOT EXISTS (
          SELECT 1 FROM public.forecast_accuracy_log a
          WHERE a.location_id = f.location_id
            AND a.date = f.date
            AND a.model_name = ''prophet_v4''
        )
      ON CONFLICT (location_id, date, model_name) DO NOTHING
    ';
  END IF;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Step 2: Backfill actuals from facts_sales_15m (if it exists)
  IF v_has_facts THEN
    EXECUTE '
      WITH daily_actuals AS (
        SELECT location_id,
               (ts_bucket AT TIME ZONE ''UTC'')::date AS sale_date,
               SUM(sales_net) AS actual_sales
        FROM public.facts_sales_15m
        WHERE sales_net > 0
        GROUP BY location_id, (ts_bucket AT TIME ZONE ''UTC'')::date
      )
      UPDATE public.forecast_accuracy_log a
      SET actual = da.actual_sales
      FROM daily_actuals da
      WHERE a.location_id = da.location_id
        AND a.date = da.sale_date
        AND a.actual IS NULL
    ';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  -- Step 3: Fallback to tickets table for actuals (if facts_sales_15m empty)
  IF v_has_tickets AND v_updated = 0 THEN
    EXECUTE '
      WITH ticket_actuals AS (
        SELECT location_id,
               (opened_at AT TIME ZONE ''UTC'')::date AS sale_date,
               SUM(net_total) AS actual_sales
        FROM public.tickets
        WHERE net_total > 0
        GROUP BY location_id, (opened_at AT TIME ZONE ''UTC'')::date
      )
      UPDATE public.forecast_accuracy_log a
      SET actual = ta.actual_sales
      FROM ticket_actuals ta
      WHERE a.location_id = ta.location_id
        AND a.date = ta.sale_date
        AND a.actual IS NULL
    ';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  -- Step 4: Fallback to pos_daily_finance for actuals
  IF v_updated = 0 AND to_regclass('public.pos_daily_finance') IS NOT NULL THEN
    EXECUTE '
      UPDATE public.forecast_accuracy_log a
      SET actual = p.net_sales
      FROM public.pos_daily_finance p
      WHERE a.location_id = p.location_id
        AND a.date = p.date
        AND a.actual IS NULL
        AND p.net_sales > 0
    ';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'predictions_logged', v_inserted,
    'actuals_backfilled', v_updated,
    'run_at', now()
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
