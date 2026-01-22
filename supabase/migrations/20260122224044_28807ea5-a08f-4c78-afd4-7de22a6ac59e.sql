-- Add missing columns to ticket_lines for full KDS functionality
ALTER TABLE public.ticket_lines ADD COLUMN IF NOT EXISTS is_rush boolean DEFAULT false;
ALTER TABLE public.ticket_lines ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id);
ALTER TABLE public.ticket_lines ADD COLUMN IF NOT EXISTS course integer DEFAULT 1;

-- Add index for faster product lookups
CREATE INDEX IF NOT EXISTS idx_ticket_lines_product_id ON public.ticket_lines(product_id);

-- Add comment for documentation
COMMENT ON COLUMN public.ticket_lines.is_rush IS 'Priority flag for rush orders';
COMMENT ON COLUMN public.ticket_lines.product_id IS 'Reference to product for prep time lookup';
COMMENT ON COLUMN public.ticket_lines.course IS 'Course number for multi-course meals (1=first, 2=second, etc)';