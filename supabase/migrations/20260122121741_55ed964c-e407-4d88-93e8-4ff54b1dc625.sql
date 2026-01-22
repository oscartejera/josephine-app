-- ============================================
-- FASE C: Forecasting Engine - Tabla de auditoría + columnas adicionales
-- ============================================

-- 1. Create forecast_model_runs table for auditing
CREATE TABLE IF NOT EXISTS public.forecast_model_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  model_version text NOT NULL,
  algorithm text NOT NULL DEFAULT 'linear_regression_seasonal',
  history_start date NOT NULL,
  history_end date NOT NULL,
  horizon_days integer NOT NULL DEFAULT 365,
  mse numeric,
  mape numeric,
  confidence numeric,
  data_points integer,
  trend_slope numeric,
  trend_intercept numeric,
  seasonality_dow jsonb,
  seasonality_woy jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.forecast_model_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "forecast_model_runs_select" ON public.forecast_model_runs
  FOR SELECT USING (
    location_id IN (SELECT public.get_accessible_location_ids())
  );

CREATE POLICY "forecast_model_runs_insert" ON public.forecast_model_runs
  FOR INSERT WITH CHECK (
    location_id IN (SELECT public.get_accessible_location_ids())
  );

-- 2. Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_forecast_model_runs_location_date 
ON forecast_model_runs(location_id, generated_at DESC);

-- 3. Ensure forecast_daily_metrics has trend/seasonality fields if needed later
-- (columns already added in previous migration: mse, mape, confidence, model_version, generated_at)

-- 4. Add realtime for forecast updates (optional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.forecast_model_runs;

-- 5. Create function to get latest forecast run per location
CREATE OR REPLACE FUNCTION public.get_latest_forecast_run(p_location_id uuid)
RETURNS forecast_model_runs
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM forecast_model_runs
  WHERE location_id = p_location_id
  ORDER BY generated_at DESC
  LIMIT 1;
$$;

-- 6. Create function to check if forecast needs refresh (older than 24h or doesn't exist)
CREATE OR REPLACE FUNCTION public.forecast_needs_refresh(p_location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT generated_at < now() - interval '24 hours'
     FROM forecast_model_runs
     WHERE location_id = p_location_id
     ORDER BY generated_at DESC
     LIMIT 1),
    true -- No forecast exists, needs refresh
  );
$$;