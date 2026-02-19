-- Create table to track report subscriptions and preferences
CREATE TABLE public.report_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('daily_sales', 'weekly_summary', 'kpi_alerts')),
  is_enabled boolean DEFAULT true,
  email_override text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, group_id, location_id, report_type)
);

-- Create table to log sent reports
CREATE TABLE public.report_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  group_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message text,
  report_data jsonb,
  sent_at timestamptz DEFAULT now()
);

-- Create table for KPI thresholds
CREATE TABLE public.kpi_alert_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  kpi_name text NOT NULL,
  min_threshold numeric,
  max_threshold numeric,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(group_id, location_id, kpi_name)
);

-- Enable RLS
ALTER TABLE public.report_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_alert_thresholds ENABLE ROW LEVEL SECURITY;

-- RLS Policies for report_subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON public.report_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own subscriptions"
  ON public.report_subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for report_logs (owners/admins only via profiles)
CREATE POLICY "Owners can view report logs"
  ON public.report_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON p.id = ur.user_id
      JOIN public.roles r ON ur.role_id = r.id
      WHERE p.id = auth.uid()
        AND p.group_id = report_logs.group_id
        AND r.name IN ('owner', 'admin')
    )
  );

-- RLS Policies for kpi_alert_thresholds
CREATE POLICY "Group members can view thresholds"
  ON public.kpi_alert_thresholds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.group_id = kpi_alert_thresholds.group_id
    )
  );

CREATE POLICY "Owners can manage thresholds"
  ON public.kpi_alert_thresholds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON p.id = ur.user_id
      JOIN public.roles r ON ur.role_id = r.id
      WHERE p.id = auth.uid()
        AND p.group_id = kpi_alert_thresholds.group_id
        AND r.name IN ('owner', 'admin')
    )
  );

-- Insert default KPI thresholds for demo group
INSERT INTO public.kpi_alert_thresholds (group_id, kpi_name, min_threshold, max_threshold)
SELECT 
  id as group_id,
  kpi.kpi_name,
  kpi.min_threshold,
  kpi.max_threshold
FROM public.orgs,
LATERAL (
  VALUES 
    ('labour_cost_percent', NULL::numeric, 30::numeric),
    ('cogs_percent', NULL::numeric, 35::numeric),
    ('prime_cost_percent', NULL::numeric, 65::numeric),
    ('daily_sales', 1000::numeric, NULL::numeric),
    ('average_check', 15::numeric, NULL::numeric)
) AS kpi(kpi_name, min_threshold, max_threshold)
ON CONFLICT DO NOTHING;

