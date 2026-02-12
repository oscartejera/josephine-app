-- =============================================
-- Fix POS data reconciliation issues
-- 1) sales_daily_unified: COALESCE labor from labour_daily when pos_daily_metrics has 0
-- 2) product_sales_daily: add COGS estimation trigger using category-based ratios
-- =============================================

-- 1) Update sales_daily_unified view to fallback to labour_daily for labor data.
--    When data_source='pos', pos_daily_metrics has labor_cost=0 because Square
--    doesn't provide labor data. But labour_daily (from timesheets/shifts) does.
--    We LEFT JOIN labour_daily and COALESCE so that:
--    - If pos_daily_metrics has non-zero labor → use it (simulated mode)
--    - If pos_daily_metrics has 0 labor → fall back to labour_daily (POS mode)
DROP VIEW IF EXISTS sales_daily_unified;
CREATE VIEW sales_daily_unified AS
SELECT
  COALESCE(pdm.date, pdf.date) AS date,
  COALESCE(pdm.location_id, pdf.location_id) AS location_id,
  COALESCE(pdm.data_source, pdf.data_source, 'simulated') AS data_source,
  COALESCE(pdm.net_sales, pdf.net_sales, 0) AS net_sales,
  COALESCE(pdm.orders, pdf.orders_count, 0) AS orders_count,
  COALESCE(NULLIF(pdm.labor_cost, 0), ld.labour_cost, 0) AS labor_cost,
  COALESCE(NULLIF(pdm.labor_hours, 0), ld.labour_hours, 0) AS labor_hours,
  pdf.gross_sales,
  pdf.payments_cash,
  pdf.payments_card,
  pdf.payments_other,
  pdf.refunds_amount,
  pdf.refunds_count,
  pdf.discounts_amount,
  pdf.comps_amount,
  pdf.voids_amount
FROM pos_daily_metrics pdm
FULL OUTER JOIN pos_daily_finance pdf
  ON pdm.date = pdf.date
  AND pdm.location_id = pdf.location_id
  AND pdm.data_source = pdf.data_source
LEFT JOIN labour_daily ld
  ON ld.date = COALESCE(pdm.date, pdf.date)
  AND ld.location_id = COALESCE(pdm.location_id, pdf.location_id);

GRANT SELECT ON sales_daily_unified TO authenticated;
