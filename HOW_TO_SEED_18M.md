# 🌱 Generar 18 Meses de Datos Demo

## 📅 **Periodo: 2025-01-01 a 2026-06-30**

### **Estructura temporal:**
- **📊 2025 completo (12 meses):** Actuals históricos - baseline
- **📈 2026 Ene-Feb (2 meses):** Actuals en progreso - presente
- **🔮 2026 Mar-Jun (4 meses):** Forecast/Planned - futuro

---

## 🚀 OPCIÓN 1: Desde Supabase Dashboard (MÁS FÁCIL)

### **Pasos:**

1. **Ir a Supabase Dashboard** → SQL Editor

2. **Copiar y pegar este comando:**

```sql
-- Llamar a la edge function via SQL (si está disponible)
SELECT extensions.http_post(
  url := current_setting('app.supabase_url') || '/functions/v1/seed_josephine_18m',
  headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')),
  body := '{}'::jsonb
);
```

**O ejecutar directamente:**

```bash
# Desde terminal (reemplaza con tus valores)
curl -X POST \
  https://qixipveebfhurbarksib.functions.supabase.co/functions/v1/seed_josephine_18m \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

3. **Espera 3-5 minutos** (genera ~60,000 registros)

4. **Verifica** que funcionó:

```sql
SELECT 
  (SELECT COUNT(*) FROM facts_sales_15m) as sales_records,
  (SELECT COUNT(*) FROM facts_labor_daily) as labour_records,
  (SELECT COUNT(*) FROM locations WHERE name IN ('La Taberna Centro', 'Chamberí', 'Malasaña')) as locations,
  (SELECT COUNT(*) FROM employees) as employees;
```

**Resultado esperado:**
```
sales_records: ~60,000
labour_records: ~1,980  (18 meses × 3 locations × 30 días aprox)
locations: 3
employees: 70
```

---

## 📊 **Datos Generados:**

### **3 Locations:**
```
La Taberna Centro (Salamanca)
├─ Premium positioning
├─ Avg check: €26
└─ 35% of group sales

Chamberí (Madrid)
├─ Mid-range
├─ Avg check: €23
└─ 33% of group sales

Malasaña (Madrid)
├─ Casual
├─ Avg check: €22
└─ 32% of group sales
```

### **70 Employees:**
```
Por location:
├─ 8 Chefs @ €18/h      (26% labour hours)
├─ 12 Servers @ €12/h   (40% labour hours)
├─ 5 Bartenders @ €14/h (17% labour hours)
├─ 3 Hosts @ €11/h      (10% labour hours)
└─ 2 Managers @ €25/h   (7% labour hours)
```

### **Patrones de Sales:**

**Por día de semana:**
```
Viernes-Sábado: €18,000/día base (+50%)
Domingo: €16,000/día (+33%)
Lunes-Jueves: €13,000/día (normal)
Martes-Miércoles: €10,000/día (-17% mid-week dip)
```

**Estacionalidad mensual:**
```
Verano (Jun-Ago): +20% (temporada alta)
Primavera (Mar-May): +10% (temporada media-alta)
Otoño (Sep-Nov): Normal
Invierno (Dic-Feb): -10% (temporada baja)
```

**Crecimiento YoY:**
```
2025: Baseline (€1.2M anual)
2026: +15% growth (proyección €1.38M)
```

**Peak hours diarios:**
```
10:00-11:00: 4% (apertura)
12:00-15:00: 40% (lunch peak)
16:00-18:00: 8% (valle)
19:00-22:00: 45% (dinner peak)
23:00: 3% (cierre)
```

### **Labour coherente con Sales:**

```javascript
// Relación matemática garantizada:
COL% = (Labour Cost / Sales) × 100

Labour Hours = Labour Cost / Avg Hourly Wage (€14.50)

SPLH = Sales / Labour Hours

// Ejemplo día típico:
Sales: €12,000
COL% Target: 28%
Labour Cost: €12,000 × 0.28 = €3,360
Labour Hours: €3,360 / €14.50 = 231.7h
SPLH: €12,000 / 231.7h = €51.8/h
```

---

## ✅ **Verificar que Funcionó:**

### **1. Sales Module (`/sales`):**
```
✓ Sales to Date: €36,066+ (semana actual)
✓ Gráfico: 7 días con barras visibles
✓ Location Selector: 3 locations disponibles
✓ Drill-down: Click en día muestra 13 horas
✓ Date range: Cambiar a "Month" muestra 30 días
✓ YoY compare: "vs Last Year" muestra crecimiento
```

### **2. Labour Module (`/insights/labour`):**
```
✓ Sales card: €36,066+
✓ COL% card: 28-30% con target bar
✓ SPLH card: €70-80/h
✓ OPLH card: 1.8-2.2 orders/h
✓ Gráfico: 7 días con barras
✓ Labour by Role: 5 roles con datos
✓ Locations Table: 3 rows + total
```

### **3. Queries SQL de verificación:**

```sql
-- Ver sales totales por mes (2025 vs 2026)
SELECT 
  TO_CHAR(DATE(ts_bucket), 'YYYY-MM') as month,
  ROUND(SUM(sales_net)::NUMERIC, 0) as monthly_sales,
  COUNT(DISTINCT DATE(ts_bucket)) as days_with_data
