---
description: TDD estricto — RED (test falla) → GREEN (pasa) → REFACTOR (limpia)
---

# /tdd — Test-Driven Development Workflow

## Cuándo usar
- Cualquier cambio de lógica de negocio
- Nuevos hooks, utilidades, o funciones
- Cambios en data layer, RPCs, o contracts
- Bug fixes (primero reproducir con test)

## Workflow

### Step 1: RED — Escribir test que falle

```bash
# Crear test que capture el comportamiento esperado
# El test DEBE fallar antes de implementar
```

1. Identificar el archivo de test correcto (o crear uno nuevo)
2. Escribir test(s) que describan el comportamiento deseado
3. Ejecutar: `npx vitest run [ruta-al-test]`
4. Confirmar que FALLA con el error esperado

### Step 2: GREEN — Implementar mínimo código

1. Escribir SOLO el código necesario para que el test pase
2. No refactorizar aún
3. No añadir features extra
4. Ejecutar: `npx vitest run [ruta-al-test]`
5. Confirmar que PASA

### Step 3: REFACTOR — Limpiar

1. Mejorar la implementación sin cambiar comportamiento
2. Eliminar duplicación
3. Mejorar naming
4. Ejecutar de nuevo: `npx vitest run [ruta-al-test]`
5. Confirmar que SIGUE pasando

### Step 4: VERIFY — Validación completa

// turbo
```bash
npx tsc --noEmit
```
// turbo
```bash
npm run lint
```
// turbo
```bash
npx vitest run [ruta-al-test]
```

### Step 5: REPORT

```
🧪 **TDD Cycle Complete**
- Test: [nombre del test]
- RED: ✅ Test falló correctamente
- GREEN: ✅ Test pasa con implementación mínima
- REFACTOR: ✅ Código limpio, test sigue pasando
- VERIFY: ✅ tsc + lint + test
```

## Reglas estrictas

- **NUNCA** escribir implementación antes del test
- **NUNCA** saltarse el paso RED (confirmar que falla primero)
- **NUNCA** hacer refactor si el test no pasa
- **SIEMPRE** ejecutar la suite completa de validación al final
