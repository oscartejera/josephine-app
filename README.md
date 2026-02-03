# Josephine - AI Operations Platform for Restaurants

Josephine es una plataforma de operaciones potenciada por IA para restaurantes, estilo Nory. **No es un POS** - se integra con sistemas POS existentes y proporciona inteligencia operativa.

## 🎯 Qué es Josephine

Josephine conecta con tu POS actual (Square, Lightspeed, Oracle Simphony, etc.) y proporciona:

- **Forecast automático** de ventas, covers y demanda
- **Recomendaciones AI** accionables (staff, compras, menú)
- **Insights unificados** de múltiples fuentes
- **Optimización automática** de turnos, inventario y menú

## 🏗️ Arquitectura

```
External POS (Square, etc.)
    ↓
OAuth + Webhooks
    ↓
Josephine Integrations Layer
    ↓
Canonical Data Model (CDM)
    ↓
Feature Store (facts tables)
    ↓
AI/Forecast Engine (Prophet + LLM)
    ↓
Recommendations + Actions
    ↓
UI Dashboard
```

## 📦 Módulos

### 🔌 Integrations
- **Square POS**: OAuth, webhooks, sync incremental
- **Próximamente**: Lightspeed, Oracle Simphony, Toast, Clover
- **CDM**: Modelo canónico de datos (locations, items, orders, payments)
- **Idempotent**: Deduplicación automática de eventos

### 📊 Insights
- **Sales**: Análisis de ventas con trends
- **Labour**: Costos laborales y eficiencia
- **Instant P&L**: P&L en tiempo real con alertas
- **Reviews**: Agregación de reseñas
- **Inventory**: Niveles de stock y rotación
- **Waste**: Estimación y tracking de merma
- **Menu Engineering**: Mix, márgenes, recomendaciones
- **Cash Management**: Control de efectivo
- **Budgets**: Planificación y seguimiento

### 🤖 AI Operations
- **Feature Store**: Agregaciones 15min, daily, item mix
- **Forecast Engine**: Prophet API + statistical fallback
- **Recommendations**: AI-generated con rationale
- **Actions**: Approve/Auto con guardrails
- **Impact Measurement**: Before/after tracking

### 👥 Workforce
- **Scheduling**: Generación optimizada de turnos
- **Availability**: Gestión de disponibilidad
- **Payroll**: Timesheets + export (no cálculo legal)

### 🛒 Procurement
- **Auto-ordering**: Sugerencias basadas en forecast
- **Vendor management**: Macro, proveedores locales
- **Safety stock**: Niveles óptimos
- **Lead times**: Optimización de pedidos

## 🚀 Quick Start

### 1. Conectar Square

```bash
# Ir a /integrations
# Click "Square POS"
# Click "Conectar con Square"
# Autorizar → Listo
```

### 2. Primera Sincronización

```bash
# En /integrations/square
# Click "Sincronizar Ahora"
# Esperar ~30s
# Ver stats: X ubicaciones, Y productos, Z pedidos
```

### 3. Ver Recommendations

```bash
# Dashboard muestra cards AI:
# "Ajuste de Personal: +2 staff sábado"
# "Pedido Sugerido: Salmón + Vino"
# Click Aprobar → Ejecuta acción
```

## 🔧 Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI/ML**: Prophet (Modal Labs) + Claude API
- **UI**: shadcn/ui + Tailwind CSS
- **Auth**: Supabase Auth
- **Realtime**: Supabase Realtime

## 📊 Data Flow

```
1. Square → webhook → raw_events (idempotent)
2. square-sync → CDM tables (normalized)
3. Triggers → facts tables (aggregated)
4. Prophet API → forecasts (time series)
5. AI engine → recommendations (actionable)
6. User approves → actions (executed)
7. Results measured → feedback loop
```

## 🎯 Value Proposition

**Josephine vs Traditional POS:**
- ❌ No hardware dependencies
- ✅ Works with any POS
- ✅ AI-powered insights
- ✅ Automated decision-making
- ✅ Unified data from multiple sources

**Josephine vs Spreadsheets:**
- ❌ No manual data entry
- ✅ Real-time sync
- ✅ Automatic forecasting
- ✅ Predictive recommendations
- ✅ Impact measurement

## 🔐 Security

- **Secrets**: Stored only in Supabase Secrets
- **RLS**: Row-level security on all tables
- **OAuth**: Secure token management
- **Encryption**: Tokens encrypted at rest
- **Audit**: Complete event log

## 📈 Roadmap

**Q1 2026:**
- ✅ Square integration
- ✅ CDM + Feature Store
- ✅ Prophet forecasting
- ✅ AI recommendations MVP

**Q2 2026:**
- [ ] Lightspeed + Toast integrations
- [ ] Advanced ML models (fine-tuned)
- [ ] Autopilot mode (auto-execute safe actions)
- [ ] Mobile app

**Q3 2026:**
- [ ] Multi-location rollups
- [ ] Benchmarking vs industry
- [ ] Custom AI models per restaurant

## 💡 Key Features

✅ **No Hardware**: Cloud-based, acceso desde cualquier dispositivo
✅ **Universal**: Funciona con Square, Toast, Lightspeed, Oracle, etc.
✅ **AI-First**: Prophet forecasts + LLM insights
✅ **Actionable**: Recommendations con approve/reject
✅ **Measurable**: Impact tracking automático
✅ **Scalable**: De 1 a 100+ locations
✅ **Real-time**: Sync continuo con POS

---

**Built with ❤️ for restaurant operators**

*Josephine: Your AI co-pilot for restaurant operations*
