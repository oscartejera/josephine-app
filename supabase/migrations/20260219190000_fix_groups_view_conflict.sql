-- ============================================================
-- Fix: groups TABLE → VIEW conflict
-- If TABLE groups still exists (from old migrations),
-- drop it and recreate as a VIEW over orgs.
-- Safe: IF NOT EXISTS / CASCADE handles both fresh and existing DBs.
-- ============================================================

-- 1. Drop TABLE groups if it exists (data already lives in orgs)
DROP TABLE IF EXISTS public.groups CASCADE;

-- 2. Recreate the compatibility VIEW
CREATE OR REPLACE VIEW public.groups AS
SELECT id, name FROM public.orgs;

GRANT SELECT ON public.groups TO anon, authenticated;
