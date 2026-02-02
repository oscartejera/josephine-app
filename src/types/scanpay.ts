/**
 * Scan&Pay Module - Type Definitions
 * Sistema completo de pago por QR tipo Ágora
 */

// ============= Bill (Cuenta) =============

export interface BillItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number; // Porcentaje (ej: 10 para 10%)
  subtotal: number; // qty * unit_price
  tax_amount: number; // subtotal * (tax_rate/100)
  total: number; // subtotal + tax_amount
}

export interface Bill {
  id: string;
  operation_number: string; // Número de operación visible
  location_id: string;
  table_name: string | null;
  waiter_name: string | null;
  items: BillItem[];
  subtotal: number; // Suma de items subtotals
  tax_total: number; // Suma de taxes
  total: number; // subtotal + tax_total
  amount_paid: number; // Lo que se ha pagado hasta ahora
  amount_due: number; // Lo que queda por pagar (total - amount_paid)
  status: BillStatus;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  voided_at: string | null;
}

export type BillStatus = 'open' | 'partially_paid' | 'paid' | 'void';

// ============= Scan Token =============

export interface ScanToken {
  token: string; // UUID o hash seguro
  bill_id: string;
  expires_at: string;
  created_at: string;
  used_at: string | null;
  is_active: boolean;
}

// ============= Payment =============

export interface Payment {
  id: string;
  bill_id: string;
  amount: number; // Monto base del pago
  tip_amount: number; // Propina
  total_amount: number; // amount + tip_amount
  method: PaymentMethod;
  status: PaymentStatus;
  provider_reference: string | null; // Payment intent ID, etc.
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export type PaymentMethod = 'apple_pay' | 'google_pay' | 'card' | 'demo';

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

// ============= Settings =============

export interface ScanPaySettings {
  id: string;
  location_id: string | null; // null = global
  enabled: boolean;
  currency: string;
  allow_partial_payment: boolean;
  allow_tip: boolean;
  tip_presets: number[]; // Ej: [5, 10, 15, 20]
  payment_mode: 'demo' | 'stripe' | 'both';
  stripe_publishable_key: string | null;
  qr_expiry_hours: number;
  require_waiter_pin: boolean; // Si requiere PIN del camarero para generar QR
  auto_print_receipt: boolean;
  created_at: string;
  updated_at: string;
}

// ============= API Inputs =============

export interface CreateBillInput {
  location_id: string;
  table_name?: string;
  waiter_name?: string;
  items: {
    name: string;
    quantity: number;
    unit_price: number;
    tax_rate?: number;
  }[];
}

export interface CreatePaymentInput {
  bill_id: string;
  amount: number; // Puede ser parcial
  tip_amount?: number;
  method: PaymentMethod;
  payment_method_id?: string; // Para Stripe
}

export interface GenerateQRInput {
  bill_id: string;
  expiry_hours?: number;
}

// ============= QR Code Data =============

export interface QRCodeData {
  url: string; // La URL completa para escanear
  token: string;
  expires_at: string;
}

// ============= Invoice/Receipt =============

export interface Invoice {
  bill_id: string;
  operation_number: string;
  date: string;
  location_name: string;
  table_name: string | null;
  waiter_name: string | null;
  items: BillItem[];
  subtotal: number;
  tax_total: number;
  total: number;
  payments: {
    method: string;
    amount: number;
    tip: number;
    date: string;
  }[];
  total_paid: number;
}
