---
description: Descomponer features complejas en sub-tareas independientes para ejecución paralela o secuencial
---

# Task Decomposition — Multi-Agent Ready

Usa este workflow cuando una feature requiere **3+ archivos en capas distintas**
(DB + backend + frontend), o cuando las tareas pueden ejecutarse en paralelo.

---

## Cuándo Usar

- Feature nueva que toca DB + hooks + pages + sidebar
- Refactor grande que afecta múltiples módulos
- Bug que requiere cambios en varias capas
- Cualquier tarea donde digas "esto tiene partes independientes"

---

## Fase 1: ANALIZAR — Dependency Scan

Antes de descomponer, entender el grafo:

```bash
# 1. Ver qué impacta el área de trabajo
npm run impact-map:query -- src/data/relevant-file.ts

# 2. Vista general del codebase
npm run impact-map:summary
```

Identificar las capas involucradas:

| Capa | Archivos típicos | Dependencias |
|------|------------------|--------------|
| 🗃️ DB | `supabase/migrations/*.sql` | Ninguna (base) |
| 📡 Data | `src/data/*.ts` | DB, types |
| 🪝 Hooks | `src/hooks/use*.ts` | Data, contexts |
| 🧩 Components | `src/components/**/*.tsx` | Hooks, UI library |
| 📄 Pages | `src/pages/*.tsx` | Hooks, components |
| 🧭 Navigation | `App.tsx`, `AppSidebar.tsx` | Pages |
| 🌐 i18n | `src/i18n/locales/*.json` | Ninguna (paralelo) |

---

## Fase 2: DESCOMPONER — Task Graph

Crear un grafo de tareas con dependencias explícitas:

```
📋 Feature: [Nombre]

Track A (DATABASE — sin dependencias):
  A1. Crear migración SQL
  A2. Añadir Zod schema a rpc-contracts.ts
  A3. Regenerar types

Track B (DATA LAYER — depende de A):
  B1. Crear módulo de datos en src/data/
  B2. Crear hook useXData

Track C (UI — depende de B):
  C1. Crear componentes en src/components/
  C2. Crear página en src/pages/

Track D (WIRING — depende de B y C):
  D1. Añadir lazy import + Route en App.tsx
  D2. Añadir sidebar item en AppSidebar.tsx
  D3. Añadir i18n keys

Track E (QUALITY — depende de todo):
  E1. Tests
  E2. npm run preflight
  E3. npm run health
```

### Reglas de Descomposición

1. **Cada sub-tarea debe ser compilable** — nunca dejar código que no compila
2. **Dependencias explícitas** — Track B no empieza hasta que Track A termina
3. **Tareas paralelas** — A y i18n pueden ejecutarse simultáneamente
4. **Tamaño máximo** — cada sub-tarea max 3 archivos
5. **Verificación por track** — `npx tsc --noEmit` después de cada track

---

## Fase 3: EJECUTAR — Sequential o Parallel

### Modo Secuencial (agente único — modo actual)

Ejecutar tracks en orden de dependencias:

```
1. Track A (DB) → verificar: npm run db:lint
2. Track B (Data) → verificar: npx tsc --noEmit
3. Track C (UI) → verificar: npx tsc --noEmit
4. Track D (Wiring) → verificar: npm run preflight:quick
5. Track E (Quality) → verificar: npm run preflight
```

**Un commit por track completado** (no por sub-tarea):
```bash
git add -A && git commit -m "feat(feature): track A — database layer"
git add -A && git commit -m "feat(feature): track B — data layer"
# ...etc
```

### Modo Paralelo (multi-agent — futuro)

Cuando haya capacidad multi-agent, los tracks independientes se ejecutan simultáneamente:

```
┌── Track A (DB)     ──┐
│                       ├── Track B (Data) ── Track C (UI) ── Track D (Wiring)
└── Track i18n (keys) ──┘                                          │
                                                              Track E (Quality)
```

Reglas multi-agent:
- Cada agente trabaja en su Track
- No tocar archivos de otro Track
- Merge gate: `npm run preflight` antes de integrar
- Conflicto = uno espera, el otro rebasa

---

## Fase 4: VERIFICAR — Integration Check

Después de completar todos los tracks:

```bash
# 1. Preflight completo
npm run preflight

# 2. Health check
npm run health

# 3. Impact check del nuevo feature
npm run impact-map:query -- src/pages/NewFeature.tsx

# 4. Changelog
npm run changelog
```

---

## Atajos para Features Comunes

### Quick: Nueva página con datos (usa scaffold)

```bash
# 1. Scaffold genera page + hook + test
npm run scaffold -- --name FeatureName --type page --section insights

# 2. Solo tienes que:
#    - Implementar la lógica del hook
#    - Añadir Route a App.tsx
#    - Añadir sidebar item
#    - npm run preflight
```

### Quick: Nuevo RPC + visualización

```
Track A: SQL migration + Zod schema + db:types
Track B: Data module + hook
Track C: Page component + sidebar + route
```

### Quick: Nuevo componente reutilizable

```bash
npm run scaffold -- --name ComponentName --type component --folder feature-area
# Solo 1 track, no necesita descomposición
```

---

## Template de Descomposición

Copiar y rellenar cuando descompongas:

```markdown
## 📋 [Feature Name]

### Análisis
- Capas afectadas: [DB / Data / Hooks / Components / Pages / Nav / i18n]
- Complejidad: [1-10]
- Archivos estimados: [N]

### Tracks

#### Track A: [Nombre] (sin dependencias)
- [ ] A1. [tarea]
- [ ] A2. [tarea]
- Verificación: `[comando]`

#### Track B: [Nombre] (depende de: A)
- [ ] B1. [tarea]
- [ ] B2. [tarea]
- Verificación: `[comando]`

#### Track C: [Nombre] (depende de: B)
- [ ] C1. [tarea]
- Verificación: `[comando]`

### Pre-merge
- [ ] npm run preflight
- [ ] npm run health
```
