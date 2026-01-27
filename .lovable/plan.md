
# Plan: Eliminar Módulo de Integraciones

## Resumen

Eliminaremos completamente la página y funcionalidad de **Integraciones** de Josephine, ya que el POS nativo hace innecesaria la conexión con TPVs externos (Revo, Glop, Square, Lightspeed).

---

## Archivos a Eliminar

### Página Principal
- `src/pages/Integrations.tsx`

### Componentes (carpeta completa)
- `src/components/integrations/ConnectDialog.tsx`
- `src/components/integrations/CsvImportDialog.tsx`
- `src/components/integrations/HealthPanel.tsx`
- `src/components/integrations/IntegrationCard.tsx`
- `src/components/integrations/MappingDialog.tsx`

### Edge Functions de Sincronización POS
- `supabase/functions/pos_import_csv/`
- `supabase/functions/pos_sync_dispatch/`
- `supabase/functions/pos_sync_glop/`
- `supabase/functions/pos_sync_lightspeed/`
- `supabase/functions/pos_sync_revo/`
- `supabase/functions/pos_sync_square/`
- `supabase/functions/pos_sync_schedule_runner/`

---

## Archivos a Modificar

### 1. App.tsx - Eliminar ruta
```text
Línea 33: Eliminar import de Integrations
Línea 133: Eliminar ruta /integrations
```

### 2. AppSidebar.tsx - Eliminar del menú
```text
Línea 11: Eliminar import de Plug icon
Línea 57: Eliminar item de Integrations del array navItems
```

### 3. usePermissions.ts - Eliminar permisos
```text
Líneas 63-67: Eliminar permisos INTEGRATIONS_*
Línea 103: Eliminar integrations de SIDEBAR_PERMISSIONS
```

### 4. Traducciones (i18n)
```text
src/i18n/locales/en.json: Eliminar "integrations" keys
src/i18n/locales/es.json: Eliminar "integrations" keys
src/i18n/locales/ca.json: Eliminar "integrations" keys
```

---

## Tablas de Base de Datos Afectadas

La tabla `pos_connections` quedará sin uso tras esta eliminación. Se puede:
- **Opción A**: Dejar la tabla (no afecta al funcionamiento)
- **Opción B**: Eliminarla en una migración futura

---

## Sección Técnica

### Orden de Eliminación

1. Eliminar edge functions de sincronización POS
2. Eliminar componentes de `src/components/integrations/`
3. Eliminar página `src/pages/Integrations.tsx`
4. Actualizar `App.tsx` (quitar import y ruta)
5. Actualizar `AppSidebar.tsx` (quitar del menú)
6. Actualizar `usePermissions.ts` (quitar permisos)
7. Actualizar archivos de traducción

### Impacto en Otras Funcionalidades

- **POS nativo**: Sin impacto, funciona independientemente
- **Tickets**: Sin impacto, se generan desde el POS nativo
- **Insights/Menu Engineering**: Sin impacto, usan datos de `tickets` y `products` existentes
- **Settings**: La pestaña de "Integrations" en settings también se puede eliminar si existe

### Verificación Post-Eliminación

Tras la eliminación, verificar que:
1. El sidebar no muestra "Integrations"
2. La ruta `/integrations` redirige a 404
3. No hay errores de imports rotos en la consola
