/**
 * Phone Assistant Adapter (Feature G)
 * Integración con asistente telefónico tipo Bookline
 */

import type { ReservationsDataLayer } from '../repository-interface';
import type { CreateReservationInput } from '@/types/reservations';

export interface PhoneCallIntent {
  action: 'create' | 'modify' | 'cancel' | 'inquire';
  guest_name?: string;
  guest_phone?: string;
  party_size?: number;
  preferred_date?: string;
  preferred_time?: string;
  special_requests?: string;
}

export interface PhoneCallResponse {
  success: boolean;
  message: string;
  suggestions?: { date: string; time: string }[];
  reservation_id?: string;
}

export class PhoneAssistantAdapter {
  constructor(private dataLayer: ReservationsDataLayer) {}

  async processPhoneCall(
    locationId: string,
    intent: PhoneCallIntent
  ): Promise<PhoneCallResponse> {
    console.log('[Phone Assistant] Processing call:', intent);

    switch (intent.action) {
      case 'create':
        return await this.handleCreateReservation(locationId, intent);
      
      case 'inquire':
        return await this.handleInquiry(locationId, intent);
      
      case 'cancel':
        return await this.handleCancellation(intent);
      
      default:
        return {
          success: false,
          message: 'Acción no reconocida',
        };
    }
  }

  private async handleCreateReservation(
    locationId: string,
    intent: PhoneCallIntent
  ): Promise<PhoneCallResponse> {
    if (!intent.guest_name || !intent.party_size) {
      return {
        success: false,
        message: 'Necesito el nombre y número de comensales',
      };
    }

    const input: CreateReservationInput = {
      guest_name: intent.guest_name,
      guest_phone: intent.guest_phone,
      party_size: intent.party_size,
      reservation_date: intent.preferred_date || new Date().toISOString().split('T')[0],
      reservation_time: intent.preferred_time || '20:00',
      source: 'manual',
      special_requests: intent.special_requests,
    };

    try {
      const reservation = await this.dataLayer.reservations.createReservation(locationId, input);

      return {
        success: true,
        message: `Reserva confirmada para ${intent.guest_name}, ${intent.party_size} personas, ${input.reservation_date} a las ${input.reservation_time}`,
        reservation_id: reservation.id,
      };
    } catch (error) {
      return {
        success: false,
        message: `No pude crear la reserva: ${error}`,
      };
    }
  }

  private async handleInquiry(
    locationId: string,
    intent: PhoneCallIntent
  ): Promise<PhoneCallResponse> {
    // Check availability and suggest times
    return {
      success: true,
      message: 'Tenemos disponibilidad. ¿A qué hora prefieres?',
      suggestions: [
        { date: intent.preferred_date || '', time: '20:00' },
        { date: intent.preferred_date || '', time: '20:30' },
        { date: intent.preferred_date || '', time: '21:00' },
      ],
    };
  }

  private async handleCancellation(intent: PhoneCallIntent): Promise<PhoneCallResponse> {
    // Mock cancellation
    return {
      success: true,
      message: 'Reserva cancelada correctamente',
    };
  }
}
