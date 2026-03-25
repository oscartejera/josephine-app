---
description: Auto-review pre-commit — checklist de calidad, seguridad y consistencia
---

# /code-review — Self-Review Before Commit

## Cuándo usar
- SIEMPRE antes de hacer commit
- SIEMPRE antes de declarar una tarea como completada
- Cuando el usuario pide review de cambios

## Checklist

### 1. Funcionalidad
- [ ] ¿El cambio hace exactamente lo que se pidió?
- [ ] ¿Funciona en demo mode Y en modo real?
- [ ] ¿Se validó con el comando apropiado?

### 2. Calidad de código
- [ ] ¿Sin `console.log` o debug statements?
- [ ] ¿Sin archivos huérfanos o edits no relacionados?
- [ ] ¿Sin `any` innecesarios en TypeScript?
- [ ] ¿Sin imports no utilizados?
- [ ] ¿Naming claro y consistente?
- [ ] ¿Sigue los patrones existentes del repo?

### 3. Seguridad
- [ ] ¿Sin secrets hardcodeados?
- [ ] ¿Sin SQL injection vectors?
- [ ] ¿Sin XSS vectors en JSX?
- [ ] ¿Inputs del usuario validados?
- [ ] ¿RBAC respetado si hay auth?

### 4. Datos
- [ ] ¿Tipos generados actualizados si hubo cambio de schema?
- [ ] ¿RPCs y contracts válidos?
- [ ] ¿Matviews tratados como potencialmente stale?

### 5. Tests
- [ ] ¿Tests existentes siguen pasando?
- [ ] ¿Se escribieron tests nuevos si aplica?
- [ ] ¿Coverage no decreció?

### 6. Performance
- [ ] ¿Sin queries N+1?
- [ ] ¿Sin re-renders innecesarios en React?
- [ ] ¿Sin bundle size bloat (imports grandes)?

## Comandos de verificación

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
npm test -- --run 2>&1 | tail -20
```

## Formato de reporte

```
🔍 **Code Review**
- Funcionalidad: ✅/❌
- Calidad: ✅/❌
- Seguridad: ✅/❌
- Datos: ✅/❌ (o N/A)
- Tests: ✅/❌
- Performance: ✅/❌

📝 Commit propuesto: `[type]: [description]`
```

## Reglas estrictas

- **NUNCA** declarar "listo" sin haber corrido al menos `tsc --noEmit` + `lint`
- **NUNCA** hacer commit con warnings de lint no resueltos
- **NUNCA** saltarse el check de seguridad en cambios que tocan auth, inputs, o datos
