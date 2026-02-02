/**
 * Stripe Payment Provider
 * Real Stripe integration (requires API keys)
 */

import type { PaymentMethod } from '@/types/scanpay';
import type { PaymentProvider } from '../payments-service';

export class StripePaymentProvider implements PaymentProvider {
  private publishableKey: string;

  constructor(publishableKey: string) {
    this.publishableKey = publishableKey;
    
    if (!publishableKey) {
      console.warn('[Stripe] No publishable key provided');
    }
  }

  async processPayment(
    amount: number,
    method: PaymentMethod,
    metadata: any
  ): Promise<{ success: boolean; reference?: string; error?: string }> {
    console.log('[Stripe] Processing payment:', { amount, method });

    // TODO: Integrate real Stripe SDK
    // For now, throw error if called without configuration
    if (!this.publishableKey) {
      return {
        success: false,
        error: 'Stripe not configured. Using demo mode.',
      };
    }

    // In production:
    // const stripe = await loadStripe(this.publishableKey);
    // const paymentIntent = await createPaymentIntent(...)
    // const result = await confirmPayment(...)
    // return { success: true, reference: paymentIntent.id };

    return {
      success: false,
      error: 'Stripe integration not yet implemented. Use demo mode.',
    };
  }

  supportsMethod(method: PaymentMethod): boolean {
    // Stripe supports all except demo
    return ['apple_pay', 'google_pay', 'card'].includes(method);
  }
}
