-- ============================================================
-- UI Contract View: product_sales_daily_unified
--
-- Per-product daily sales with margin metrics.
-- Enriches product_sales_daily with product name/category
-- from the products table, and adds org_id.
--
-- Source: product_sales_daily + products + locations
-- Note:  The existing v_product_sales_daily_unified view
--        (data_source normalization) is preserved; this view
--        serves a different purpose (UI contract with enrichment).
-- RLS: security_invoker = true → inherits caller's privileges
-- ============================================================

CREATE OR REPLACE VIEW product_sales_daily_unified AS
SELECT
  l.group_id                                             AS org_id,
  psd.location_id,
  psd.date                                               AS day,
  psd.product_id,
  p.name                                                 AS product_name,
  p.category                                             AS product_category,
  psd.units_sold::numeric(12,2)                          AS units_sold,
  psd.net_sales::numeric(12,2)                           AS net_sales,
  psd.cogs::numeric(12,2)                                AS cogs,
  (psd.net_sales - psd.cogs)::numeric(12,2)              AS gross_profit,
  CASE
    WHEN psd.net_sales > 0
    THEN ((psd.net_sales - psd.cogs) / psd.net_sales * 100)::numeric(5,2)
    ELSE 0::numeric(5,2)
  END                                                    AS margin_pct,
  psd.data_source
FROM product_sales_daily psd
JOIN locations l ON l.id = psd.location_id
LEFT JOIN products p ON p.id = psd.product_id;

ALTER VIEW product_sales_daily_unified SET (security_invoker = true);

COMMENT ON VIEW product_sales_daily_unified IS
  'UI contract: daily product-level sales with margin. '
  'Enriched from product_sales_daily + products. '
  'RLS flows through underlying tables via security_invoker.';

GRANT SELECT ON product_sales_daily_unified TO authenticated;

-- Recommended indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_product_sales_daily_loc_date
  ON product_sales_daily(location_id, date);
CREATE INDEX IF NOT EXISTS idx_product_sales_daily_loc_date_product
  ON product_sales_daily(location_id, date, product_id);
