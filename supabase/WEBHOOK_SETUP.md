# Supabase Database Webhooks — Setup Guide

> Configura webhooks para que INSERT/UPDATE en tablas disparen push notifications.

---

## Arquitectura

```
┌──────────────────┐    POST (auto)     ┌─────────────────────┐    fetch     ┌────────────┐
│  Supabase DB     │ ─────────────────► │  handle-db-webhook  │ ──────────► │  send-push │
│  (tabla trigger) │   webhook payload  │  (Edge Function)    │  formatted  │  (APNs)    │
└──────────────────┘                    └─────────────────────┘  payload    └────────────┘
```

- **Supabase DB Webhook**: trigger automático en INSERT/UPDATE → POST a Edge Function
- **`handle-db-webhook`**: traduce payload genérico de webhook al formato `{type, employee_ids, title, body}`
- **`send-push`**: envía push via APNs HTTP/2 (ya existe)

---

## Webhooks a Configurar

### 1. `shift_swap_requests` (Sprint 7)

| Campo                | Valor                                                    |
| -------------------- | -------------------------------------------------------- |
| **Name**             | `swap-request-push`                                      |
| **Table**            | `shift_swap_requests`                                    |
| **Events**           | `INSERT`, `UPDATE`                                       |
| **Type**             | Supabase Edge Function                                   |
| **Function**         | `handle-db-webhook`                                      |
| **HTTP Method**      | `POST`                                                   |

**Comportamiento:**
- `INSERT` → notifica al `target_id`: "Tienes una solicitud de cambio de turno"
- `UPDATE` a `approved` → notifica al `requester_id`: "Tu cambio fue aprobado"
- `UPDATE` a `rejected` → notifica al `requester_id`: "Tu cambio fue rechazado"

### 2. `announcements` (Sprint 6)

| Campo                | Valor                                                    |
| -------------------- | -------------------------------------------------------- |
| **Name**             | `announcement-push`                                      |
| **Table**            | `announcements`                                          |
| **Events**           | `INSERT`                                                 |
| **Type**             | Supabase Edge Function                                   |
| **Function**         | `handle-db-webhook`                                      |

**Comportamiento:**
- `INSERT` → notifica a todos los empleados del `location_id`

### 3. `planned_shifts` (Sprint 6)

| Campo                | Valor                                                    |
| -------------------- | -------------------------------------------------------- |
| **Name**             | `new-shift-push`                                         |
| **Table**            | `planned_shifts`                                         |
| **Events**           | `INSERT`                                                 |
| **Type**             | Supabase Edge Function                                   |
| **Function**         | `handle-db-webhook`                                      |

**Comportamiento:**
- `INSERT` → notifica al `employee_id`: "Tienes un nuevo turno asignado"

---

## Payload del Webhook (Supabase → Edge Function)

Supabase envía automáticamente:

```json
{
  "type": "INSERT",
  "table": "shift_swap_requests",
  "schema": "public",
  "record": {
    "id": "...",
    "requester_id": "...",
    "target_id": "...",
    "status": "pending",
    "reason": "Tengo cita médica"
  },
  "old_record": null
}
```

En UPDATE, `old_record` contiene el estado anterior.

---

## Pasos en Supabase Dashboard

1. Ir a **Database → Webhooks** (o **Integrations → Webhooks**)
2. Clic **"Create a new webhook"**
3. Configurar:
   - **Name**: ver tabla arriba
   - **Table**: seleccionar la tabla
   - **Events**: marcar INSERT / UPDATE según tabla
   - **Type**: "Supabase Edge Functions"
   - **Function**: seleccionar `handle-db-webhook`
4. **Save**

> ⚠️ Los webhooks de DB usan `service_role` key internamente — no requieren auth adicional.

---

## Variables de Entorno Requeridas

Configurar en **Supabase Dashboard → Edge Functions → Secrets**:

| Variable           | Descripción                                |
| ------------------ | ------------------------------------------ |
| `APNS_KEY_ID`      | Key ID del Apple Developer Portal          |
| `APNS_TEAM_ID`     | Team ID del Apple Developer Portal         |
| `APNS_PRIVATE_KEY` | Contenido .p8 codificado en base64         |
| `APNS_BUNDLE_ID`   | Bundle ID de la app (ej. com.josephine.team) |
| `APNS_ENVIRONMENT` | `development` o `production`               |

> Las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` están disponibles automáticamente en Edge Functions.

---

## Testing

```bash
# Invocar handle-db-webhook simulando un INSERT de swap request
curl -X POST https://<project>.supabase.co/functions/v1/handle-db-webhook \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "table": "shift_swap_requests",
    "schema": "public",
    "record": {
      "id": "test-uuid",
      "requester_id": "e0000001-0000-0000-0000-000000000001",
      "target_id": "e0000001-0000-0000-0000-000000000002",
      "status": "pending",
      "reason": "Test push"
    },
    "old_record": null
  }'
```
