-- PR4 fix: safe v2 MV refresh + correct sync trigger WHEN clause
-- ============================================================

-- A0) Add missing unique index on v1 product MV (required for CONCURRENTLY)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_psdu_mv_uniq
  ON product_sales_daily_unified_mv (org_id, location_id, day, product_id);

-- A) Patch ops.refresh_all_mvs with safe skip-if-missing + empty-MV fallback
-- ============================================================

CREATE OR REPLACE FUNCTION ops.refresh_all_mvs(p_triggered_by text DEFAULT 'manual')
RETURNS jsonb AS $$
DECLARE
  t_start   timestamptz;
  log_id    bigint;
  results   jsonb := '[]'::jsonb;
  mv_name   text;
  mv_start  timestamptz;
  mv_ms     integer;
  mv_rows   bigint;
  mv_list   text[] := ARRAY[
    'product_sales_daily_unified_mv',
    'sales_hourly_unified_mv',
    'product_sales_daily_unified_mv_v2',
    'sales_hourly_unified_mv_v2',
    'mart_kpi_daily_mv',
    'mart_sales_category_daily_mv'
  ];
BEGIN
  t_start := clock_timestamp();

  INSERT INTO ops.mv_refresh_log (triggered_by, status)
  VALUES (p_triggered_by, 'running')
  RETURNING id INTO log_id;

  FOREACH mv_name IN ARRAY mv_list LOOP
    -- Skip safely if MV does not exist
    IF to_regclass(mv_name) IS NULL THEN
      results := results || jsonb_build_object(
        'view', mv_name, 'skipped', true, 'reason', 'missing'
      );
      CONTINUE;
    END IF;

    mv_start := clock_timestamp();

    -- Check row count: CONCURRENTLY requires >= 1 existing row
    EXECUTE format('SELECT count(*) FROM %I', mv_name) INTO mv_rows;

    IF mv_rows = 0 THEN
      EXECUTE format('REFRESH MATERIALIZED VIEW %I', mv_name);
    ELSE
      EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', mv_name);
    END IF;

    mv_ms := extract(milliseconds from clock_timestamp() - mv_start)::integer;
    results := results || jsonb_build_object(
      'view', mv_name, 'ms', mv_ms,
      'mode', CASE WHEN mv_rows = 0 THEN 'full' ELSE 'concurrent' END
    );
  END LOOP;

  UPDATE ops.mv_refresh_log SET
    finished_at = clock_timestamp(),
    duration_ms = extract(milliseconds from clock_timestamp() - t_start)::integer,
    views_refreshed = mv_list,
    status = 'success',
    metadata = jsonb_build_object('details', results)
  WHERE id = log_id;

  RETURN jsonb_build_object(
    'log_id', log_id,
    'duration_ms', extract(milliseconds from clock_timestamp() - t_start)::integer,
    'views', results
  );

EXCEPTION WHEN OTHERS THEN
  UPDATE ops.mv_refresh_log SET
    finished_at = clock_timestamp(),
    status = 'error',
    error_message = SQLERRM
  WHERE id = log_id;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Public wrapper (re-declare to ensure consistency)
CREATE OR REPLACE FUNCTION public.refresh_all_mvs(p_triggered_by text DEFAULT 'manual')
RETURNS jsonb AS $$
  SELECT ops.refresh_all_mvs(p_triggered_by);
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ops.refresh_all_mvs(text) TO service_role;
GRANT EXECUTE ON FUNCTION ops.refresh_all_mvs(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_mvs(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_mvs(text) TO authenticated;


-- ============================================================
-- B) Fix trigger WHEN clause to match valid sync_status values
-- ============================================================

DROP TRIGGER IF EXISTS trg_sync_success_refresh_mvs ON public.integration_sync_runs;

CREATE TRIGGER trg_sync_success_refresh_mvs
  AFTER UPDATE OF status ON public.integration_sync_runs
  FOR EACH ROW
  WHEN (
    (NEW.status)::text = 'success'
    AND (OLD.status)::text IS DISTINCT FROM (NEW.status)::text
  )
  EXECUTE FUNCTION public.trg_enqueue_refresh_mvs();


-- ============================================================
-- C) Reload PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