-- Create function to get daily sales summary data
CREATE OR REPLACE FUNCTION public.get_daily_sales_summary(
  p_group_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_date date DEFAULT CURRENT_DATE - 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'date', p_date,
    'locations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'location_id', l.id,
        'location_name', l.name,
        'net_sales', COALESCE(pdf.net_sales, 0),
        'orders_count', COALESCE(pdf.orders_count, 0),
        'payments_cash', COALESCE(pdf.payments_cash, 0),
        'payments_card', COALESCE(pdf.payments_card, 0),
        'labour_cost', COALESCE(ld.labour_cost, 0),
        'labour_hours', COALESCE(ld.labour_hours, 0),
        'cogs', COALESCE(cd.cogs_amount, 0),
        'labour_percent', CASE WHEN COALESCE(pdf.net_sales, 0) > 0 
          THEN ROUND((COALESCE(ld.labour_cost, 0) / pdf.net_sales * 100)::numeric, 1) 
          ELSE 0 END,
        'cogs_percent', CASE WHEN COALESCE(pdf.net_sales, 0) > 0 
          THEN ROUND((COALESCE(cd.cogs_amount, 0) / pdf.net_sales * 100)::numeric, 1) 
          ELSE 0 END
      ) ORDER BY l.name)
      FROM public.locations l
      LEFT JOIN public.pos_daily_finance pdf 
        ON l.id = pdf.location_id AND pdf.date = p_date
      LEFT JOIN public.labour_daily ld 
        ON l.id = ld.location_id AND ld.date = p_date
      LEFT JOIN public.cogs_daily cd 
        ON l.id = cd.location_id AND cd.date = p_date
      WHERE l.group_id = p_group_id
        AND l.active = true
        AND (p_location_id IS NULL OR l.id = p_location_id)
    ), '[]'::jsonb),
    'totals', (
      SELECT jsonb_build_object(
        'total_sales', COALESCE(SUM(pdf.net_sales), 0),
        'total_orders', COALESCE(SUM(pdf.orders_count), 0),
        'total_labour', COALESCE(SUM(ld.labour_cost), 0),
        'total_cogs', COALESCE(SUM(cd.cogs_amount), 0),
        'avg_check', CASE WHEN COALESCE(SUM(pdf.orders_count), 0) > 0 
          THEN ROUND((COALESCE(SUM(pdf.net_sales), 0) / SUM(pdf.orders_count))::numeric, 2) 
          ELSE 0 END
      )
      FROM public.locations l
      LEFT JOIN public.pos_daily_finance pdf 
        ON l.id = pdf.location_id AND pdf.date = p_date
      LEFT JOIN public.labour_daily ld 
        ON l.id = ld.location_id AND ld.date = p_date
      LEFT JOIN public.cogs_daily cd 
        ON l.id = cd.location_id AND cd.date = p_date
      WHERE l.group_id = p_group_id
        AND l.active = true
        AND (p_location_id IS NULL OR l.id = p_location_id)
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Create function to get weekly summary data
CREATE OR REPLACE FUNCTION public.get_weekly_sales_summary(
  p_group_id uuid,
  p_week_start date DEFAULT (date_trunc('week', CURRENT_DATE - 7))::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  week_end date := p_week_start + 6;
BEGIN
  SELECT jsonb_build_object(
    'week_start', p_week_start,
    'week_end', week_end,
    'locations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'location_id', l.id,
        'location_name', l.name,
        'total_sales', COALESCE(sales.total, 0),
        'total_orders', COALESCE(sales.orders, 0),
        'total_labour', COALESCE(labour.total, 0),
        'total_cogs', COALESCE(cogs.total, 0),
        'avg_daily_sales', ROUND(COALESCE(sales.total / 7, 0)::numeric, 2),
        'labour_percent', CASE WHEN COALESCE(sales.total, 0) > 0 
          THEN ROUND((COALESCE(labour.total, 0) / sales.total * 100)::numeric, 1) 
          ELSE 0 END,
        'cogs_percent', CASE WHEN COALESCE(sales.total, 0) > 0 
          THEN ROUND((COALESCE(cogs.total, 0) / sales.total * 100)::numeric, 1) 
          ELSE 0 END,
        'prime_cost_percent', CASE WHEN COALESCE(sales.total, 0) > 0 
          THEN ROUND(((COALESCE(labour.total, 0) + COALESCE(cogs.total, 0)) / sales.total * 100)::numeric, 1) 
          ELSE 0 END
      ) ORDER BY sales.total DESC NULLS LAST)
      FROM public.locations l
      LEFT JOIN (
        SELECT location_id, SUM(net_sales) as total, SUM(orders_count) as orders
        FROM public.pos_daily_finance
        WHERE date BETWEEN p_week_start AND week_end
        GROUP BY location_id
      ) sales ON l.id = sales.location_id
      LEFT JOIN (
        SELECT location_id, SUM(labour_cost) as total
        FROM public.labour_daily
        WHERE date BETWEEN p_week_start AND week_end
        GROUP BY location_id
      ) labour ON l.id = labour.location_id
      LEFT JOIN (
        SELECT location_id, SUM(cogs_amount) as total
        FROM public.cogs_daily
        WHERE date BETWEEN p_week_start AND week_end
        GROUP BY location_id
      ) cogs ON l.id = cogs.location_id
      WHERE l.group_id = p_group_id
        AND l.active = true
    ), '[]'::jsonb),
    'totals', (
      SELECT jsonb_build_object(
        'total_sales', COALESCE(SUM(pdf.net_sales), 0),
        'total_orders', COALESCE(SUM(pdf.orders_count), 0),
        'total_labour', COALESCE(SUM(ld.labour_cost), 0),
        'total_cogs', COALESCE(SUM(cd.cogs_amount), 0),
        'avg_check', CASE WHEN COALESCE(SUM(pdf.orders_count), 0) > 0 
          THEN ROUND((SUM(pdf.net_sales) / SUM(pdf.orders_count))::numeric, 2) 
          ELSE 0 END,
        'prime_cost_percent', CASE WHEN COALESCE(SUM(pdf.net_sales), 0) > 0 
          THEN ROUND(((COALESCE(SUM(ld.labour_cost), 0) + COALESCE(SUM(cd.cogs_amount), 0)) / SUM(pdf.net_sales) * 100)::numeric, 1) 
          ELSE 0 END
      )
      FROM public.locations l
      LEFT JOIN public.pos_daily_finance pdf 
        ON l.id = pdf.location_id AND pdf.date BETWEEN p_week_start AND week_end
      LEFT JOIN public.labour_daily ld 
        ON l.id = ld.location_id AND ld.date BETWEEN p_week_start AND week_end
      LEFT JOIN public.cogs_daily cd 
        ON l.id = cd.location_id AND cd.date BETWEEN p_week_start AND week_end
      WHERE l.group_id = p_group_id
        AND l.active = true
    ),
    'daily_breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', d.date,
        'sales', COALESCE(SUM(pdf.net_sales), 0),
        'orders', COALESCE(SUM(pdf.orders_count), 0)
      ) ORDER BY d.date)
      FROM generate_series(p_week_start, week_end, '1 day'::interval) d(date)
      LEFT JOIN public.pos_daily_finance pdf 
        ON pdf.date = d.date::date
        AND pdf.location_id IN (SELECT id FROM public.locations WHERE group_id = p_group_id AND active = true)
      GROUP BY d.date
    ), '[]'::jsonb)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Create function to check KPI alerts
