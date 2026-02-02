# Módulo de Reservas - Josephine

Sistema completo de gestión de reservas con control de aforo, depósitos, mensajería automática y analítica.

## 📋 Características Implementadas

### ✅ Core Features

- **Libro Único de Reservas**: Todas las reservas (telefónicas, walk-in, online, Google) en un solo calendario
- **Control de Aforo Avanzado**:
  - Por servicio (Almuerzo, Cena, Brunch, etc.)
  - Por franja horaria (slots configurables)
  - Por zona (Terraza, Salón, Privado, Barra)
  - Validación automática de disponibilidad
  - Sugerencias de horarios alternativos

- **Sistema de Depósitos**:
  - Preautorización de pagos (sin cargo inmediato)
  - Cargo automático al sentar clientes
  - Reembolsos completos o parciales
  - Conversión a prepago en TPV

- **Anti No-Show**:
  - Recordatorios automáticos 24h antes
  - Sistema de reconfirmación opcional
  - Política de cancelación configurable
  - Tracking de no-shows por cliente
  - Bloqueo automático después de X no-shows

- **Gestión de Mesas**:
  - Plano interactivo con zonas visuales
  - Asignación manual y automática
  - Recomendaciones inteligentes basadas en:
    - Capacidad perfecta
    - Zona preferida
    - Disponibilidad
  - Soporte para mesas combinables
  - Liberación automática desde TPV

- **Lista de Espera**:
  - Gestión de clientes sin reserva
  - Notificación automática cuando se libera mesa
  - Asignación inteligente según capacidad

- **Base de Datos de Clientes**:
  - Perfiles completos con historial
  - Etiquetas (VIP, Regular, Influencer, Empresa)
  - Límites de comensales por cliente
  - Tracking de visitas, gastos, no-shows
  - Bloqueo de clientes problemáticos

- **Mensajería Automática**:
  - Confirmaciones de reserva
  - Recordatorios 24h antes
  - Solicitudes de reconfirmación
  - Notificaciones de cancelación
  - Encuestas post-visita
  - Plantillas personalizables con placeholders
  - Soporte para Email y SMS (interfaces preparadas)

- **Promociones y Códigos**:
  - Códigos de descuento
  - Depósito gratis
  - Porcentaje de descuento
  - Límites de uso
  - Validez por servicio y fecha

- **Servicios y Turnos**:
  - Múltiples servicios por día
  - Horarios configurables
  - Días de la semana específicos
  - Capacidad máxima por servicio

- **Días de Cierre**:
  - Gestión de cierres por fecha
  - Cierres recurrentes (Navidad, etc.)
  - Eventos privados

### 🔄 Integraciones

#### Google Reservations
- Adapter implementado (mock + interfaz para real)
- Webhook handler para eventos
- Sincronización bidireccional
- Mapeo de estados

#### POS (TPV)
- Adapter implementado (mock + interfaz)
- Sincronización de estados de mesas
- Conversión de depósitos a prepagos
- Liberación automática de mesas
- Trigger de encuestas post-visita

## 🗂️ Arquitectura del Código

### Estructura de Directorios

```
src/
├── types/
│   └── reservations.ts           # Definiciones TypeScript completas
├── services/
│   └── reservations/
│       ├── repository-interface.ts        # Interfaces de repositorios
│       ├── in-memory-repository.ts        # Implementación InMemory
│       ├── seed-data.ts                   # Datos de demostración
│       ├── availability-service.ts        # Validación de disponibilidad
│       ├── seating-service.ts             # Asignación de mesas
│       ├── messaging-service.ts           # Email/SMS
│       ├── deposit-service.ts             # Depósitos y pagos
│       ├── adapters/
│       │   ├── google-reservations-adapter.ts
│       │   └── pos-adapter.ts
│       └── index.ts                       # Exports principales
```

### Capa de Datos (Data Layer)

El sistema está diseñado con **abstracción completa de datos**:

