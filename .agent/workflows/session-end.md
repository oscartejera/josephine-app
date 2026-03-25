---
description: Cierre de sesión — guardar contexto, lecciones y estado pendiente para la próxima sesión
---

# Session End — Persistir Contexto

Ejecutar estos pasos al FINAL de cada sesión de trabajo:

1. Actualizar `memory/session-context.md` con:

```markdown
## Last Session

- **Date**: [fecha actual]
- **Duration**: [estimación]
- **Focus**: [resumen de 1 línea]

## What Was Done

- [lista de cambios realizados con archivos afectados]

## Decisions Made

- [decisiones tomadas durante la sesión]

## Pending TODOs

- [tareas que quedaron pendientes o que el usuario mencionó]

## Active Branches

- [ramas activas y su estado]

## Known Issues

- [bugs conocidos, deuda técnica nueva]

## Next Session Priority

- [qué debería hacerse primero en la próxima sesión]
```

2. Si se descubrió algún **patrón reutilizable**, agregarlo a `memory/patterns.md`

3. Si se tomó una **decisión de arquitectura**, registrarla en `memory/decisions.md`

4. Si se corrigió un **bug o regresión**, preguntar al usuario:
   _"¿Quieres que registre esta lección en `memory/lessons.md`?"_
   Si dice sí, usar `/log-lesson`

5. Presentar al usuario un resumen de cierre:

```
✅ **Cierre de sesión**
- Completado: [resumen]
- Pendiente: [TODOs]
- Próxima prioridad: [sugerencia]
- Memoria actualizada: session-context ✓ | lessons [✓/—] | decisions [✓/—] | patterns [✓/—]
```
