/**
 * Offers Service (Feature F)
 * Gestiona ofertas avanzadas más allá de códigos promo simples
 */

import type { ReservationsDataLayer } from './repository-interface';

export interface Offer {
  id: string;
  location_id: string | null;
  name: string;
  description: string;
  type: 'discount' | 'free_deposit' | 'upgrade' | 'perk';
  value: number;
  active_from: string;
  active_until: string;
  applies_to: {
    days_of_week?: number[];
    time_from?: string;
    time_to?: string;
    services?: string[];
    zones?: string[];
    min_party_size?: number;
    max_party_size?: number;
  };
  auto_apply: boolean; // Se aplica automáticamente si es elegible
  is_active: boolean;
}

export class OffersService {
  constructor(private dataLayer: ReservationsDataLayer) {}

  async findEligibleOffers(
    locationId: string,
    date: string,
    time: string,
    partySize: number,
    serviceId?: string,
    zoneId?: string
  ): Promise<Offer[]> {
    // Mock implementation - in production would query offers table
    const mockOffers: Offer[] = [
      {
        id: 'offer-1',
        location_id: locationId,
        name: 'Cena Temprana',
        description: '15% descuento en reservas antes de las 20:00',
        type: 'discount',
        value: 15,
        active_from: '2024-01-01',
        active_until: '2024-12-31',
        applies_to: {
          time_from: '18:00',
          time_to: '20:00',
          services: ['service-dinner'],
        },
        auto_apply: true,
        is_active: true,
      },
    ];

    // Filter eligible offers
    return mockOffers.filter(offer => this.isOfferEligible(offer, date, time, partySize));
  }

  private isOfferEligible(offer: Offer, date: string, time: string, partySize: number): boolean {
    if (!offer.is_active) return false;
    
    // Check date range
    if (date < offer.active_from || date > offer.active_until) return false;

    // Check party size
    if (offer.applies_to.min_party_size && partySize < offer.applies_to.min_party_size) return false;
    if (offer.applies_to.max_party_size && partySize > offer.applies_to.max_party_size) return false;

    // Check time
    if (offer.applies_to.time_from && time < offer.applies_to.time_from) return false;
    if (offer.applies_to.time_to && time > offer.applies_to.time_to) return false;

    return true;
  }
}
