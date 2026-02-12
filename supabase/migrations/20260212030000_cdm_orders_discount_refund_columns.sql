-- Add discount_total and refund_total columns to cdm_orders
-- These fields capture Square's total_discount_money and refund totals
-- which were previously discarded during normalization.

ALTER TABLE cdm_orders
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_total NUMERIC DEFAULT 0;

-- Add 'draft' to the status check constraint for incomplete Square orders
-- Current allowed: 'open', 'closed', 'paid', 'void'
ALTER TABLE cdm_orders DROP CONSTRAINT IF EXISTS cdm_orders_status_check;
ALTER TABLE cdm_orders ADD CONSTRAINT cdm_orders_status_check
  CHECK (status IN ('open', 'closed', 'paid', 'void', 'draft'));

-- Add discount_total and tax_total to cdm_order_lines
ALTER TABLE cdm_order_lines
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_total NUMERIC DEFAULT 0;

-- Add external_ref to inventory_items for Square catalog_object_id matching
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS external_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_inventory_items_external_ref
  ON inventory_items(external_ref) WHERE external_ref IS NOT NULL;
