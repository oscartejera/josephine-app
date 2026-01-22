-- ============================================
-- FASE 1: Limpiar datos y añadir constraints (v2)
-- ============================================

-- 1.1 Eliminar forecasts de locations legacy (IDs aaaaaaa1-3)
DELETE FROM forecast_daily_metrics 
WHERE location_id IN (
  'aaaaaaa1-1111-1111-1111-111111111111',
  'aaaaaaa2-1111-1111-1111-111111111111', 
  'aaaaaaa3-1111-1111-1111-111111111111'
);

-- 1.2 Eliminar planned_shifts de locations legacy
DELETE FROM planned_shifts 
WHERE location_id IN (
  'aaaaaaa1-1111-1111-1111-111111111111',
  'aaaaaaa2-1111-1111-1111-111111111111', 
  'aaaaaaa3-1111-1111-1111-111111111111'
);

-- 1.3 Eliminar cualquier forecast duplicado restante (keep only most recent per location+date)
DELETE FROM forecast_daily_metrics f1
USING forecast_daily_metrics f2
WHERE f1.location_id = f2.location_id 
  AND f1.date = f2.date 
  AND f1.id < f2.id;

-- 1.4 Añadir UNIQUE constraint para prevenir duplicados futuros
-- Primero verificamos si ya existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'forecast_unique_location_date'
  ) THEN
    ALTER TABLE forecast_daily_metrics 
    ADD CONSTRAINT forecast_unique_location_date 
    UNIQUE (location_id, date);
  END IF;
END $$;

-- 1.5 Añadir índice para optimizar queries de forecast
CREATE INDEX IF NOT EXISTS idx_forecast_location_date 
ON forecast_daily_metrics(location_id, date);

-- 1.6 Añadir columna 'active' a locations para soft-delete
ALTER TABLE locations ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 1.7 Marcar locations legacy como inactivas (ahora que existe la columna)
UPDATE locations SET active = false 
WHERE id IN (
  'aaaaaaa1-1111-1111-1111-111111111111',
  'aaaaaaa2-1111-1111-1111-111111111111', 
  'aaaaaaa3-1111-1111-1111-111111111111'
);

-- 1.8 Asegurar que target_col_percent = 22 en todas las locations activas
INSERT INTO location_settings (location_id, target_col_percent, default_hourly_cost)
SELECT l.id, 22, 15.00
FROM locations l
WHERE l.active = true
  AND NOT EXISTS (
    SELECT 1 FROM location_settings ls WHERE ls.location_id = l.id
  )
ON CONFLICT (location_id) DO UPDATE
SET target_col_percent = 22;