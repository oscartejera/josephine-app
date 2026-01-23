-- Add stripe_payment_intent_id column to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id 
ON public.payments(stripe_payment_intent_id) 
WHERE stripe_payment_intent_id IS NOT NULL;