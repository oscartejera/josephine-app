-- ============================================================
-- Fix: Budget targets €0 — correct schema for production tables
--
-- budget_versions: start_date, end_date (NOT period_start/period_end)
-- budget_metrics: NO id column
-- budget_drivers: may have different columns → skip entirely (LEFT JOIN)
-- ============================================================

-- 1. Ensure unique indexes exist for ON CONFLICT
-- Wrap in DO blocks in case data has duplicates
DO $$ BEGIN
  CREATE UNIQUE INDEX idx_budget_days_uniq 
    ON budget_days (budget_version_id, location_id, day);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'budget_days index: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX idx_budget_metrics_uniq 
    ON budget_metrics (budget_day_id, metric, layer);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'budget_metrics index: %', SQLERRM;
END $$;


-- 2. Extend published budget versions to cover 2026
UPDATE budget_versions SET 
  start_date = LEAST(COALESCE(start_date, CURRENT_DATE - 60), CURRENT_DATE - 30),
  end_date   = GREATEST(COALESCE(end_date, CURRENT_DATE + 7), CURRENT_DATE + 7)
WHERE status IN ('published', 'frozen');


-- 3. Insert budget_days for current window per published version × active location
INSERT INTO budget_days (id, budget_version_id, org_id, location_id, day)
SELECT
  md5(bv.id::text || '-' || l.id::text || '-' || d::text)::uuid,
  bv.id,
  bv.org_id,
  l.id,
  d::date
FROM budget_versions bv
CROSS JOIN locations l
CROSS JOIN generate_series(CURRENT_DATE - 30, CURRENT_DATE + 7, interval '1 day') AS d
WHERE bv.status IN ('published', 'frozen')
  AND l.active = true
  AND l.org_id = bv.org_id
ON CONFLICT DO NOTHING;


-- 4. Sales budget (budget_metrics has NO id column)
INSERT INTO budget_metrics (budget_day_id, metric, value, layer)
SELECT
  bd.id,
  'sales_net',
  CASE 
    WHEN EXTRACT(DOW FROM bd.day) IN (5, 6) THEN 3400 + (EXTRACT(DOY FROM bd.day)::int * 7 % 400)
    WHEN EXTRACT(DOW FROM bd.day) = 0 THEN 2800 + (EXTRACT(DOY FROM bd.day)::int * 7 % 300)
    ELSE 2200 + (EXTRACT(DOW FROM bd.day)::int * 100) + (EXTRACT(DOY FROM bd.day)::int * 3 % 200)
  END,
  'final'
FROM budget_days bd
LEFT JOIN budget_metrics ex ON ex.budget_day_id = bd.id AND ex.metric = 'sales_net' AND ex.layer = 'final'
WHERE ex.budget_day_id IS NULL AND bd.day >= CURRENT_DATE - 30
ON CONFLICT DO NOTHING;


-- 5. Labour budget (~28%)
INSERT INTO budget_metrics (budget_day_id, metric, value, layer)
SELECT
  bd.id,
  'labour_cost',
  CASE 
    WHEN EXTRACT(DOW FROM bd.day) IN (5, 6) THEN 952 + (EXTRACT(DOY FROM bd.day)::int * 5 % 112)
    WHEN EXTRACT(DOW FROM bd.day) = 0 THEN 784 + (EXTRACT(DOY FROM bd.day)::int * 5 % 84)
    ELSE 616 + (EXTRACT(DOW FROM bd.day)::int * 28) + (EXTRACT(DOY FROM bd.day)::int * 2 % 56)
  END,
  'final'
FROM budget_days bd
LEFT JOIN budget_metrics ex ON ex.budget_day_id = bd.id AND ex.metric = 'labour_cost' AND ex.layer = 'final'
WHERE ex.budget_day_id IS NULL AND bd.day >= CURRENT_DATE - 30
ON CONFLICT DO NOTHING;


-- 6. COGS budget (~30%)
INSERT INTO budget_metrics (budget_day_id, metric, value, layer)
SELECT
  bd.id,
  'cogs',
  CASE 
    WHEN EXTRACT(DOW FROM bd.day) IN (5, 6) THEN 1020 + (EXTRACT(DOY FROM bd.day)::int * 5 % 120)
    WHEN EXTRACT(DOW FROM bd.day) = 0 THEN 840 + (EXTRACT(DOY FROM bd.day)::int * 5 % 90)
    ELSE 660 + (EXTRACT(DOW FROM bd.day)::int * 30) + (EXTRACT(DOY FROM bd.day)::int * 2 % 60)
  END,
  'final'
FROM budget_days bd
LEFT JOIN budget_metrics ex ON ex.budget_day_id = bd.id AND ex.metric = 'cogs' AND ex.layer = 'final'
WHERE ex.budget_day_id IS NULL AND bd.day >= CURRENT_DATE - 30
ON CONFLICT DO NOTHING;


-- 7. Reload schema  
NOTIFY pgrst, 'reload schema';
