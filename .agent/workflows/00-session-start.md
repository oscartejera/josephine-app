---
description: Inicio de sesión — carga memoria, contexto y lecciones antes de cualquier trabajo
---

# Session Start — Carga de Contexto

Ejecutar estos pasos al INICIO de cada sesión, ANTES de cualquier otro trabajo:

// turbo-all

0. Ejecutar `npm run session:brief` — obtiene estado actual del proyecto (TS errors, commits, branch, archivos)
1. Leer `memory/lessons.md` completo — contiene lecciones de bugs y regresiones pasadas
2. Leer `memory/session-context.md` — contiene el contexto de la última sesión (qué se hizo, TODOs pendientes, decisiones, prioridad para esta sesión)
3. Leer `memory/decisions.md` — contiene decisiones de arquitectura vigentes
4. Leer `memory/patterns.md` — contiene patrones reutilizables descubiertos
5. Leer `memory/checklists.md` — contiene checklists de validación del proyecto

Después de leer todo, presentar al usuario un briefing ultra-conciso:

```
📋 **Briefing de sesión**
- Última sesión: [fecha] — [qué se hizo]
- TODOs pendientes: [lista]
- Prioridad sugerida: [lo que dice session-context.md]
- Lecciones relevantes: [cualquiera que aplique al trabajo de hoy]
```

⚠️ Si `memory/session-context.md` no existe, crear uno vacío con la estructura base.
⚠️ Si `memory/lessons.md` no existe, avisar al usuario.
