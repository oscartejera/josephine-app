-- ============================================================
-- Reconciliation Marts + RPC
-- Regular views (not MVs) — stock count data is low-volume
-- ============================================================

-- ------------------------------------------------------------
-- 1. mart_stock_count_headers — enriched stock_counts
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW mart_stock_count_headers AS
SELECT
  sc.id,
  sc.group_id,
  sc.location_id,
  l.name AS location_name,
  sc.start_date,
  sc.end_date,
  sc.status,
  sc.created_at,
  sc.updated_at,
  COUNT(scl.id)::integer AS line_count,
  COALESCE(SUM(scl.variance_qty), 0)::numeric AS total_variance_qty
FROM stock_counts sc
JOIN locations l ON l.id = sc.location_id
LEFT JOIN stock_count_lines scl ON scl.stock_count_id = sc.id
GROUP BY sc.id, sc.group_id, sc.location_id, l.name,
         sc.start_date, sc.end_date, sc.status,
         sc.created_at, sc.updated_at;

GRANT SELECT ON mart_stock_count_headers TO anon, authenticated;

-- ------------------------------------------------------------
-- 2. mart_stock_count_lines_enriched — lines with item details
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW mart_stock_count_lines_enriched AS
SELECT
  scl.id,
  scl.stock_count_id,
  sc.group_id,
  sc.location_id,
  sc.start_date,
  sc.end_date,
  sc.status AS count_status,
  scl.inventory_item_id,
  ii.name AS item_name,
  ii.unit,
  COALESCE(ii.last_cost, 0)::numeric AS unit_cost,
  COALESCE(scl.opening_qty, 0)::numeric AS opening_qty,
  COALESCE(scl.deliveries_qty, 0)::numeric AS deliveries_qty,
  COALESCE(scl.transfers_net_qty, 0)::numeric AS transfers_net_qty,
  COALESCE(scl.closing_qty, 0)::numeric AS closing_qty,
  COALESCE(scl.used_qty, 0)::numeric AS used_qty,
  COALESCE(scl.sales_qty, 0)::numeric AS sales_qty,
  COALESCE(scl.variance_qty, 0)::numeric AS variance_qty,
  COALESCE(scl.batch_balance, 0)::numeric AS batch_balance,
  (COALESCE(scl.variance_qty, 0) * COALESCE(ii.last_cost, 0))::numeric AS variance_value
FROM stock_count_lines scl
JOIN stock_counts sc ON sc.id = scl.stock_count_id
JOIN inventory_items ii ON ii.id = scl.inventory_item_id;

GRANT SELECT ON mart_stock_count_lines_enriched TO anon, authenticated;

-- ------------------------------------------------------------
-- 3. rpc_reconciliation_summary — aggregated reconciliation data
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION rpc_reconciliation_summary(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_headers jsonb;
  v_lines jsonb;
  v_totals jsonb;
BEGIN
  -- Count headers
  SELECT COALESCE(jsonb_agg(row_to_json(h)::jsonb ORDER BY h.start_date DESC), '[]'::jsonb)
  INTO v_headers
  FROM (
    SELECT
      mh.id, mh.location_id, mh.location_name,
      mh.start_date, mh.end_date, mh.status,
      mh.line_count, mh.total_variance_qty,
      mh.created_at
    FROM mart_stock_count_headers mh
    WHERE mh.group_id = p_org_id
      AND (p_location_ids IS NULL OR mh.location_id = ANY(p_location_ids))
      AND mh.start_date >= p_from
      AND mh.end_date <= p_to
      AND (p_status IS NULL OR mh.status = p_status)
  ) h;

  -- Aggregated lines by item (across multiple stock counts)
  SELECT COALESCE(jsonb_agg(row_to_json(li)::jsonb ORDER BY li.item_name), '[]'::jsonb)
  INTO v_lines
  FROM (
    SELECT
      el.inventory_item_id,
      el.item_name,
      el.unit,
      el.unit_cost,
      SUM(el.opening_qty)::numeric AS opening_qty,
      SUM(el.deliveries_qty)::numeric AS deliveries_qty,
      SUM(el.transfers_net_qty)::numeric AS transfers_net_qty,
      SUM(el.closing_qty)::numeric AS closing_qty,
      SUM(el.used_qty)::numeric AS used_qty,
      SUM(el.sales_qty)::numeric AS sales_qty,
      SUM(el.variance_qty)::numeric AS variance_qty,
      SUM(el.batch_balance)::numeric AS batch_balance,
      SUM(el.variance_value)::numeric AS variance_value
    FROM mart_stock_count_lines_enriched el
    WHERE el.group_id = p_org_id
      AND (p_location_ids IS NULL OR el.location_id = ANY(p_location_ids))
      AND el.start_date >= p_from
      AND el.end_date <= p_to
      AND (p_status IS NULL OR el.count_status = p_status)
    GROUP BY el.inventory_item_id, el.item_name, el.unit, el.unit_cost
  ) li;

  -- Totals
  SELECT jsonb_build_object(
    'opening_qty', COALESCE(SUM(el.opening_qty), 0),
    'deliveries_qty', COALESCE(SUM(el.deliveries_qty), 0),
    'transfers_net_qty', COALESCE(SUM(el.transfers_net_qty), 0),
    'closing_qty', COALESCE(SUM(el.closing_qty), 0),
    'used_qty', COALESCE(SUM(el.used_qty), 0),
    'sales_qty', COALESCE(SUM(el.sales_qty), 0),
    'variance_qty', COALESCE(SUM(el.variance_qty), 0),
    'batch_balance', COALESCE(SUM(el.batch_balance), 0),
    'variance_value', COALESCE(SUM(el.variance_value), 0)
  )
  INTO v_totals
  FROM mart_stock_count_lines_enriched el
  WHERE el.group_id = p_org_id
    AND (p_location_ids IS NULL OR el.location_id = ANY(p_location_ids))
    AND el.start_date >= p_from
    AND el.end_date <= p_to
    AND (p_status IS NULL OR el.count_status = p_status);

  RETURN jsonb_build_object(
    'count_headers', v_headers,
    'lines', v_lines,
    'totals', v_totals
  );
END;
$$;
