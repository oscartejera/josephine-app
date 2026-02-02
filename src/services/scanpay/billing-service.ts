/**
 * Billing Service
 * Gestiona cuentas y aplicación de pagos
 */

import type { ScanPayDataLayer } from './in-memory-repository';
import type { Bill, CreateBillInput, Invoice } from '@/types/scanpay';

export class BillingService {
  constructor(private dataLayer: ScanPayDataLayer) {}

  async getBillByToken(token: string): Promise<Bill | null> {
    const scanToken = await this.dataLayer.tokens.findByToken(token);
    if (!scanToken || !scanToken.is_active) {
      return null;
    }

    // Check expiry
    if (new Date(scanToken.expires_at) < new Date()) {
      return null;
    }

    return this.dataLayer.bills.findById(scanToken.bill_id);
  }

  async createBill(input: CreateBillInput): Promise<Bill> {
    return this.dataLayer.bills.create(input);
  }

  async applyPayment(billId: string, paymentAmount: number): Promise<Bill> {
    return this.dataLayer.bills.applyPayment(billId, paymentAmount);
  }

  async generateInvoice(billId: string): Promise<Invoice> {
    const bill = await this.dataLayer.bills.findById(billId);
    if (!bill) throw new Error('Bill not found');

    const payments = await this.dataLayer.payments.findByBill(billId);
    const successfulPayments = payments.filter(p => p.status === 'succeeded');

    return {
      bill_id: bill.id,
      operation_number: bill.operation_number,
      date: bill.created_at,
      location_name: 'Josephine', // En producción vendría de location
      table_name: bill.table_name,
      waiter_name: bill.waiter_name,
      items: bill.items,
      subtotal: bill.subtotal,
      tax_total: bill.tax_total,
      total: bill.total,
      payments: successfulPayments.map(p => ({
        method: p.method,
        amount: p.amount,
        tip: p.tip_amount,
        date: p.completed_at || p.created_at,
      })),
      total_paid: bill.amount_paid,
    };
  }
}