FROM facts_sales_15m
GROUP BY TO_CHAR(DATE(ts_bucket), 'YYYY-MM')
ORDER BY month;

-- Resultado esperado:
-- 2025-01: €390,000 (30 días)
-- 2025-02: €364,000 (28 días)
-- ...
-- 2025-12: €351,000 (31 días - invierno)
-- 2026-01: €448,500 (+15% YoY)
-- 2026-02: €420,000
-- 2026-03 a 2026-06: Solo forecast

-- Ver COL% por mes
SELECT 
  TO_CHAR(f.day, 'YYYY-MM') as month,
  ROUND(AVG((f.labor_cost_est / NULLIF(
    (SELECT SUM(sales_net) FROM facts_sales_15m WHERE DATE(ts_bucket) = f.day), 
    0
  ) * 100))::NUMERIC, 2) as avg_col_pct,
  ROUND(SUM(f.actual_hours)::NUMERIC, 0) as total_hours,
  COUNT(DISTINCT f.day) as days
FROM facts_labor_daily f
GROUP BY TO_CHAR(f.day, 'YYYY-MM')
ORDER BY month;

-- Ver crecimiento YoY
SELECT 
  EXTRACT(MONTH FROM DATE(ts_bucket)) as month_num,
  TO_CHAR(DATE(ts_bucket), 'Month') as month_name,
  SUM(CASE WHEN EXTRACT(YEAR FROM DATE(ts_bucket)) = 2025 THEN sales_net ELSE 0 END) as sales_2025,
  SUM(CASE WHEN EXTRACT(YEAR FROM DATE(ts_bucket)) = 2026 THEN sales_net ELSE 0 END) as sales_2026,
  ROUND(
    ((SUM(CASE WHEN EXTRACT(YEAR FROM DATE(ts_bucket)) = 2026 THEN sales_net ELSE 0 END) /
      NULLIF(SUM(CASE WHEN EXTRACT(YEAR FROM DATE(ts_bucket)) = 2025 THEN sales_net ELSE 0 END), 0) - 1) * 100)::NUMERIC,
    2
  ) as yoy_growth_pct
FROM facts_sales_15m
GROUP BY EXTRACT(MONTH FROM DATE(ts_bucket)), TO_CHAR(DATE(ts_bucket), 'Month')
ORDER BY month_num;

-- Debería mostrar ~15% growth en Ene-Feb 2026 vs 2025
```

---

## 🎬 **Script para Demo con Inversores:**

### **Slide 1: Overview**
"Josephine lleva operando desde Enero 2025 con 3 locations en Madrid"

### **Slide 2: Sales Performance**
- Ir a `/sales`
- Cambiar date range a "Month" (Enero 2026)
- "Este mes llevamos €95,000 en ventas"
- Location Selector → "La Taberna Centro"
- "Nuestra location premium hace €35,000/mes"

### **Slide 3: YoY Growth**
- Compare: "vs Last Year"
- "Crecimiento sostenido del 15% YoY"
- "Enero 2025: €82,600 → Enero 2026: €95,000"

### **Slide 4: Labour Efficiency**
- Ir a `/insights/labour`
- "COL% al 30%, ligeramente sobre target de 28%"
- Click en día específico → Drill-down
- "Identificamos que 20:00-21:00 tiene picos de labour cost"
- Labour by Role → "40% del labour es Front of House"

### **Slide 5: AI-Powered Insights**
- Click "Ask Josephine"
- Pregunta: "¿Cómo puedo reducir mi COL% al 28%?"
- AI responde con recomendaciones específicas basadas en datos reales

### **Slide 6: Forecasting**
- Cambiar a Marzo 2026 (futuro)
- "Sistema proyecta €105,000 para Marzo"
- "Labour planificado: 720 horas, COL% target 28%"
- "Prophet ML aprende de nuestros patrones históricos"

---

## 🔧 **Troubleshooting:**

**Problema: "Function not found: seed_josephine_18m"**
- La función aún no está deployada
- Usa el método SQL alternativo (ver abajo)

**SQL Alternativo (genera menos datos pero funciona):**
```sql
SELECT * FROM seed_josephine_demo_data();
-- Esto genera solo 30 días, pero es suficiente para testing
```

**Problema: "Out of memory" o timeout**
- 60k registros puede ser pesado
- Solución: Ejecutar en 2 partes:
  1. Primero 2025: Modificar función para solo 2025
  2. Luego 2026: Agregar H1 2026

**Problema: Labour data parece incorrecta**
- Verificar que sales existe primero
- Labour se calcula DESPUÉS de sales
- Ejecutar: "Regenerate labour from sales" script

---

## 📞 **¿Necesitas ayuda?**

1. Verificar logs: Supabase Dashboard → Edge Functions → Logs
2. Ver datos: SQL Editor → Queries de verificación arriba
3. Support: Incluir logs específicos del error

---

## 🎯 **Next Steps After Seeding:**

1. ✅ Refresh Sales module
2. ✅ Refresh Labour module  
3. ✅ Probar date ranges (Today, Week, Month, Custom)
4. ✅ Probar location selector (3 locations)
5. ✅ Probar drill-down por hora
6. ✅ Probar Ask Josephine
7. ✅ Probar Compare "vs Last Year"
8. ✅ Verificar que Labour by Role muestra datos
9. ✅ Preparar script de demo
10. ✅ ¡Impresionar inversores! 🚀
