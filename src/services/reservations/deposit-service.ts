/**
 * Deposit Service
 * Maneja depósitos, preautorizaciones y cargos
 */

import type {
  ReservationsDataLayer,
} from './repository-interface';
import type {
  Deposit,
  Reservation,
} from '@/types/reservations';

export interface PaymentProvider {
  authorizePayment(amount: number, currency: string, metadata: any): Promise<{ id: string; status: string }>;
  capturePayment(paymentIntentId: string): Promise<void>;
  refundPayment(paymentIntentId: string, amount: number): Promise<void>;
}

/**
 * Mock payment provider for development
 */
class MockPaymentProvider implements PaymentProvider {
  async authorizePayment(amount: number, currency: string, metadata: any): Promise<{ id: string; status: string }> {
    console.log('[MOCK PAYMENT] Authorize:', { amount, currency, metadata });
    return {
      id: `pi_mock_${Date.now()}`,
      status: 'authorized',
    };
  }

  async capturePayment(paymentIntentId: string): Promise<void> {
    console.log('[MOCK PAYMENT] Capture:', paymentIntentId);
  }

  async refundPayment(paymentIntentId: string, amount: number): Promise<void> {
    console.log('[MOCK PAYMENT] Refund:', { paymentIntentId, amount });
  }
}

export class DepositService {
  private provider: PaymentProvider;

  constructor(
    private dataLayer: ReservationsDataLayer,
    provider?: PaymentProvider
  ) {
    this.provider = provider || new MockPaymentProvider();
  }

  /**
   * Check if deposit is required for a reservation
   */
  async isDepositRequired(reservation: Reservation): Promise<boolean> {
    const settings = await this.dataLayer.settings.findByLocation(reservation.location_id);
    if (!settings) return false;

    if (!settings.require_deposit) return false;

    // Check if party size requires deposit
    if (settings.deposit_required_for_party_size) {
      return reservation.party_size >= settings.deposit_required_for_party_size;
    }

    return true;
  }

  /**
   * Calculate deposit amount for a reservation
   */
  async calculateDepositAmount(reservationId: string): Promise<number> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const settings = await this.dataLayer.settings.findByLocation(reservation.location_id);
    if (!settings || !settings.require_deposit) {
      return 0;
    }

    const perPersonAmount = settings.deposit_amount_per_person;
    const totalAmount = perPersonAmount * reservation.party_size;

    // Check for promo code that gives free deposit
    if (reservation.promo_code_id) {
      const promoCode = await this.dataLayer.promoCodes.findById(reservation.promo_code_id);
      if (promoCode && promoCode.discount_type === 'free_deposit') {
        return 0;
      }
    }

