---
description: Workflow principal para construir features — brainstorm → spec → plan → TDD → review → commit
---

# Plan & Build — Workflow Estricto

Este workflow es OBLIGATORIO para CUALQUIER tarea, sin excepciones.
Incluso quick-fixes deben pasar por una versión comprimida de este ciclo.

---

## Fase 1: BRAINSTORM (obligatoria)

Antes de tocar código, entender completamente qué se necesita:

1. **Clarificar el objetivo** — ¿Qué quiere el usuario exactamente?
2. **Identificar el alcance** — ¿Qué archivos, capas, y sistemas están involucrados?
3. **Buscar contexto** — Consultar `memory/lessons.md`, `memory/patterns.md`, `memory/decisions.md`
4. **Identificar riesgos** — ¿Qué puede romperse? ¿Demo mode? ¿Auth? ¿Datos?
5. **Presentar análisis** al usuario antes de seguir:

```
🧠 **Brainstorm**
- Objetivo: [qué]
- Archivos afectados: [lista]
- Riesgos: [qué puede romperse]
- Dependencias: [qué más toca esto]
- Lecciones relevantes: [de memory/lessons.md]
- Patrón existente: [de memory/patterns.md si aplica]
```

⚠️ NO avanzar a la Fase 2 hasta que el usuario confirme o ajuste.

---

## Fase 2: PLAN (obligatoria)

Crear un plan concreto con archivos, cambios, y validación:

1. **Listar cada archivo** que se va a tocar y qué cambia en él
2. **Definir la validación** — ¿Cómo se prueba que funciona?
3. **Definir el rollback** — ¿Cómo se revierte si falla?
4. **Estimar complejidad** — 1-10

Formato:
```
📝 **Plan**
1. [archivo] — [qué cambia]
2. [archivo] — [qué cambia]
...
- Validación: [comandos o pasos]
- Rollback: [cómo revertir]
- Complejidad: [1-10]
```

⚠️ Presentar al usuario para aprobación antes de ejecutar.

---

## Fase 3: TDD — Test Driven Development (obligatoria cuando aplica)

Para cambios que tienen tests o deberían tenerlos:

1. **RED** — Escribir test que falle y capture el comportamiento deseado
2. **GREEN** — Implementar el mínimo código para que pase
3. **REFACTOR** — Limpiar sin cambiar comportamiento
4. **VERIFY** — `npm test`, `npx tsc --noEmit`, `npm run lint`

Si no aplica TDD (cambio puramente visual, config, etc.):
- Documentar por qué no aplica
- Usar la validación definida en el plan

---

## Fase 4: REVIEW (obligatoria)

Antes de declarar completado, hacer auto-review:

1. **¿El cambio hace lo que se pidió?** — Comparar con Fase 1
2. **¿Se rompió algo?** — Verificar demo mode, auth, rutas
3. **¿Se siguió el plan?** — Comparar con Fase 2
4. **¿El código es limpio?** — Sin console.log, sin archivos huérfanos, sin churn
5. **¿Se corrieron las validaciones?** — Mostrar evidencia

Formato:
```
🔍 **Review**
- ✅ Objetivo cumplido: [sí/no + evidencia]
- ✅ Demo mode: [ok/roto]
- ✅ Tests: [pasaron/fallaron]
- ✅ Lint/Types: [ok/errores]
- ⚠️ Riesgos pendientes: [lista]
```

---

## Fase 5: FINISH (obligatoria)

1. **Resumir** qué cambió exactamente
2. **Proponer commit** con mensaje descriptivo (conventional commits)
3. **Actualizar memoria** si aplica (patterns, decisions, lessons)
4. **Proponer siguiente paso** si hay trabajo pendiente

---

## Quick-Fix Mode

Para fixes de 1-2 líneas, comprimir el ciclo:

```
🧠 Brainstorm: [1 línea describiendo el fix]
📝 Plan: [archivo + línea + cambio]
🔍 Review: [validación mínima]
✅ Done: [commit message propuesto]
```

Incluso en quick-fix mode, NUNCA saltarse la identificación de riesgos.