CREATE OR REPLACE FUNCTION public.check_kpi_alerts(
  p_group_id uuid,
  p_date date DEFAULT CURRENT_DATE - 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alerts jsonb := '[]'::jsonb;
BEGIN
  -- Check each location's KPIs against thresholds
  SELECT COALESCE(jsonb_agg(alert), '[]'::jsonb)
  INTO alerts
  FROM (
    SELECT jsonb_build_object(
      'location_id', l.id,
      'location_name', l.name,
      'kpi_name', t.kpi_name,
      'actual_value', ROUND(actual.value::numeric, 2),
      'threshold_type', CASE 
        WHEN t.min_threshold IS NOT NULL AND actual.value < t.min_threshold THEN 'below_minimum'
        WHEN t.max_threshold IS NOT NULL AND actual.value > t.max_threshold THEN 'above_maximum'
      END,
      'threshold_value', COALESCE(
        CASE WHEN t.min_threshold IS NOT NULL AND actual.value < t.min_threshold THEN t.min_threshold END,
        CASE WHEN t.max_threshold IS NOT NULL AND actual.value > t.max_threshold THEN t.max_threshold END
      ),
      'severity', CASE 
        WHEN t.kpi_name IN ('prime_cost_percent', 'labour_cost_percent') THEN 'high'
        ELSE 'medium'
      END
    ) as alert
    FROM public.locations l
    CROSS JOIN public.kpi_alert_thresholds t
    LEFT JOIN LATERAL (
      SELECT CASE t.kpi_name
        WHEN 'labour_cost_percent' THEN
          CASE WHEN COALESCE(pdf.net_sales, 0) > 0 
            THEN (COALESCE(ld.labour_cost, 0) / pdf.net_sales * 100) 
            ELSE NULL END
        WHEN 'cogs_percent' THEN
          CASE WHEN COALESCE(pdf.net_sales, 0) > 0 
            THEN (COALESCE(cd.cogs_amount, 0) / pdf.net_sales * 100) 
            ELSE NULL END
        WHEN 'prime_cost_percent' THEN
          CASE WHEN COALESCE(pdf.net_sales, 0) > 0 
            THEN ((COALESCE(ld.labour_cost, 0) + COALESCE(cd.cogs_amount, 0)) / pdf.net_sales * 100) 
            ELSE NULL END
        WHEN 'daily_sales' THEN pdf.net_sales
        WHEN 'average_check' THEN
          CASE WHEN COALESCE(pdf.orders_count, 0) > 0 
            THEN (pdf.net_sales / pdf.orders_count) 
            ELSE NULL END
      END as value
      FROM public.pos_daily_finance pdf
      LEFT JOIN public.labour_daily ld ON l.id = ld.location_id AND ld.date = p_date
      LEFT JOIN public.cogs_daily cd ON l.id = cd.location_id AND cd.date = p_date
      WHERE pdf.location_id = l.id AND pdf.date = p_date
    ) actual ON true
    WHERE l.group_id = p_group_id
      AND l.active = true
      AND t.group_id = p_group_id
      AND t.is_enabled = true
      AND (t.location_id IS NULL OR t.location_id = l.id)
      AND actual.value IS NOT NULL
      AND (
        (t.min_threshold IS NOT NULL AND actual.value < t.min_threshold)
        OR (t.max_threshold IS NOT NULL AND actual.value > t.max_threshold)
      )
  ) alerts_subq;
  
  RETURN jsonb_build_object(
    'date', p_date,
    'group_id', p_group_id,
    'alerts_count', jsonb_array_length(alerts),
    'alerts', alerts
  );
END;
$$;