# Código POS Completo - Josephine

## 📁 Estructura (20 componentes + 1 hook)

```
src/
├── pages/
│   ├── POS.tsx (60 líneas)           # Selector de local
│   └── POSTerminal.tsx (156 líneas)  # Terminal principal con tabs
├── hooks/
│   └── usePOSData.ts (184 líneas)    # Hook principal de datos
└── components/pos/
    ├── POSFloorPlan.tsx (395 líneas)      # Plano de mesas interactivo
    ├── POSOrderPanel.tsx (1059 líneas)    # Panel de pedido (MÁS IMPORTANTE)
    ├── POSProductGrid.tsx (228 líneas)    # Grid de productos
    ├── POSPaymentModal.tsx (620 líneas)   # Modal de pago
    ├── POSSplitPaymentModal.tsx (447 líneas) # División de cuenta
    ├── POSModifierDialog.tsx (358 líneas)  # Modificadores de productos
    ├── POSCourseSelector.tsx (182 líneas)  # Selector de cursos
    ├── POSTableCard.tsx (302 líneas)       # Tarjeta de mesa
    ├── POSQuickOrder.tsx (386 líneas)      # Pedido rápido sin mesa
    ├── POSOpenTables.tsx (145 líneas)      # Lista de mesas abiertas
    ├── POSCashSession.tsx (360 líneas)     # Gestión de caja
    ├── POSReceiptDialog.tsx (176 líneas)   # Vista de recibo
    ├── POSReceiptPDF.tsx (182 líneas)      # Generación de PDF
    ├── POSReservationsPanel.tsx (147 líneas) # Panel de reservas
    ├── POSReservationDialog.tsx (156 líneas) # Dialog de reserva
    ├── POSQuickReservation.tsx (111 líneas)  # Reserva rápida
    ├── POSStripePayment.tsx (249 líneas)     # Integración Stripe
    ├── POSLoyaltyPanel.tsx (288 líneas)      # Programa de fidelidad
    ├── POSFloorEditor.tsx (463 líneas)       # Editor de planos
    ├── PrintQueuePanel.tsx (248 líneas)      # Cola de impresión
    └── index.ts                              # Exports
```

## 🔑 Archivos Clave (Código Completo)

### 1. usePOSData.ts - Hook Principal

**Ubicación:** `src/hooks/usePOSData.ts`

**Interfaces Principales:**
```typescript
export interface POSTable {
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
  current_ticket_id: string | null;
}

export interface POSProduct {
  id: string;
  name: string;
  category: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  kds_destination: 'kitchen' | 'bar' | 'prep';
}

export interface POSTicket {
  id: string;
  location_id: string;
  pos_table_id: string | null;
  server_id: string | null;
  status: string;
  gross_total: number;
  discount_total: number;
  net_total: number;
  service_type: string;
  notes: string | null;
  covers: number;
  opened_at: string;
  table_name: string | null;
}
```

**Funcionalidad:**
- Carga floor maps, tables, products, open tickets
- Suscripciones realtime a cambios
- Gestión de cash session

### 2. POSOrderPanel.tsx - Panel de Pedido (CORE)

**Ubicación:** `src/components/pos/POSOrderPanel.tsx`

**Interface OrderLine (Línea de Pedido):**
```typescript
interface OrderLine {
  id?: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes?: string;
  modifiers: OrderLineModifier[];
  sent_to_kitchen: boolean;
  kds_destination?: 'kitchen' | 'bar' | 'prep';
  is_rush?: boolean;
  prep_status?: 'pending' | 'preparing' | 'ready' | 'served';
  course: number;  // 0=bebida, 1=entrante, 2=principal, 3=postre
}

interface OrderLineModifier {
  modifier_name: string;
  option_name: string;
  price_delta: number;
  type: 'add' | 'remove' | 'substitute';
}
```

**Funciones Principales:**
```typescript
// Crear o actualizar ticket
const createOrUpdateTicket = async (): Promise<string>

// Enviar a cocina/bar
const sendToKitchen = async ()

// Enviar línea individual (bebidas)
const sendSingleLineToKitchen = async (line: OrderLine)

// Cerrar cuenta
const handleCloseOrder = async ()

// Agregar producto
const handleProductClick = (product: POSProduct)

// Modificadores
const handleModifierConfirm = async (
  modifiers: OrderLineModifier[], 
  itemNotes: string, 
  isRush: boolean
)
```

**Queries Clave:**
```typescript
// Cargar líneas del ticket
const { data: lines } = await supabase
  .from('ticket_lines')
  .select('*')
  .eq('ticket_id', ticketId);

// Cargar modificadores
const { data: modifiers } = await supabase
  .from('ticket_line_modifiers')
  .select('*')
  .in('ticket_line_id', lineIds);

// Insertar nueva línea
const { data: insertedLine } = await supabase
  .from('ticket_lines')
  .insert({
    ticket_id,
    product_id,
    item_name,
    quantity,
    unit_price,
    gross_line_total,
    destination: kds_destination,
    prep_status: 'pending',
    sent_at: new Date().toISOString(),
    is_rush: false,
    course: selectedCourse,
    notes: itemNotes,
  })
  .select()
  .single();

// Insertar modificadores
await supabase
  .from('ticket_line_modifiers')
  .insert(modifiers.map(mod => ({
    ticket_line_id: insertedLine.id,
    modifier_name: mod.modifier_name,
    option_name: mod.option_name,
    price_delta: mod.price_delta,
  })));
```

