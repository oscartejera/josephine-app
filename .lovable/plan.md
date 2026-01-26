
## Plan: Sistema de Cursos (Courses) para POS - Estilo Fresh KDS

### Resumen Ejecutivo
Implementar un sistema de cursos profesional que permita separar entrantes, principales y postres. El campo `course` ya existe en `ticket_lines` (integer, default 1). Los cambios afectan solo la capa de aplicación.

---

### Componentes a Modificar

#### 1. POSOrderPanel.tsx - UI de selección de curso
**Cambios:**
- Añadir selector de curso actual en la cabecera del panel de orden
- Mostrar indicador visual del curso asignado a cada línea
- Al añadir producto, asignar automáticamente el curso seleccionado
- Incluir `course` en el insert a `ticket_lines`

**UI propuesta:**
```
┌─────────────────────────────────────────┐
│  Mesa 4 • Curso: [1º] [2º] [🍰]         │
├─────────────────────────────────────────┤
│  🟢 1º Curso                            │
│    • Ensalada César x1                  │
│    • Croquetas x2                       │
│  🔵 2º Curso                            │
│    • Entrecot x1                        │
│    • Lubina x1                          │
│  🟣 Postre                              │
│    • Tiramisú x2                        │
└─────────────────────────────────────────┘
```

#### 2. POSOrderPanel.tsx - Envío a cocina por curso
**Lógica mejorada:**
- Opción "Enviar curso" para enviar solo el curso actual
- Opción "Enviar todo" para enviar todos los cursos pendientes
- Visual feedback del estado de cada curso (pendiente/enviado)

#### 3. useKDSData.ts - Agrupación por curso
**Cambios:**
- Agrupar `KDSTicketLine` items por curso dentro de cada orden
- Añadir campo `course` al tipo `KDSTicketLine`
- Ordenar items primero por curso, luego por sent_at

#### 4. KDSOrderCard.tsx - Visualización por cursos
**Cambios:**
- Renderizar secciones separadas por curso
- Headers visuales: "1º Curso", "2º Curso", "Postre"
- Colores distintivos por curso
- Indicador de "curso completo" cuando todos los items del curso están ready

#### 5. print_kitchen_ticket - Incluir curso en tickets físicos
**Cambios:**
- Añadir curso a `items_json`
- Agrupar items por curso en el ticket impreso

---

### Diseño Visual

#### Colores de Curso (POS y KDS)
| Curso | Label | Color | Badge |
|-------|-------|-------|-------|
| 1 | 1º Curso | Emerald | bg-emerald-500 |
| 2 | 2º Curso | Blue | bg-blue-500 |
| 3 | Postre | Purple | bg-purple-500 |
| 4+ | Curso N | Amber | bg-amber-500 |

#### Flujo de Trabajo
```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE CURSOS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. CAMARERO TOMA COMANDA                                       │
│     ├─ Selecciona curso activo (1º por defecto)                 │
│     ├─ Añade productos al curso                                 │
│     └─ Cambia de curso para añadir más items                    │
│                                                                 │
│  2. ENVÍO A COCINA                                              │
│     ├─ "Enviar 1º Curso" → Solo entrantes a KDS                 │
│     ├─ "Enviar 2º Curso" → Solo principales a KDS               │
│     └─ "Enviar Todo" → Todos los cursos a la vez                │
│                                                                 │
│  3. KDS MUESTRA ORDEN                                           │
│     ├─ Orden agrupada por cursos                                │
│     ├─ Header visual por curso                                  │
│     └─ Indicador "Curso Listo" al completar                     │
│                                                                 │
│  4. SERVICIO                                                    │
│     ├─ Camarero ve "1º Listo" → Sirve entrantes                 │
│     ├─ Envía 2º curso cuando cliente termina                    │
│     └─ Proceso se repite para postres                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/components/pos/POSCourseSelector.tsx` | CREAR | Selector de curso reutilizable |
| `src/components/pos/POSOrderPanel.tsx` | MODIFICAR | Integrar cursos en el flujo |
| `src/components/kds/KDSOrderCard.tsx` | MODIFICAR | Agrupar items por curso |
| `src/hooks/useKDSData.ts` | MODIFICAR | Incluir course en tipos y agrupación |
| `supabase/functions/print_kitchen_ticket/index.ts` | MODIFICAR | Incluir curso en JSON |

---

### Tipos Nuevos

```typescript
// Constantes de curso
export const COURSE_CONFIG = {
  1: { label: '1º Curso', shortLabel: '1º', color: 'emerald', icon: '🥗' },
  2: { label: '2º Curso', shortLabel: '2º', color: 'blue', icon: '🍽️' },
  3: { label: 'Postre', shortLabel: '🍰', color: 'purple', icon: '🍰' },
} as const;

// Extensión de OrderLine existente
interface OrderLine {
  // ... campos existentes
  course: number; // 1, 2, 3...
}
```

---

### Patrón de Implementación

El diseño sigue el patrón de Fresh KDS / Square Kitchen:
1. **Selección explícita**: El camarero elige el curso antes de añadir productos
2. **Agrupación visual**: Items del mismo curso siempre juntos
3. **Envío granular**: Posibilidad de enviar curso por curso
4. **Feedback de estado**: Indicador claro de qué cursos están listos

---

### Resumen de Implementación

1. ✅ BD ya tiene campo `course` (integer, default 1)
2. 🔧 Crear POSCourseSelector component
3. 🔧 Modificar POSOrderPanel para cursos
4. 🔧 Modificar KDSOrderCard para mostrar cursos
5. 🔧 Actualizar useKDSData para agrupar por curso
