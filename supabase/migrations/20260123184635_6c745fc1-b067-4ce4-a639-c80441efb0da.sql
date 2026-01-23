-- Create table for storing email OTP codes
CREATE TABLE public.email_otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_email_otp_codes_email ON public.email_otp_codes(email);
CREATE INDEX idx_email_otp_codes_expires_at ON public.email_otp_codes(expires_at);

-- RLS: Allow public insert (for generating OTPs before auth)
ALTER TABLE public.email_otp_codes ENABLE ROW LEVEL SECURITY;

-- Policy for inserting OTP codes (public access needed before user is authenticated)
CREATE POLICY "Anyone can insert OTP codes" 
ON public.email_otp_codes 
FOR INSERT 
WITH CHECK (true);

-- Policy for selecting OTP codes (public access needed for verification)
CREATE POLICY "Anyone can read OTP codes" 
ON public.email_otp_codes 
FOR SELECT 
USING (true);

-- Policy for updating OTP codes (marking as verified)
CREATE POLICY "Anyone can update OTP codes" 
ON public.email_otp_codes 
FOR UPDATE 
USING (true);

-- Function to clean up expired OTPs (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM public.email_otp_codes WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;