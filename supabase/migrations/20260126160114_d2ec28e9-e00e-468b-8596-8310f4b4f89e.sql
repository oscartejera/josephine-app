-- Add tax_rate column to purchase_order_lines for fiscal calculations
ALTER TABLE public.purchase_order_lines 
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 10;

-- Add comment for clarity
COMMENT ON COLUMN public.purchase_order_lines.tax_rate IS 'IVA rate percentage (4, 10, 21)';