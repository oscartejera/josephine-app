

## Plan: Simplificar Sistema de Envío a Cocina (UX Profesional)

### Problema Detectado
Actualmente hay **redundancia confusa** en la UI:
- Botón "Cocina" (parte inferior) → envía TODO
- Botón "Enviar" en cada curso → envía solo ese curso

Esto viola el principio de simplicidad que buscas para Josephine.

---

### Propuesta: Un Solo Flujo Inteligente (Estilo Toast/Square)

**Eliminar el botón "Cocina" global** y mantener SOLO el envío por curso, porque:
1. Es el flujo natural de un restaurante (entrantes primero, luego platos)
2. Un solo punto de acción por curso = menos confusión
3. El botón de curso cambia dinámicamente según el estado

---

### Diseño Visual Simplificado

```text
┌────────────────────────────────────────┐
│  Mesa 4 • Curso: [1º] [2º] [🍰]        │
├────────────────────────────────────────┤
│                                        │
│  🟢 1º Curso            [Enviar 1º ➜]  │  ← Si tiene items pendientes
│    • Ensalada x1                       │
│    • Croquetas x2                      │
│                                        │
│  🔵 2º Curso                           │  ← Sin botón (vacío o todo enviado)
│    (Sin items)                         │
│                                        │
├────────────────────────────────────────┤
│  Subtotal            €24.50            │
│  IVA                  €2.45            │
│  Total               €26.95            │
├────────────────────────────────────────┤
│                                        │
│  [🍽️ Servir Mesa]      ← Solo si hay   │
│                          items ready   │
│                                        │
│  [💳 Cobrar €26.95]                    │
│                                        │
└────────────────────────────────────────┘
```

---

### Cambios Concretos

#### POSOrderPanel.tsx

**1. ELIMINAR** el botón "Cocina" de la sección de acciones (líneas 896-903):
```tsx
// ELIMINAR ESTO:
<Button variant="outline" onClick={sendToKitchen} ...>
  <Printer /> Cocina
</Button>
```

**2. MEJORAR** el botón de curso para que sea más visible:
- Hacer el botón más grande y prominente dentro del header de curso
- Cambiar texto de "Enviar" a "Enviar 1º ➜" (más claro)
- Añadir animación sutil para llamar la atención

**3. AJUSTAR** la zona de acciones inferior:
- Solo mostrar "Servir Mesa" cuando hay items ready
- Botón "Cobrar" siempre visible y destacado
- Eliminar el grid de 2 columnas (ya no hay 2 botones)

---

### Flujo Simplificado Final

```text
1. Camarero añade entrantes (curso 1)
2. Toca "Enviar 1º ➜" en el header del curso
3. Añade segundos (curso 2)  
4. Cuando cliente termina entrantes → "Enviar 2º ➜"
5. KDS marca todo como ready → aparece "Servir Mesa"
6. Al terminar → "Cobrar"
```

**Solo 4 acciones posibles**, siempre visibles en contexto:
- **Enviar curso X** (aparece solo si hay items pendientes en ese curso)
- **Servir Mesa** (aparece solo cuando KDS dice "ready")
- **Cobrar** (siempre visible)
- **Cerrar panel** (X)

---

### Comparativa

| Antes (Confuso) | Después (Simple) |
|-----------------|------------------|
| Botón "Cocina" + botones por curso | Solo botones por curso |
| ¿Cuál uso? | Obvio: el del curso actual |
| 2 clics posibles para lo mismo | 1 clic, en contexto |

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/pos/POSOrderPanel.tsx` | Eliminar botón "Cocina", ajustar layout inferior |

---

### Sección Técnica

**Cambios específicos en POSOrderPanel.tsx:**

1. **Líneas 895-903**: Eliminar el `<Button variant="outline" onClick={sendToKitchen}>` completamente

2. **Líneas 881-922**: Simplificar la sección de acciones:
```tsx
<div className="p-4 border-t border-border space-y-2 shrink-0">
  {/* Servir - solo si hay items ready */}
  {hasReadyItems && (
    <Button className="w-full bg-emerald-600 ...">
      Servir Mesa
    </Button>
  )}
  
  {/* Cobrar - siempre visible, full width */}
  <Button className="w-full" onClick={...}>
    <CreditCard /> Cobrar €{total.toFixed(2)}
  </Button>
</div>
```

3. **Líneas 687-740**: Mejorar visibilidad del botón de envío por curso:
```tsx
<Button
  variant="default"  // Más visible que "ghost"
  size="sm"
  className={cn("gap-1", courseConfig.bgClass, "text-white")}
  onClick={...}
>
  <Send className="h-3.5 w-3.5" />
  Enviar {courseConfig.shortLabel} ➜
</Button>
```

**Nota:** La función `sendToKitchen()` se mantiene en el código por si se necesita en el futuro, pero no tendrá botón asociado.

