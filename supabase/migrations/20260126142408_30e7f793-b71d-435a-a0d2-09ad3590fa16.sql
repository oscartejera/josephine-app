-- Add new columns for product images, prices, and descriptions
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;