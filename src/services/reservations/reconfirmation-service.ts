/**
 * Reconfirmation Service
 * Maneja el flujo completo de reconfirmación automática
 */

import type { ReservationsDataLayer } from './repository-interface';
import type { Reservation } from '@/types/reservations';
import { MessagingService } from './messaging-service';
import { addHours, isBefore, parseISO } from 'date-fns';

export type ReconfirmationStatus = 
  | 'not_required'
  | 'pending'
  | 'sent'
  | 'reconfirmed'
  | 'expired'
  | 'cancelled_by_policy';

export interface ReconfirmationConfig {
  enabled: boolean;
  hours_before: number;
  expiry_hours: number; // Horas que tiene el cliente para reconfirmar
  auto_cancel_on_expiry: boolean;
  apply_to_all: boolean;
  apply_to_party_size_above?: number;
  apply_to_services?: string[]; // IDs de servicios específicos
}

export class ReconfirmationService {
  constructor(
    private dataLayer: ReservationsDataLayer,
    private messagingService: MessagingService
  ) {}

  /**
   * Check if reservation requires reconfirmation
   */
  async requiresReconfirmation(reservation: Reservation): Promise<boolean> {
    const settings = await this.dataLayer.settings.findByLocation(reservation.location_id);
    
    if (!settings?.require_reconfirmation) {
      return false;
    }

    // Check if specific to party size
    if (settings.deposit_required_for_party_size) {
      return reservation.party_size >= settings.deposit_required_for_party_size;
    }

    return true;
  }

  /**
   * Schedule reconfirmation request
   * In production, this would be called by a scheduler/cron
   */
  async scheduleReconfirmation(reservationId: string): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const settings = await this.dataLayer.settings.findByLocation(reservation.location_id);
    if (!settings?.require_reconfirmation) {
      return; // Not enabled
    }

    // Calculate when to send reconfirmation request
    const reservationDateTime = parseISO(`${reservation.reservation_date}T${reservation.reservation_time}`);
    const sendAt = addHours(reservationDateTime, -settings.reconfirmation_hours_before);
    const expiresAt = addHours(reservationDateTime, -4); // 4 hours before as default expiry

    // Mark as requiring reconfirmation
    await this.dataLayer.reservations.update(reservationId, {
      reconfirmation_required: true,
    });

    console.log(`[Reconfirmation] Scheduled for ${reservation.guest_name} at ${sendAt.toISOString()}`);
  }

  /**
   * Send reconfirmation request
   * Called by cron/scheduler at the appropriate time
   */
  async sendReconfirmationRequest(reservationId: string): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) {
      return;
    }

    if (reservation.reconfirmed_at) {
      console.log(`[Reconfirmation] Already reconfirmed: ${reservationId}`);
      return;
    }

    // Send via messaging service
    await this.messagingService.sendReconfirmationRequest(reservationId);

    console.log(`[Reconfirmation] Sent request to ${reservation.guest_name}`);
  }

  /**
   * Mark reservation as reconfirmed
   */
  async markAsReconfirmed(reservationId: string): Promise<void> {
    await this.dataLayer.reservations.reconfirmReservation(reservationId);
    
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    console.log(`[Reconfirmation] Confirmed by ${reservation?.guest_name}`);
  }

  /**
   * Process expired reconfirmations
   * Called by scheduler to check and cancel expired reservations
   */
  async processExpiredReconfirmations(): Promise<number> {
    const now = new Date();
    const allReservations = await this.dataLayer.reservations.findAll();
    
    let processedCount = 0;

    for (const reservation of allReservations) {
      if (!reservation.reconfirmation_required || reservation.reconfirmed_at) {
        continue;
      }

      // Check if past deadline (4 hours before reservation)
      const reservationDateTime = parseISO(`${reservation.reservation_date}T${reservation.reservation_time}`);
      const deadline = addHours(reservationDateTime, -4);

      if (isBefore(now, deadline)) {
        continue; // Not expired yet
      }

      // Check settings for auto-cancel
      const settings = await this.dataLayer.settings.findByLocation(reservation.location_id);
      
      if (settings?.require_reconfirmation) {
        // Cancel reservation
        await this.dataLayer.reservations.cancelReservation(
          reservation.id,
          'Cancelada automáticamente - No reconfirmada'
        );

        // Send notification
        try {
          await this.messagingService.sendCancellation(reservation.id);
        } catch (error) {
          console.error('Failed to send cancellation notification:', error);
        }

        processedCount++;
        console.log(`[Reconfirmation] Cancelled expired: ${reservation.id}`);
      }
    }

    return processedCount;
  }

  /**
   * Get all reservations pending reconfirmation
   */
  async getPendingReconfirmations(locationId: string): Promise<Reservation[]> {
    const reservations = await this.dataLayer.reservations.findByLocation(locationId);
    
    return reservations.filter(r => 
      r.reconfirmation_required && 
      !r.reconfirmed_at &&
      ['confirmed', 'pending'].includes(r.status)
    );
  }

  /**
   * Get reconfirmation stats for analytics
   */
  async getReconfirmationStats(locationId: string, startDate: string, endDate: string) {
    const reservations = await this.dataLayer.reservations.findByDateRange(
      locationId,
      startDate,
      endDate
    );

    const requiredReconfirmation = reservations.filter(r => r.reconfirmation_required);
    const reconfirmed = requiredReconfirmation.filter(r => r.reconfirmed_at);
    const expired = requiredReconfirmation.filter(r => 
      !r.reconfirmed_at && r.status === 'cancelled'
    );

    return {
      total_requiring_reconfirmation: requiredReconfirmation.length,
      total_reconfirmed: reconfirmed.length,
      total_expired: expired.length,
      reconfirmation_rate: requiredReconfirmation.length > 0 
        ? (reconfirmed.length / requiredReconfirmation.length) * 100 
        : 100,
    };
  }
}