```typescript
interface ReservationsDataLayer {
  reservations: ReservationsRepository;
  customers: CustomersRepository;
  deposits: DepositsRepository;
  zones: ZonesRepository;
  tables: TablesRepository;
  services: ServicesRepository;
  // ... más repositorios
}
```

Puedes usar:
- **InMemoryRepository**: Funciona sin base de datos (ideal para desarrollo)
- **SupabaseRepository**: Para producción con Supabase (por implementar)

## 🚀 Cómo Usar

### 1. Modo Desarrollo (Sin Supabase)

El sistema ya funciona con datos en memoria:

```typescript
import { createInMemoryDataLayer, getAllSeedData } from '@/services/reservations';
import { AvailabilityService, SeatingService } from '@/services/reservations';

// Crear data layer
const dataLayer = createInMemoryDataLayer();

// Cargar datos de demostración
const seedData = getAllSeedData('tu-location-id');
dataLayer.customers.seed(seedData.customers);
dataLayer.zones.seed(seedData.zones);
dataLayer.tables.seed(seedData.tables);
// ... etc

// Crear servicios
const availabilityService = new AvailabilityService(dataLayer);
const seatingService = new SeatingService(dataLayer);

// Usar servicios
const result = await availabilityService.checkAvailability({
  locationId: 'location-1',
  date: '2024-02-15',
  time: '20:00',
  party_size: 4,
});

if (result.available) {
  // Crear reserva...
}
```

### 2. Activar Supabase (Futuro)

#### Paso 1: Ejecutar Migraciones

```bash
cd supabase/migrations
# Las migraciones se encuentran en supabase/migrations/
# Ejecutar con Supabase CLI o desde el dashboard
```

#### Paso 2: Implementar SupabaseRepository

```typescript
import { createSupabaseDataLayer } from '@/services/reservations/supabase-repository';
import { supabase } from '@/integrations/supabase/client';

const dataLayer = createSupabaseDataLayer(supabase);

// Resto del código es igual
const availabilityService = new AvailabilityService(dataLayer);
```

#### Paso 3: Configurar Variables de Entorno

```bash
VITE_SUPABASE_URL=your-url
VITE_SUPABASE_KEY=your-key
```

### 3. Integración con TPV

El adapter de TPV permite sincronización bidireccional:

```typescript
import { MockPosAdapter, PosIntegrationService } from '@/services/reservations/adapters/pos-adapter';

const posAdapter = new MockPosAdapter(dataLayer);
const posIntegration = new PosIntegrationService(dataLayer, posAdapter);

// Sentar una reserva
await posIntegration.seatReservation('reservation-id', 'table-id');

// Manejar cierre de mesa desde TPV
await posIntegration.handleTableClosed('table-id');

// Sincronizar estados de mesas
await posIntegration.syncTableStatuses('location-id');
```

### 4. Mensajería

```typescript
import { MessagingService } from '@/services/reservations';

const messagingService = new MessagingService(dataLayer);

// Enviar confirmación
await messagingService.sendConfirmation('reservation-id');

// Enviar recordatorio
await messagingService.sendReminder('reservation-id');

// Encuesta post-visita
await messagingService.sendPostVisitSurvey('reservation-id');
```

Para usar un proveedor real (ej: Resend para email, Twilio para SMS):

```typescript
import { MessagingService, MessageProvider } from '@/services/reservations';

const customProvider: MessageProvider = {
  async sendEmail(to, subject, body) {
    // Integración con Resend, SendGrid, etc.
  },
  async sendSMS(to, body) {
    // Integración con Twilio, Vonage, etc.
  }
};

const messagingService = new MessagingService(dataLayer, customProvider);
```

### 5. Depósitos

```typescript
import { DepositService } from '@/services/reservations';

const depositService = new DepositService(dataLayer);

// Verificar si se requiere depósito
const required = await depositService.isDepositRequired(reservation);

// Calcular monto
const amount = await depositService.calculateDepositAmount('reservation-id');

// Crear y autorizar
const deposit = await depositService.createDeposit(
  'reservation-id',
  'payment-method-id'
);

// Cargar cuando cliente es sentado
await depositService.chargeDeposit(deposit.id);

// Reembolsar si cancela
await depositService.refundDeposit(deposit.id, amount, 'Cancelación');
```

