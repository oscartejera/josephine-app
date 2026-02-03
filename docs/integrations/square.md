# Square POS Integration - Josephine

## 🎯 Overview

Integración completa con Square POS usando arquitectura escalable basada en Canonical Data Model (CDM).

## 🏗️ Arquitectura

```
Square POS → OAuth/Webhooks → Edge Functions → raw_events → CDM → Josephine
```

### Componentes:

1. **OAuth Flow**: `square-oauth-start` + `square-oauth-callback`
2. **Webhook Receiver**: `square-webhook` (idempotent)
3. **Sync Function**: `square-sync` (incremental, cursor-based)
4. **CDM**: 9 tablas normalizadas
5. **UI**: `/integrations/square`

## 🚀 Setup

### 1. Configurar Secrets en Supabase:

```bash
SQUARE_SANDBOX_CLIENT_ID=your_sandbox_client_id
SQUARE_SANDBOX_CLIENT_SECRET=your_sandbox_secret
SQUARE_PRODUCTION_CLIENT_ID=your_production_client_id
SQUARE_PRODUCTION_CLIENT_SECRET=your_production_secret
```

### 2. Conectar desde UI:

1. Ir a `/integrations`
2. Click en "Square POS"
3. Click "Conectar con Square"
4. Autorizar en Square
5. Redirect automático → Integración activa

### 3. Configurar Webhook (Opcional):

En Square Developer Dashboard:
- Webhook URL: `https://your-project.supabase.co/functions/v1/square-webhook`
- Events: `order.created`, `order.updated`, `payment.updated`
- Signature verification: TODO (agregar en producción)

## 📊 Datos Sincronizados:

- **Locations**: Todas las ubicaciones de Square
- **Catalog**: Items y categorías
- **Orders**: Últimos 7 días (incremental)
- **Payments**: Por location

## 🔄 Sincronización Automática:

Se puede configurar pg_cron para sync automático cada 5 minutos:

```sql
SELECT cron.schedule(
  'square-sync-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/square-sync',
    body := json_build_object('accountId', account_id)::text
  )
  FROM integration_accounts
  WHERE provider = 'square' AND is_active = true;
  $$
);
```

## 🎯 Canonical Data Model:

Todos los datos de Square se normalizan a:
- `cdm_locations`
- `cdm_items`
- `cdm_orders`
- `cdm_order_lines`
- `cdm_payments`

Esto permite:
- Análisis unificado
- Cambiar de POS sin perder datos
- AI/ML training sobre datos consistentes

## ✅ Features:

- ✅ OAuth 2.0 flow completo
- ✅ Token management (encrypted)
- ✅ Incremental sync con cursors
- ✅ Webhook support (idempotent)
- ✅ Error tracking en sync_runs
- ✅ UI dashboard con estado
- ✅ Manual sync trigger
- ✅ Multi-environment (sandbox/prod)
- ✅ Deduplicación garantizada

## 📝 Extensibilidad:

Para agregar Lightspeed/Oracle/etc:
1. Crear `lightspeed-client.ts` en _shared
2. Crear normalizers para Lightspeed → CDM
3. Copiar pattern de OAuth/Sync functions
4. Agregar card en UI

El CDM no cambia - solo los adapters.

---

**Hecho con ❤️ para Josephine**
