# Josephine — Demo Playbook v1.0

## POS ↔ Demo Auto-Switch

---

## 🎯 Objetivo (30s de contexto)

Josephine resuelve un problema real: **¿qué datos muestro cuando el restaurante aún no tiene TPV conectado?** La respuesta es un sistema inteligente que:

- Muestra **datos demo** cuando no hay TPV o los datos están obsoletos
- Cambia **automáticamente a datos reales** cuando llega una sincronización del TPV
- **Nunca mezcla fuentes** — las cifras siempre son coherentes
- Permite **control manual** para forzar demo o POS según necesidad

---

## 🎤 Script hablado (75s)

> *«Buenas. Os voy a enseñar cómo Josephine gestiona automáticamente la fuente de datos de vuestro restaurante en tres escenarios.*
>
> *Primero: sin TPV conectado. Mirad el badge en la barra lateral — dice "Demo, auto". El sistema detecta que no hay sincronización reciente y muestra datos demo. Todos los KPIs, la gráfica horaria y los productos top salen de la misma fuente. Nunca se mezclan.*
>
> *Segundo: conectáis Square. En cuanto llega una sincronización exitosa, el badge cambia a verde — "POS, auto". Los números del Dashboard, Ventas y P&L ahora son datos reales del TPV. Las vistas materializadas se refrescan solas en menos de 3 segundos.*
>
> *Tercero: control manual. En Ajustes podéis forzar "Siempre Demo" o "Siempre POS". Si forzáis POS pero no hay datos frescos, el badge se pone ámbar con un aviso de bloqueo — y el sistema sigue mostrando demo como fallback seguro. Nunca dejamos la pantalla vacía.*
>
> *El modo "Auto" es el recomendado. Josephine decide por vosotros: si hay datos reales recientes, los usa; si no, muestra demo. Cero intervención manual, datos de confianza, sin sorpresas.»*

---

## 🖱️ Click Path (10 pasos)

| # | Acción | Ruta | Qué señalar |
|---|--------|------|-------------|
| 1 | Abrir app | `/dashboard` | KPIs del día. Badge azul 🔵 "Demo auto" en sidebar footer |
| 2 | Click **Ventas** | `/insights/sales` | Gráfica horaria + top productos. Fuente = demo |
| 3 | Click **P&L Instantáneo** | `/insights/instant-pl` | Margen, costes laborales. Misma fuente demo |
| 4 | Click **Ajustes** | `/settings` | Scroll a sección "Fuente de datos" |
| 5 | Seleccionar **Manual → POS** | `/settings` | Badge ámbar ⚠️ — "POS sin datos, bloqueado" |
| 6 | Volver a **Dashboard** | `/dashboard` | Datos visibles (fallback demo). "Nunca pantalla vacía" |
| 7 | En Ajustes: **Manual → Demo** | `/settings` | Badge azul estable. "Forzado a Demo" |
| 8 | Seleccionar **Automático** | `/settings` | Badge vuelve a "Demo auto" |
| 9 | Click **Integraciones** | `/integrations` | Mostrar Square conectado, última sync |
| 10 | Volver a **Dashboard** | `/dashboard` | Cierre: "Cuando llegue un sync real, todo cambia solo" |

---

## ✅ Proof Points (5)

### PP1: "No mezcla fuentes"

**Pantalla**: Dashboard → Ventas → P&L (todos muestran la misma fuente)

```sql
SELECT org_id, data_source, COUNT(*) AS rows
FROM sales_daily_unified
GROUP BY 1, 2
ORDER BY 1, 2;
```

**Esperado**: Una sola fila por org — solo `demo` O solo `pos`, nunca ambas.

---

### PP2: "Auto fallback inteligente"

```sql
SELECT resolve_data_source('<org_id>');
```

| Estado del sync | Resultado |
|----------------|-----------|
| `last_synced_at` < 24h | `data_source: 'pos'`, `reason: 'auto_pos_recent'` |
| `last_synced_at` > 24h | `data_source: 'demo'`, `reason: 'auto_demo_no_sync'` |
| Sin integración | `data_source: 'demo'`, `reason: 'auto_demo_no_sync'` |

**En UI**: Badge alterna verde 🟢 / azul 🔵 según la frescura del sync.

---

### PP3: "Manual POS bloquea si no hay sync"

En Ajustes → Fuente de datos → Manual → POS

```sql
UPDATE org_settings SET data_source_mode = 'manual_pos' WHERE org_id = '...';
SELECT resolve_data_source('...');
-- → { data_source: 'demo', blocked: true, reason: 'manual_pos_blocked_no_sync' }
```

**En UI**: Badge ámbar 🟡 con icono ⚠️, tooltip: "Bloqueado: datos POS no disponibles".

> ⚠️ **Restaurar después**: `UPDATE org_settings SET data_source_mode = 'auto' WHERE org_id = '...';`

---

### PP4: "Hourly + Top Products cambian con el source"

