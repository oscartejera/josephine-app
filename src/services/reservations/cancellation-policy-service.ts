/**
 * Cancellation Policy Service
 * Maneja políticas de cancelación y cargos por tarjeta
 */

import type { ReservationsDataLayer } from './repository-interface';
import type { Reservation, Deposit } from '@/types/reservations';
import type { PaymentProvider } from './deposit-service';
import { parseISO, differenceInHours } from 'date-fns';

export interface CancellationPolicy {
  id: string;
  location_id: string | null;
  name: string;
  description: string;
  free_cancellation_hours: number; // Horas antes para cancelación gratis
  partial_charge_hours: number; // Horas antes para cargo parcial
  partial_charge_percentage: number; // % a cobrar si cancela en ventana parcial
  full_charge_hours: number; // Horas antes donde ya se cobra completo
  no_show_charge_percentage: number; // % a cobrar por no-show (default 100%)
  is_active: boolean;
  created_at: string;
}

export interface CardGuarantee {
  id: string;
  reservation_id: string;
  payment_method_id: string; // Token de la tarjeta
  status: 'saved' | 'charged' | 'refunded' | 'expired';
  charged_amount: number | null;
  charged_at: string | null;
  charge_reason: string | null;
  created_at: string;
}

export class CancellationPolicyService {
  constructor(
    private dataLayer: ReservationsDataLayer,
    private paymentProvider: PaymentProvider
  ) {}

  /**
   * Save card for guarantee without charging
   */
  async saveCardGuarantee(
    reservationId: string,
    paymentMethodId: string
  ): Promise<CardGuarantee> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    // In real implementation, validate card with payment provider
    console.log('[Card Guarantee] Saving card for reservation:', reservationId);

    const guarantee: CardGuarantee = {
      id: `cg_${Date.now()}`,
      reservation_id: reservationId,
      payment_method_id: paymentMethodId,
      status: 'saved',
      charged_amount: null,
      charged_at: null,
      charge_reason: null,
      created_at: new Date().toISOString(),
    };

    // Store in notes for now (in production, would have separate table)
    await this.dataLayer.reservations.update(reservationId, {
      notes: `${reservation.notes || ''}\n[Card guarantee saved: ${paymentMethodId}]`,
    });

