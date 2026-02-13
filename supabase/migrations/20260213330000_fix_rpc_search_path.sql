-- Fix: set search_path on SECURITY DEFINER functions to prevent search_path hijack
ALTER FUNCTION rpc_low_stock_alerts(uuid, int, int, int)
  SET search_path = public;

ALTER FUNCTION rpc_create_po_from_low_stock(uuid, uuid, jsonb)
  SET search_path = public;

-- Fix: COALESCE count to avoid null when v_po_ids is empty
CREATE OR REPLACE FUNCTION rpc_create_po_from_low_stock(
  p_location_id uuid,
  p_group_id    uuid,
  p_items       jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    'count', COALESCE(array_length(v_po_ids, 1), 0)
  );
END;
$$;