| Vista | Demo | POS (tras sync) |
|-------|------|-----------------|
| `sales_hourly_unified` | ~18K filas | Depende del volumen real |
| `product_sales_daily_unified` | ~42K filas | Solo productos reales |

```sql
SELECT COUNT(*) FROM sales_hourly_unified;
SELECT COUNT(*) FROM product_sales_daily_unified;
```

**En UI**: `/insights/sales` muestra gráfica horaria y top productos de la fuente activa.

---

### PP5: "Refresh automático tras sync success"

```sql
-- Trigger activo:
SELECT tgname, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'integration_sync_runs'::regclass
  AND tgname ILIKE '%refresh%';

-- Último refresh:
SELECT triggered_by, status, duration_ms
FROM ops.mv_refresh_log
ORDER BY id DESC LIMIT 1;
-- → triggered_by: 'sync_success', status: 'success', ~2000ms
```

**Pipeline**: sync success → trigger → job `refresh_mvs` → `ops.refresh_all_mvs()` → views actualizadas.

---

## 🔧 Troubleshooting (15s cada uno)

### Dashboard muestra "Demo" cuando debería ser "POS"

| Causa | Diagnóstico | Solución |
|-------|-------------|----------|
| Sync stale (>24h) | `SELECT resolve_data_source(org_id)` → `auto_demo_no_sync` | Lanzar sync desde Integraciones |
| Modo manual_demo | `SELECT data_source_mode FROM org_settings` | Cambiar a `auto` en Ajustes |
| `last_synced_at` no actualizado | `SELECT metadata->>'last_synced_at' FROM integrations` | Verificar edge function de sync |

### Hourly / Products vacíos tras flip a POS

| Causa | Diagnóstico | Solución |
|-------|-------------|----------|
| MVs no refrescadas | `SELECT COUNT(*) FROM sales_hourly_unified_mv_v2` → 0 | `SELECT ops.refresh_all_mvs('manual_fix')` |
| Sin pedidos recientes | `SELECT COUNT(*) FROM cdm_orders WHERE closed_at > now() - '7d'` | Esperar sync |
| Job no procesado | `SELECT * FROM jobs WHERE job_type='refresh_mvs' ORDER BY created_at DESC LIMIT 1` | `SELECT process_refresh_mvs_jobs()` |

### Badge dice `blocked = true` (ámbar ⚠️)

| Causa | Significado | Acción |
|-------|-------------|--------|
| `manual_pos` sin sync | Usuario pidió POS pero no hay datos | Cambiar a "Automático" |
| Comportamiento esperado | Fallback seguro a demo | Explicar: "Cuando conectes Square, cambiará solo" |

---

## 📦 SQL Pack — "Verificación pre-demo"

Ejecutar en el SQL Editor de Supabase antes de la demo:

```sql
-- 1) Resolver
SELECT resolve_data_source((SELECT id FROM orgs LIMIT 1));

-- 2) Sin mezcla
SELECT org_id, data_source, COUNT(*)
FROM sales_daily_unified GROUP BY 1, 2;

-- 3) MVs existen
SELECT
  to_regclass('sales_hourly_unified_mv_v2') AS hourly_v2,
  to_regclass('product_sales_daily_unified_mv_v2') AS product_v2;

-- 4) Refresh funciona
SELECT ops.refresh_all_mvs('pre_demo_check');

-- 5) Cuentas
SELECT 'Hourly' AS v, COUNT(*) FROM sales_hourly_unified
UNION ALL SELECT 'Products', COUNT(*) FROM product_sales_daily_unified
UNION ALL SELECT 'Daily', COUNT(*) FROM sales_daily_unified
UNION ALL SELECT 'Forecast', COUNT(*) FROM forecast_daily_unified;

-- 6) Modo actual
SELECT data_source_mode FROM org_settings
WHERE org_id = (SELECT id FROM orgs LIMIT 1);
```

Todos deben devolver datos sin errores. El modo debe ser `auto`.

---

## ⏱️ Checklist pre-demo (2 min)

- [ ] Abrir app en navegador, verificar que carga `/dashboard`
- [ ] Sidebar badge visible: "Demo auto" (azul)
- [ ] Ejecutar SQL Pack de verificación — 0 errores
- [ ] Verificar que `/insights/sales` muestra gráfica horaria con datos
- [ ] Verificar que `/settings` tiene sección "Fuente de datos" visible
- [ ] Modo = `auto` (si no, restaurar)
- [ ] Preparar SQL Editor de Supabase en otra pestaña (para proof points)

---

## 🎯 Líneas de cierre (ventas)

1. > *«Con Josephine, vuestros datos siempre están disponibles. Desde el primer día veis demo útil, y cuando conectáis el TPV, todo cambia automáticamente.»*

2. > *«No hay configuración manual. Conectáis Square y en menos de 3 segundos los dashboards muestran datos reales. Sin intervención técnica.»*

3. > *«La confianza en los datos es clave para tomar decisiones. Josephine garantiza que cada pantalla muestra una sola fuente — nunca hay mezcla ni confusión.»*

---

*Versión 1.0 — Febrero 2026*
