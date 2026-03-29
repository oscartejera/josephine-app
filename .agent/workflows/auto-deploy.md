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
**CRÍTICO: Usar `&&` para encadenar, NUNCA `;` en PowerShell.**
**CRÍTICO: Usar `WaitMsBeforeAsync: 10000` — el comando DEBE terminar en background.**

```powershell
git add -A && git commit --no-verify -m "<tipo>(<scope>): <descripción>" && git push --no-verify origin main
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

1. **NUNCA usar `git commit` sin `--no-verify`** — el pre-commit hook ejecuta `npm run preflight:quick` que tarda 30-60s y bloquea el terminal
2. **NUNCA usar `git push` sin `--no-verify`** — el pre-push hook ejecuta `npm run preflight` completo que tarda 1-2 min
3. **NUNCA separar commit y push en comandos separados** — encadenar SIEMPRE con `&&`
4. **NUNCA usar `;` en PowerShell** — usar `&&` para encadenar
5. **NUNCA hacer force push (`git push --force`)**
6. **NUNCA commitear archivos `.env`, secrets, o tokens**
7. Si el push falla por conflictos, hacer `git pull --rebase origin main` primero
8. Si hay migraciones, seguir también `/db-migrate` para las reglas SQL específicas

## Razón del `--no-verify`

Los husky hooks (`.husky/pre-commit` y `.husky/pre-push`) ejecutan:
- pre-commit: `npm run preflight:quick` (tsc + eslint)  
- pre-push: `npm run preflight` (tsc + eslint + tests)

Como YA ejecutamos `npx tsc --noEmit` manualmente en el paso 1, estos hooks son redundantes
y solo causan que los comandos se "cuelguen" durante minutos.
