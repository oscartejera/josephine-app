-- lint:disable-file (new views + functions for hourly forecast decomposition)
-- =============================================================================
-- HOURLY FORECAST DECOMPOSITION (Gap 3 of Forecasting Engine v6)
--
-- 1. mv_hourly_sales_mix — materialized view with DOW × hour sales distribution
-- 2. get_hourly_forecast() — RPC that decomposes daily forecast into hours
-- =============================================================================

-- ─── Materialized View: hourly sales mix ─────────────────────────────────────
-- Calculates DOW × hour sales distribution from historical POS data.
-- Uses facts_sales_15m (15-minute buckets → aggregated to hours).
-- Auto-creates if facts_sales_15m exists, otherwise creates a stub.

DO $$
BEGIN
  IF to_regclass('public.facts_sales_15m') IS NOT NULL THEN
    -- Create materialized view from actual POS data
    EXECUTE '
      CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_hourly_sales_mix AS
      SELECT
        location_id,
        EXTRACT(DOW FROM ts_bucket)::int AS day_of_week,
        EXTRACT(HOUR FROM ts_bucket)::int AS hour,
        SUM(sales_net) AS total_sales,
        COUNT(DISTINCT (ts_bucket::date)) AS days_sampled
      FROM public.facts_sales_15m
      WHERE sales_net > 0
      GROUP BY location_id, EXTRACT(DOW FROM ts_bucket), EXTRACT(HOUR FROM ts_bucket)
      WITH DATA
    ';

    -- Create unique index for concurrent refresh
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE indexname = 'idx_hourly_mix_unique'
    ) THEN
      EXECUTE '
        CREATE UNIQUE INDEX idx_hourly_mix_unique
        ON public.mv_hourly_sales_mix (location_id, day_of_week, hour)
      ';
    END IF;

  ELSE
    -- Stub: create regular view if no POS data available yet
    CREATE OR REPLACE VIEW public.mv_hourly_sales_mix AS
    SELECT
      NULL::uuid AS location_id,
      0::int AS day_of_week,
      0::int AS hour,
      0::numeric AS total_sales,
      0::bigint AS days_sampled
    WHERE false;
  END IF;
END $$;

-- ─── Function: get_hourly_forecast ───────────────────────────────────────────
-- Decomposes a daily forecast into hourly predictions using the DOW × hour mix.
-- Returns one row per hour (typically 8:00-23:00 for restaurants).
CREATE OR REPLACE FUNCTION public.get_hourly_forecast(
  p_location_id uuid,
  p_date date
)
RETURNS TABLE(
  hour int,
  forecast_sales numeric,
  mix_pct numeric,
  is_peak boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily_forecast numeric;
  v_has_mix boolean;
  v_dow int;
BEGIN
  -- Get daily forecast for this date
  SELECT fdm.forecast_sales INTO v_daily_forecast
  FROM public.forecast_daily_metrics fdm
  WHERE fdm.location_id = p_location_id
    AND fdm.date = p_date
  LIMIT 1;

  IF v_daily_forecast IS NULL OR v_daily_forecast <= 0 THEN
    -- No forecast available for this date
    RETURN;
  END IF;

  v_dow := EXTRACT(DOW FROM p_date)::int;

  -- Check if hourly mix data exists for this location + DOW
  SELECT EXISTS(
    SELECT 1 FROM public.mv_hourly_sales_mix m
    WHERE m.location_id = p_location_id
      AND m.day_of_week = v_dow
  ) INTO v_has_mix;

  IF v_has_mix THEN
    -- Use real hourly distribution from POS data
    RETURN QUERY
    WITH hourly_totals AS (
      SELECT
        m.hour AS h,
        m.total_sales,
        SUM(m.total_sales) OVER () AS grand_total
      FROM public.mv_hourly_sales_mix m
      WHERE m.location_id = p_location_id
        AND m.day_of_week = v_dow
        AND m.total_sales > 0
    ),
    hourly_pct AS (
      SELECT
        h,
        total_sales / NULLIF(grand_total, 0) AS pct
      FROM hourly_totals
    ),
    hourly_with_peak AS (
      SELECT
        hp.h,
        ROUND(v_daily_forecast * hp.pct, 2) AS fc,
        ROUND(hp.pct * 100, 1) AS pct_val,
        hp.pct >= (
          SELECT PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY hp2.pct)
          FROM hourly_pct hp2
        ) AS pk
      FROM hourly_pct hp
    )
    SELECT
      hwp.h::int,
      hwp.fc,
      hwp.pct_val,
      hwp.pk
    FROM hourly_with_peak hwp
    ORDER BY hwp.h;
  ELSE
    -- Use default restaurant distribution (10:00-23:00)
    -- Typical restaurant curve: low morning, lunch peak, dinner peak
    RETURN QUERY
    WITH default_mix(h, weight) AS (
      VALUES
        (10, 0.02), (11, 0.05), (12, 0.10), (13, 0.12), (14, 0.10),
        (15, 0.04), (16, 0.04), (17, 0.05), (18, 0.06), (19, 0.10),
        (20, 0.12), (21, 0.10), (22, 0.07), (23, 0.03)
    )
    SELECT
      dm.h::int,
      ROUND(v_daily_forecast * dm.weight, 2),
      ROUND(dm.weight * 100, 1),
      dm.weight >= 0.10
    FROM default_mix dm
    ORDER BY dm.h;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_hourly_forecast(uuid, date) TO authenticated;

-- ─── Function: refresh_hourly_mix ────────────────────────────────────────────
-- Call periodically to update the materialized view (e.g., weekly cron).
CREATE OR REPLACE FUNCTION public.refresh_hourly_mix()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.mv_hourly_sales_mix') IS NOT NULL
     AND to_regclass('public.facts_sales_15m') IS NOT NULL THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_hourly_sales_mix;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_hourly_mix() TO authenticated;

-- Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
