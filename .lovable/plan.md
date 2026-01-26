

# Plan: Módulo Fiscal para Josephine

## Resumen Ejecutivo

Crearemos un módulo fiscal completo que aprovechará los datos existentes del POS (ventas) y Procurement (compras) para calcular automáticamente el IVA, gestionar facturas y preparar las declaraciones trimestrales (Modelo 303).

---

## Arquitectura del Módulo

```text
+---------------------+     +------------------+     +------------------+
|    POS (Ventas)     |---->|                  |     |                  |
|  - tickets          |     |   FISCAL MODULE  |---->|  Modelo 303      |
|  - ticket_lines     |     |                  |     |  (Export AEAT)   |
+---------------------+     |  - IVA Dashboard |     +------------------+
                            |  - Invoice Ledger|
+---------------------+     |  - Alerts        |     +------------------+
|  Procurement        |---->|  - Calendar      |---->|  Gastos/Compras  |
|  - purchase_orders  |     +------------------+     |  (IVA Soportado) |
|  - purchase_lines   |                              +------------------+
+---------------------+
```

---

## Funcionalidades Principales

### 1. Dashboard Fiscal Principal
- **KPI Cards**: IVA Repercutido (ventas), IVA Soportado (compras), IVA a Pagar, Próximo Vencimiento
- **Gráfico temporal**: Evolución mensual de IVA
- **Alertas**: Fechas límite de declaración (20 de abril, julio, octubre, enero)
- **Filtros**: Por trimestre, por local

### 2. Calculadora de IVA Automática
- Agregación de IVA por tipo impositivo (21%, 10%, 4%)
- Ventas desde `tickets` + `ticket_lines` (tax_rate)
- Compras desde `purchase_orders` + `purchase_order_lines`
- Desglose por categoría de producto

### 3. Libro de Facturas (Invoice Ledger)
- Tabla con todas las facturas emitidas y recibidas
- Subida de facturas de proveedor (PDF)
- OCR opcional para extracción automática (fase 2)
- Estado: Pendiente, Contabilizada, Pagada

### 4. Generador Modelo 303
- Cálculo automático de casillas principales
- Vista previa del formulario
- Exportación en formato compatible AEAT
- Histórico de declaraciones

### 5. Calendario Fiscal
- Vista mensual con fechas límite
- Recordatorios configurables
- Integración con alertas del sistema

---

## Cambios en Base de Datos

### Nuevas Tablas

**fiscal_periods** - Control de trimestres fiscales
```sql
CREATE TABLE fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id),
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'submitted')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**fiscal_invoices** - Registro de facturas (emitidas y recibidas)
```sql
CREATE TABLE fiscal_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id),
  location_id UUID REFERENCES locations(id),
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('issued', 'received')),
  supplier_name TEXT,
  customer_name TEXT,
  base_amount NUMERIC(12,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL,
  tax_amount NUMERIC(12,2) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accounted', 'paid')),
  document_url TEXT,
  ticket_id UUID REFERENCES tickets(id),
  purchase_order_id UUID REFERENCES purchase_orders(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**fiscal_model303** - Histórico de declaraciones
```sql
CREATE TABLE fiscal_model303 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id),
  fiscal_period_id UUID REFERENCES fiscal_periods(id),
  base_21 NUMERIC(12,2) DEFAULT 0,
  iva_21 NUMERIC(12,2) DEFAULT 0,
  base_10 NUMERIC(12,2) DEFAULT 0,
  iva_10 NUMERIC(12,2) DEFAULT 0,
  base_4 NUMERIC(12,2) DEFAULT 0,
  iva_4 NUMERIC(12,2) DEFAULT 0,
  total_repercutido NUMERIC(12,2) DEFAULT 0,
  total_soportado NUMERIC(12,2) DEFAULT 0,
  result NUMERIC(12,2) DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  confirmation_code TEXT
);
```

---

## Nuevos Archivos Frontend

### Página Principal
- `src/pages/Fiscal.tsx` - Dashboard fiscal principal

### Componentes
- `src/components/fiscal/FiscalHeader.tsx` - Header con filtros y acciones
- `src/components/fiscal/FiscalKPICards.tsx` - Tarjetas de métricas de IVA
- `src/components/fiscal/IVABreakdownChart.tsx` - Gráfico de desglose por tipo
- `src/components/fiscal/IVATrendChart.tsx` - Evolución temporal
- `src/components/fiscal/InvoiceLedgerTable.tsx` - Tabla de facturas
- `src/components/fiscal/UploadInvoiceDialog.tsx` - Modal para subir facturas
- `src/components/fiscal/Model303Preview.tsx` - Vista previa del modelo
- `src/components/fiscal/FiscalCalendar.tsx` - Calendario con deadlines
- `src/components/fiscal/FiscalAlertBanner.tsx` - Banner de alertas
- `src/components/fiscal/index.ts` - Barrel export

### Hook de Datos
- `src/hooks/useFiscalData.ts` - Agregación de datos fiscales desde POS y Procurement

---

## Navegación

Se añadirá como nueva sección principal en el sidebar (fuera de Insights), dado que es un módulo operativo crítico:

```typescript
// En AppSidebar.tsx, después de Payroll
{ icon: Receipt, label: 'Fiscal', path: '/fiscal', key: 'fiscal' }
```

**Ruta en App.tsx:**
```typescript
<Route path="/fiscal" element={<Fiscal />} />
```

---

## Fases de Implementación

### Fase 1: MVP (Esta implementación)
1. Crear tablas de base de datos
2. Página Fiscal con Dashboard de KPIs
3. Cálculo automático de IVA desde tickets
4. Tabla de facturas básica
5. Vista previa del Modelo 303

### Fase 2: Mejoras (Futuro)
- OCR para facturas de proveedor
- Exportación formato AEAT
- Integración con el "Compliance Gateway" existente
- Alertas por email de fechas límite
- Modelo 347 (operaciones > 3.005€)

---

## Sección Técnica

### Cálculo de IVA desde Datos Existentes

**IVA Repercutido (Ventas):**
```sql
SELECT 
  COALESCE(tl.tax_rate, 10) as tax_rate,
  SUM(tl.gross_line_total - tl.discount_line_total) as base,
  SUM((tl.gross_line_total - tl.discount_line_total) * COALESCE(tl.tax_rate, 10) / 100) as iva
FROM tickets t
JOIN ticket_lines tl ON tl.ticket_id = t.id
WHERE t.status = 'closed'
  AND t.closed_at BETWEEN :start AND :end
  AND t.location_id IN (:locations)
GROUP BY COALESCE(tl.tax_rate, 10)
```

**IVA Soportado (Compras):**
```sql
SELECT 
  COALESCE(pol.tax_rate, 10) as tax_rate,
  SUM(pol.quantity * pol.unit_price) as base,
  SUM(pol.quantity * pol.unit_price * COALESCE(pol.tax_rate, 10) / 100) as iva
FROM purchase_orders po
JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id
WHERE po.status IN ('received', 'sent')
  AND po.created_at BETWEEN :start AND :end
GROUP BY COALESCE(pol.tax_rate, 10)
```

### Permisos
Se añadirá la clave `fiscal` al sistema de permisos existente, visible para roles: `owner`, `admin`, `finance`.

### Integración con Sistema Existente
- Reutilizará `DateRangePickerNoryLike` para filtros de fecha
- Seguirá el patrón de `useBudgetsData` para el hook de datos
- Usará los mismos componentes UI (Card, Table, Badge, etc.)
- Se integrará con el banner de alertas de `NotificationCenter`

