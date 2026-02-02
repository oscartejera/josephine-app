/**
 * Demo Payment Provider
 * Mock implementation para testing sin payment provider real
 */

import type { PaymentMethod } from '@/types/scanpay';
import type { PaymentProvider } from '../payments-service';

export class DemoPaymentProvider implements PaymentProvider {
  async processPayment(
    amount: number,
    method: PaymentMethod,
    metadata: any
  ): Promise<{ success: boolean; reference?: string; error?: string }> {
    console.log('[DEMO PAYMENT]', {
      amount,
      method,
      metadata,
    });

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulate 95% success rate
    if (Math.random() > 0.05) {
      const reference = `demo_${method}_${Date.now()}`;
      console.log('[DEMO PAYMENT] SUCCESS:', reference);
      
      return {
        success: true,
        reference,
      };
    } else {
      console.log('[DEMO PAYMENT] FAILED: Simulated error');
      
      return {
        success: false,
        error: 'Pago rechazado (simulado)',
      };
    }
  }

  supportsMethod(method: PaymentMethod): boolean {
    return ['apple_pay', 'google_pay', 'card', 'demo'].includes(method);
  }
}
