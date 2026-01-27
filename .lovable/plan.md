
# Plan: Módulo de Reservas para Josephine

## Resumen

Crearemos un módulo de reservas centralizado inspirado en Agora Bookings que aprovechará la infraestructura de base de datos ya existente (`customer_profiles`, `reservation_settings`, `reservation_deposits`, `reservation_waitlist`, etc.) y la integrará completamente con el POS.

---

## Funcionalidades Principales (basado en Agora)

### 1. Libro Único de Reservas
- Vista de timeline diario con todas las reservas
- Navegación por calendario semanal/mensual
- Filtros por estado, hora, número de comensales
- Vista de resumen de ocupación por franjas horarias

### 2. Plano Interactivo de Mesas
- Editor visual SVG para configurar mesas
- Drag & drop para asignar reservas a mesas
- Visualización de estado en tiempo real
- Indicadores de disponibilidad por hora

### 3. Sistema de Cobro de Señal
- Depósito por comensal configurable (10€, 15€, 20€...)
- Integración con Stripe para pagos
- El pago anticipado aparece en el POS al cerrar la cuenta
- Política de cancelación personalizable

### 4. CRM de Clientes
- Base de datos de clientes con historial
- Sistema de etiquetas (VIP, Frequent, Blacklist, Alergia...)
- Total de visitas y gasto acumulado
- Notas y preferencias

### 5. Lista de Espera (Waitlist)
- Registro de clientes sin mesa disponible
- Notificación automática cuando se libera una mesa
- Priorización manual o automática

### 6. Confirmación y Recordatorios
- Email de confirmación automático
- Recordatorio 24h antes (email/SMS opcional)
- Reconfirmación automática para grupos grandes

### 7. Analítica de Reservas
- KPIs: tasa de ocupación, no-shows, media comensales
- Gráficos de reservas por hora/día
- Comparativa semanal/mensual

### 8. Configuración Avanzada
- Control de aforo por franja horaria
- Días de cierre
- Límite de personas por reserva
- Doblaje automático de mesas
- Turnos solapados por zonas

---

## Arquitectura Técnica

```text
+-----------------------------+
|   /reservations (página)    |
+-----------------------------+
            |
    +-------+-------+
    |               |
+-------+     +----------+
|Timeline|    |FloorPlan |
| View   |    | Editor   |
+-------+     +----------+
    |               |
+-------+     +----------+
|Waitlist|    |Customers |
| Panel  |    |   CRM    |
+-------+     +----------+
    |               |
    +-------+-------+
            |
+-----------------------------+
|   useReservationsModule     |
|   (hook principal)          |
+-----------------------------+
            |
+-----------------------------+
|    Supabase Tables          |
| - reservations              |
| - customer_profiles         |
| - customer_tags             |
| - reservation_settings      |
| - reservation_deposits      |
| - reservation_waitlist      |
| - reservation_turns         |
+-----------------------------+
```

---

## Nuevos Archivos

### Página Principal
- `src/pages/Reservations.tsx` - Dashboard de reservas

### Componentes
```text
src/components/reservations/
├── ReservationsHeader.tsx        # Header con navegación de fecha y acciones
├── ReservationsKPICards.tsx      # Métricas: ocupación, no-shows, comensales
├── ReservationsTimeline.tsx      # Vista de timeline por hora (como Agora)
├── ReservationsCalendar.tsx      # Navegación mensual con ocupación
├── ReservationFloorPlan.tsx      # Plano de mesas interactivo
├── ReservationCard.tsx           # Tarjeta individual de reserva
├── CreateReservationDialog.tsx   # Modal para nueva reserva
├── EditReservationDialog.tsx     # Modal para editar reserva
├── CustomerProfilePanel.tsx      # Panel lateral de CRM cliente
├── CustomerTagsManager.tsx       # Gestión de etiquetas
├── WaitlistPanel.tsx             # Panel de lista de espera
├── DepositSettingsDialog.tsx     # Configuración de señales
├── ReservationSettingsPanel.tsx  # Configuración general
├── ReservationsAnalytics.tsx     # Gráficos y estadísticas
├── NoShowTracker.tsx             # Seguimiento de no-shows
├── index.ts                      # Barrel export
```

### Hooks
- `src/hooks/useReservationsModule.ts` - Hook principal con toda la lógica
- `src/hooks/useCustomerProfiles.ts` - Gestión de CRM
- `src/hooks/useReservationSettings.ts` - Configuración del local
- `src/hooks/useWaitlist.ts` - Lista de espera

### Edge Functions (nuevas o mejoradas)
- `supabase/functions/reservation_deposit/index.ts` - Procesar cobro de señal via Stripe
- `supabase/functions/reservation_reconfirm/index.ts` - Reconfirmación automática

---

## Cambios en Archivos Existentes

### 1. AppSidebar.tsx - Añadir al menú
```typescript
// Añadir después de Scheduling
{ icon: CalendarDays, label: 'Reservas', path: '/reservations', key: 'reservations' as const }
```

### 2. App.tsx - Nueva ruta
```typescript
<Route path="/reservations" element={<Reservations />} />
```

### 3. usePermissions.ts - Nuevo permiso
```typescript
// Añadir a SIDEBAR_PERMISSIONS
reservations: ['owner', 'admin', 'ops_manager', 'store_manager']
```

---

## Diseño de UI (Inspirado en Agora)

### Vista Principal: Timeline + Plano

