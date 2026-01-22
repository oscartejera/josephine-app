-- Fix linter 0011: set immutable search_path for function missing it
ALTER FUNCTION public.enforce_8h_shift() SET search_path = public;

-- Fix linter 0010: ensure view respects invoker permissions
ALTER VIEW public.sales_daily_unified SET (security_invoker = true);