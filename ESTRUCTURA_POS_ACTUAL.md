# Estructura de Datos POS - Josephine (Estado Actual)

## 📊 Modelo de Datos Completo

### 1️⃣ POSTicket (Cuenta/Comanda)
```typescript
interface POSTicket {
  id: string;
  location_id: string;
  pos_table_id: string | null;      // FK a pos_tables
  server_id: string | null;         // Camarero
  status: string;                   // 'open' | 'closed' | 'paid' | 'void'
  gross_total: number;              // Total bruto
  discount_total: number;           // Descuentos aplicados
  net_total: number;                // Total neto
  service_type: string;             // 'dine_in' | 'takeaway' | 'delivery'
  notes: string | null;
  covers: number;                   // Número de comensales
  opened_at: string;
  table_name: string | null;        // Desnormalizado para display
}
```

### 2️⃣ TicketLine (Líneas de Pedido) - **LA MÁS IMPORTANTE PARA KDS**
```typescript
interface TicketLine {
  id: string;
  ticket_id: string;                // FK a tickets
  product_id: string | null;        // FK a products
  item_name: string;                // Nombre del producto
  quantity: number;
  unit_price: number;
  gross_line_total: number;
  discount_line_total: number;
  tax_rate: number | null;
  category_name: string | null;     // Categoría del producto
  
  // ===== CAMPOS ESPECÍFICOS PARA KDS =====
  prep_status: 'pending' | 'preparing' | 'ready' | 'served';
  prep_started_at: string | null;   // Cuando empezó prep
  ready_at: string | null;          // Cuando terminó
  sent_at: string | null;           // Cuando se envió a KDS
  destination: 'kitchen' | 'bar' | 'prep';  // Estación destino
  target_prep_time: number | null;  // Tiempo objetivo en minutos
  is_rush: boolean;                 // Pedido urgente
  course: number;                   // 0=bebida, 1=entrante, 2=principal, 3=postre
  notes: string | null;             // Notas del item
  voided: boolean;
  comped: boolean;
  
  // External IDs (para integraciones)
  external_line_id: string | null;
  item_external_id: string | null;
}
```

### 3️⃣ Modifiers (Modificadores de Items)
```typescript
interface TicketLineModifier {
  id: string;
  ticket_line_id: string;
  modifier_name: string;            // Ej: "Punto de Cocción"
  option_name: string;              // Ej: "Poco hecho"
  price_delta: number;              // +/- precio
  type: 'add' | 'remove' | 'substitute';  // Inferido de nombre
}
```

### 4️⃣ POSTable (Mesas)
```typescript
interface POSTable {
  id: string;
  floor_map_id: string;
  table_number: string;
  seats: number;
  position_x: number;
  position_y: number;
  shape: 'square' | 'round' | 'rectangle';
  width: number;
  height: number;
  status: 'available' | 'occupied' | 'reserved' | 'blocked';
  current_ticket_id: string | null;  // Ticket actual en la mesa
}
```

### 5️⃣ POSProduct (Productos/Menú)
```typescript
interface POSProduct {
  id: string;
  name: string;
  category: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  kds_destination: 'kitchen' | 'bar' | 'prep';  // IMPORTANTE para KDS
}
```

### 6️⃣ CashSession (Caja/Turno)
```typescript
interface CashSession {
  id: string;
  location_id: string;
  opened_by: string;               // User ID
  opening_cash: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
}
```

### 7️⃣ Payment (Pagos)
```typescript
interface Payment {
  id: string;
  ticket_id: string;
  amount: number;
  method: 'card' | 'cash' | 'other';
  status: 'completed' | 'pending' | 'failed';
  created_at: string;
}
```

---

## 🔄 Flujo POS → KDS (Actual)

### Cuando se crea un pedido en POS:

1. **POS crea Ticket**:
```sql
INSERT INTO tickets (location_id, pos_table_id, status, opened_at, ...)
VALUES (...)
```

2. **POS crea TicketLines**:
```sql
INSERT INTO ticket_lines (
  ticket_id, 
  product_id, 
  item_name, 
  quantity,
  destination,        -- 'kitchen' | 'bar' | 'prep'
  prep_status,        -- 'pending'
  sent_at,            -- NOW()
  course,             -- 0, 1, 2, 3
  is_rush,            -- false
  ...
)
```

3. **KDS escucha cambios** (realtime subscription):
```typescript
supabase
  .channel('kds-location-X')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'ticket_lines',
    filter: `destination=eq.kitchen` // o bar, prep
  }, handleNewOrder)
```

4. **KDS agrupa por ticket**:
```typescript
// Obtiene todas las líneas con prep_status != 'served'
const lines = await supabase
  .from('ticket_lines')
  .select('*, ticket:tickets(*)')
  .eq('destination', 'kitchen')
  .neq('prep_status', 'served')
  
// Agrupa por ticket_id
const orders = groupByTicket(lines)
```

