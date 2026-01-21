-- Create indexes for performance (if not exist)
CREATE INDEX IF NOT EXISTS idx_product_sales_daily_date_location 
ON public.product_sales_daily(date, location_id);

CREATE INDEX IF NOT EXISTS idx_product_sales_daily_product_date 
ON public.product_sales_daily(product_id, date);

-- Create table for storing action plans
CREATE TABLE IF NOT EXISTS public.menu_engineering_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  location_id uuid REFERENCES public.locations(id),
  date_from date NOT NULL,
  date_to date NOT NULL,
  product_id uuid REFERENCES public.products(id),
  action_type text NOT NULL,
  classification text NOT NULL,
  estimated_impact_eur numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.menu_engineering_actions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own actions"
ON public.menu_engineering_actions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own actions"
ON public.menu_engineering_actions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own actions"
ON public.menu_engineering_actions FOR DELETE
USING (auth.uid() = user_id);

-- Main RPC function for menu engineering with server-side aggregation
CREATE OR REPLACE FUNCTION public.menu_engineering_summary(
  p_date_from date,
  p_date_to date,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  product_id uuid,
  name text,
  category text,
  units numeric,
  sales numeric,
  cogs numeric,
  profit_eur numeric,
  margin_pct numeric,
  profit_per_sale numeric,
  popularity_share numeric,
  sales_share numeric,
  classification text,
  action_tag text,
  badges text[],
  total_units_period numeric,
  total_sales_period numeric,
  pop_threshold numeric,
  margin_threshold numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_group_id uuid;
  v_total_units numeric;
  v_total_sales numeric;
  v_pop_threshold numeric;
  v_margin_threshold numeric;
BEGIN
  -- Get user's group
  v_group_id := get_user_group_id();
  
  -- Calculate totals for the period
  SELECT 
    COALESCE(SUM(psd.units_sold), 0),
    COALESCE(SUM(psd.net_sales), 0)
  INTO v_total_units, v_total_sales
  FROM product_sales_daily psd
  JOIN locations l ON l.id = psd.location_id
  WHERE l.group_id = v_group_id
    AND psd.date >= p_date_from
    AND psd.date <= p_date_to
    AND (p_location_id IS NULL OR psd.location_id = p_location_id)
    AND psd.location_id IN (SELECT get_accessible_location_ids());
  
  -- If no data, return empty
  IF v_total_units = 0 THEN
    RETURN;
  END IF;
  
  -- Calculate thresholds using percentile on aggregated data
  WITH aggregated AS (
    SELECT 
      psd.product_id,
      SUM(psd.units_sold) as agg_units,
      SUM(psd.net_sales) as agg_sales,
      SUM(psd.cogs) as agg_cogs
    FROM product_sales_daily psd
    JOIN locations l ON l.id = psd.location_id
    WHERE l.group_id = v_group_id
      AND psd.date >= p_date_from
      AND psd.date <= p_date_to
      AND (p_location_id IS NULL OR psd.location_id = p_location_id)
      AND psd.location_id IN (SELECT get_accessible_location_ids())
    GROUP BY psd.product_id
    HAVING SUM(psd.units_sold) > 0
  ),
  with_margin AS (
    SELECT 
      agg_units,
      CASE WHEN agg_sales > 0 THEN ((agg_sales - agg_cogs) / agg_sales) * 100 ELSE 0 END as margin
    FROM aggregated
  )
  SELECT 
    percentile_cont(0.6) WITHIN GROUP (ORDER BY agg_units),
    percentile_cont(0.6) WITHIN GROUP (ORDER BY margin)
  INTO v_pop_threshold, v_margin_threshold
  FROM with_margin;
  
  -- Return aggregated results with classification
  RETURN QUERY
  WITH aggregated AS (
    SELECT 
      psd.product_id as pid,
      p.name as pname,
      COALESCE(p.category, 'Other') as pcategory,
      SUM(psd.units_sold) as agg_units,
      SUM(psd.net_sales) as agg_sales,
      SUM(psd.cogs) as agg_cogs
    FROM product_sales_daily psd
    JOIN products p ON p.id = psd.product_id
    JOIN locations l ON l.id = psd.location_id
    WHERE l.group_id = v_group_id
      AND psd.date >= p_date_from
      AND psd.date <= p_date_to
      AND (p_location_id IS NULL OR psd.location_id = p_location_id)
      AND psd.location_id IN (SELECT get_accessible_location_ids())
    GROUP BY psd.product_id, p.name, p.category
    HAVING SUM(psd.units_sold) > 0
  ),
  calculated AS (
    SELECT 
      pid,
      pname,
      pcategory,
      agg_units,
      ROUND(agg_sales::numeric, 2) as agg_sales,
      ROUND(agg_cogs::numeric, 2) as agg_cogs,
      ROUND((agg_sales - agg_cogs)::numeric, 2) as profit,
      CASE WHEN agg_sales > 0 THEN ROUND(((agg_sales - agg_cogs) / agg_sales * 100)::numeric, 2) ELSE 0 END as margin,
      CASE WHEN agg_units > 0 THEN ROUND(((agg_sales - agg_cogs) / agg_units)::numeric, 2) ELSE 0 END as profit_per,
      CASE WHEN v_total_units > 0 THEN ROUND((agg_units / v_total_units * 100)::numeric, 4) ELSE 0 END as pop_share,
      CASE WHEN v_total_sales > 0 THEN ROUND((agg_sales / v_total_sales * 100)::numeric, 4) ELSE 0 END as sales_share_val
    FROM aggregated
  ),
  classified AS (
    SELECT 
      *,
      CASE 
        WHEN agg_units >= v_pop_threshold AND margin >= v_margin_threshold THEN 'star'
        WHEN agg_units >= v_pop_threshold AND margin < v_margin_threshold THEN 'plow_horse'
        WHEN agg_units < v_pop_threshold AND margin >= v_margin_threshold THEN 'puzzle'
        ELSE 'dog'
      END as class,
      CASE 
        WHEN agg_units >= v_pop_threshold AND margin >= v_margin_threshold THEN 'Mantener'
        WHEN agg_units >= v_pop_threshold AND margin < v_margin_threshold THEN 'Subir precio'
        WHEN agg_units < v_pop_threshold AND margin >= v_margin_threshold THEN 'Promocionar'
        ELSE 'Revisar'
      END as action,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN sales_share_val > 5 AND margin < v_margin_threshold THEN 'Vende mucho pero deja poco' END,
        CASE WHEN margin > v_margin_threshold AND sales_share_val < 1 THEN 'Joya oculta' END,
        CASE WHEN profit < 0 THEN 'Pérdidas' END
      ], NULL) as badge_arr
    FROM calculated
  )
  SELECT 
    pid,
    pname,
    pcategory,
    agg_units,
    agg_sales,
    agg_cogs,
    profit,
    margin,
    profit_per,
    pop_share,
    sales_share_val,
    class,
    action,
    badge_arr,
    v_total_units,
    v_total_sales,
    ROUND(v_pop_threshold::numeric, 2),
    ROUND(v_margin_threshold::numeric, 2)
  FROM classified
  ORDER BY agg_sales DESC;
END;
$$;