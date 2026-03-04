-- lint:disable-file (new tables + functions for forecast accuracy tracking)
-- =============================================================================
-- FORECAST ACCURACY TRACKING (Gap 1 of Forecasting Engine v6)
--
-- 1. forecast_accuracy_log — stores predicted vs actual per day/location/model
-- 2. backfill_forecast_accuracy() — nightly RPC to fill actuals from sales
-- 3. v_forecast_accuracy — summary view for frontend dashboard
-- =============================================================================

-- ─── Table: forecast_accuracy_log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.forecast_accuracy_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  location_id   uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  date          date NOT NULL,
  model_name    text NOT NULL DEFAULT 'prophet_v5',
  predicted     numeric NOT NULL,
  actual        numeric,
  error_abs     numeric GENERATED ALWAYS AS (
    CASE WHEN actual IS NOT NULL THEN ABS(predicted - actual) END
  ) STORED,
  error_pct     numeric GENERATED ALWAYS AS (
    CASE WHEN actual IS NOT NULL AND actual > 0
         THEN ABS(predicted - actual) / actual * 100
    END
  ) STORED,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id, date, model_name)
);

-- Indexes for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_date
  ON public.forecast_accuracy_log(date DESC);
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_location_date
  ON public.forecast_accuracy_log(location_id, date DESC);

-- RLS: authenticated users can read their org's data
ALTER TABLE public.forecast_accuracy_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their org forecast accuracy"
  ON public.forecast_accuracy_log FOR SELECT
  TO authenticated
  USING (
    location_id IN (
      SELECT l.id FROM public.locations l
      JOIN public.user_profiles up ON up.org_id = l.org_id
      WHERE up.id = auth.uid()
    )
  );

-- ─── Function: backfill_forecast_accuracy ────────────────────────────────────
-- Reads forecast_daily_metrics (predicted) and joins with actual sales.
-- Uses dynamic SQL with table-existence checks to handle varying schemas.
-- Designed to be called nightly or on-demand.
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

  -- Step 1: Insert new rows from forecast_daily_metrics for past dates
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
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Step 2: Backfill actuals from facts_sales_15m (if it exists)
  IF v_has_facts THEN
    EXECUTE '
      WITH daily_actuals AS (
        SELECT location_id,
               (ts_bucket AT TIME ZONE ''UTC'')::date AS sale_date,
               SUM(sales_net) AS total_sales
        FROM public.facts_sales_15m
        GROUP BY location_id, (ts_bucket AT TIME ZONE ''UTC'')::date
      )
      UPDATE public.forecast_accuracy_log a
      SET actual = da.total_sales
      FROM daily_actuals da
      WHERE a.location_id = da.location_id
        AND a.date = da.sale_date
        AND a.actual IS NULL
        AND da.total_sales > 0
    ';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  -- Step 3: If no POS data, try tickets table (if it exists)
  IF v_updated = 0 AND v_has_tickets THEN
    EXECUTE '
      WITH ticket_actuals AS (
        SELECT location_id,
               (opened_at AT TIME ZONE ''UTC'')::date AS sale_date,
               SUM(net_total) AS total_sales
        FROM public.tickets
        GROUP BY location_id, (opened_at AT TIME ZONE ''UTC'')::date
      )
      UPDATE public.forecast_accuracy_log a
      SET actual = ta.total_sales
      FROM ticket_actuals ta
      WHERE a.location_id = ta.location_id
        AND a.date = ta.sale_date
        AND a.actual IS NULL
        AND ta.total_sales > 0
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

GRANT EXECUTE ON FUNCTION public.backfill_forecast_accuracy() TO authenticated;

-- ─── View: v_forecast_accuracy ───────────────────────────────────────────────
-- Aggregates accuracy metrics per location/model over last 90 days.
-- Frontend reads this for the accuracy dashboard.
CREATE OR REPLACE VIEW public.v_forecast_accuracy AS
SELECT
  location_id,
  model_name,
  COUNT(*) FILTER (WHERE actual IS NOT NULL)     AS days_evaluated,
  COUNT(*) FILTER (WHERE actual IS NULL)         AS days_pending,
  ROUND(AVG(error_pct) FILTER (WHERE actual IS NOT NULL), 1) AS mape,
  ROUND(AVG(predicted - actual) FILTER (WHERE actual IS NOT NULL), 0) AS bias_eur,
  ROUND(
    COUNT(*) FILTER (WHERE error_pct <= 10 AND actual IS NOT NULL)::numeric /
    NULLIF(COUNT(*) FILTER (WHERE actual IS NOT NULL), 0) * 100,
    1
  ) AS hit_rate_10pct,
  ROUND(
    COUNT(*) FILTER (WHERE error_pct <= 5 AND actual IS NOT NULL)::numeric /
    NULLIF(COUNT(*) FILTER (WHERE actual IS NOT NULL), 0) * 100,
    1
  ) AS hit_rate_5pct,
  MIN(date) FILTER (WHERE actual IS NOT NULL) AS first_date,
  MAX(date) FILTER (WHERE actual IS NOT NULL) AS last_date
FROM public.forecast_accuracy_log
WHERE date >= CURRENT_DATE - 90
GROUP BY location_id, model_name;

-- Grant read access
GRANT SELECT ON public.v_forecast_accuracy TO authenticated;
GRANT SELECT ON public.forecast_accuracy_log TO authenticated;

-- Notify PostgREST to refresh its schema cache
NOTIFY pgrst, 'reload schema';
