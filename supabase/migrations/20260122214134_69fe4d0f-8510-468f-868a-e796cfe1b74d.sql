-- Add target prep time column to products (in minutes)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS target_prep_time integer;

-- Add comment explaining the column
COMMENT ON COLUMN public.products.target_prep_time IS 'Target preparation time in minutes. If null, uses station default.';