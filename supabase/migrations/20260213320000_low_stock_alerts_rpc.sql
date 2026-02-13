-- ============================================================
-- Low Stock Alerts: view + RPCs
-- 1) v_stock_on_hand_by_location — derives on-hand from stock_movements
-- 2) rpc_low_stock_alerts — returns low-stock items for a location
-- 3) rpc_create_po_from_low_stock — creates a draft PO from low-stock items
-- ============================================================

-- 1) View: on-hand stock per location per item
--    Positive movements: purchase, transfer-in, adjustment(+)
--    Negative movements: usage, waste, transfer-out, adjustment(-)
CREATE OR REPLACE VIEW v_stock_on_hand_by_location AS
SELECT
  sm.location_id,
  sm.item_id,
  SUM(
    CASE
      WHEN sm.movement_type = 'purchase'   THEN ABS(sm.quantity)
      WHEN sm.movement_type = 'adjustment' THEN sm.quantity  -- signed
      WHEN sm.movement_type = 'usage'      THEN -ABS(sm.quantity)
      WHEN sm.movement_type = 'waste'      THEN -ABS(sm.quantity)
      WHEN sm.movement_type = 'transfer'   THEN sm.quantity  -- signed (+in/-out)
      ELSE 0
    END
  ) AS on_hand
FROM stock_movements sm
GROUP BY sm.location_id, sm.item_id;


-- 2) RPC: low stock alerts for a single location
CREATE OR REPLACE FUNCTION rpc_low_stock_alerts(
  p_location_id  uuid,
  p_days_history int DEFAULT 30,
  p_days_cover   int DEFAULT 7,
  p_limit        int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH on_hand AS (
    SELECT item_id, on_hand
    FROM v_stock_on_hand_by_location
    WHERE location_id = p_location_id
  ),
  daily_usage AS (
    -- Average daily usage over the last p_days_history days
    SELECT
      sm.item_id,
      CASE
        WHEN COUNT(*) > 0
        THEN SUM(ABS(sm.quantity)) / p_days_history
        ELSE NULL
      END AS avg_daily
    FROM stock_movements sm
    WHERE sm.location_id = p_location_id
      AND sm.movement_type = 'usage'
      AND sm.created_at >= NOW() - (p_days_history || ' days')::interval
    GROUP BY sm.item_id
  ),
  alerts AS (
    SELECT
      ii.id             AS item_id,
      ii.name,
      ii.unit_of_measure AS unit,
      ii.main_supplier_id AS supplier_id,
      ii.price,
      ii.order_unit,
      ii.order_unit_qty,
      ii.min_order_qty,
      COALESCE(oh.on_hand, 0)     AS on_hand,
      COALESCE(ii.reorder_point, 0) AS reorder_point,
      COALESCE(ii.safety_stock, 0)  AS safety_stock,
      du.avg_daily                 AS avg_daily_usage,
      -- forecast_qty = avg_daily_usage * days_cover (null if no usage data)
      CASE
        WHEN du.avg_daily IS NOT NULL
        THEN ROUND(du.avg_daily * p_days_cover, 2)
        ELSE NULL
      END AS forecast_qty,
      -- recommended_qty
      CASE
        WHEN du.avg_daily IS NOT NULL
        THEN GREATEST(0, ROUND(du.avg_daily * p_days_cover + COALESCE(ii.safety_stock, 0) - COALESCE(oh.on_hand, 0), 2))
        WHEN COALESCE(ii.safety_stock, 0) > COALESCE(oh.on_hand, 0)
        THEN ROUND(COALESCE(ii.safety_stock, 0) - COALESCE(oh.on_hand, 0), 2)
        WHEN COALESCE(ii.reorder_point, 0) > COALESCE(oh.on_hand, 0)
        THEN ROUND(COALESCE(ii.reorder_point, 0) - COALESCE(oh.on_hand, 0), 2)
        ELSE 0
      END AS recommended_qty,
      -- urgency
      CASE
        WHEN COALESCE(oh.on_hand, 0) <= 0 THEN 'critical'
        WHEN COALESCE(ii.safety_stock, 0) > 0
             AND COALESCE(oh.on_hand, 0) <= COALESCE(ii.safety_stock, 0) THEN 'critical'
        WHEN COALESCE(ii.reorder_point, 0) > 0
             AND COALESCE(oh.on_hand, 0) <= COALESCE(ii.reorder_point, 0) THEN 'high'
        WHEN du.avg_daily IS NOT NULL
             AND du.avg_daily > 0
             AND COALESCE(oh.on_hand, 0) / du.avg_daily <= p_days_cover THEN 'medium'
        ELSE 'low'
      END AS urgency
    FROM inventory_items ii
    LEFT JOIN on_hand oh ON oh.item_id = ii.id
    LEFT JOIN daily_usage du ON du.item_id = ii.id
    WHERE ii.is_active = true
      AND (
        -- item belongs to this location (via location_ids array)
        p_location_id = ANY(ii.location_ids)
        -- or has stock movements at this location
        OR oh.item_id IS NOT NULL
      )
      AND (
        -- below reorder point
        (COALESCE(ii.reorder_point, 0) > 0 AND COALESCE(oh.on_hand, 0) <= COALESCE(ii.reorder_point, 0))
        -- or below safety stock
        OR (COALESCE(ii.safety_stock, 0) > 0 AND COALESCE(oh.on_hand, 0) <= COALESCE(ii.safety_stock, 0))
        -- or will run out within days_cover based on usage
        OR (du.avg_daily IS NOT NULL AND du.avg_daily > 0
            AND COALESCE(oh.on_hand, 0) / du.avg_daily <= p_days_cover)
      )
    ORDER BY
      CASE
        WHEN COALESCE(oh.on_hand, 0) <= 0 THEN 0
        WHEN COALESCE(ii.safety_stock, 0) > 0
             AND COALESCE(oh.on_hand, 0) <= COALESCE(ii.safety_stock, 0) THEN 1
        WHEN COALESCE(ii.reorder_point, 0) > 0
             AND COALESCE(oh.on_hand, 0) <= COALESCE(ii.reorder_point, 0) THEN 2
        ELSE 3
      END,
      ii.name
    LIMIT p_limit
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'item_id',          a.item_id,
      'name',             a.name,
      'unit',             a.unit,
      'supplier_id',      a.supplier_id,
      'price',            a.price,
      'order_unit',       a.order_unit,
      'order_unit_qty',   a.order_unit_qty,
      'min_order_qty',    a.min_order_qty,
      'on_hand',          a.on_hand,
      'reorder_point',    a.reorder_point,
      'safety_stock',     a.safety_stock,
      'avg_daily_usage',  a.avg_daily_usage,
      'forecast_qty',     a.forecast_qty,
      'recommended_qty',  a.recommended_qty,
      'urgency',          a.urgency
    )
  ), '[]'::jsonb)
  INTO v_result
  FROM alerts a;

  RETURN v_result;