    return guarantee;
  }

  /**
   * Calculate charge amount based on cancellation timing
   */
  async calculateCancellationCharge(
    reservationId: string,
    cancelledAt: Date = new Date()
  ): Promise<{
    shouldCharge: boolean;
    amount: number;
    percentage: number;
    reason: string;
  }> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const settings = await this.dataLayer.settings.findByLocation(reservation.location_id);
    if (!settings) {
      return { shouldCharge: false, amount: 0, percentage: 0, reason: 'No settings' };
    }

    const reservationDateTime = parseISO(`${reservation.reservation_date}T${reservation.reservation_time}`);
    const hoursUntilReservation = differenceInHours(reservationDateTime, cancelledAt);

    // Check deposit amount
    const depositAmount = reservation.deposit_id 
      ? (await this.dataLayer.deposits.findById(reservation.deposit_id))?.amount || 0
      : settings.deposit_amount_per_person * reservation.party_size;

    // Free cancellation period
    if (hoursUntilReservation >= settings.cancellation_deadline_hours) {
      return {
        shouldCharge: false,
        amount: 0,
        percentage: 0,
        reason: 'Cancelled before deadline',
      };
    }

    // Past deadline - apply fee
    if (settings.charge_cancellation_fee) {
      const chargeAmount = (depositAmount * settings.cancellation_fee_percentage) / 100;
      
      return {
        shouldCharge: true,
        amount: chargeAmount,
        percentage: settings.cancellation_fee_percentage,
        reason: `Cancelled ${hoursUntilReservation}h before (deadline: ${settings.cancellation_deadline_hours}h)`,
      };
    }

    return {
      shouldCharge: false,
      amount: 0,
      percentage: 0,
      reason: 'Cancellation fee not enabled',
    };
  }

  /**
   * Apply cancellation policy
   */
  async applyCancellationPolicy(
    reservationId: string,
    cancelledBy: 'customer' | 'restaurant' = 'customer'
  ): Promise<void> {
    const charge = await this.calculateCancellationCharge(reservationId);

    if (charge.shouldCharge && cancelledBy === 'customer') {
      // Charge the card
      const reservation = await this.dataLayer.reservations.findById(reservationId);
      if (reservation?.deposit_id) {
        const deposit = await this.dataLayer.deposits.findById(reservation.deposit_id);
        
        if (deposit && deposit.payment_intent_id) {
          try {
            // Charge the cancellation fee
            await this.paymentProvider.capturePayment(deposit.payment_intent_id);
            
            // If partial charge, refund the difference
            if (charge.amount < deposit.amount) {
              const refundAmount = deposit.amount - charge.amount;
              await this.paymentProvider.refundPayment(deposit.payment_intent_id, refundAmount);
            }

            await this.dataLayer.deposits.update(deposit.id, {
              status: 'charged',
              charged_at: new Date().toISOString(),
            });

            console.log(`[Cancellation Policy] Charged €${charge.amount} (${charge.percentage}%)`);
          } catch (error) {
            console.error('[Cancellation Policy] Failed to charge:', error);
          }
        }
      }
    } else if (!charge.shouldCharge && cancelledBy === 'customer') {
      // Full refund
      const reservation = await this.dataLayer.reservations.findById(reservationId);
      if (reservation?.deposit_id) {
        const deposit = await this.dataLayer.deposits.findById(reservation.deposit_id);
        if (deposit && deposit.payment_intent_id) {
          try {
            await this.paymentProvider.refundPayment(deposit.payment_intent_id, deposit.amount);
            await this.dataLayer.deposits.refundDeposit(deposit.id, deposit.amount, charge.reason);
            console.log(`[Cancellation Policy] Full refund - ${charge.reason}`);
          } catch (error) {
            console.error('[Cancellation Policy] Failed to refund:', error);
          }
        }
      }
    }

    // Update reservation
    await this.dataLayer.reservations.update(reservationId, {
      notes: `${charge.reason}`,
    });
  }

  /**
   * Handle no-show with full charge
   */
  async handleNoShow(reservationId: string): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation || !reservation.deposit_id) {
      return;
    }

    const deposit = await this.dataLayer.deposits.findById(reservation.deposit_id);
    if (!deposit || !deposit.payment_intent_id) {
      return;
    }

    try {
      // Charge full amount for no-show
      await this.paymentProvider.capturePayment(deposit.payment_intent_id);
      await this.dataLayer.deposits.chargeDeposit(deposit.id);

      console.log(`[Cancellation Policy] No-show charge: €${deposit.amount}`);

      // Update customer stats
      if (reservation.customer_profile_id) {
        await this.dataLayer.customers.incrementNoShows(reservation.customer_profile_id);
      }
    } catch (error) {
      console.error('[Cancellation Policy] Failed to charge no-show:', error);
    }
  }

  /**
   * Get cancellation policy preview for a reservation
   */
  async getCancellationPolicyPreview(reservationId: string): Promise<{
    free_until: string;
    partial_charge_period: string;
    full_charge_period: string;
    no_show_charge: string;
  }> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const settings = await this.dataLayer.settings.findByLocation(reservation.location_id);
    if (!settings) {
      return {
        free_until: 'Sin política configurada',
        partial_charge_period: '',
        full_charge_period: '',
        no_show_charge: '',
      };
    }

    const depositAmount = settings.deposit_amount_per_person * reservation.party_size;
    const partialAmount = (depositAmount * settings.cancellation_fee_percentage) / 100;

    return {
      free_until: `Hasta ${settings.cancellation_deadline_hours}h antes: Cancelación gratuita`,
      partial_charge_period: settings.charge_cancellation_fee 
        ? `Menos de ${settings.cancellation_deadline_hours}h: Cargo de €${partialAmount.toFixed(2)} (${settings.cancellation_fee_percentage}%)`
        : '',
      full_charge_period: `Menos de 4h: Cargo completo de €${depositAmount.toFixed(2)}`,
      no_show_charge: `No-show: Cargo completo de €${depositAmount.toFixed(2)}`,
    };
  }
}
