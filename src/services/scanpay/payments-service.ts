/**
 * Payments Service
 * Procesa pagos con múltiples providers
 */

import type { ScanPayDataLayer } from './in-memory-repository';
import type { Payment, PaymentMethod, CreatePaymentInput } from '@/types/scanpay';

export interface PaymentProvider {
  processPayment(amount: number, method: PaymentMethod, metadata: any): Promise<{ success: boolean; reference?: string; error?: string }>;
  supportsMethod(method: PaymentMethod): boolean;
}

export class PaymentsService {
  constructor(
    private dataLayer: ScanPayDataLayer,
    private provider: PaymentProvider
  ) {}

  async processPayment(input: CreatePaymentInput): Promise<Payment> {
    // Create payment record
    const payment = await this.dataLayer.payments.create(input);

    try {
      // Process with provider
      const result = await this.provider.processPayment(
        input.amount + (input.tip_amount || 0),
        input.method,
        { bill_id: input.bill_id }
      );

      if (result.success) {
        // Mark as succeeded
        await this.dataLayer.payments.markAsSucceeded(payment.id, result.reference);

        // Apply payment to bill
        await this.dataLayer.bills.applyPayment(
          input.bill_id,
          input.amount + (input.tip_amount || 0)
        );

        return await this.dataLayer.payments.findById(payment.id) as Payment;
      } else {
        // Mark as failed
        await this.dataLayer.payments.markAsFailed(payment.id, result.error || 'Unknown error');
        throw new Error(result.error || 'Payment failed');
      }
    } catch (error) {
      await this.dataLayer.payments.markAsFailed(
        payment.id,
        error instanceof Error ? error.message : 'Payment processing error'
      );
      throw error;
    }
  }

  async getPaymentHistory(billId: string): Promise<Payment[]> {
    return this.dataLayer.payments.findByBill(billId);
  }
}
