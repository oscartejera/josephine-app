-- =============================================
-- LABOUR ANALYTICS TABLES
-- =============================================

-- 1) pos_daily_metrics table
CREATE TABLE IF NOT EXISTS public.pos_daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  net_sales numeric NOT NULL DEFAULT 0,
  orders numeric NOT NULL DEFAULT 0,
  labor_hours numeric NOT NULL DEFAULT 0,
  labor_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date, location_id)
);

-- Indexes for pos_daily_metrics
CREATE INDEX IF NOT EXISTS idx_pos_daily_metrics_date_location ON public.pos_daily_metrics(date, location_id);
CREATE INDEX IF NOT EXISTS idx_pos_daily_metrics_location_date ON public.pos_daily_metrics(location_id, date);

-- Enable RLS
ALTER TABLE public.pos_daily_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pos_daily_metrics
CREATE POLICY "Users can view pos metrics for accessible locations"
  ON public.pos_daily_metrics FOR SELECT
  USING (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Managers can manage pos metrics"
  ON public.pos_daily_metrics FOR ALL
  USING (is_admin_or_ops() AND location_id IN (SELECT get_accessible_location_ids()));

-- 2) forecast_daily_metrics table
CREATE TABLE IF NOT EXISTS public.forecast_daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  forecast_sales numeric NOT NULL DEFAULT 0,
  forecast_orders numeric NOT NULL DEFAULT 0,
  planned_labor_hours numeric NOT NULL DEFAULT 0,
  planned_labor_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date, location_id)
);

-- Indexes for forecast_daily_metrics
CREATE INDEX IF NOT EXISTS idx_forecast_daily_metrics_date_location ON public.forecast_daily_metrics(date, location_id);
CREATE INDEX IF NOT EXISTS idx_forecast_daily_metrics_location_date ON public.forecast_daily_metrics(location_id, date);

-- Enable RLS
ALTER TABLE public.forecast_daily_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forecast_daily_metrics
CREATE POLICY "Users can view forecast metrics for accessible locations"
  ON public.forecast_daily_metrics FOR SELECT
  USING (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Managers can manage forecast metrics"
  ON public.forecast_daily_metrics FOR ALL
  USING (is_admin_or_ops() AND location_id IN (SELECT get_accessible_location_ids()));