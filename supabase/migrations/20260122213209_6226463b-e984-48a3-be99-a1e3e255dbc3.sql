-- Add kds_destination column to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS kds_destination TEXT DEFAULT 'kitchen';

-- Add constraint for valid destinations
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_kds_destination_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_kds_destination_check 
  CHECK (kds_destination IN ('kitchen', 'bar', 'prep'));

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_products_kds_destination ON public.products(kds_destination);

-- Set default destinations based on category (existing products)
UPDATE public.products
SET kds_destination = 'bar'
WHERE category ILIKE '%bebida%' 
   OR category ILIKE '%drink%'
   OR category ILIKE '%cocktail%'
   OR category ILIKE '%vino%'
   OR category ILIKE '%cerveza%';

COMMENT ON COLUMN public.products.kds_destination IS 'Default KDS station for this product: kitchen, bar, or prep';