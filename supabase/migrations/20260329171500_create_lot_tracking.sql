-- Migration: Create inventory_lot_tracking table + seed demo data
-- Enables Shelf-Life Tracker feature in the Waste module

-- 1. Create the lot tracking table
CREATE TABLE IF NOT EXISTS inventory_lot_tracking (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  location_id   uuid NOT NULL,
  inventory_item_id uuid NOT NULL,
  lot_number    text,
  quantity       numeric(12,3) NOT NULL DEFAULT 0,
  unit          text DEFAULT 'kg',
  opened_at     timestamptz,
  expires_at    timestamptz,
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'sealed', 'consumed', 'expired', 'discarded')),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE inventory_lot_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY lot_tracking_read ON inventory_lot_tracking
  FOR SELECT TO authenticated USING (true);
CREATE POLICY lot_tracking_write ON inventory_lot_tracking
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY lot_tracking_update ON inventory_lot_tracking
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY lot_tracking_delete ON inventory_lot_tracking
  FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_lot_tracking TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lot_tracking_item ON inventory_lot_tracking (inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_lot_tracking_expires ON inventory_lot_tracking (expires_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_lot_tracking_location ON inventory_lot_tracking (location_id, status);

-- 2. Seed realistic demo data
DO $$
DECLARE
  v_org uuid;
  v_loc uuid;
  v_item record;
  v_lot_id uuid;
  v_now timestamptz := NOW();
  v_opened timestamptz;
  v_expires timestamptz;
  v_shelf_days int;
  v_qty numeric;
  v_status text;
  v_count int := 0;
  -- Shelf life by category (days)
  shelf_life_map jsonb := '{
    "Proteins": 3,
    "Meat": 3,
    "Fish": 2,
    "Dairy": 5,
    "Produce": 4,
    "Vegetables": 5,
    "Fruits": 3,
    "Beverages": 30,
    "Dry Goods": 90,
    "Bakery": 2,
    "Other": 7
  }'::jsonb;
BEGIN
  -- Get demo org and location
  SELECT org_id INTO v_org FROM profiles WHERE full_name = 'Demo Owner' LIMIT 1;
  IF v_org IS NULL THEN
    RAISE NOTICE 'No demo org found, skipping lot tracking seed';
    RETURN;
  END IF;

  SELECT id INTO v_loc FROM locations WHERE org_id = v_org LIMIT 1;
  IF v_loc IS NULL THEN
    RAISE NOTICE 'No location found, skipping lot tracking seed';
    RETURN;
  END IF;

  -- Generate lots for each inventory item
  FOR v_item IN
    SELECT id, name, category_name FROM inventory_items
    WHERE org_id = v_org
    ORDER BY name
  LOOP
    v_shelf_days := COALESCE((shelf_life_map ->> COALESCE(v_item.category_name, 'Other'))::int, 7);

    -- Create 2-4 lots per item at different stages
    -- Lot 1: Recently opened (0-1 days ago)
    v_opened := v_now - (random() * interval '1 day');
    v_expires := v_opened + (v_shelf_days * interval '1 day');
    v_qty := round((random() * 5 + 0.5)::numeric, 2);
    INSERT INTO inventory_lot_tracking (org_id, location_id, inventory_item_id, lot_number,
      quantity, opened_at, expires_at, status)
    VALUES (v_org, v_loc, v_item.id,
      'L-' || to_char(v_now, 'YYMMDD') || '-' || lpad((v_count + 1)::text, 3, '0'),
      v_qty, v_opened, v_expires, 'open');
    v_count := v_count + 1;

    -- Lot 2: Expiring soon (within 24-48 hours) — for items with short shelf life
    IF v_shelf_days <= 5 THEN
      v_opened := v_now - ((v_shelf_days - 1) * interval '1 day') - (random() * interval '12 hours');
      v_expires := v_now + (random() * interval '36 hours');
      v_qty := round((random() * 3 + 0.3)::numeric, 2);
      INSERT INTO inventory_lot_tracking (org_id, location_id, inventory_item_id, lot_number,
        quantity, opened_at, expires_at, status)
      VALUES (v_org, v_loc, v_item.id,
        'L-' || to_char(v_now - interval '2 days', 'YYMMDD') || '-' || lpad((v_count + 1)::text, 3, '0'),
        v_qty, v_opened, v_expires, 'open');
      v_count := v_count + 1;
    END IF;

    -- Lot 3: Already expired (for some items, ~30% chance)
    IF random() < 0.3 AND v_shelf_days <= 7 THEN
      v_opened := v_now - ((v_shelf_days + 2) * interval '1 day');
      v_expires := v_now - (random() * interval '2 days');
      v_qty := round((random() * 1.5 + 0.2)::numeric, 2);
      INSERT INTO inventory_lot_tracking (org_id, location_id, inventory_item_id, lot_number,
        quantity, opened_at, expires_at, status)
      VALUES (v_org, v_loc, v_item.id,
        'L-' || to_char(v_now - interval '5 days', 'YYMMDD') || '-' || lpad((v_count + 1)::text, 3, '0'),
        v_qty, v_opened, v_expires, 'expired');
      v_count := v_count + 1;
    END IF;

    -- Lot 4: Sealed (not yet opened)
    IF random() < 0.5 THEN
      v_qty := round((random() * 10 + 2)::numeric, 2);
      v_expires := v_now + ((v_shelf_days * 2 + floor(random() * 10)::int) * interval '1 day');
      INSERT INTO inventory_lot_tracking (org_id, location_id, inventory_item_id, lot_number,
        quantity, opened_at, expires_at, status)
      VALUES (v_org, v_loc, v_item.id,
        'L-' || to_char(v_now, 'YYMMDD') || '-S' || lpad((v_count + 1)::text, 3, '0'),
        v_qty, NULL, v_expires, 'sealed');
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Created % inventory lots for org %', v_count, v_org;
END $$;