### 3. POSFloorPlan.tsx - Plano de Mesas

**Funcionalidad:**
- Renderiza mesas en canvas interactivo
- Click en mesa → abre POSOrderPanel
- Actualiza estados en tiempo real
- Drag & drop para rearrange

**Estado de Mesa:**
```typescript
const getTableStatusColor = (status: string) => {
  switch (status) {
    case 'available': return 'bg-emerald-500';
    case 'occupied': return 'bg-red-500';
    case 'reserved': return 'bg-blue-500';
    case 'blocked': return 'bg-gray-400';
  }
}
```

### 4. POSProductGrid.tsx - Grid de Productos

**Funcionalidad:**
- Grid categorizado de productos
- Búsqueda y filtrado
- Imágenes de productos
- Click → añade al pedido

### 5. POSPaymentModal.tsx - Modal de Pago

**Métodos de Pago:**
```typescript
const paymentMethods = [
  { id: 'cash', label: 'Efectivo', icon: Coins },
  { id: 'card', label: 'Tarjeta', icon: CreditCard },
  { id: 'stripe', label: 'Stripe', icon: Smartphone },
];
```

**Funcionalidad:**
- Múltiples métodos de pago
- Split payment (división)
- Propina
- Impresión de recibo
- Integración con Stripe

### 6. POSModifierDialog.tsx - Modificadores

**Funcionalidad:**
- Dialog para seleccionar modificadores de productos
- Opciones: Sin cebolla, Punto de carne, Extra queso
- Notas personalizadas
- Toggle "Rush" (urgente)

### 7. POSCourseSelector.tsx - Cursos

**Cursos Configurados:**
```typescript
const KDS_COURSE_CONFIG = {
  0: { label: 'Bebidas', color: 'amber' },
  1: { label: '1º Curso', color: 'emerald' },
  2: { label: '2º Curso', color: 'blue' },
  3: { label: 'Postre', color: 'purple' },
}
```

---

## 🔄 Flujos Principales

### A) Crear Pedido Nuevo:

1. Click en mesa disponible
2. Se abre POSOrderPanel
3. Click en productos → se añaden a orderLines[]
4. Click "Enviar a Cocina"
5. Crea ticket en DB
6. Crea ticket_lines con destination y prep_status='pending'
7. KDS recibe vía realtime

### B) Añadir Items a Pedido Existente:

1. Click en mesa ocupada
2. Carga ticket_lines existentes
3. Añadir más productos
4. Click "Enviar a Cocina" → solo envía nuevos items
5. Items se marcan como sent_to_kitchen=true

### C) Pagar Cuenta:

1. Click "Cobrar"
2. Se abre POSPaymentModal
3. Seleccionar método
4. Procesar pago
5. Ticket status → 'paid'
6. Mesa status → 'available'
7. Imprimir recibo

---

## 📊 Queries SQL Típicas

### Obtener ticket con líneas:
```sql
SELECT t.*, 
       tl.*,
       tlm.*
FROM tickets t
LEFT JOIN ticket_lines tl ON tl.ticket_id = t.id
LEFT JOIN ticket_line_modifiers tlm ON tlm.ticket_line_id = tl.id
WHERE t.id = 'ticket-id'
```

### Obtener pedidos pendientes para KDS:
```sql
SELECT tl.*,
       t.table_name,
       t.covers,
       t.opened_at
FROM ticket_lines tl
INNER JOIN tickets t ON t.id = tl.ticket_id
WHERE tl.destination = 'kitchen'
  AND tl.prep_status IN ('pending', 'preparing', 'ready')
ORDER BY tl.sent_at ASC
```

---

## 🎨 Componentes UI Secundarios

- **POSCashSession**: Abrir/cerrar caja, contar dinero
- **POSReceiptDialog**: Vista previa de recibo
- **POSReceiptPDF**: Generación de PDF
- **POSSplitPaymentModal**: División de cuenta entre comensales
- **POSStripePayment**: Integración con Stripe Elements
- **POSLoyaltyPanel**: Programa de puntos
- **POSReservationsPanel**: Ver reservas del día
- **POSTableCard**: Tarjeta individual de mesa
- **POSFloorEditor**: Editar posición de mesas
- **PrintQueuePanel**: Cola de impresión

---

## 🔗 Integración con Otros Módulos

### POS → KDS:
- Campo `destination` en ticket_lines
- Campo `prep_status` para tracking
- Realtime sync vía Supabase

### POS → Reservas:
- Campo `pos_table_id` en reservations
- Liberar mesa al cerrar ticket
- POSReservationsPanel muestra reservas

### POS → Scan&Pay:
- Bill = Ticket
- BillItems = TicketLines
- Mismo modelo de datos

---

## 📝 Archivos Completos Disponibles

Todos los archivos están en:
```
/workspace/src/components/pos/*.tsx
/workspace/src/pages/POS*.tsx
/workspace/src/hooks/usePOSData.ts
```

**¿Quieres que copie algún archivo específico completo** o ya tienes suficiente contexto para configurar el KDS?

Los archivos clave que probablemente necesites ver completos son:
1. `POSOrderPanel.tsx` (1059 líneas) - Lógica de pedidos
2. `usePOSData.ts` (184 líneas) - Data fetching
3. `POSFloorPlan.tsx` (395 líneas) - UI de mesas

Dime cuál quieres ver completo y te lo muestro.
