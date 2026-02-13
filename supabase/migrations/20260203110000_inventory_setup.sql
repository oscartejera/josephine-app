-- Inventory Setup - Master Items, Recipes, Suppliers
-- Central hub for all inventory and procurement operations

-- 1) Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  delivery_days TEXT[] DEFAULT '{}', -- ['monday', 'wednesday', 'friday']
  min_order_amount NUMERIC DEFAULT 0,
  lead_time_days INT DEFAULT 3,
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(org_id, is_active);

-- 2) Inventory Items (Master)
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  type TEXT NOT NULL CHECK (type IN ('food', 'beverage', 'misc', 'packaging')),
  category_name TEXT,
  
  -- Supplier & Ordering
  main_supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  order_unit TEXT DEFAULT 'ea', -- 'pack', 'case', 'kg', 'l', 'ea'
  order_unit_qty NUMERIC DEFAULT 1, -- How many units in one order unit
  price NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  min_order_qty NUMERIC DEFAULT 1,
  lead_time_days INT DEFAULT 3,
  
  -- Stock Management
  par_level NUMERIC DEFAULT 0,
  reorder_point NUMERIC DEFAULT 0,
  safety_stock NUMERIC DEFAULT 0,
  current_stock NUMERIC DEFAULT 0,
  shelf_life_days INT DEFAULT NULL,
  storage_location TEXT,
  
  -- Recipe/Usage
  unit_of_measure TEXT DEFAULT 'ea', -- Base unit for recipes
  cost_per_uom NUMERIC DEFAULT 0, -- Auto-calculated
  is_recipe_ingredient BOOLEAN DEFAULT false,
  is_menu_item BOOLEAN DEFAULT false,
  
  -- Multi-location
  location_ids UUID[] DEFAULT '{}',
  
  -- POS Integration
  cdm_item_id UUID REFERENCES cdm_items(id) ON DELETE SET NULL,
  external_mappings JSONB DEFAULT '{}',
  
  -- Metadata
  description TEXT,
  notes TEXT,
  image_url TEXT,
  allergens TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_org ON inventory_items(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_supplier ON inventory_items(main_supplier_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category_name);
CREATE INDEX IF NOT EXISTS idx_inventory_items_cdm ON inventory_items(cdm_item_id);

-- 3) Recipes (Bill of Materials)
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  menu_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  portions NUMERIC DEFAULT 1,
  portion_size TEXT,
  prep_time_minutes INT,
  cost_per_portion NUMERIC DEFAULT 0, -- Auto-calculated
  selling_price NUMERIC DEFAULT 0,
  gp_percentage NUMERIC DEFAULT 0, -- Auto-calculated
  instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipes_org ON recipes(org_id, is_active);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

-- 4) Procurement Suggestions (AI-generated)
CREATE TABLE IF NOT EXISTS procurement_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  suggested_qty NUMERIC NOT NULL,
  suggested_order_units NUMERIC NOT NULL, -- In order_unit (packs/cases)
  current_stock NUMERIC DEFAULT 0,
  forecasted_usage NUMERIC DEFAULT 0, -- Next 7-14 days
  days_of_stock_remaining NUMERIC DEFAULT 0,
  rationale TEXT NOT NULL,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  delivery_needed_by DATE,
  estimated_cost NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'ordered', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '48 hours'
);

CREATE INDEX IF NOT EXISTS idx_procurement_suggestions_location ON procurement_suggestions(location_id, status);

-- 5) Stock Movements (for tracking)
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase', 'usage', 'waste', 'transfer', 'adjustment')),
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  reference_id UUID DEFAULT NULL, -- Order ID, waste record ID, etc.
  cost NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_location ON stock_movements(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(item_id, created_at DESC);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Simple policies
DROP POLICY IF EXISTS suppliers_policy ON suppliers;
CREATE POLICY suppliers_policy ON suppliers FOR ALL USING (true);
DROP POLICY IF EXISTS inventory_items_policy ON inventory_items;
CREATE POLICY inventory_items_policy ON inventory_items FOR ALL USING (true);
DROP POLICY IF EXISTS recipes_policy ON recipes;
CREATE POLICY recipes_policy ON recipes FOR ALL USING (true);
DROP POLICY IF EXISTS recipe_ingredients_policy ON recipe_ingredients;
CREATE POLICY recipe_ingredients_policy ON recipe_ingredients FOR ALL USING (true);
DROP POLICY IF EXISTS procurement_suggestions_policy ON procurement_suggestions;
CREATE POLICY procurement_suggestions_policy ON procurement_suggestions FOR ALL USING (true);
DROP POLICY IF EXISTS stock_movements_policy ON stock_movements;
CREATE POLICY stock_movements_policy ON stock_movements FOR ALL USING (true);

-- Trigger to calculate cost_per_uom
CREATE OR REPLACE FUNCTION calculate_cost_per_uom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.cost_per_uom := NEW.price / NULLIF(NEW.order_unit_qty, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_cost_per_uom
  BEFORE INSERT OR UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_cost_per_uom();

COMMENT ON TABLE inventory_items IS 'Master inventory items - central hub for procurement, forecasting, recipes, waste, and AI';
COMMENT ON TABLE recipes IS 'Menu recipes with bill of materials (BOM)';
COMMENT ON TABLE procurement_suggestions IS 'AI-generated purchase suggestions based on forecast and stock levels';
