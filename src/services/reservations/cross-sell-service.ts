/**
 * Cross-Sell Service (Feature H)
 * Sugiere otros locales cuando no hay disponibilidad
 */

import type { ReservationsDataLayer } from './repository-interface';
import { AvailabilityService } from './availability-service';

export interface CrossSellSuggestion {
  location_id: string;
  location_name: string;
  distance_km?: number;
  available_times: string[];
  reason: string;
}

export class CrossSellService {
  constructor(
    private dataLayer: ReservationsDataLayer,
    private availabilityService: AvailabilityService
  ) {}

  async findAlternativeLocations(
    originalLocationId: string,
    date: string,
    time: string,
    partySize: number
  ): Promise<CrossSellSuggestion[]> {
    const suggestions: CrossSellSuggestion[] = [];

    // Get all locations
    const allZones = await this.dataLayer.zones.findAll();
    const locationIds = [...new Set(allZones.map(z => z.location_id))];

    // Check each other location
    for (const locationId of locationIds) {
      if (locationId === originalLocationId) continue;

      // Check availability at this location
      const check = await this.availabilityService.checkAvailability({
        locationId,
        date,
        time,
        party_size: partySize,
      });

      if (check.available) {
        suggestions.push({
          location_id: locationId,
          location_name: `Location ${locationId}`,
          available_times: [time],
          reason: 'Disponibilidad confirmada',
        });
      } else if (check.suggested_times && check.suggested_times.length > 0) {
        suggestions.push({
          location_id: locationId,
          location_name: `Location ${locationId}`,
          available_times: check.suggested_times,
          reason: 'Horarios alternativos disponibles',
        });
      }
    }

    return suggestions;
  }
}
