/**
 * Scan&Pay Seed Data
 * Datos demo para testing
 */

import type { Bill, BillItem, ScanPaySettings } from '@/types/scanpay';

function createBillItem(name: string, qty: number, price: number, taxRate: number = 10): BillItem {
  const subtotal = qty * price;
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  return {
    id: `item-${Date.now()}-${Math.random()}`,
    name,
    quantity: qty,
    unit_price: price,
    tax_rate: taxRate,
    subtotal,
    tax_amount: taxAmount,
    total,
  };
}

export function generateDemoBills(locationId: string): Bill[] {
  const now = new Date().toISOString();

  return [
    {
      id: 'bill-demo-1',
      operation_number: 'OP-00001234',
      location_id: locationId,
      table_name: 'Mesa 5',
      waiter_name: 'María García',
      items: [
        createBillItem('Paella Valenciana', 2, 18.50),
        createBillItem('Ensalada Mixta', 1, 8.90),
        createBillItem('Coca Cola', 2, 2.50),
        createBillItem('Café con Leche', 2, 1.80),
      ],
      subtotal: 53.00,
      tax_total: 5.30,
      total: 58.30,
      amount_paid: 0,
      amount_due: 58.30,
      status: 'open',
      created_at: now,
      updated_at: now,
      paid_at: null,
      voided_at: null,
    },
    {
      id: 'bill-demo-2',
      operation_number: 'OP-00001235',
      location_id: locationId,
      table_name: 'Mesa 12',
      waiter_name: 'Carlos López',
      items: [
        createBillItem('Chuletón de Buey', 2, 32.00),
        createBillItem('Vino Tinto Reserva', 1, 24.00),
        createBillItem('Pan y Alioli', 1, 2.50),
        createBillItem('Coulant de Chocolate', 2, 7.50),
      ],
      subtotal: 105.50,
      tax_total: 10.55,
      total: 116.05,
      amount_paid: 60.00,
      amount_due: 56.05,
      status: 'partially_paid',
      created_at: now,
      updated_at: now,
      paid_at: null,
      voided_at: null,
    },
    {
      id: 'bill-demo-3',
      operation_number: 'OP-00001236',
      location_id: locationId,
      table_name: 'Terraza 3',
      waiter_name: 'Ana Rodríguez',
      items: [
        createBillItem('Hamburguesa Premium', 3, 14.50),
        createBillItem('Patatas Fritas', 3, 4.50),
        createBillItem('Cerveza', 3, 3.00),
        createBillItem('Tiramisú', 1, 6.50),
      ],
      subtotal: 73.00,
      tax_total: 7.30,
      total: 80.30,
      amount_paid: 80.30,
      amount_due: 0,
      status: 'paid',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString(),
      paid_at: new Date(Date.now() - 1800000).toISOString(),
      voided_at: null,
    },
  ];
}

export function getDemoSettings(locationId: string): ScanPaySettings {
  return {
    id: `settings-${locationId}`,
    location_id: locationId,
    enabled: true,
    currency: 'EUR',
    allow_partial_payment: true,
    allow_tip: true,
    tip_presets: [5, 10, 15, 20],
    payment_mode: 'demo',
    stripe_publishable_key: null,
    qr_expiry_hours: 24,
    require_waiter_pin: false,
    auto_print_receipt: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function getAllScanPaySeedData(locationId: string) {
  return {
    bills: generateDemoBills(locationId),
    settings: getDemoSettings(locationId),
  };
}
