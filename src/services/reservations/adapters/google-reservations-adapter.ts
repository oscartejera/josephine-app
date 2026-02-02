/**
 * Google Reservations Adapter
 * Interfaz para sincronizar reservas desde Google
 */

import type {
  ReservationsDataLayer,
} from '../repository-interface';
import type {
  Reservation,
  CreateReservationInput,
} from '@/types/reservations';

export interface GoogleReservationPayload {
  reservation_id: string;
  merchant_id: string;
  user_information: {
    given_name: string;
    family_name: string;
    email: string;
    telephone: string;
  };
  payment_information?: {
    prepayment_status: 'PREPAYMENT_PROVIDED' | 'PREPAYMENT_NOT_PROVIDED';
  };
  booking: {
    slot: {
      merchant_id: string;
      service_id: string;
      start_sec: number;
      duration_sec: number;
    };
    party_size: number;
    booking_reference_number?: string;
  };
}

export interface GoogleAdapter {
  syncReservation(payload: GoogleReservationPayload): Promise<Reservation>;
  updateReservationStatus(googleReservationId: string, status: string): Promise<void>;
  getReservationUpdates(): Promise<GoogleReservationPayload[]>;
}

/**
 * Mock Google Reservations Adapter for development
 */
export class MockGoogleReservationsAdapter implements GoogleAdapter {
  constructor(private dataLayer: ReservationsDataLayer) {}

  async syncReservation(payload: GoogleReservationPayload): Promise<Reservation> {
    console.log('[Google Reservations] Syncing reservation:', payload.reservation_id);

    // Convert Google payload to internal format
    const input: CreateReservationInput = {
      guest_name: `${payload.user_information.given_name} ${payload.user_information.family_name}`,
      guest_email: payload.user_information.email,
      guest_phone: payload.user_information.telephone,
      party_size: payload.booking.party_size,
      reservation_date: this.convertTimestamp(payload.booking.slot.start_sec),
      reservation_time: this.convertTimestampToTime(payload.booking.slot.start_sec),
      duration_minutes: payload.booking.slot.duration_sec / 60,
      source: 'google',
      notes: `Google Booking: ${payload.booking.booking_reference_number || 'N/A'}`,
    };

    // Find location from merchant_id
    // For now, use first location (in real implementation, map merchant_id to location_id)
    const locations = await this.dataLayer.zones.findAll();
    const locationId = locations[0]?.location_id || 'default-location';

    // Create reservation
    const reservation = await this.dataLayer.reservations.createReservation(
      locationId,
      input
    );

    console.log('[Google Reservations] Created reservation:', reservation.id);

    return reservation;
  }

  async updateReservationStatus(googleReservationId: string, status: string): Promise<void> {
    console.log('[Google Reservations] Updating status:', { googleReservationId, status });

    // In real implementation:
    // 1. Find reservation by Google ID
    // 2. Map Google status to internal status
    // 3. Update reservation
    
    // For mock, just log
  }

  async getReservationUpdates(): Promise<GoogleReservationPayload[]> {
    console.log('[Google Reservations] Fetching updates...');
    
    // In real implementation:
    // 1. Call Google API to get updates
    // 2. Return list of updated reservations
    
    // For mock, return empty array
    return [];
  }

  private convertTimestamp(seconds: number): string {
    const date = new Date(seconds * 1000);
    return date.toISOString().split('T')[0];
  }

  private convertTimestampToTime(seconds: number): string {
    const date = new Date(seconds * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

/**
 * Real Google Reservations Adapter (to be implemented)
 */
export class GoogleReservationsAdapter implements GoogleAdapter {
  private apiEndpoint = 'https://mapsbooking.googleapis.com/v1';
  private apiKey: string;

  constructor(
    private dataLayer: ReservationsDataLayer,
    apiKey: string
  ) {
    this.apiKey = apiKey;
  }

  async syncReservation(payload: GoogleReservationPayload): Promise<Reservation> {
    // TODO: Implement real Google Reservations API integration
    // For now, use mock implementation
    const mock = new MockGoogleReservationsAdapter(this.dataLayer);
    return mock.syncReservation(payload);
  }

  async updateReservationStatus(googleReservationId: string, status: string): Promise<void> {
    // TODO: Implement real API call
    console.log('[Google API] Update status:', { googleReservationId, status });
  }

  async getReservationUpdates(): Promise<GoogleReservationPayload[]> {
    // TODO: Implement real API call
    return [];
  }
}

/**
 * Google Reservations Webhook Handler
 */
export class GoogleReservationsWebhookHandler {
  constructor(private adapter: GoogleAdapter) {}

  async handleWebhook(payload: any): Promise<void> {
    console.log('[Google Webhook] Received:', payload);

    switch (payload.event_type) {
      case 'RESERVATION_CREATED':
        await this.adapter.syncReservation(payload.reservation);
        break;

      case 'RESERVATION_UPDATED':
        await this.adapter.updateReservationStatus(
          payload.reservation_id,
          payload.status
        );
        break;

      case 'RESERVATION_CANCELLED':
        await this.adapter.updateReservationStatus(
          payload.reservation_id,
          'cancelled'
        );
        break;

      default:
        console.warn('[Google Webhook] Unknown event type:', payload.event_type);
    }
  }
}
