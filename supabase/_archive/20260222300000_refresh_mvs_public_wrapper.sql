-- Public wrapper for ops.refresh_all_mvs so Supabase REST API can reach it.
-- The ops schema is not exposed via PostgREST by default.

CREATE OR REPLACE FUNCTION public.refresh_all_mvs(p_triggered_by text DEFAULT 'manual')
RETURNS jsonb AS $$
  SELECT ops.refresh_all_mvs(p_triggered_by);
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.refresh_all_mvs(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_mvs(text) TO authenticated;
