
## Plan: Corregir Bug payment_method y Simplificar Gestión de Mesas (Patrón Square)

### Resumen Ejecutivo
Corregir el error de esquema que impide cerrar tickets correctamente y adoptar el patrón de la industria (Square/Toast) para gestión de estado de mesas: toda la lógica en la capa de aplicación, sin triggers de base de datos.

---

### Problema 1: Bug payment_method

**Diagnóstico:**
El código intenta insertar/actualizar `payment_method` directamente en la tabla `tickets`, pero esta columna NO existe en el esquema actual. Los métodos de pago se almacenan correctamente en la tabla `payments` (soporta múltiples pagos por ticket).

**Archivos afectados:**
- `src/components/pos/POSQuickOrder.tsx` (línea 83)
- `src/components/pos/POSOrderPanel.tsx` (línea 434)

**Solución:**
Eliminar las referencias a `payment_method` en las inserciones/updates de tickets, ya que esta información ya se guarda en la tabla `payments`.

---

### Problema 2: Gestión de Estado de Mesas

**Situación actual:**
- Al abrir mesa: Se actualiza manualmente `pos_tables.status = 'occupied'` (línea 278-281 de POSOrderPanel)
- Al cerrar ticket: Se actualiza `tickets.status = 'closed'` pero NO se libera la mesa
- No existe el trigger `sync_pos_table_status` mencionado en la documentación

**Patrón de la industria (Square/Toast):**
Los sistemas POS modernos manejan el estado de mesa en la capa de aplicación, no con triggers de BD. Esto permite:
- Control explícito del flujo
- Mejor manejo de errores
- Transacciones atómicas simples
- Código más mantenible y depurable

**Solución:**
Implementar función `releaseTable()` que se ejecuta después de cerrar el ticket exitosamente.

---

### Cambios Propuestos

#### 1. POSQuickOrder.tsx
Eliminar `payment_method: method` del insert a tickets:

```text
ANTES (línea 77-88):
.insert({
  location_id: locationId,
  status: 'closed',
  service_type: 'takeaway',
  gross_total: total,
  net_total: subtotal,
  payment_method: method,  // <-- ELIMINAR
  closed_at: new Date().toISOString(),
  cash_session_id: cashSession?.id,
})

DESPUÉS:
.insert({
  location_id: locationId,
  status: 'closed',
  service_type: 'takeaway',
  gross_total: total,
  net_total: subtotal,
  closed_at: new Date().toISOString(),
  cash_session_id: cashSession?.id,
})
```

#### 2. POSOrderPanel.tsx
Eliminar `payment_method` del update y añadir liberación de mesa:

```text
ANTES (línea 431-445):
const ticketUpdate: Record<string, unknown> = {
  status: 'closed', 
  closed_at: new Date().toISOString(),
  payment_method: primaryMethod,  // <-- ELIMINAR
  tip_total: totalTip,
};
...
await supabase
  .from('tickets')
  .update(ticketUpdate)
  .eq('id', ticketId);

DESPUÉS:
const ticketUpdate: Record<string, unknown> = {
  status: 'closed', 
  closed_at: new Date().toISOString(),
  tip_total: totalTip,
};
...
await supabase
  .from('tickets')
  .update(ticketUpdate)
  .eq('id', ticketId);

// Liberar mesa (Patrón Square - lógica en aplicación)
if (table?.id) {
  await supabase
    .from('pos_tables')
    .update({ 
      status: 'available', 
      current_ticket_id: null 
    })
    .eq('id', table.id);
}
```

---

### Flujo Completo Corregido

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO POS CORREGIDO                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. ABRIR MESA                                                  │
│     ├─ Crear ticket (status: 'open')                            │
│     └─ Actualizar pos_tables (status: 'occupied')               │
│                                                                 │
│  2. AÑADIR PRODUCTOS                                            │
│     └─ Insertar en ticket_lines                                 │
│                                                                 │
│  3. ENVIAR A COCINA                                             │
│     ├─ Actualizar ticket_lines (sent_at, prep_status)           │
│     └─ Insertar en pos_print_queue                              │
│                                                                 │
│  4. COBRAR                                                      │
│     ├─ Insertar en payments (method, amount, tip)               │
│     ├─ Actualizar ticket (status: 'closed')                     │
│     └─ Actualizar pos_tables (status: 'available')  ← NUEVO     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Resumen de Cambios

| Archivo | Cambio | Impacto |
|---------|--------|---------|
| `POSQuickOrder.tsx` | Eliminar `payment_method` del insert | Corrige error de esquema |
| `POSOrderPanel.tsx` | Eliminar `payment_method` del update | Corrige error de esquema |
| `POSOrderPanel.tsx` | Añadir liberación explícita de mesa | Mesa vuelve a "disponible" |

---

### Sección Técnica

**Por qué NO usar triggers de BD:**
1. Los triggers complican el debugging (fallan silenciosamente)
2. No se pueden testear fácilmente en desarrollo
3. Añaden latencia extra en cada operación
4. Square, Toast, Lightspeed usan lógica de aplicación

**Por qué NO añadir columna `payment_method` a tickets:**
1. Un ticket puede tener múltiples pagos (split billing)
2. La tabla `payments` ya almacena esta info correctamente
3. Añadirla sería redundante y propenso a inconsistencias

**Patrón recomendado para transacciones críticas:**
```typescript
// Transacción atómica con rollback manual
const closeTicketAndReleaseTable = async () => {
  // 1. Cerrar ticket
  const { error: ticketError } = await supabase
    .from('tickets')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', ticketId);
  
  if (ticketError) throw ticketError;
  
  // 2. Liberar mesa
  const { error: tableError } = await supabase
    .from('pos_tables')
    .update({ status: 'available', current_ticket_id: null })
    .eq('id', tableId);
  
  if (tableError) {
    // Rollback: reabrir ticket
    await supabase.from('tickets').update({ status: 'open' }).eq('id', ticketId);
    throw tableError;
  }
};
```
