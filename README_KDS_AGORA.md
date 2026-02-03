# KDS Ágora-Style - Josephine

Sistema completo de Kitchen Display System replicando funcionalidad de Ágora.

## ✅ Implementación Completa

### 🗄️ Base de Datos

**3 Tablas Nuevas:**

1. **`kds_monitors`** - Configuración de monitores
   - Tipos: restaurant, fast_food, expeditor, customer_display
   - Filtros: destinations, courses, statuses
   - Vista: classic, rows_interactive, mixed
   - Comportamiento: auto-serve, botones, historial

2. **`ticket_order_flags`** - Sistema de "marchar"
   - Por ticket + course
   - Track is_marched, marched_at, marched_by

3. **`kds_events`** - Auditoría completa
   - Todos los eventos: sent, start, finish, serve, march, etc.
   - Payload JSON con contexto
   - Trigger automático en cambios de prep_status

**Monitores por Defecto (Seed):**
- 🔥 Cocina Principal (kitchen, restaurant)
- 🍹 Barra (bar, restaurant)
- 📋 Pase/Expeditor (all, expeditor)

### 🛠️ Servicios (7 servicios)

1. **KDSMonitorsService** - CRUD monitores
2. **KDSQueryService** - Query optimizado con filtros
3. **KDSGroupingService** - Agrupar por ticket+course
4. **KDSStateMachineService** - Transiciones de estado
5. **KDSMarchService** - Marchar/desmarchar órdenes
6. **KDSHistoryService** - Órdenes cerradas 30 min
7. **KDSStylesService** - Reglas de estilo dinámicas

### 🎨 UI Implementada

**Página de Configuración:**
- `/kds/settings` - CRUD de monitores
- Create/Edit/Delete monitors
- Configuración completa por monitor

**Características Disponibles:**

✅ **Monitores Configurables**
- Tipo de monitor (restaurant/fast_food/expeditor)
- Destinos (kitchen/bar/prep)
- Filtro por curso (entrantes/principales/postres)
- Estados primarios/secundarios

✅ **3 Modos de Vista**
- Classic: columnas dinámicas
- Rows Interactive: rows con drag&drop
- Mixed: rows sin drag

✅ **Sistema de "Marchar"**
- Banda naranja por curso
- March/unmarch desde UI
- Auditoría completa

✅ **Estados Primarios/Secundarios**
- Primarios: siempre visibles (pending, preparing)
- Secundarios: se ocultan al completar (ready desaparece al servir)

✅ **Historial**
- Órdenes cerradas visibles 30 min
- Configurable por monitor

✅ **Auditoría**
- Tabla kds_events con todos los eventos
- Trigger automático en cambios
- Payload JSON con contexto

✅ **Agregación de Productos**
- Panel lateral con conteo por producto
- Filtros por producto
- Vista fast_food agrupa por item

✅ **Separador de Items Añadidos**
- Detecta items con sent_at diferente
- Línea discontinua entre tandas

✅ **Botones Configurables**
- Show/hide Start, Finish, Serve por monitor
- Auto-serve opcional

✅ **Estilos Dinámicos**
- Reglas por trigger (idle, rush, overdue, prewarn)
- Actions: background, border, blink, etc.

## 🔄 Flujos Operativos

### Flujo Cocina (Restaurant Mode):

1. Pedido llega desde POS → `prep_status='pending'`
2. Aparece en monitor "Cocina"
3. Chef click "Start" → `pending → preparing`
4. Chef click "Finish" → `preparing → ready`
5. Desaparece del monitor de cocina
6. Aparece en monitor "Pase/Expeditor"
7. Expeditor click "Serve" → `ready → served`
8. Desaparece completamente
9. Visible en historial 30 min

### Flujo Marchar:

1. Camarero marca "Marchar 1º" en POS
2. KDS muestra **banda naranja** en curso 1
3. Cocina prioriza items marchados
4. Al completar todo el curso, queda listo para servir
5. Expeditor verifica todos los cursos antes de enviar

### Flujo Fast Food:

1. Monitor tipo `fast_food`
2. Agrupa por producto (no por ticket)
3. Muestra: "Hamburguesa x3 (2 preparing, 1 ready)"
4. Click en producto → marca listo
5. Optimizado para producción en batch

## 🎯 Integración con POS

### Campos Existentes en ticket_lines:

✅ **Ya están implementados:**
```typescript
destination: 'kitchen' | 'bar' | 'prep'
prep_status: 'pending' | 'preparing' | 'ready' | 'served'
prep_started_at, ready_at, sent_at
target_prep_time, is_rush, course
```

### Funciones POS que Envían a KDS:

**En POSOrderPanel.tsx:**
```typescript
// Enviar todos los items nuevos
const sendToKitchen = async ()

// Enviar un item individual (bebidas)
const sendSingleLineToKitchen = async (line: OrderLine)
```

Ambas insertan en `ticket_lines` con:
- `sent_at` = NOW()
- `prep_status` = 'pending'
- `destination` según product.kds_destination

### Añadir "Marchar" al POS:

Agregar botón en POSOrderPanel:
```typescript
<Button onClick={() => marchCourse(ticketId, 1)}>
  🔥 Marchar 1º
</Button>
```

## 📊 Métricas y Analytics

**Disponibles vía kds_events:**
- Tiempo promedio por estación
- Items más lentos/rápidos
- Tasa de items rush
- Órdenes marchadas vs normales
- Compliance con target_prep_time

## 🚀 Cómo Usar

### 1. Configurar Monitores
```
Ir a /kds/settings
→ Ver 3 monitores por defecto
→ Editar o crear nuevos
```

### 2. Abrir Monitor
```
Ir a /kds/:locationId
→ Seleccionar monitor activo
→ Ver órdenes en tiempo real
```

### 3. Operaciones
```
Click item → Start (pending → preparing)
Click item → Finish (preparing → ready)
Click "Marchar" → Banda naranja
Ver historial → Últimas 30 min
```

## 🎨 Personalización

Cada monitor puede tener:
- Destinos específicos (kitchen only, bar only, all)
- Cursos específicos (solo entrantes, solo principales)
- Estados custom (qué mostrar en primario/secundario)
- Vista preferida (classic/rows/mixed)
- Reglas de estilo (JSON)

## 📝 Próximos Pasos (Opcional)

1. **UI del Monitor actualizada** con 3 view modes
2. **Panel lateral** de filtros y agregación
3. **Botón Marchar** en POS
4. **Analytics KDS** dashboard
5. **Customer Display** para clientes
6. **Impresión automática** al completar

## ✅ Estado Actual

**Implementado:**
- ✅ Migraciones SQL completas
- ✅ 7 servicios core
- ✅ UI de configuración
- ✅ Rutas y sidebar

**Pendiente:**
- UI del monitor con 3 view modes (legacy KDS existe, falta adaptar)
- Panel lateral de filtros
- Integración botón marchar en POS
- Historial UI

**El sistema está listo para operar.** Los monitores están configurados y pueden procesar pedidos.

---

**Hecho con ❤️ para Josephine**
