-- Fix CDM demo data distribution for Menu Engineering matrix
--
-- Problem: One product dominates all sales (~90% popularity),
-- causing the matrix to cluster all other items near 0%.
-- Also: "Unknown" products with NULL item_id need cleanup.
--
-- Solution:
-- 1. Delete order lines with NULL or zero-UUID item_id (Unknown products)
-- 2. Rebalance quantities to create realistic, varied popularity distribution

-- Step 1: Remove "Unknown" products (NULL item_id or zero-UUID)
DELETE FROM cdm_order_lines
WHERE item_id IS NULL
   OR item_id = '00000000-0000-0000-0000-000000000000'::uuid;

-- Step 2: Remove order lines referencing items that don't exist in cdm_items or menu_items
DELETE FROM cdm_order_lines ol
WHERE NOT EXISTS (SELECT 1 FROM cdm_items ci WHERE ci.id = ol.item_id)
  AND NOT EXISTS (SELECT 1 FROM menu_items mi WHERE mi.id = ol.item_id);

-- Step 3: Rebalance quantities for diversity
-- Strategy: Use a deterministic hash of item_id to assign varied quantities
-- Goal: popularity spread from ~3% to ~20% per item within each category
UPDATE cdm_order_lines ol
SET qty = GREATEST(1, (
  -- Use last 4 hex chars of item_id as a "randomness" seed
  -- Produces values between 1 and 8 per line
  1 + (('x' || right(ol.item_id::text, 4))::bit(16)::int % 8)
));

-- Step 4: Also vary the gross values proportionally
-- Keep price realistic but create margin diversity
UPDATE cdm_order_lines ol
SET gross = ROUND(
  ol.qty * (
    -- Base price between 8 and 25 depending on item hash
    8.0 + (('x' || right(ol.item_id::text, 3))::bit(12)::int % 18)
  ), 2
);

-- Step 5: Clean up any orders that now have no lines
DELETE FROM cdm_orders o
WHERE NOT EXISTS (SELECT 1 FROM cdm_order_lines ol WHERE ol.order_id = o.id);
