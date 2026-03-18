-- Reseed daily_sales with rolling CURRENT_DATE offsets
-- This ensures demo data is always valid relative to the current date,
-- regardless of when the migration was first applied.
--
-- Root cause: original baseline seed used CURRENT_DATE at migration time,
-- causing data to expire after ~37 days.

-- Step 1: Delete stale demo rows (keep POS data untouched)
DELETE FROM daily_sales ds
WHERE ds.org_id IN (
  SELECT g.id FROM groups g WHERE g.name ILIKE '%josephine%' OR g.name ILIKE '%demo%'
);

-- Step 2: Re-insert for CURRENT_DATE - 90 to CURRENT_DATE + 7
-- Uses same pattern as baseline but with a 90-day lookback window
INSERT INTO daily_sales (org_id, location_id, day, net_sales, gross_sales, orders_count, payments_total, payments_cash, payments_card, refunds, discounts, comps, voids)
SELECT
  l.org_id,
  l.id,
  d::date,
  -- Net sales: €2,200-3,800 depending on day of week
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)
    WHEN EXTRACT(DOW FROM d) = 0 THEN 2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)
    ELSE 2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)
  END::numeric,
  -- Gross sales: net + 5%
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN ROUND((3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 1.05, 2)
    WHEN EXTRACT(DOW FROM d) = 0 THEN ROUND((2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 1.05, 2)
    ELSE ROUND((2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 1.05, 2)
  END::numeric,
  -- Orders
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 56 + (EXTRACT(DOY FROM d)::int % 10)
    WHEN EXTRACT(DOW FROM d) = 0 THEN 44 + (EXTRACT(DOY FROM d)::int % 8)
    ELSE 36 + (EXTRACT(DOW FROM d)::int * 2)
  END::integer,
  -- Payments total = net_sales
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)
    WHEN EXTRACT(DOW FROM d) = 0 THEN 2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)
    ELSE 2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)
  END::numeric,
  -- payments_cash: 25%
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.25
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.25
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.25
  END, 2)::numeric,
  -- payments_card: 75%
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.75
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.75
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.75
  END, 2)::numeric,
  -- Refunds: 0.5%
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.005
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.005
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.005
  END, 2)::numeric,
  -- Discounts: 3%
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.03
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.03
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.03
  END, 2)::numeric,
  -- Comps: 1%
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.01
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.01
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.01
  END, 2)::numeric,
  -- Voids: 0.2%
  ROUND(CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN (3400 + (EXTRACT(DOY FROM d)::int * 7 % 400)) * 0.002
    WHEN EXTRACT(DOW FROM d) = 0 THEN (2800 + (EXTRACT(DOY FROM d)::int * 7 % 300)) * 0.002
    ELSE (2200 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)) * 0.002
  END, 2)::numeric
FROM locations l
CROSS JOIN generate_series(CURRENT_DATE - 90, CURRENT_DATE + 7, '1 day'::interval) AS d
WHERE l.active = true
ON CONFLICT DO NOTHING;

-- Step 3: Also reseed planned_shifts so labour KPIs work
-- Delete old demo planned_shifts
DELETE FROM planned_shifts ps
WHERE ps.location_id IN (
  SELECT l.id FROM locations l
  JOIN groups g ON g.id = l.org_id
  WHERE g.name ILIKE '%josephine%' OR g.name ILIKE '%demo%'
)
AND ps.shift_date < CURRENT_DATE - 90;

-- Insert planned_shifts for the rolling window if missing
INSERT INTO planned_shifts (employee_id, location_id, shift_date, planned_hours)
SELECT
  e.id,
  e.location_id,
  d::date,
  CASE
    WHEN EXTRACT(DOW FROM d) IN (0, 1) THEN 0  -- off on Sun/Mon
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 9  -- longer on Fri/Sat
    ELSE 7
  END
FROM employees e
CROSS JOIN generate_series(CURRENT_DATE - 90, CURRENT_DATE + 7, '1 day'::interval) AS d
WHERE e.active = true
  AND CASE
    WHEN EXTRACT(DOW FROM d) IN (0, 1) THEN false  -- skip off days
    ELSE true
  END
ON CONFLICT DO NOTHING;

-- Step 4: Reseed forecast_daily_metrics so forecast comparison KPIs work
INSERT INTO forecast_daily_metrics (location_id, date, forecast_sales, forecast_orders, planned_labor_hours, planned_labor_cost)
SELECT
  l.id,
  d::date,
  -- Forecast sales slightly above actuals
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 3600 + (EXTRACT(DOY FROM d)::int * 7 % 400)
    WHEN EXTRACT(DOW FROM d) = 0 THEN 3000 + (EXTRACT(DOY FROM d)::int * 7 % 300)
    ELSE 2400 + (EXTRACT(DOW FROM d)::int * 100) + (EXTRACT(DOY FROM d)::int * 3 % 200)
  END::numeric,
  -- Forecast orders
  CASE 
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 60 + (EXTRACT(DOY FROM d)::int % 10)
    WHEN EXTRACT(DOW FROM d) = 0 THEN 48 + (EXTRACT(DOY FROM d)::int % 8)
    ELSE 40 + (EXTRACT(DOW FROM d)::int * 2)
  END::integer,
  -- Planned labor hours
  CASE
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 85
    WHEN EXTRACT(DOW FROM d) = 0 THEN 60
    ELSE 70
  END::numeric,
  -- Planned labor cost (hours * €14.50 avg)
  CASE
    WHEN EXTRACT(DOW FROM d) IN (5, 6) THEN 85 * 14.50
    WHEN EXTRACT(DOW FROM d) = 0 THEN 60 * 14.50
    ELSE 70 * 14.50
  END::numeric
FROM locations l
CROSS JOIN generate_series(CURRENT_DATE - 90, CURRENT_DATE + 7, '1 day'::interval) AS d
WHERE l.active = true
ON CONFLICT DO NOTHING;

-- Step 5: Reseed budget_days + budget_metrics for rolling window
INSERT INTO budget_days (id, budget_version_id, org_id, location_id, day)
SELECT
  md5(bv.id::text || '-' || l.id::text || '-' || d::text)::uuid,
  bv.id,
  bv.org_id,
  l.id,
  d::date
FROM budget_versions bv
CROSS JOIN locations l
CROSS JOIN generate_series(CURRENT_DATE - 90, CURRENT_DATE + 7, interval '1 day') AS d
WHERE bv.status IN ('published', 'frozen')
  AND l.active = true
  AND l.org_id = bv.org_id
ON CONFLICT DO NOTHING;

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
WHERE ex.budget_day_id IS NULL AND bd.day >= CURRENT_DATE - 90
ON CONFLICT DO NOTHING;
