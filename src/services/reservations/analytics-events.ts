/**
 * Analytics Events (Feature I)
 * Google Analytics tracking para embudo de reservas
 */

export interface AnalyticsEvent {
  event: string;
  category: 'reservations';
  label?: string;
  value?: number;
  reservation_id?: string;
  [key: string]: any;
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export class AnalyticsEventsService {
  private enabled: boolean = false;

  constructor(gaTrackingId?: string) {
    this.enabled = !!gaTrackingId && typeof window !== 'undefined';
    
    if (this.enabled && window.gtag) {
      console.log('[Analytics] Google Analytics enabled');
    } else {
      console.log('[Analytics] Running in mock mode (no GA key)');
    }
  }

  /**
   * Track reservation search
   */
  trackReservationSearch(locationId: string, date: string, partySize: number): void {
    this.track({
      event: 'reservation_search',
      category: 'reservations',
      label: 'search',
      location_id: locationId,
      date,
      party_size: partySize,
    });
  }

  /**
   * Track slot selected
   */
  trackSlotSelected(time: string, serviceId: string): void {
    this.track({
      event: 'slot_selected',
      category: 'reservations',
      label: 'slot_selection',
      time,
      service_id: serviceId,
    });
  }

  /**
   * Track reservation created
   */
  trackReservationCreated(
    reservationId: string,
    source: string,
    partySize: number,
    hasDeposit: boolean
  ): void {
    this.track({
      event: 'reservation_created',
      category: 'reservations',
      label: source,
      value: partySize,
      reservation_id: reservationId,
      has_deposit: hasDeposit,
    });
  }

  /**
   * Track reservation cancelled
   */
  trackReservationCancelled(
    reservationId: string,
    reason: string,
    hoursBeforeReservation: number
  ): void {
    this.track({
      event: 'reservation_cancelled',
      category: 'reservations',
      label: reason,
      reservation_id: reservationId,
      hours_before: hoursBeforeReservation,
    });
  }

  /**
   * Track no-show
   */
  trackNoShow(reservationId: string, partySize: number): void {
    this.track({
      event: 'no_show_marked',
      category: 'reservations',
      label: 'no_show',
      value: partySize,
      reservation_id: reservationId,
    });
  }

  /**
   * Track deposit payment
   */
  trackDepositPayment(amount: number, method: string): void {
    this.track({
      event: 'deposit_payment',
      category: 'reservations',
      label: method,
      value: amount,
    });
  }

  /**
   * Internal track method
   */
  private track(event: AnalyticsEvent): void {
    if (this.enabled && window.gtag) {
      window.gtag('event', event.event, {
        event_category: event.category,
        event_label: event.label,
        value: event.value,
        ...event,
      });
    } else {
      // Mock: just log
      console.log('[Analytics Event]', event);
    }
  }
}
