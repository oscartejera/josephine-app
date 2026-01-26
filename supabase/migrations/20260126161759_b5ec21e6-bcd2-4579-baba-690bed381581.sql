-- Table: forecast_hourly_metrics
-- Stores AI-generated hourly sales predictions with confidence and factors

CREATE TABLE public.forecast_hourly_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  forecast_sales NUMERIC(12,2) NOT NULL DEFAULT 0,
  forecast_covers INTEGER NOT NULL DEFAULT 0,
  forecast_orders INTEGER NOT NULL DEFAULT 0,
  confidence INTEGER NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  factors JSONB,
  model_version TEXT DEFAULT 'AI_HOURLY_v1',
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT forecast_hourly_metrics_unique UNIQUE(location_id, date, hour)
);

-- Enable RLS
ALTER TABLE public.forecast_hourly_metrics ENABLE ROW LEVEL SECURITY;

-- Index for efficient queries by location and date range
CREATE INDEX idx_forecast_hourly_location_date ON public.forecast_hourly_metrics(location_id, date);

-- RLS Policies: Users can read forecasts for locations they have access to
CREATE POLICY "Users can view forecasts for their locations"
ON public.forecast_hourly_metrics
FOR SELECT
USING (
  location_id IN (
    SELECT ur.location_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
);

-- Service role can insert/update (for edge functions)
CREATE POLICY "Service role can manage forecasts"
ON public.forecast_hourly_metrics
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.forecast_hourly_metrics;

COMMENT ON TABLE public.forecast_hourly_metrics IS 'AI-generated hourly sales forecasts with confidence scores and explanatory factors';