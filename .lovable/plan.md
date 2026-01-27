

# Plan: Login Demo Estable con Auto-Fallback

## Diagnóstico del Problema

El error actual se origina en el flujo de login demo:

1. **El seed es innecesario cuando los usuarios demo ya existen** – Los 5 usuarios `@demo.com` ya están creados en `auth.users` con sus roles asignados.
2. **El edge function `seed_demo_users` falla continuamente** por errores de "schema cache" (PGRST002), bloqueando el login aunque los usuarios existan.
3. **El flujo actual espera al seed antes de intentar login**, lo que causa timeouts encadenados.

## Solución Propuesta

### Cambio 1: Invertir la lógica – Login primero, Seed después (opcional)

Modificar `handleDemoLogin` en `src/pages/Login.tsx`:

```text
ANTES:
  1. Llamar seed_demo_users (esperar hasta 12 reintentos)
  2. Esperar 600ms
  3. Intentar login

DESPUÉS:
  1. Intentar login inmediatamente
  2. Si login falla con "user not found" → entonces llamar seed
  3. Si login exitoso → continuar al dashboard
```

Esto permite entrar al instante si el usuario ya existe, sin esperar al seed.

### Cambio 2: Seed en background (fire-and-forget)

Si el login funciona, lanzar el seed como tarea secundaria para refrescar datos demo sin bloquear al usuario:

```typescript
// Fire-and-forget seed después de login exitoso
supabase.functions.invoke('seed_demo_users').catch(() => {});
```

### Cambio 3: Auto-fallback cuando backend está degradado

Integrar el estado del `BackendHealthIndicator` en la lógica de login:

1. Si el indicador muestra `degraded` u `offline` y el login falla con timeout:
   - Mostrar mensaje claro: "Backend no disponible. Reintenta en 30s."
   - **No** bloquear la UI con spinners infinitos
2. Si el login retorna `invalid_credentials` → mostrar error real
3. Si el login retorna `user_not_found` → entonces intentar seed

### Cambio 4: Reducir reintentos del seed

Cambiar de 12 intentos a **3 intentos máximo** con timeout corto (5s total), ya que:
- Los usuarios demo ya existen
- El seed solo es necesario la primera vez o para refrescar datos
- No debe bloquear el flujo de login

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Login.tsx` | Reordenar flujo: login primero, seed condicional después |
| `src/components/auth/BackendHealthIndicator.tsx` | Exportar estado para consumo externo (crear hook) |

## Flujo Resultante

```text
Usuario pulsa "Owner - Acceso completo"
         │
         ▼
    ┌─────────────────┐
    │ Intentar login  │
    │ con retry (3x)  │
    └────────┬────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
Login OK          Login Falla
    │                 │
    ▼                 ▼
Navegar a      ¿Es "user not found"?
/dashboard           │
    │       ┌────────┴────────┐
    │       │                 │
    ▼       ▼                 ▼
Seed en   Llamar seed      Mostrar error
background  (3 intentos)    (credenciales/timeout)
            luego login
```

## Beneficios

- **Login instantáneo** cuando usuarios existen (caso normal)
- **Sin bloqueos** por schema cache
- **Auto-fallback** con mensaje claro cuando backend está degradado
- **Funciona en producción** con los usuarios demo ya creados

