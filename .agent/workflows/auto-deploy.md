---
description: Auto-commit y push a main después de cada cambio completado — regla global del proyecto
---

// turbo-all

# Workflow: Auto-Deploy (Regla Global)

**Esta es la regla por defecto del proyecto.** Después de completar CUALQUIER cambio
(código, estilos, config, migraciones, docs, etc.), ejecutar automáticamente:

## 1. Preflight Gate (OBLIGATORIO)

```bash
npm run preflight
```

Este comando ejecuta automáticamente según lo que haya cambiado:
- `npx tsc --noEmit` — siempre
- `eslint --quiet` — siempre
- Migration lint — si hay `.sql` nuevos/modificados
- Contract tests — si `src/data/` cambió
- Unit tests — si archivos `.ts`/`.tsx` cambiaron
- Demo verification — si hooks/data/pages cambiaron
- BOM check — si hay migraciones SQL

Si preflight falla, corregir ANTES de continuar. No commitear código roto.

Para cambios triviales (solo docs, comments): `npm run preflight:quick` (solo tsc + lint)

## 2. Stage de archivos modificados

```bash
git add -A
```

## 3. Commit con mensaje descriptivo

```bash
git commit -m "<tipo>(<scope>): <descripción>"
```

Tipos válidos: `feat`, `fix`, `refactor`, `style`, `db`, `docs`, `chore`, `perf`

Ejemplos:
- `feat(inventory): add stock audit page`
- `fix(auth): handle expired session redirect`
- `db(schema): add reservations table`
- `style(sidebar): reorder cost management items`

## 4. Push a main

```bash
git push origin main
```

## 5. Confirmar deploy

```bash
git log --oneline -1
```

---

## ⚠️ Reglas de seguridad

- **SIEMPRE** ejecutar `npm run preflight` antes de push — no subir código que no compila
- **NUNCA** hacer force push (`git push --force`)
- **NUNCA** commitear archivos `.env`, secrets, o tokens
- Si el push falla por conflictos, hacer `git pull --rebase origin main` primero
- Si hay migraciones, seguir también `/db-migrate` para las reglas SQL específicas
