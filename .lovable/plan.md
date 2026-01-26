

## Plan: Añadir Bebidas como Curso 0 con Envío Automático a Barra

### Objetivo
Añadir **Bebidas** como el primer "curso" (Course 0) con envío automático a barra cuando se añade el producto, sin necesidad de pulsar ningún botón.

---

### Diseño Visual

```text
Selector de Cursos:
[🍺 Beb] [1º] [2º] [🍰]
   ↑
 Ámbar/Naranja

Flujo automático:
1. Camarero selecciona "Bebidas"
2. Añade cerveza → SE ENVÍA AUTOMÁTICAMENTE a barra
3. No aparece en la lista de "pendientes", ya está en barra
```

---

### Configuración de Colores

| Curso | Color | Icono | Destino | Comportamiento |
|-------|-------|-------|---------|----------------|
| 0 - Bebidas | Ámbar/Naranja | Beer/GlassWater | `bar` | Auto-envío |
| 1 - 1º Curso | Esmeralda | Soup | `kitchen` | Manual |
| 2 - 2º Curso | Azul | UtensilsCrossed | `kitchen` | Manual |
| 3 - Postre | Púrpura | IceCream2 | `kitchen` | Manual |

---

### Cambios Concretos

#### 1. POSCourseSelector.tsx

**Añadir Curso 0 a la configuración:**
```tsx
import { Wine } from 'lucide-react'; // o Beer/GlassWater

export const COURSE_CONFIG = {
  0: { 
    label: 'Bebidas', 
    shortLabel: '🍺', 
    color: 'amber',
    bgClass: 'bg-amber-500',
    bgClassLight: 'bg-amber-500/20',
    borderClass: 'border-amber-500',
    textClass: 'text-amber-500',
    icon: Wine,
    autoSend: true,      // Nueva propiedad
    destination: 'bar',  // Nueva propiedad
  },
  1: { /* ... sin cambios ... */ },
  2: { /* ... sin cambios ... */ },
  3: { /* ... sin cambios ... */ },
}
```

**Actualizar el array de cursos:**
```tsx
const courses = [0, 1, 2, 3] as const;
```

---

#### 2. POSOrderPanel.tsx

**Inicializar con Curso 0 (Bebidas) como default:**
```tsx
const [selectedCourse, setSelectedCourse] = useState(0);
```

**Añadir función de envío automático:**
```tsx
const sendLineToKitchen = async (line: OrderLine) => {
  const currentTicketId = await createOrUpdateTicket();
  
  const { data: insertedLine, error } = await supabase
    .from('ticket_lines')
    .insert({
      ticket_id: currentTicketId,
      product_id: line.product_id,
      item_name: line.name,
      quantity: line.quantity,
      unit_price: line.unit_price,
      gross_line_total: calculateLineTotal(line),
      notes: line.notes,
      sent_to_kitchen: true,
      sent_at: new Date().toISOString(),
      destination: line.kds_destination || 'bar',
      prep_status: 'pending',
      is_rush: line.is_rush || false,
      course: line.course,
    })
    .select()
    .single();
  
  return insertedLine;
};
```

**Modificar handleModifierConfirm para auto-envío:**
```tsx
const handleModifierConfirm = async (modifiers, itemNotes, isRush) => {
  if (!pendingProduct) return;

  const courseConfig = getCourseConfig(selectedCourse);
  
  const newLine: OrderLine = {
    product_id: pendingProduct.id,
    name: pendingProduct.name,
    quantity: 1,
    unit_price: pendingProduct.price,
    total: pendingProduct.price + modifiers.reduce(...),
    notes: itemNotes || undefined,
    modifiers,
    sent_to_kitchen: courseConfig.autoSend || false, // Auto-marcado
    kds_destination: courseConfig.destination || pendingProduct.kds_destination || 'kitchen',
    is_rush: isRush,
    course: selectedCourse,
  };

  // Si el curso tiene auto-envío, enviar inmediatamente
  if (courseConfig.autoSend) {
    setLoading(true);
    try {
      const inserted = await sendLineToKitchen(newLine);
      if (inserted) {
        setOrderLines([...orderLines, { ...newLine, id: inserted.id }]);
        toast.success(`${newLine.name} enviado a barra`);
      }
    } catch (error) {
      toast.error('Error al enviar a barra');
    } finally {
      setLoading(false);
    }
  } else {
    setOrderLines([...orderLines, newLine]);
  }
  
  setPendingProduct(null);
};
```

---

#### 3. KDSOrderCard.tsx

**Añadir Course 0 a la configuración del KDS:**
```tsx
const KDS_COURSE_CONFIG = {
  0: { label: 'Bebidas', color: 'amber', icon: Wine, bgClass: 'bg-amber-500/20', borderClass: 'border-amber-500', textClass: 'text-amber-400' },
  1: { /* ... */ },
  2: { /* ... */ },
  3: { /* ... */ },
}
```

---

### Comportamiento Final

```text
┌─────────────────────────────────────────┐
│  Mesa 4 • Curso: [🍺] [1º] [2º] [🍰]    │
│                   ↑ (seleccionado)       │
├─────────────────────────────────────────┤
│  + Toca "Cerveza"                        │
│    → Se añade a la lista                 │
│    → SE ENVÍA AUTOMÁTICAMENTE A BARRA   │
│    → Aparece con badge "Enviado"        │
│                                          │
│  🟠 Bebidas                              │
│    ✓ Cerveza x1        [En barra]       │
│    ✓ Coca-Cola x2      [En barra]       │
│                                          │
│  🟢 1º Curso           [Enviar 1º ➜]    │
│    • Ensalada x1       (pendiente)       │
└─────────────────────────────────────────┘
```

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/pos/POSCourseSelector.tsx` | Añadir Course 0 con propiedades `autoSend` y `destination` |
| `src/components/pos/POSOrderPanel.tsx` | Lógica de auto-envío cuando se añade bebida |
| `src/components/kds/KDSOrderCard.tsx` | Añadir Course 0 a la configuración visual del KDS |

---

### Sección Técnica

**Cambios en tipos (POSCourseSelector.tsx):**

```typescript
// Extender la configuración del curso
interface CourseConfigItem {
  label: string;
  shortLabel: string;
  color: string;
  bgClass: string;
  bgClassLight: string;
  borderClass: string;
  textClass: string;
  icon: LucideIcon;
  autoSend?: boolean;
  destination?: 'kitchen' | 'bar' | 'prep';
}

export const COURSE_CONFIG: Record<number, CourseConfigItem> = {
  0: { /* Bebidas */ },
  1: { /* 1º Curso */ },
  2: { /* 2º Curso */ },
  3: { /* Postre */ },
};
```

**Flujo de auto-envío (POSOrderPanel.tsx):**

1. `handleModifierConfirm` detecta si el curso actual tiene `autoSend: true`
2. Si es así, llama a `sendLineToKitchen` inmediatamente
3. La línea se añade a `orderLines` ya con `sent_to_kitchen: true` y el `id` del registro insertado
4. Se muestra toast de confirmación: "Cerveza enviado a barra"

**Destino KDS:**
- Course 0 (Bebidas): `destination: 'bar'` → Aparece en estación BARRA del KDS
- Courses 1-3: `destination: 'kitchen'` → Aparece en estación COCINA del KDS