## 🎨 UI Components (Existentes)

Ya hay componentes UI básicos que debes expandir:

- `src/pages/Reservations.tsx` - Página principal
- `src/components/reservations/` - Componentes específicos
- `src/hooks/useReservationsModule.ts` - Hook principal

### Mejoras Sugeridas a UI:

1. **Calendario Visual**: Usar `react-big-calendar` o similar
2. **Plano de Mesas Interactivo**: Canvas o SVG interactivo con drag & drop
3. **Panel de Analítica**: Gráficos con Recharts (ya disponible)
4. **Gestión de Clientes**: CRUD completo con búsqueda y filtros
5. **Configuración**: Página de settings para cada location

## 📊 Datos de Demostración

El sistema incluye datos seed completos:

- 4 Clientes con diferentes perfiles (VIP, Regular, Influencer, Empresa)
- 4 Zonas (Terraza, Salón Principal, Privado, Barra)
- 16 Mesas distribuidas en zonas
- 3 Servicios (Almuerzo, Cena, Brunch)
- Plantillas de mensajes
- Códigos promocionales
- Reservas de ejemplo para hoy

Ver `src/services/reservations/seed-data.ts` para detalles.

## 🔧 Configuración

### ReservationSettings

Cada location tiene su configuración:

```typescript
{
  default_reservation_duration: 90,      // minutos
  slot_duration_minutes: 15,
  max_party_size: 12,
  require_deposit: true,
  deposit_amount_per_person: 10,        // EUR
  deposit_required_for_party_size: 6,   // solo grupos >= 6
  auto_confirm: false,
  require_reconfirmation: true,
  reconfirmation_hours_before: 24,
  send_reminder: true,
  reminder_hours_before: 24,
  cancellation_deadline_hours: 24,
  charge_cancellation_fee: true,
  cancellation_fee_percentage: 50,
  track_no_shows: true,
  block_after_no_shows: 3,              // bloquear después de 3 no-shows
  enable_waitlist: true,
  enable_table_combining: true,
  enable_promo_codes: true,
  enable_google_reservations: true,
}
```

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Tests específicos de reservations
npm test reservations
```

## 📈 Próximos Pasos (Opcionales)

1. **Migraciones SQL**: Crear archivos SQL para Supabase
2. **SupabaseRepository**: Implementar versión real de repositorios
3. **UI Mejorada**: Calendario visual, plano de mesas interactivo
4. **Analítica Completa**: Página con gráficos y métricas
5. **Google Reservations**: Integración real con API de Google
6. **Proveedores Reales**: Resend, Twilio, Stripe
7. **Webhooks**: Endpoints para recibir eventos de Google y pagos
8. **Automatizaciones**: Cron jobs para recordatorios y reportes

## 🤝 Soporte

Para dudas o mejoras, revisa:
- El código fuente en `src/services/reservations/`
- Los tipos en `src/types/reservations.ts`
- Los datos seed para ejemplos

## 📝 Notas Técnicas

### Por qué InMemory?

- ✅ Funciona inmediatamente sin configuración
- ✅ Ideal para desarrollo y demos
- ✅ Permite tests rápidos
- ✅ Fácil migración a Supabase cuando esté listo

### Arquitectura de Servicios

Cada servicio es independiente y recibe el `dataLayer` como dependencia:

- **AvailabilityService**: Validaciones y cálculos de capacidad
- **SeatingService**: Lógica de asignación de mesas
- **MessagingService**: Envío de comunicaciones
- **DepositService**: Manejo de pagos

Esto permite:
- Testing unitario fácil
- Swap de implementaciones
- Extensibilidad

### Tipos TypeScript

Todos los tipos están centralizados en `src/types/reservations.ts`:
- 20+ interfaces principales
- Enums para estados
- Input types para API
- Tipos para adapters

---

**Hecho con ❤️ para Josephine**
