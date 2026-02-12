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

-- Ensure columns exist (table may pre-exist from initial migration with simpler schema)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS delivery_days TEXT[] DEFAULT '{}';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS lead_time_days INT DEFAULT 3;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE suppliers SET org_id = group_id WHERE org_id IS NULL AND group_id IS NOT NULL;

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

-- Ensure columns exist (table may pre-exist from initial migration with simpler schema)
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'food';
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS category_name TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS main_supplier_id UUID;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS order_unit TEXT DEFAULT 'ea';
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS order_unit_qty NUMERIC DEFAULT 1;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS vat_rate NUMERIC DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS min_order_qty NUMERIC DEFAULT 1;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS lead_time_days INT DEFAULT 3;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS reorder_point NUMERIC DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS safety_stock NUMERIC DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS shelf_life_days INT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS storage_location TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS unit_of_measure TEXT DEFAULT 'ea';
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS cost_per_uom NUMERIC DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_recipe_ingredient BOOLEAN DEFAULT false;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_menu_item BOOLEAN DEFAULT false;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS location_ids UUID[] DEFAULT '{}';
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS cdm_item_id UUID;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS external_mappings JSONB DEFAULT '{}';
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS allergens TEXT[];
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE inventory_items SET org_id = group_id WHERE org_id IS NULL AND group_id IS NOT NULL;

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

-- Ensure columns exist (table may pre-exist from initial migration with simpler schema)
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS menu_item_id UUID;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS portions NUMERIC DEFAULT 1;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS portion_size TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS prep_time_minutes INT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cost_per_portion NUMERIC DEFAULT 0;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS selling_price NUMERIC DEFAULT 0;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS gp_percentage NUMERIC DEFAULT 0;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE recipes SET org_id = group_id WHERE org_id IS NULL AND group_id IS NOT NULL;

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

-- Ensure columns exist (table may pre-exist from initial migration with simpler schema)
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS ingredient_id UUID;
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'ea';
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
UPDATE recipe_ingredients SET ingredient_id = inventory_item_id WHERE ingredient_id IS NULL AND inventory_item_id IS NOT NULL;

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
