# Módulo Scan & Pay - Josephine

Sistema completo de pago por QR tipo Ágora Scan&Pay.

## 🎯 Funcionalidad

Permite a los clientes **pagar su cuenta escaneando un código QR**, sin necesidad de login, con soporte para:
- Múltiples métodos de pago (Apple Pay, Google Pay, Tarjeta)
- Pago parcial
- Propinas configurables
- Factura digital

## 🔄 Flujo Completo (Cliente)

### 1️⃣ Escanear QR
El cliente escanea el QR impreso en el ticket/recibo → abre `/scan-pay/:token`

### 2️⃣ Revisar Cuenta
Pantalla muestra:
- ✅ Operación #
- ✅ Fecha y hora
- ✅ Camarero
- ✅ Lista de items (nombre, cantidad, precio)
- ✅ Totales: Base, IVA, Total
- ✅ Botón sticky: **"PAGAR €XX,XX"**

Si cuenta ya pagada → muestra estado "Ya pagada" y deshabilita pago

### 3️⃣ Seleccionar Método de Pago
- 📱 Apple Pay
- 📱 Google Pay
- 💳 Tarjeta de Crédito

**Opciones adicionales:**
- 💰 Propina (presets: 5%, 10%, 15%, 20% + custom)
- 📊 Pago Parcial (ingresar cantidad menor al total)

### 4️⃣ Confirmar y Pagar
Click "PAGAR €XX.XX" → procesamiento → éxito

### 5️⃣ Pantalla de Éxito
- ✅ "Pago Completado"
- 📄 Botón "Descargar Factura"
- Número de operación
- Total pagado

## 🖥️ Flujo Admin (Staff)

### En `/scanpay`:
1. Ver tabla con todas las cuentas (open, partially_paid, paid)
2. Click botón "QR" → Genera código QR
3. QR se puede imprimir o mostrar en pantalla
4. URL del QR: `/scan-pay/:token` (válido 24h)

## 🏗️ Arquitectura

```
src/
├── types/
│   └── scanpay.ts                    # Tipos completos
├── services/
│   └── scanpay/
│       ├── in-memory-repository.ts   # Data layer InMemory
│       ├── seed-data.ts              # 3 bills demo
│       ├── token-service.ts          # QR token generation
│       ├── billing-service.ts        # Bill management
│       ├── payments-service.ts       # Payment processing
│       └── providers/
│           ├── demo-provider.ts      # Mock payments
│           └── stripe-provider.ts    # Stripe (preparado)
└── pages/
    └── scanpay/
        ├── ScanPayPublic.tsx         # UI pública (/scan-pay/:token)
        └── ScanPayAdmin.tsx          # UI admin (/scanpay)
```

## 🚀 Cómo Usar

### Modo Demo (Funciona Ya)

1. **Entrar como usuario logueado** a `/scanpay`
2. **Ver las 3 cuentas demo**:
   - OP-00001234: €58.30 pendiente
   - OP-00001235: €56.05 pendiente (parcialmente pagada)
   - OP-00001236: €80.30 (ya pagada)
3. **Click "QR"** en una cuenta abierta
4. **Copiar URL** o click "Abrir en Nueva Pestaña"
5. **En la pestaña nueva** (modo público):
   - Ver cuenta
   - Click "PAGAR"
   - Seleccionar método
   - Añadir propina (opcional)
   - Confirmar pago
   - Ver pantalla de éxito
   - Descargar factura

### Activar Stripe (Producción)

1. **Obtener API keys** de Stripe Dashboard

2. **Configurar variables de entorno**:
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

3. **En settings de Scan&Pay** (cuando esté la UI):
```typescript
{
  payment_mode: 'stripe', // Cambiar de 'demo' a 'stripe'
  stripe_publishable_key: process.env.VITE_STRIPE_PUBLISHABLE_KEY
}
```

4. **Instalar Stripe SDK** (si no está):
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

5. **Implementar integration** en `stripe-provider.ts`:
```typescript
import { loadStripe } from '@stripe/stripe-js';
// ... implementar processPayment real
```

## 🎨 Datos Demo

### Bills (Cuentas):
- **OP-00001234** - Mesa 5, María García, €58.30
- **OP-00001235** - Mesa 12, Carlos López, €116.05 (€60 pagados)
- **OP-00001236** - Terraza 3, Ana Rodríguez, €80.30 (pagada)

### Tokens válidos:
- `sp_demo_token_1` → Bill OP-00001234

## ⚙️ Configuración

```typescript
ScanPaySettings {
  enabled: true,
  currency: 'EUR',
  allow_partial_payment: true,
  allow_tip: true,
  tip_presets: [5, 10, 15, 20],
  payment_mode: 'demo', // o 'stripe'
  qr_expiry_hours: 24,
}
```

## 🧪 Testing

### Test Manual:
1. Ir a `/scanpay` (logueado)
2. Click "QR" en cuenta abierta
3. Abrir URL generada en incógnito
4. Completar flujo de pago
5. Verificar éxito

### Test de Estados:
- Cuenta abierta → permite pagar
- Cuenta parcialmente pagada → muestra pendiente, permite pagar resto
- Cuenta pagada → muestra "Ya pagada", deshabilita botón

## 📊 Métricas

En Analytics (futuro) se pueden agregar:
- Pagos por método (Apple Pay vs Google Pay vs Card)
- Tiempo promedio de pago
- Tasa de éxito de pagos
- Propinas promedio
- Uso de pago parcial

## 🔒 Seguridad

- ✅ Tokens con expiración (24h default)
- ✅ Tokens de un solo uso (opcional)
- ✅ Validación de bill_id en cada request
- ✅ HTTPS obligatorio en producción
- ✅ Rate limiting (implementar en backend)

## 📝 Próximos Pasos (Opcional)

1. **Generar QR real** con librería `qrcode` o `react-qr-code`
2. **PDF de factura** con `@react-pdf/renderer` o `jspdf`
3. **WhatsApp share** para enviar factura
4. **Email receipt** automático
5. **Integración real con Stripe**
6. **Webhooks** para confirmaciones
7. **Analytics** de uso de Scan&Pay

## 🎁 Features Incluidas

✅ Ruta pública (sin auth) para `/scan-pay/:token`
✅ 3 pantallas (Review → Payment → Success)
✅ Soporte multi-método (Apple/Google/Card)
✅ Propinas configurables con presets
✅ Pago parcial funcional
✅ Demo provider que siempre funciona
✅ UI admin para generar QRs
✅ Item en sidebar "Scan & Pay"

---

**Hecho con ❤️ para Josephine**
