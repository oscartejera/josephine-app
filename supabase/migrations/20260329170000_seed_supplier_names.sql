-- Migration: Seed supplier_name on inventory_items for demo account
-- This enables the Supplier Quality Score feature in the Waste module

DO $$
DECLARE
  v_org_id uuid;
  category_supplier_map jsonb := '{
    "Proteins":  "Cárnicas Martínez",
    "Meat":      "Cárnicas Martínez",
    "Fish":      "Pescados del Norte",
    "Dairy":     "Lácteos La Vega",
    "Produce":   "Frutas Hernández",
    "Vegetables":"Frutas Hernández",
    "Fruits":    "Frutas Hernández",
    "Beverages": "Bodega El Páramo",
    "Dry Goods": "Distribuciones García",
    "Bakery":    "Distribuciones García",
    "Other":     "Distribuciones García"
  }'::jsonb;
  v_item record;
  v_supplier text;
  v_cat text;
BEGIN
  -- Get demo org via locations (locations has org_id column)
  SELECT org_id INTO v_org_id
  FROM locations WHERE active = true LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No active location found, skipping supplier seed';
    RETURN;
  END IF;

  -- Add supplier_name column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'supplier_name'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN supplier_name text;
  END IF;

  -- Assign suppliers based on category
  FOR v_item IN
    SELECT id, category_name FROM inventory_items WHERE org_id = v_org_id
  LOOP
    v_cat := COALESCE(v_item.category_name, 'Other');
    v_supplier := category_supplier_map ->> v_cat;
    IF v_supplier IS NULL THEN
      v_supplier := 'Distribuciones García';
    END IF;

    UPDATE inventory_items SET supplier_name = v_supplier WHERE id = v_item.id;
  END LOOP;

  RAISE NOTICE 'Supplier names seeded for org %', v_org_id;
END $$;
