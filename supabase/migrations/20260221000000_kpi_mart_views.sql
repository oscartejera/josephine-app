-- ============================================================
-- KPI Contract: mart views + summary RPC
-- Single source of truth for all KPI calculations
-- ============================================================

-- ------------------------------------------------------------
-- 1. mart_kpi_daily — One row per location per day
--    Joins sales, labour, COGS with source labels
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW mart_kpi_daily AS
SELECT
  s.org_id,
  s.location_id,
  s.date,
  -- Sales (always actual from POS/CDM)
  s.net_sales,
  s.orders_count,
  0::integer AS covers,
  CASE WHEN s.orders_count > 0
       THEN s.net_sales / s.orders_count
       ELSE 0 END AS avg_check,
  -- Labour
  l.actual_cost AS labour_cost,
  l.actual_hours AS labour_hours,
  CASE WHEN s.net_sales > 0 AND l.actual_cost IS NOT NULL
       THEN (l.actual_cost / s.net_sales) * 100
       ELSE NULL END AS col_percent,
  -- COGS: cascade stock_movements → default_cogs_percent → 30%
  COALESCE(
    NULLIF(c.cogs_amount, 0),
    s.net_sales * COALESCE(ls.default_cogs_percent, 30) / 100.0
  ) AS cogs,
  CASE
    WHEN NULLIF(c.cogs_amount, 0) IS NOT NULL THEN 'actual'
    ELSE 'estimated'
  END AS cogs_source,
  -- GP%
  CASE WHEN s.net_sales > 0 THEN
    ((s.net_sales - COALESCE(
      NULLIF(c.cogs_amount, 0),
      s.net_sales * COALESCE(ls.default_cogs_percent, 30) / 100.0
    )) / s.net_sales) * 100
  ELSE NULL END AS gp_percent,
  -- Labour source
  CASE WHEN l.actual_cost IS NOT NULL AND l.actual_cost > 0
       THEN 'actual' ELSE 'estimated' END AS labour_source
FROM sales_daily_unified s
LEFT JOIN labour_daily_unified l
  ON l.location_id = s.location_id AND l.day = s.date
LEFT JOIN cogs_daily c
  ON c.location_id = s.location_id AND c.date = s.date
LEFT JOIN location_settings ls
  ON ls.location_id = s.location_id;

GRANT SELECT ON mart_kpi_daily TO anon, authenticated;

-- ------------------------------------------------------------
-- 2. rpc_kpi_range_summary — Aggregate KPIs with previous period
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION rpc_kpi_range_summary(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date
) RETURNS json AS $$
DECLARE
  current_result json;
  prev_result json;
  period_days int;
  prev_from date;
  prev_to date;
BEGIN
  period_days := p_to - p_from + 1;
  prev_to := p_from - 1;
  prev_from := prev_to - period_days + 1;

  -- Current period
  SELECT json_build_object(
    'net_sales', COALESCE(SUM(net_sales), 0),
    'orders_count', COALESCE(SUM(orders_count), 0),
    'covers', COALESCE(SUM(covers), 0),
    'avg_check', CASE WHEN SUM(orders_count) > 0 THEN SUM(net_sales) / SUM(orders_count) ELSE 0 END,
    'labour_cost', SUM(labour_cost),
    'labour_hours', SUM(labour_hours),
    'cogs', COALESCE(SUM(cogs), 0),
    'col_percent', CASE WHEN SUM(net_sales) > 0 THEN (SUM(labour_cost) / SUM(net_sales)) * 100 ELSE NULL END,
    'gp_percent', CASE WHEN SUM(net_sales) > 0 THEN ((SUM(net_sales) - SUM(cogs)) / SUM(net_sales)) * 100 ELSE NULL END,
    'cogs_source_mixed', bool_or(cogs_source = 'estimated'),
    'labour_source_mixed', bool_or(labour_source = 'estimated')
  ) INTO current_result
  FROM mart_kpi_daily
  WHERE org_id = p_org_id
    AND (p_location_ids IS NULL OR location_id = ANY(p_location_ids))
    AND date BETWEEN p_from AND p_to;

  -- Previous period (same duration, immediately before)
  SELECT json_build_object(
    'net_sales', COALESCE(SUM(net_sales), 0),
    'orders_count', COALESCE(SUM(orders_count), 0),
    'covers', COALESCE(SUM(covers), 0),
    'avg_check', CASE WHEN SUM(orders_count) > 0 THEN SUM(net_sales) / SUM(orders_count) ELSE 0 END,
    'labour_cost', SUM(labour_cost),
    'cogs', COALESCE(SUM(cogs), 0),
    'col_percent', CASE WHEN SUM(net_sales) > 0 THEN (SUM(labour_cost) / SUM(net_sales)) * 100 ELSE NULL END,
    'gp_percent', CASE WHEN SUM(net_sales) > 0 THEN ((SUM(net_sales) - SUM(cogs)) / SUM(net_sales)) * 100 ELSE NULL END
  ) INTO prev_result
  FROM mart_kpi_daily
  WHERE org_id = p_org_id
    AND (p_location_ids IS NULL OR location_id = ANY(p_location_ids))
    AND date BETWEEN prev_from AND prev_to;

  RETURN json_build_object(
    'current', current_result,
    'previous', prev_result,
    'period', json_build_object('from', p_from, 'to', p_to, 'days', period_days),
    'previousPeriod', json_build_object('from', prev_from, 'to', prev_to)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------
-- 3. mart_sales_category_daily — Product-level COGS via recipes
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW mart_sales_category_daily AS
SELECT
  p.org_id,
  p.location_id,
  p.day AS date,
  p.product_id,
  p.product_name,
  p.product_category AS category,
  p.units_sold,
  p.net_sales,
  -- Recipe-based COGS if available, else fallback to default_cogs_percent
  COALESCE(
    (SELECT SUM(ri.quantity * ii.last_cost)
     FROM recipes r
     JOIN recipe_ingredients ri ON ri.recipe_id = r.id
     JOIN inventory_items ii ON ii.id = ri.inventory_item_id
     WHERE r.menu_item_name = p.product_name
       AND r.group_id = p.org_id
    ) * p.units_sold,
    p.net_sales * COALESCE(ls.default_cogs_percent, 30) / 100.0
  ) AS cogs,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.menu_item_name = p.product_name AND r.group_id = p.org_id
    ) THEN 'recipe'
    ELSE 'estimated'
  END AS cogs_source
FROM product_sales_daily_unified p
LEFT JOIN location_settings ls ON ls.location_id = p.location_id;

GRANT SELECT ON mart_sales_category_daily TO anon, authenticated;
