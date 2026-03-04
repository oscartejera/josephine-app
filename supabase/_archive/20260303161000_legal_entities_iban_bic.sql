-- Add IBAN/BIC columns to legal_entities for SEPA generation
-- These can be set per legal entity but default to the user's ING España account
ALTER TABLE public.legal_entities ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE public.legal_entities ADD COLUMN IF NOT EXISTS bic TEXT;

COMMENT ON COLUMN public.legal_entities.iban IS 'Company IBAN for SEPA payment transfers (debtor account)';
COMMENT ON COLUMN public.legal_entities.bic IS 'Company BIC/SWIFT code for SEPA payment transfers';
