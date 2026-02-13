-- ============================================================
-- cdm_location_items — availability sync trigger
--
-- Closes the gap left by 20260213230000 which synced data
-- one-shot but did NOT create a trigger to keep is_active
-- and is_available in lockstep on future writes.
--
-- What this migration does:
--   1. CREATE OR REPLACE sync function (INSERT/UPDATE branches)
--   2. DROP + CREATE trigger BEFORE INSERT OR UPDATE
--   3. One-shot sync to fix any mismatches that crept in
--   4. Inline validation (introspection only, no DML)
--
-- What this migration does NOT touch:
--   - RLS policies
--   - Column definitions / constraints
--   - is_active column (kept for backward compat)
--
-- Idempotent: safe to re-run.
-- ============================================================


-- ================== 1. SYNC FUNCTION ========================
CREATE OR REPLACE FUNCTION public.sync_cdm_loc_items_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- On INSERT: resolve the canonical value from whatever was provided.
    -- Priority: is_available > is_active > default true.
    NEW.is_available := COALESCE(NEW.is_available, NEW.is_active, true);
    NEW.is_active    := NEW.is_available;
  ELSE
    -- On UPDATE: propagate whichever column changed.
    IF NEW.is_available IS DISTINCT FROM OLD.is_available THEN
      NEW.is_active := NEW.is_available;
    ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      NEW.is_available := NEW.is_active;
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;


-- ================== 2. TRIGGER ==============================
DROP TRIGGER IF EXISTS trg_sync_cdm_loc_items_availability
  ON public.cdm_location_items;

CREATE TRIGGER trg_sync_cdm_loc_items_availability
  BEFORE INSERT OR UPDATE ON public.cdm_location_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cdm_loc_items_availability();


-- ================== 3. ONE-SHOT SYNC ========================
-- Fix any mismatches that accumulated while the trigger was missing.
-- is_available is canonical; push to is_active.
UPDATE public.cdm_location_items
SET is_active = is_available
WHERE is_active IS DISTINCT FROM is_available;


-- ================== 4. VALIDATION ===========================

-- 4a. Trigger must exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'cdm_location_items'
      AND t.tgname  = 'trg_sync_cdm_loc_items_availability'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Missing trg_sync_cdm_loc_items_availability on public.cdm_location_items';
  END IF;
  RAISE NOTICE 'OK: trigger trg_sync_cdm_loc_items_availability exists';
END $$;

-- 4b. No mismatches
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.cdm_location_items
    WHERE is_active IS DISTINCT FROM is_available
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Found cdm_location_items availability mismatches (is_active != is_available)';
  END IF;
  RAISE NOTICE 'OK: 0 mismatches between is_active and is_available';
END $$;
