-- ============================================================================
-- FIX: PostgREST schema cache — expose facts_sales_15m to REST API
-- 
-- The table exists but PostgREST can't see it (404: not in schema cache).
-- This ensures proper grants and triggers a schema reload.
-- ============================================================================

-- Grant SELECT to authenticated and anon roles (service_role already has access)
DO $$ BEGIN
  GRANT SELECT ON public.facts_sales_15m TO authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'facts_sales_15m grant: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT ON public.facts_sales_15m TO anon;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'facts_sales_15m anon grant: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT ON public.forecast_daily_metrics TO authenticated;
  GRANT SELECT ON public.forecast_daily_metrics TO anon;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'forecast_daily_metrics grant: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT ON public.forecast_accuracy_log TO authenticated;
  GRANT SELECT ON public.forecast_accuracy_log TO anon;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'forecast_accuracy_log grant: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT INSERT, UPDATE ON public.forecast_daily_metrics TO authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'forecast_daily_metrics insert grant: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT INSERT, UPDATE ON public.forecast_accuracy_log TO authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'forecast_accuracy_log insert grant: %', SQLERRM;
END $$;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
