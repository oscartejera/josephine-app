-- Harden email_otp_codes table: OTP codes should only be managed by backend functions (service role).
-- Remove overly-permissive policies flagged by the security linter.

DROP POLICY IF EXISTS "Anyone can insert OTP codes" ON public.email_otp_codes;
DROP POLICY IF EXISTS "Anyone can update OTP codes" ON public.email_otp_codes;
DROP POLICY IF EXISTS "Anyone can read OTP codes"   ON public.email_otp_codes;

-- Deny all direct client access (edge functions using service role bypass RLS).
CREATE POLICY "Deny direct select OTP codes"
ON public.email_otp_codes
FOR SELECT
TO public
USING (false);

CREATE POLICY "Deny direct insert OTP codes"
ON public.email_otp_codes
FOR INSERT
TO public
WITH CHECK (false);

CREATE POLICY "Deny direct update OTP codes"
ON public.email_otp_codes
FOR UPDATE
TO public
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny direct delete OTP codes"
ON public.email_otp_codes
FOR DELETE
TO public
USING (false);
