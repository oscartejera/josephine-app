# 🌱 Cómo Poblar Datos Demo en Josephine

## 🚀 Opción 1: Desde el Frontend (Más Fácil)

1. **Ir a Labour module** en tu app: `/insights/labour`

2. **Si no hay datos**, verás un botón grande:
   ```
   [📊 Generate Demo Data]
   ```

3. **Click en el botón** → Genera automáticamente:
   - 3 locations
   - 70 empleados
   - 30 días de ventas
   - 30 días de labour
   - ~4,680 registros

4. **Espera 30-60 segundos** → Datos aparecen automáticamente

## 💻 Opción 2: Desde Supabase Edge Functions

1. **Ve a Supabase Dashboard** → Edge Functions

2. **Busca** `seed_josephine_demo`

3. **Ejecuta:**
   ```bash
   curl -X POST https://[tu-proyecto].supabase.co/functions/v1/seed_josephine_demo \
     -H "Authorization: Bearer [tu-anon-key]" \
     -H "Content-Type: application/json" \
     -d '{"days": 60}'
   ```

4. **Respuesta:**
   ```json
   {
     "success": true,
     "locations": 3,
     "employees": 70,
     "salesRecords": 9360,
     "labourRecords": 180,
     "message": "✅ Demo data seeded"
   }
   ```

## 🗄️ Opción 3: SQL Directo

1. **Ve a Supabase Dashboard** → SQL Editor

2. **Copia y pega** de `supabase/migrations/20260204_seed_demo_data_simple.sql`

3. **Ejecuta:**
   ```sql
   SELECT * FROM seed_josephine_demo_data();
   ```

4. **Verifica:**
   ```sql
   SELECT 
     (SELECT COUNT(*) FROM facts_sales_15m) as sales,
     (SELECT COUNT(*) FROM facts_labor_daily) as labour,
     (SELECT COUNT(*) FROM employees) as employees,
     (SELECT COUNT(*) FROM locations) as locations;
   ```

## ✅ Verificar que Funcionó

### **En Sales Module (`/sales`):**
- Sales to Date debe mostrar ~€36,000+
- Gráfico debe tener 7 días con barras visibles
- Location selector debe mostrar 3 locations
- Click en día → Drill-down por hora funciona

### **En Labour Module (`/insights/labour`):**
- Sales card debe mostrar ~€36,000+
- COL% debe estar ~28-30%
- SPLH debe estar ~€70-80
- Gráfico debe tener 7 días con datos
- Labour by Role debe mostrar 5 roles

### **Queries de verificación:**
```sql
-- Ver sales de los últimos 7 días
SELECT 
  DATE(ts_bucket) as day,
  l.name as location,
  ROUND(SUM(sales_net)::NUMERIC, 0) as daily_sales,
  SUM(tickets) as tickets
FROM facts_sales_15m f
JOIN locations l ON l.id = f.location_id
WHERE DATE(ts_bucket) >= CURRENT_DATE - 7
GROUP BY DATE(ts_bucket), l.name
ORDER BY day DESC, l.name;

-- Ver labour de los últimos 7 días
SELECT 
  f.day,
  l.name as location,
  ROUND(f.actual_hours, 1) as hours,
  ROUND(f.labor_cost_est, 0) as cost,
  ROUND((f.labor_cost_est / NULLIF(
    (SELECT SUM(sales_net) FROM facts_sales_15m WHERE DATE(ts_bucket) = f.day AND location_id = f.location_id), 
    0
  ) * 100)::NUMERIC, 2) as col_pct
FROM facts_labor_daily f
JOIN locations l ON l.id = f.location_id
WHERE f.day >= CURRENT_DATE - 7
ORDER BY f.day DESC, l.name;

-- Ver empleados por location y rol
SELECT 
  l.name as location,
  e.role_name,
  COUNT(*) as count,
  ROUND(AVG(e.hourly_cost)::NUMERIC, 2) as avg_wage
FROM employees e
JOIN locations l ON l.id = e.location_id
WHERE e.active = true
GROUP BY l.name, e.role_name
ORDER BY l.name, e.role_name;
```

## 🧹 Limpiar Datos Demo

Si necesitas regenerar desde cero:

```sql
-- Limpiar TODO (cuidado!)
DELETE FROM facts_sales_15m WHERE location_id IN (
  SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
);
DELETE FROM facts_labor_daily WHERE location_id IN (
  SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
);
DELETE FROM employees WHERE location_id IN (
  SELECT id FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')
);
DELETE FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña');

-- Luego regenerar:
SELECT * FROM seed_josephine_demo_data();
```

## 🎬 Para Demo/Inversores

### **Antes de la demo:**
1. ✅ Ejecutar seed (Opción 1, 2 o 3)
2. ✅ Verificar Sales module muestra €36k+
3. ✅ Verificar Labour module muestra COL% ~28-30%
4. ✅ Verificar 3 locations en selectores
5. ✅ Probar drill-down por hora
6. ✅ Probar Ask Josephine con pregunta

### **Durante la demo:**
- **No menciones** que son datos demo (parecen 100% reales)
- Usa location selector para mostrar multi-location
- Usa drill-down para impresionar con granularidad
- Usa Ask Josephine para mostrar AI capabilities
- Cambia date ranges para mostrar flexibilidad

## 🔥 Troubleshooting

**Problema:** El botón "Generate Demo Data" no aparece
- **Solución:** Verifica que estás en un periodo sin datos (ej: últimos 30 días)

**Problema:** Datos no aparecen después de seed
- **Solución:** Refetch manual: `window.location.reload()`
- **Solución:** Verificar en SQL Editor si los datos existen

**Problema:** COL% sale 0% o NULL
- **Solución:** facts_labor_daily necesita regenerarse
- **Ejecutar:** Script que calcula labour basado en sales existentes

**Problema:** Location selector vacío
- **Solución:** Locations no se crearon
- **Ejecutar:** `INSERT INTO locations...` manual

## 📞 Ayuda

Si algo falla:
1. Ver logs en Supabase Dashboard → Edge Functions → seed_josephine_demo
2. Ejecutar queries de verificación de arriba
3. Contactar soporte con logs específicos
