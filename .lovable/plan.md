

## Plan: Sistema de Reservas Ultra-Rápido para Llamadas Telefónicas

### Análisis del Problema

El flujo actual de reservas requiere abrir un diálogo modal con **múltiples campos y selectores**, lo cual es lento cuando un cliente llama por teléfono. Los mejores sistemas de la industria (OpenTable, Resy, SevenRooms) priorizan:

1. **Entrada mínima de datos** - Solo lo esencial
2. **Recomendación automática de mesas** - Basada en disponibilidad y capacidad
3. **Un solo flujo lineal** - Sin navegación innecesaria

---

### Solución: Flujo de Reserva en 5 Segundos

```text
┌─────────────────────────────────────────────────────────────────┐
│  NUEVA RESERVA RÁPIDA (inline en header)                        │
│                                                                 │
│  📅 Hoy ▾    🕐 20:30 ▾    👥 4 ▾    📞 ___________             │
│                                                                 │
│  Nombre: [________________] Apellido: [________________]        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  MESAS RECOMENDADAS (automático según 4 personas)       │   │
│  │                                                         │   │
│  │  ✅ Mesa 1 (4 pax) - Disponible                         │   │
│  │  ✅ Mesa 2 (4 pax) - Disponible                         │   │
│  │  ✅ Mesa 3 (6 pax) - Disponible                         │   │
│  │  ⚠️ Mesa 7 (4 pax) - Ocupada, libre ~21:30              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│           [ Cancelar ]    [ ✓ Confirmar Reserva ]               │
└─────────────────────────────────────────────────────────────────┘
```

### Características Clave

| Característica | Descripción |
|----------------|-------------|
| **Formulario inline** | No abrir modal - todo visible en un panel lateral |
| **Defaults inteligentes** | Fecha = Hoy, Hora = Próximo slot disponible, Personas = 2 |
| **Solo 2 campos de texto** | Nombre + Apellido (el camarero escribe mientras escucha) |
| **Teléfono opcional** | Un campo numérico simple |
| **Recomendación automática** | Al cambiar "personas", filtra mesas compatibles |
| **Click para asignar** | Un tap en la mesa recomendada = asignación instantánea |
| **Validación mínima** | Solo nombre obligatorio |

---

### Flujo de Usuario (5 segundos)

1. **Click "Nueva Reserva"** → Se abre panel inline
2. **Seleccionar fecha/hora/personas** → Valores por defecto ya puestos
3. **Escribir nombre** → Mientras el cliente lo dice por teléfono
4. **Teléfono (opcional)** → Solo si el cliente lo da
5. **Click en mesa sugerida** → Auto-selecciona y confirma

---

### Archivos a Modificar/Crear

| Archivo | Cambio |
|---------|--------|
| `src/components/pos/POSQuickReservation.tsx` | **NUEVO** - Panel inline de reserva rápida |
| `src/components/pos/POSTableSuggestions.tsx` | **NUEVO** - Grid de mesas recomendadas |
| `src/components/pos/POSFloorPlan.tsx` | Integrar panel de reserva rápida en sidebar |
| `src/hooks/useReservationsData.ts` | Añadir función para obtener disponibilidad de mesas |

---

### Diseño Visual del Panel Rápido

```text
┌─────────────────────────────────────────┐
│ 📞 RESERVA RÁPIDA              [X]     │
├─────────────────────────────────────────┤
│                                         │
│ Fecha          Hora         Personas   │
│ [Hoy     ▾]   [20:30  ▾]   [2 ▾]      │
│                                         │
│ Nombre *                               │
│ [____________________________]         │
│                                         │
│ Apellido                               │
│ [____________________________]         │
│                                         │
│ Teléfono                               │
│ [____________________________]         │
│                                         │
├─────────────────────────────────────────┤
│ 🪑 MESAS DISPONIBLES (para 2 pax)      │
│                                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│ │ Mesa 5  │ │ Mesa 6  │ │ Barra 1 │   │
│ │  2 pax  │ │  2 pax  │ │  3 pax  │   │
│ │   ✓     │ │   ✓     │ │   ✓     │   │
│ └─────────┘ └─────────┘ └─────────┘   │
│                                         │
│ ┌─────────┐ ┌─────────┐               │
│ │ Mesa 1  │ │ Mesa 2  │               │
│ │  4 pax  │ │  4 pax  │               │
│ │   ✓     │ │   ✓     │               │
│ └─────────┘ └─────────┘               │
│                                         │
├─────────────────────────────────────────┤
│  Mesa seleccionada: Mesa 5             │
│                                         │
│ [    ✓ Confirmar Reserva    ]          │
└─────────────────────────────────────────┘
```

---

### Algoritmo de Recomendación de Mesas

```text
1. Filtrar mesas por capacidad:
   - Mesas con seats >= party_size
   - Ordenar por diferencia (mesas más ajustadas primero)

2. Verificar disponibilidad en fecha/hora:
   - Consultar reservas existentes para esa franja
   - Excluir mesas con reservas solapadas (±2 horas)

3. Verificar estado actual:
   - Si la mesa está "available" → ✅ Disponible
   - Si la mesa está "occupied" → ⚠️ Estimar hora de liberación

4. Ordenar por prioridad:
   - Primero: Disponibles y ajustadas a capacidad
   - Segundo: Disponibles con capacidad extra
   - Tercero: Ocupadas que se liberarán a tiempo
```

---

### Sección Técnica

#### POSQuickReservation.tsx (Nuevo Componente)

```tsx
interface POSQuickReservationProps {
  locationId: string;
  tables: POSTable[];
  onClose: () => void;
  onConfirm: (reservation: QuickReservationData) => Promise<void>;
}

interface QuickReservationData {
  guest_name: string;
  guest_surname: string;
  guest_phone: string | null;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  pos_table_id: string;
}

// Componente con:
// - Selectores compactos en fila (fecha/hora/personas)
// - Inputs de nombre/apellido con autofocus
// - Grid de mesas recomendadas abajo
// - Botón de confirmar que solo se activa con nombre + mesa
```

#### Hook useTableAvailability

```tsx
function useTableAvailability(
  locationId: string,
  date: string,
  time: string,
  partySize: number
) {
  // Retorna:
  // - availableTables: mesas libres y compatibles
  // - occupiedTables: mesas ocupadas con hora estimada
  // - recommendedTable: la mejor opción auto-seleccionada
}
```

#### Modificaciones en POSFloorPlan.tsx

```tsx
// Reemplazar el botón "Nueva Reserva" que abre modal
// por un toggle que muestra el panel inline

const [showQuickReservation, setShowQuickReservation] = useState(false);

// En el render:
{showQuickReservation && (
  <POSQuickReservation
    locationId={locationId}
    tables={currentTables}
    onClose={() => setShowQuickReservation(false)}
    onConfirm={handleQuickReservation}
  />
)}
```

---

### Resultado Final

El camarero recibirá una llamada y podrá:

1. **1 click** → Abrir panel de reserva
2. **Escribir nombre** mientras escucha al cliente
3. **Ajustar personas** si no son 2 (default)
4. **Tocar una mesa verde** → Se selecciona
5. **Click Confirmar** → Reserva creada

**Tiempo total: ~5 segundos** vs. el flujo actual de ~15-20 segundos

