-- Fix unique constraints to allow both 'pos' and 'simulated' rows to coexist
-- for the same (date, location_id). This enables switching between POS and
-- simulated data without deleting either.

-- 1) pos_daily_finance: drop old unique, add new with data_source
ALTER TABLE pos_daily_finance DROP CONSTRAINT IF EXISTS pos_daily_finance_date_location_id_key;
ALTER TABLE pos_daily_finance ADD CONSTRAINT pos_daily_finance_date_location_source_key
  UNIQUE (date, location_id, data_source);

-- 2) product_sales_daily: drop old unique, add new with data_source
ALTER TABLE product_sales_daily DROP CONSTRAINT IF EXISTS product_sales_daily_date_location_id_product_id_key;
ALTER TABLE product_sales_daily ADD CONSTRAINT product_sales_daily_date_loc_prod_source_key
  UNIQUE (date, location_id, product_id, data_source);

-- 3) pos_daily_metrics: drop old unique, add new with data_source
ALTER TABLE pos_daily_metrics DROP CONSTRAINT IF EXISTS pos_daily_metrics_date_location_id_key;
ALTER TABLE pos_daily_metrics ADD CONSTRAINT pos_daily_metrics_date_location_source_key
  UNIQUE (date, location_id, data_source);

-- 4) Update get_top_products RPC to accept data_source parameter
CREATE OR REPLACE FUNCTION public.get_top_products(
  p_location_id uuid DEFAULT NULL,
  p_date_from date DEFAULT (CURRENT_DATE - INTERVAL '7 days')::date,
  p_date_to date DEFAULT CURRENT_DATE,
  p_order_by text DEFAULT 'share',
  p_data_source text DEFAULT 'simulated'
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  category text,
  units numeric,
  sales numeric,
  sales_share_pct numeric,
  cogs numeric,
  gp numeric,
  gp_pct numeric,
  badge_label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_sales numeric;
  v_group_id uuid;
BEGIN
  -- Get user's group_id
  v_group_id := get_user_group_id();

  -- Calculate total sales for the period, filtered by data_source
  SELECT COALESCE(SUM(psd.net_sales), 0)
  INTO v_total_sales
  FROM public.product_sales_daily psd
  JOIN public.locations l ON l.id = psd.location_id
  WHERE l.group_id = v_group_id
    AND psd.date >= p_date_from
    AND psd.date <= p_date_to
    AND psd.data_source = p_data_source
    AND (p_location_id IS NULL OR psd.location_id = p_location_id);

  -- If no sales, return empty
  IF v_total_sales = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH aggregated AS (
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.category,
      SUM(psd.units_sold) AS units,
      SUM(psd.net_sales) AS sales,
      SUM(psd.cogs) AS cogs
    FROM public.product_sales_daily psd
    JOIN public.products p ON p.id = psd.product_id
    JOIN public.locations l ON l.id = psd.location_id
    WHERE l.group_id = v_group_id
      AND psd.date >= p_date_from
      AND psd.date <= p_date_to
      AND psd.data_source = p_data_source
      AND (p_location_id IS NULL OR psd.location_id = p_location_id)
    GROUP BY p.id, p.name, p.category
  ),
  calculated AS (
    SELECT
      a.product_id,
      a.product_name,
      a.category,
      a.units,
      a.sales,
      CASE WHEN v_total_sales > 0 THEN ROUND((a.sales / v_total_sales) * 100, 2) ELSE 0 END AS sales_share_pct,
      a.cogs,
      ROUND(a.sales - a.cogs, 2) AS gp,
      CASE WHEN a.sales > 0 THEN ROUND(((a.sales - a.cogs) / a.sales) * 100, 1) ELSE 0 END AS gp_pct
    FROM aggregated a
  )
  SELECT
    c.product_id,
    c.product_name,
    c.category,
    c.units,
    c.sales,
    c.sales_share_pct,
    c.cogs,
    c.gp,
    c.gp_pct,
    CASE
      WHEN c.gp_pct < 50 THEN 'Low margin'
      ELSE NULL
    END AS badge_label
  FROM calculated c
  ORDER BY
    CASE p_order_by
      WHEN 'share' THEN c.sales_share_pct
      WHEN 'gp_eur' THEN c.gp
      WHEN 'gp_pct' THEN c.gp_pct
      ELSE c.sales_share_pct
    END DESC
  LIMIT 10;
END;
$$;
