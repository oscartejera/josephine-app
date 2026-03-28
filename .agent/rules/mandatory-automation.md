---
description: Protocolo obligatorio de automatización — gates que el agente DEBE ejecutar en cada cambio, sin excepción
---

# Mandatory Automation Protocol (MAP)

> ⚠️ Estas reglas son OBLIGATORIAS, no sugerencias.
> El agente DEBE ejecutarlas en CADA tarea que modifique código.
> Violarlas es tan grave como introducir un bug.

---

## PRE-EDIT: Antes de tocar cualquier archivo

**OBLIGATORIO** cuando vas a modificar cualquier archivo en `src/`:

```bash
npm run impact-map:query -- <archivo-que-vas-a-tocar>
```

**Qué obtienes**: quién importa ese archivo, qué páginas lo consumen, qué RPCs usa.
**Por qué**: para no romper cosas sin saberlo.

**Si el archivo tiene ≥5 consumers** → mencionarlo al usuario antes de editar.

---

## PRE-FEATURE: Antes de crear una feature nueva

**OBLIGATORIO** cuando la tarea requiere crear 3+ archivos nuevos o tocar 3+ capas:

```bash
npm run decompose -- --name "Nombre de la feature"
```

**Qué obtienes**: tracks de ejecución con dependencias y orden.
**Por qué**: evitar empezar a picar sin plan.

---

## SCAFFOLD: Cuando crees páginas, hooks, componentes o módulos de datos

**OBLIGATORIO** usar el scaffold en vez de escribir boilerplate desde cero:

```bash
# Página nueva
npm run scaffold -- --name NombrePagina --type page --section insights

# Hook nuevo
npm run scaffold -- --name useNombreHook --type hook

# Componente nuevo
npm run scaffold -- --name NombreComponente --type component

# Módulo de datos nuevo
npm run scaffold -- --name nombre-modulo --type data
```

**Por qué**: garantiza que cada archivo sigue los patrones exactos de Josephine (imports, hooks, estructura).

---

## POST-EDIT: Después de cada cambio de código

**OBLIGATORIO** después de modificar cualquier archivo `.ts` o `.tsx`:

```bash
npm run preflight:quick
```

**Qué obtienes**: confirmación de que TypeScript y lint pasan.
**Por qué**: detectar errores antes de seguir acumulando cambios.

**Si falla** → arreglar ANTES de seguir con la siguiente tarea.

---

## PRE-COMMIT: Antes de cada commit

**OBLIGATORIO** antes de ejecutar `git commit`:

```bash
npm run preflight
```

**Qué obtienes**: validación completa (tsc + lint + tests + migration lint + demo verify).
**Por qué**: nunca commitear código roto.

**Si falla** → NO commitear. Arreglar primero.

---

## Resumen Visual

```
Usuario pide cambio
       │
       ▼
  ┌─────────────────────┐
  │ PRE-EDIT            │
  │ impact-map:query    │◄── ¿Qué se puede romper?
  │ (si 3+ archivos:    │
  │  decompose)         │
  └─────────┬───────────┘
            │
            ▼
  ┌─────────────────────┐
  │ HACER EL CAMBIO     │
  │ (usar scaffold si   │
  │  es boilerplate)    │
  └─────────┬───────────┘
            │
            ▼
  ┌─────────────────────┐
  │ POST-EDIT           │
  │ preflight:quick     │◄── ¿Compila? ¿Lint clean?
  └─────────┬───────────┘
            │
            ▼
  ┌─────────────────────┐
  │ PRE-COMMIT          │
  │ preflight (full)    │◄── ¿Tests pasan? ¿Demo ok?
  └─────────┬───────────┘
            │
            ▼
     git commit + push
```

---

## Excepciones (únicas permitidas)

1. **Cambios solo en archivos `.md`, `.json` de config, o `.yml`** → skip impact-map y preflight:quick (pero sí preflight antes de commit)
2. **Fixes de 1 línea en archivos sin consumers** → skip impact-map (pero sí preflight:quick)
3. **Cambios solo en `.agent/` o `scripts/`** → skip impact-map (pero sí preflight:quick)
