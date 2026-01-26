

## Plan: Carta Italiana Profesional con Imágenes y Grid Optimizada

### Resumen del Problema

1. **Grid de productos muy pequeña**: Altura fija de `h-48` (192px) que hace imposible seleccionar rápidamente
2. **Sin fotos de productos**: La tabla `products` no tiene campo de imagen
3. **Sin precios reales**: Todos los productos tienen precio hardcodeado a €10.00
4. **Carta actual no es italiana**: Los productos existentes son de cocina española

---

### Solución Propuesta

#### 1. Ampliar Base de Datos

Añadir columnas a la tabla `products`:
- `image_url` (TEXT) - URL de imagen del producto
- `price` (NUMERIC) - Precio del producto
- `description` (TEXT) - Descripción corta (opcional)

#### 2. Insertar Carta Italiana Completa

Crear productos con sentido para un restaurante italiano:

| Categoría | Productos |
|-----------|-----------|
| **Bebidas** | Acqua naturale, Coca-Cola, Birra Moretti, Vino della casa, Caffè espresso |
| **Antipasti** | Bruschetta al pomodoro, Carpaccio di manzo, Burrata con prosciutto, Caprese |
| **Primi** | Spaghetti carbonara, Penne all'arrabbiata, Lasagna bolognese, Risotto ai funghi, Gnocchi al pesto |
| **Secondi** | Saltimbocca alla romana, Ossobuco, Pollo alla parmigiana, Branzino al forno |
| **Pizze** | Margherita, Quattro formaggi, Diavola, Capricciosa, Prosciutto e funghi |
| **Dolci** | Tiramisù, Panna cotta, Cannoli siciliani, Gelato artigianale |

Cada producto con:
- Nombre en italiano auténtico
- Precio realista (€3-25)
- Imagen generada con AI
- Destino KDS correcto (bebidas → bar, comida → kitchen)

#### 3. Rediseñar Grid de Productos

**Layout actual (problemático):**
```text
┌─────────────────────────────┐
│ Mesa 4 • [Cursos]           │
├─────────────────────────────┤
│ [Grid pequeña h-48 = 192px] │ ← MUY PEQUEÑA
│ [solo caben 6 productos]    │
├─────────────────────────────┤
│ [Lista de líneas - grande]  │
├─────────────────────────────┤
│ [Totales + Cobrar]          │
└─────────────────────────────┘
```

**Nuevo layout (optimizado):**
```text
┌─────────────────────────────┐
│ Mesa 4 • [Cursos]           │
├─────────────────────────────┤
│ [Grid GRANDE = flex-1]      │ ← MITAD DE PANTALLA
│ Tarjetas con:               │
│  - Foto circular/cuadrada   │
│  - Nombre visible           │
│  - Precio destacado         │
├─────────────────────────────┤
│ [Lista compacta de líneas]  │ ← Más compacta
├─────────────────────────────┤
│ [Cobrar €XX.XX]             │
└─────────────────────────────┘
```

---

### Diseño Visual de Tarjetas de Producto

```text
┌──────────────┐
│   [FOTO]     │  ← Imagen 64x64 o 80x80
│   circular   │
├──────────────┤
│ Margherita   │  ← Nombre (2 líneas max)
│   €9.50      │  ← Precio destacado
└──────────────┘
```

- Tarjetas cuadradas tipo "aspect-square"
- Foto del producto arriba
- Nombre centrado
- Precio en color primario
- Animación de press feedback

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/` | Añadir columnas `image_url`, `price`, `description` a `products` |
| `supabase/migrations/` | INSERT de ~30 productos italianos con URLs de imagen |
| `src/hooks/usePOSData.ts` | Actualizar query para traer `price`, `image_url` |
| `src/components/pos/POSProductGrid.tsx` | Rediseño completo con imágenes y layout grande |
| `src/components/pos/POSOrderPanel.tsx` | Cambiar `h-48` por altura dinámica `flex-1` |

---

### Sección Técnica

#### Migración SQL - Nuevas columnas

```sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;
```

#### Productos Italianos de Ejemplo (INSERT)

```sql
-- Bebidas (kds_destination = 'bar')
INSERT INTO products (location_id, name, category, price, image_url, kds_destination, is_active)
VALUES 
  ('7b6f18b7-...', 'Acqua Naturale', 'Bevande', 2.50, 'https://...', 'bar', true),
  ('7b6f18b7-...', 'Birra Moretti', 'Bevande', 4.50, 'https://...', 'bar', true),
  -- ... más bebidas

-- Antipasti (kds_destination = 'kitchen')
INSERT INTO products (...)
VALUES 
  ('7b6f18b7-...', 'Bruschetta al pomodoro', 'Antipasti', 7.50, 'https://...', 'kitchen', true),
  -- ... más antipasti

-- Pizze, Primi, Secondi, Dolci...
```

Las imágenes se generarán usando la API de generación de imágenes AI (google/gemini-2.5-flash-image) y se subirán al bucket de storage.

#### POSProductGrid Rediseñado

```tsx
// Tarjeta con imagen
<button className="aspect-square p-2 rounded-xl border-2 ...">
  <div className="w-16 h-16 mx-auto rounded-full overflow-hidden bg-muted mb-2">
    {product.image_url ? (
      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
    ) : (
      <ShoppingBag className="w-8 h-8 m-auto text-muted-foreground" />
    )}
  </div>
  <span className="text-sm font-medium line-clamp-2 text-center">{product.name}</span>
  <span className="text-sm font-bold text-primary">€{product.price.toFixed(2)}</span>
</button>
```

#### POSOrderPanel - Layout Balance

```tsx
// Antes: <div className="h-48 border-b ...">
// Después:
<div className="flex-1 min-h-0 border-b border-border">
  <POSProductGrid products={products} onProductClick={handleProductClick} />
</div>

// Lista de líneas más compacta:
<ScrollArea className="h-[30vh] shrink-0">
  ...
</ScrollArea>
```

---

### Resultado Final

El camarero verá:
1. **Grid grande** con productos visuales fáciles de tocar
2. **Fotos de platos** que ayudan a identificar rápidamente
3. **Precios reales** de un restaurante italiano
4. **Categorías coherentes**: Bevande, Antipasti, Primi, Secondi, Pizze, Dolci
5. **Lista de pedido compacta** pero funcional