END;
$$;


-- 3) RPC: create draft PO from low-stock items
--    Expects: p_location_id, p_group_id, p_items jsonb
--    p_items format: [{"item_id": "uuid", "supplier_id": "uuid", "quantity": 10, "unit_cost": 5.00}, ...]
--    Groups items by supplier_id and creates one PO per supplier.
CREATE OR REPLACE FUNCTION rpc_create_po_from_low_stock(
  p_location_id uuid,
  p_group_id    uuid,
  p_items       jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supplier_id  uuid;
  v_po_id        uuid;
  v_item         jsonb;
  v_po_ids       uuid[] := '{}';
  v_suppliers    uuid[];
BEGIN
  -- Get distinct supplier IDs
  SELECT ARRAY(
    SELECT DISTINCT (elem->>'supplier_id')::uuid
    FROM jsonb_array_elements(p_items) elem
    WHERE elem->>'supplier_id' IS NOT NULL
      AND elem->>'supplier_id' != ''
  ) INTO v_suppliers;

  -- Create one PO per supplier
  FOREACH v_supplier_id IN ARRAY v_suppliers LOOP
    INSERT INTO purchase_orders (supplier_id, group_id, location_id, status)
    VALUES (v_supplier_id, p_group_id, p_location_id, 'draft')
    RETURNING id INTO v_po_id;

    v_po_ids := v_po_ids || v_po_id;

    -- Insert lines for this supplier
    INSERT INTO purchase_order_lines (purchase_order_id, inventory_item_id, quantity, unit_cost)
    SELECT
      v_po_id,
      (elem->>'item_id')::uuid,
      (elem->>'quantity')::numeric,
      NULLIF((elem->>'unit_cost')::numeric, 0)
    FROM jsonb_array_elements(p_items) elem
    WHERE (elem->>'supplier_id')::uuid = v_supplier_id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'po_ids', to_jsonb(v_po_ids),
    'count', array_length(v_po_ids, 1)
  );
END;
$$;
