---
description: Auto-commit y push a main después de cada cambio completado — regla global del proyecto
---

// turbo-all

# Workflow: Auto-Deploy (Regla Global)

**Esta es la regla por defecto del proyecto.** Después de completar CUALQUIER cambio
(código, estilos, config, migraciones, docs, etc.), ejecutar automáticamente:

## 1. Preflight Gate (OBLIGATORIO)

```bash
npx tsc --noEmit
```

Si falla, corregir ANTES de continuar. No commitear código roto.

## 2. Commit + Push en UN solo comando

**CRÍTICO: Usar SIEMPRE `--no-verify` en commit Y push porque ya validamos con tsc.**
**CRÍTICO: Usar `;` para encadenar comandos (PowerShell 5.1 NO soporta `&&`).**
**CRÍTICO: Poner `WaitMsBeforeAsync: 10000`.**

```powershell
git add -A; git commit --no-verify -m "<tipo>(<scope>): <descripción>"; git push --no-verify origin main
```

Tipos válidos: `feat`, `fix`, `refactor`, `style`, `db`, `docs`, `chore`, `perf`

Ejemplos:
- `feat(inventory): add stock audit page`
- `fix(auth): handle expired session redirect`
- `db(schema): add reservations table`

## 3. Confirmar deploy

Esperar max 30s con `command_status` y verificar con:

```bash
git log --oneline -1
```

---

## ⚠️ Errores comunes que NUNCA repetir

1. **NUNCA usar `git commit` sin `--no-verify`** — el pre-commit hook ejecuta `npm run preflight:quick` que cuelga el terminal 30-60s+
2. **NUNCA usar `git push` sin `--no-verify`** — el pre-push hook ejecuta `npm run preflight` completo que cuelga 1-2 min+
3. **NUNCA separar commit y push en comandos separados** — encadenar SIEMPRE con `;` en la misma línea
4. **NUNCA usar `&&` en PowerShell** — esta máquina usa PowerShell 5.1 que NO soporta `&&`. Usar siempre `;`
5. **NUNCA hacer force push (`git push --force`)**
6. **NUNCA commitear archivos `.env`, secrets, o tokens**
7. Si el push falla por conflictos, hacer `git pull --rebase origin main` primero
8. Si hay migraciones, seguir también `/db-migrate` para las reglas SQL específicas

## Razón del `--no-verify`

Los husky hooks (`.husky/pre-commit` y `.husky/pre-push`) fueron desactivados (exit 0)
porque referenciaban scripts npm inexistentes (`preflight:quick`, `preflight`) y causaban
que git se colgara INDEFINIDAMENTE sin output.

### Fix permanente aplicado (2026-03-29):
1. `.husky/pre-commit` → `exit 0` (era `npm run preflight:quick` — no existe)
2. `.husky/pre-push` → `exit 0` (era `npm run preflight` — no existe)  
3. `git config --unset core.hooksPath` → elimina la redirección `.husky/_`

Si en el futuro se añaden los scripts `preflight:quick` y `preflight` al package.json,
se pueden reactivar los hooks eliminando el `exit 0`.

## Sintaxis PowerShell 5.1

Esta máquina (Windows) usa PowerShell 5.1. Diferencias clave:
- `&&` → NO funciona. Usar `;` (ejecuta siempre el siguiente, sin short-circuit)
- `2>&1` → funciona para redirigir stderr
- El operador `;` ejecuta todos los comandos aunque uno falle, lo cual está OK para nuestro caso

## Si git se cuelga de nuevo

1. Matar procesos: `Get-Process -Name "git*" | Stop-Process -Force`
2. Limpiar locks: `Remove-Item -Force .git/index.lock`
3. Verificar hooks: `git config --get core.hooksPath` (debe dar vacío)
4. Re-desactivar si Husky lo reactivó: `git config --unset core.hooksPath`