5. **KDS cambia estados**:
```typescript
// Cocina marca item como "preparando"
await supabase
  .from('ticket_lines')
  .update({ 
    prep_status: 'preparing',
    prep_started_at: NOW()
  })
  .eq('id', lineId)

// Marca como "listo"
await supabase
  .from('ticket_lines')
  .update({ 
    prep_status: 'ready',
    ready_at: NOW()
  })
  .eq('id', lineId)

// Marca como "servido" (expeditor)
await supabase
  .from('ticket_lines')
  .update({ 
    prep_status: 'served'
  })
  .eq('id', lineId)
```

---

## 🎯 Datos Clave para KDS

### Fields Críticos en `ticket_lines`:

| Campo | Tipo | Uso en KDS |
|-------|------|------------|
| `destination` | kitchen/bar/prep | Filtrar qué estación ve cada item |
| `prep_status` | pending/preparing/ready/served | Estado de preparación |
| `sent_at` | timestamp | Cuándo se envió el pedido |
| `prep_started_at` | timestamp | Para calcular tiempo transcurrido |
| `ready_at` | timestamp | Para calcular tiempo total prep |
| `target_prep_time` | number | Tiempo objetivo (minutos) |
| `is_rush` | boolean | Pedido urgente (rush) |
| `course` | 0/1/2/3 | Bebida/Entrante/Principal/Postre |
| `modifiers` | array | Modificaciones del plato |
| `notes` | string | Alergias, instrucciones |

### Joins Típicos:

```typescript
// KDS hace este query principal:
const { data } = await supabase
  .from('ticket_lines')
  .select(`
    *,
    ticket:tickets!inner(
      id,
      pos_table_id,
      table_name,
      server_id,
      opened_at,
      covers
    )
  `)
  .eq('destination', 'kitchen')
  .in('prep_status', ['pending', 'preparing', 'ready'])
  .order('sent_at', { ascending: true })
```

---

## 📋 Tablas de Base de Datos (Supabase)

1. **`tickets`** - Cuentas/comandas principales
2. **`ticket_lines`** - Líneas individuales de pedido (items)
3. **`ticket_line_modifiers`** - Modificadores de cada línea
4. **`pos_tables`** - Mesas del restaurante
5. **`pos_floor_maps`** - Planos de sala
6. **`products`** - Catálogo de productos/menú
7. **`pos_cash_sessions`** - Turnos de caja
8. **`payments`** - Pagos realizados

---

## 🔗 Relaciones

```
tickets (1) ──┬──> (N) ticket_lines
              │
              └──> (N) payments

ticket_lines (1) ──> (N) ticket_line_modifiers

pos_tables (1) ──> (1) tickets [current_ticket_id]

products (1) ──> (N) ticket_lines [product_id]
```

---

## 🎨 Estados del Sistema

### Ticket Status:
- `open` - En proceso
- `closed` - Cerrado pero no pagado
- `paid` - Pagado completamente
- `void` - Anulado

### TicketLine prep_status:
- `pending` - Enviado a KDS, esperando
- `preparing` - Cocina está preparando
- `ready` - Listo para servir
- `served` - Ya servido al cliente

### Table Status:
- `available` - Libre
- `occupied` - Ocupada con ticket abierto
- `reserved` - Reservada (vinculada a reservas)
- `blocked` - Bloqueada (no disponible)

---

## 🔧 Para Configurar KDS:

### 1. Ya existe página KDS en `/kds/:locationId`

### 2. Ya existe hook `useKDSData` que:
- Obtiene ticket_lines por destination
- Agrupa por ticket
- Escucha cambios realtime
- Actualiza prep_status

### 3. Tienes componentes:
- `KDSBoard` - Vista principal
- `KDSOrderCard` - Tarjeta de pedido
- `KDSExpeditorCard` - Para expeditor (servir)

### 4. Lo que el KDS necesita del POS:
✅ Ya lo tiene todo conectado vía Supabase
✅ Realtime subscription funciona
✅ Estados se sincronizan automáticamente

---

## 💡 Para tu Prompt de Cursor:

**Usa estos nombres EXACTOS** (no reinventar):
- Tabla: `ticket_lines` (no "orders" ni "order_items")
- Status field: `prep_status` (no "status" ni "kitchen_status")
- Destino: `destination` con valores 'kitchen' | 'bar' | 'prep'
- Modificadores: tabla separada `ticket_line_modifiers`

**El KDS ya está implementado**, solo necesitas:
- Configurarlo desde UI
- Añadir analytics de KDS
- Personalizar tiempos objetivo por producto
- Configurar alertas por estación

¿Quieres que continúe con algo más o ya tienes lo que necesitas para el prompt de KDS?
