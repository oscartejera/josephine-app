---
description: Crear o modificar migraciones SQL de Supabase de forma segura
---

// turbo-all

# Workflow: Crear Migración SQL (100% Automático)

Sigue estos pasos **siempre** que necesites crear o modificar schema de base de datos.
**Todo se ejecuta automáticamente sin pedir confirmación al usuario.**

## 1. Crear archivo de migración con timestamp correcto

```bash
# Formato: YYYYMMDDHHMMSS_nombre_descriptivo.sql
# Ejemplo: 20260328140000_add_reservations_table.sql
```

El archivo va en `supabase/migrations/`.

## 2. Reglas SQL obligatorias

- **Tablas**: Usar `CREATE TABLE IF NOT EXISTS` (nunca `CREATE TABLE` a secas)
- **Funciones/Views**: Usar `CREATE OR REPLACE FUNCTION/VIEW`
- **DROP**: Solo con `IF EXISTS` — nunca DROP sin guard
- **Columnas nuevas**: Usar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- **Al final del archivo**: Si tocas funciones o views, añadir:
  ```sql
  NOTIFY pgrst, 'reload schema';
  ```

## 3. Validar la migración

```bash
node scripts/validate-migration.mjs supabase/migrations/<FICHERO_CREADO>.sql
```

Si hay errores, corregir antes de continuar. Warnings son aceptables.

## 4. Regenerar types TypeScript

```bash
npx supabase gen types typescript --project-id qixipveebfhurbarksib > src/integrations/supabase/types.ts
```

## 5. Commit automático

```bash
git add supabase/migrations/ src/integrations/supabase/types.ts
git commit -m "db: <descripción corta del cambio>"
```

Incluir también cualquier archivo de código que dependa de los cambios de DB.

## 6. Push automático a main

```bash
git push origin main
```

Esto dispara automáticamente:
- `ci.yml` → lint de migraciones
- `deploy-migrations.yml` → `supabase db push` contra producción
- `deploy-functions.yml` → si hay cambios en edge functions

## 7. Verificar el deploy (opcional)

Si quieres confirmar que pasó, ejecuta:
```bash
gh run list --workflow=deploy-migrations.yml --limit 1
```

---

## ⚠️ Anti-patrones

- **NUNCA** ejecutar SQL directo en el SQL Editor de Supabase — siempre usar archivos de migración
- **NUNCA** crear migraciones con timestamps duplicados
- **NUNCA** modificar migraciones ya aplicadas — crear una nueva migración correctiva
- **NUNCA** hacer `DROP TABLE/FUNCTION` sin `IF EXISTS`
- **NUNCA** olvidar `NOTIFY pgrst` después de crear/modificar funciones RPC
