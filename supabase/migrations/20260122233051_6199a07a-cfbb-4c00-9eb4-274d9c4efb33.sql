-- Add tip columns to payments and tickets tables
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10,2) DEFAULT 0;

ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS tip_total NUMERIC(10,2) DEFAULT 0;

-- Add index for tip reporting
CREATE INDEX IF NOT EXISTS idx_payments_tip ON public.payments(tip_amount) WHERE tip_amount > 0;

COMMENT ON COLUMN public.payments.tip_amount IS 'Tip amount included in this payment';
COMMENT ON COLUMN public.tickets.tip_total IS 'Total tips for this ticket across all payments';