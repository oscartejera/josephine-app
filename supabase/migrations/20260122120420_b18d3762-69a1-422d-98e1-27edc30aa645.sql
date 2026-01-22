-- Fix SECURITY DEFINER VIEW by recreating as a regular view
-- The RLS on underlying tables will still apply
DROP VIEW IF EXISTS sales_daily_unified;

CREATE VIEW sales_daily_unified AS
SELECT 
  COALESCE(pdm.date, pdf.date) as date,
  COALESCE(pdm.location_id, pdf.location_id) as location_id,
  COALESCE(pdm.net_sales, pdf.net_sales, 0) as net_sales,
  COALESCE(pdm.orders, pdf.orders_count, 0) as orders_count,
  pdm.labor_cost,
  pdm.labor_hours,
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
  AND pdm.location_id = pdf.location_id;

-- Grant access for authenticated users (RLS on underlying tables will filter)
GRANT SELECT ON sales_daily_unified TO authenticated;