    return totalAmount;
  }

  /**
   * Create and authorize deposit for a reservation
   */
  async createDeposit(
    reservationId: string,
    paymentMethodId: string
  ): Promise<Deposit> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    // Check if deposit already exists
    const existing = await this.dataLayer.deposits.findByReservation(reservationId);
    if (existing) {
      throw new Error('Deposit already exists for this reservation');
    }

    // Calculate amount
    const amount = await this.calculateDepositAmount(reservationId);
    if (amount === 0) {
      throw new Error('No deposit required for this reservation');
    }

    const settings = await this.dataLayer.settings.findByLocation(reservation.location_id);
    const perPersonAmount = settings?.deposit_amount_per_person || 0;

    // Create deposit record
    const deposit = await this.dataLayer.deposits.createDeposit(
      reservationId,
      amount,
      perPersonAmount
    );

    // Authorize payment with provider
    try {
      const paymentResult = await this.provider.authorizePayment(amount, 'EUR', {
        reservation_id: reservationId,
        guest_name: reservation.guest_name,
        party_size: reservation.party_size,
        payment_method_id: paymentMethodId,
      });

      await this.dataLayer.deposits.authorizeDeposit(deposit.id, paymentResult.id);

      // Update reservation with deposit_id
      await this.dataLayer.reservations.update(reservationId, {
        deposit_id: deposit.id,
      });

      return await this.dataLayer.deposits.findById(deposit.id) as Deposit;
    } catch (error) {
      // Update deposit status to failed
      await this.dataLayer.deposits.update(deposit.id, { status: 'failed' });
      throw new Error(`Failed to authorize payment: ${error}`);
    }
  }

  /**
   * Charge (capture) a deposit
   */
  async chargeDeposit(depositId: string): Promise<void> {
    const deposit = await this.dataLayer.deposits.findById(depositId);
    if (!deposit) {
      throw new Error('Deposit not found');
    }

    if (deposit.status !== 'authorized') {
      throw new Error(`Cannot charge deposit with status: ${deposit.status}`);
    }

    if (!deposit.payment_intent_id) {
      throw new Error('No payment intent ID found');
    }

    try {
      await this.provider.capturePayment(deposit.payment_intent_id);
      await this.dataLayer.deposits.chargeDeposit(depositId);
    } catch (error) {
      throw new Error(`Failed to charge deposit: ${error}`);
    }
  }

  /**
   * Refund a deposit (full or partial)
   */
  async refundDeposit(
    depositId: string,
    amount?: number,
    reason?: string
  ): Promise<void> {
    const deposit = await this.dataLayer.deposits.findById(depositId);
    if (!deposit) {
      throw new Error('Deposit not found');
    }

    if (!['authorized', 'charged'].includes(deposit.status)) {
      throw new Error(`Cannot refund deposit with status: ${deposit.status}`);
    }

    if (!deposit.payment_intent_id) {
      throw new Error('No payment intent ID found');
    }

    const refundAmount = amount || deposit.amount;

    if (refundAmount > deposit.amount) {
      throw new Error('Refund amount cannot exceed deposit amount');
    }

    try {
      await this.provider.refundPayment(deposit.payment_intent_id, refundAmount);
      await this.dataLayer.deposits.refundDeposit(
        depositId,
        refundAmount,
        reason || 'Refund requested'
      );
    } catch (error) {
      throw new Error(`Failed to refund deposit: ${error}`);
    }
  }

  /**
   * Automatically refund deposit when reservation is cancelled
   */
  async handleCancellation(reservationId: string): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation || !reservation.deposit_id) {
      return; // No deposit to handle
    }

    const settings = await this.dataLayer.settings.findByLocation(reservation.location_id);
    if (!settings) return;

    const deposit = await this.dataLayer.deposits.findById(reservation.deposit_id);
    if (!deposit) return;

    // Check cancellation deadline
    const reservationDateTime = new Date(`${reservation.reservation_date}T${reservation.reservation_time}`);
    const now = new Date();
    const hoursUntilReservation = (reservationDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilReservation < settings.cancellation_deadline_hours) {
      // Past deadline - charge cancellation fee
      if (settings.charge_cancellation_fee && settings.cancellation_fee_percentage > 0) {
        const feeAmount = (deposit.amount * settings.cancellation_fee_percentage) / 100;
        const refundAmount = deposit.amount - feeAmount;

        if (refundAmount > 0) {
          await this.refundDeposit(
            deposit.id,
            refundAmount,
            `Cancelled after deadline. Cancellation fee: €${feeAmount.toFixed(2)}`
          );
        } else {
          // Charge full deposit
          if (deposit.status === 'authorized') {
            await this.chargeDeposit(deposit.id);
          }
        }
      } else {
        // Full refund even after deadline
        await this.refundDeposit(deposit.id, deposit.amount, 'Reservation cancelled');
      }
    } else {
      // Before deadline - full refund
      await this.refundDeposit(deposit.id, deposit.amount, 'Reservation cancelled before deadline');
    }
  }

  /**
   * Handle no-show - charge deposit
   */
  async handleNoShow(reservationId: string): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation || !reservation.deposit_id) {
      return;
    }

    const deposit = await this.dataLayer.deposits.findById(reservation.deposit_id);
    if (!deposit) return;

    // Charge the deposit for no-show
    if (deposit.status === 'authorized') {
      await this.chargeDeposit(deposit.id);
    }

    // Update customer profile
    if (reservation.customer_profile_id) {
      await this.dataLayer.customers.incrementNoShows(reservation.customer_profile_id);

      const customer = await this.dataLayer.customers.findById(reservation.customer_profile_id);
      const settings = await this.dataLayer.settings.findByLocation(reservation.location_id);

      // Auto-block if too many no-shows
      if (
        customer &&
        settings?.block_after_no_shows &&
        customer.total_no_shows >= settings.block_after_no_shows
      ) {
        await this.dataLayer.customers.blockCustomer(
          customer.id,
          `Bloqueado automáticamente por ${customer.total_no_shows} no-shows`
        );
      }
    }
  }

  /**
   * Get deposit status for a reservation
   */
  async getDepositStatus(reservationId: string): Promise<{
    required: boolean;
    amount: number;
    deposit?: Deposit;
  }> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const required = await this.isDepositRequired(reservation);
    const amount = await this.calculateDepositAmount(reservationId);

    let deposit: Deposit | undefined;
    if (reservation.deposit_id) {
      deposit = await this.dataLayer.deposits.findById(reservation.deposit_id) || undefined;
    }

    return {
      required,
      amount,
      deposit,
    };
  }

  /**
   * Convert deposit to POS prepayment when reservation is seated
   */
  async convertToPrepayment(reservationId: string): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation || !reservation.deposit_id) {
      return;
    }

    const deposit = await this.dataLayer.deposits.findById(reservation.deposit_id);
    if (!deposit || deposit.status !== 'charged') {
      return;
    }

    // In real implementation, this would:
    // 1. Create a prepayment record in POS
    // 2. Link it to the table/order
    // 3. The deposit amount would be deducted from final bill

    console.log(`[Deposit→POS] Converting deposit ${deposit.id} (€${deposit.amount}) to prepayment for table ${reservation.pos_table_id}`);
    
    // For now, just log it
    // The POS integration will handle this
  }
}
