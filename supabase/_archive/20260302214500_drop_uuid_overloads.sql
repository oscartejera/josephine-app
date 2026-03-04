-- ============================================================
-- Fix: Drop old uuid[] overloads that conflict with text[] versions
--
-- Root cause: CREATE OR REPLACE with different param types creates
-- a NEW overload instead of replacing. PostgREST cannot disambiguate:
--   "Could not choose the best candidate function between:
--    ...(p_location_ids => text[]) and ...(p_location_ids => uuid[])"
--
-- Solution: Drop the old uuid[] signatures, keep only text[] ones.
-- ============================================================

-- 1. Drop old rpc_kpi_range_summary(uuid, uuid[], date, date)
DROP FUNCTION IF EXISTS public.rpc_kpi_range_summary(uuid, uuid[], date, date);

-- 2. Drop old get_instant_pnl_unified(uuid, uuid[], date, date)
DROP FUNCTION IF EXISTS public.get_instant_pnl_unified(uuid, uuid[], date, date);

-- 3. Grant permissions on the correct text[] signatures
GRANT EXECUTE ON FUNCTION public.rpc_kpi_range_summary(uuid, text[], date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_instant_pnl_unified(uuid, text[], date, date) TO anon, authenticated;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