```text
+--------------------------------------------------+
| Reservas    [← 27 Ene →]  [Hoy] [+Nueva Reserva] |
+--------------------------------------------------+
| 📊 12 reservas | 👥 48 pax | 📈 85% ocupación    |
+--------------------------------------------------+
|   TIMELINE (izq)    |    PLANO MESAS (der)       |
|---------------------|----------------------------|
| 12:00               |                            |
|  ┌─────────────┐    |    [Mesa 1]  [Mesa 2]      |
|  │ García - 4  │    |    ocupada   libre         |
|  │ Mesa 3      │    |                            |
|  └─────────────┘    |    [Mesa 3]  [Mesa 4]      |
| 12:30               |    García    Martínez      |
|  ┌─────────────┐    |                            |
|  │ López - 2   │    |    [Mesa 5]  [Mesa 6]      |
|  └─────────────┘    |    libre     reservada     |
| 13:00               |                            |
|  ┌─────────────┐    |                            |
|  │ Martínez - 6│    |  Drag & drop reservas      |
|  │ VIP 🌟      │    |  a las mesas               |
|  └─────────────┘    |                            |
+--------------------------------------------------+
| [Lista de Espera: 3 clientes]  [CRM Clientes]    |
+--------------------------------------------------+
```

### Panel CRM de Cliente

```text
+-------------------------+
| 👤 María García         |
| ⭐ VIP                   |
+-------------------------+
| 📧 maria@email.com      |
| 📱 +34 612 345 678      |
+-------------------------+
| 📊 Historial            |
| • 12 visitas            |
| • 850€ gastado          |
| • Última: 15 Ene 2026   |
+-------------------------+
| 🏷️ Etiquetas            |
| [VIP] [Alergia gluten]  |
+-------------------------+
| 📝 Notas                |
| Prefiere mesa exterior  |
| Celebra cumpleaños      |
+-------------------------+
| [Ver historial completo]|
+-------------------------+
```

---

## Integración con POS

### Sincronización Bidireccional
1. **Reserva → POS**: Al "Sentar" una reserva, se crea/abre un ticket en la mesa
2. **POS → Reserva**: Al cerrar un ticket, la mesa queda liberada automáticamente
3. **Depósito → POS**: El pago de señal aparece como "Anticipo" en el ticket

### Flujo de Depósito

```text
Cliente reserva online
        ↓
Sistema solicita señal (10€/pax)
        ↓
Pago via Stripe
        ↓
reservation_deposits (status: 'paid')
        ↓
Cliente llega al restaurante
        ↓
"Sentar" → Crea ticket
        ↓
Depósito se aplica como prepago
        ↓
applied_to_ticket_id = ticket.id
```

---

## Base de Datos

Las tablas ya existen. Solo se actualizarán los hooks para usarlas:

| Tabla | Uso |
|-------|-----|
| `reservations` | Reservas principales |
| `customer_profiles` | CRM de clientes |
| `customer_tags` | Etiquetas (VIP, etc.) |
| `reservation_settings` | Config por local |
| `reservation_deposits` | Pagos de señal |
| `reservation_waitlist` | Lista de espera |
| `reservation_turns` | Turnos/franjas horarias |

### Tabla de relación nueva (si no existe)
```sql
CREATE TABLE IF NOT EXISTS customer_profile_tags (
  customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
  customer_tag_id UUID REFERENCES customer_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_profile_id, customer_tag_id)
);
```

---

## Fases de Implementación

### Fase 1: MVP (Esta implementación)
1. Página principal con timeline de reservas
2. Crear/editar/cancelar reservas
3. Vista de plano de mesas básica
4. Integración con hooks existentes
5. KPIs básicos

### Fase 2: CRM y Waitlist
- Panel completo de CRM
- Sistema de etiquetas
- Lista de espera funcional
- Historial de cliente

### Fase 3: Depósitos
- Cobro de señal via Stripe
- Aplicación al ticket
- Política de cancelación

### Fase 4: Analítica Avanzada
- Gráficos de ocupación
- Predicción de no-shows
- Reportes automáticos

---

## Sección Técnica

### Hook Principal useReservationsModule

```typescript
interface UseReservationsModuleReturn {
  // Data
  reservations: Reservation[];
  todayStats: {
    totalReservations: number;
    totalCovers: number;
    occupancyRate: number;
    noShowRate: number;
  };
  
  // Actions
  createReservation: (data: CreateReservationInput) => Promise<Reservation>;
  updateReservation: (id: string, data: Partial<Reservation>) => Promise<void>;
  cancelReservation: (id: string, reason?: string) => Promise<void>;
  seatGuests: (id: string, tableId?: string) => Promise<void>;
  markNoShow: (id: string) => Promise<void>;
  
  // Waitlist
  waitlist: WaitlistEntry[];
  addToWaitlist: (data: WaitlistInput) => Promise<void>;
  notifyWaitlist: (entryId: string, tableId: string) => Promise<void>;
  
  // State
  loading: boolean;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}
```

### Componente Timeline (estructura)

El timeline mostrará reservas agrupadas por hora (slots de 30 min) en formato similar a un calendario, permitiendo ver de un vistazo la ocupación del día y hacer drag & drop.

### Permisos

Se usará el sistema existente de permisos:
- `owner`, `admin`, `ops_manager`: Acceso completo
- `store_manager`: Acceso solo a su local
- `employee`: Sin acceso (usan el panel de reservas del POS)

### Sincronización en Tiempo Real

Usará el mismo patrón de realtime de Supabase que ya existe en `useReservationsData`:

```typescript
supabase
  .channel('reservations-realtime')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'reservations' 
  }, handleChange)
  .subscribe()
```
