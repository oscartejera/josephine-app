/**
 * Availability Service
 * Gestiona la disponibilidad, aforo y validación de reservas
 */

import type {
  ReservationsDataLayer,
} from './repository-interface';
import type {
  AvailabilityCheck,
  AvailabilityResult,
  TimeSlot,
  Reservation,
  Service,
} from '@/types/reservations';
import { addMinutes, parse, format, isWithinInterval } from 'date-fns';

export class AvailabilityService {
  constructor(private dataLayer: ReservationsDataLayer) {}

  /**
   * Check if a reservation can be made for the given parameters
   */
  async checkAvailability(check: AvailabilityCheck): Promise<AvailabilityResult> {
    const { date, time, party_size, zone_id, service_id } = check;

    // 1. Check if location is closed on this date
    const settings = await this.dataLayer.settings.findByLocation(check.locationId!);
    if (!settings) {
      return { available: false, reason: 'No se encontró configuración de reservas' };
    }

    const isClosed = await this.dataLayer.closureDays.isClosedOn(check.locationId!, date);
    if (isClosed) {
      const closure = await this.dataLayer.closureDays.findByDate(check.locationId!, date);
      return {
        available: false,
        reason: `Cerrado: ${closure?.reason || 'Día de cierre'}`,
      };
    }

    // 2. Check party size limits
    if (party_size < settings.min_party_size) {
      return {
        available: false,
        reason: `Mínimo ${settings.min_party_size} comensales`,
      };
    }

    if (party_size > settings.max_party_size) {
      return {
        available: false,
        reason: `Máximo ${settings.max_party_size} comensales. Contacta para grupos mayores.`,
        max_party_size: settings.max_party_size,
      };
    }

    // 3. Get the service for this date/time
    const services = await this.dataLayer.services.findForDate(check.locationId!, date);
    
    let targetService: Service | null = null;
    if (service_id) {
      targetService = services.find(s => s.id === service_id) || null;
    } else {
      // Find which service this time belongs to
      targetService = this.findServiceForTime(services, time);
    }

    if (!targetService) {
      return {
        available: false,
        reason: 'No hay servicio disponible en este horario',
      };
    }

    // 4. Check time is within service hours
    const timeObj = parse(time, 'HH:mm', new Date());
    const startTime = parse(targetService.start_time, 'HH:mm', new Date());
    const endTime = parse(targetService.end_time, 'HH:mm', new Date());

    // Handle services that cross midnight
    if (endTime < startTime) {
      endTime.setDate(endTime.getDate() + 1);
    }

    if (!isWithinInterval(timeObj, { start: startTime, end: endTime })) {
      return {
        available: false,
        reason: `Fuera del horario del servicio (${targetService.start_time} - ${targetService.end_time})`,
      };
    }

    // 5. Get existing reservations for this date
    const existingReservations = await this.dataLayer.reservations.findByDate(
      check.locationId!,
      date
    );

    // Filter active reservations (not cancelled or no-show)
    const activeReservations = existingReservations.filter(
      r => !['cancelled', 'no_show'].includes(r.status)
    );

    // 6. Check capacity by time slot
    const overlappingReservations = this.findOverlappingReservations(
      activeReservations,
      time,
      targetService.default_reservation_duration
    );

    // Calculate current covers at this time
    const currentCovers = overlappingReservations.reduce((sum, r) => sum + r.party_size, 0);

    // Check service-level capacity
    if (targetService.max_covers) {
      const availableCovers = targetService.max_covers - currentCovers;
      if (availableCovers < party_size) {
        // Suggest alternative times
        const suggestions = await this.suggestAlternativeTimes(
          check.locationId!,
          date,
          targetService,
          party_size,
          activeReservations
        );

        return {
          available: false,
          reason: `Aforo completo (${currentCovers}/${targetService.max_covers} cubiertos)`,
          suggested_times: suggestions,
        };
      }
    }

    // 7. Check zone-specific capacity if zone is specified
    if (zone_id) {
      const zone = await this.dataLayer.zones.findById(zone_id);
      if (!zone || !zone.is_active) {
        return {
          available: false,
          reason: 'Zona no disponible',
        };
      }

      const zoneReservations = overlappingReservations.filter(r => r.zone_id === zone_id);
      const zoneCovers = zoneReservations.reduce((sum, r) => sum + r.party_size, 0);

      if (zoneCovers + party_size > zone.capacity) {
        return {
          available: false,
          reason: `Zona ${zone.name} completa`,
        };
      }

      // Check if there are tables available in this zone
      const zoneTables = await this.dataLayer.tables.findByZone(zone_id);
      const suitableTables = zoneTables.filter(
        t => t.is_active && t.min_capacity <= party_size && t.max_capacity >= party_size
      );

      if (suitableTables.length === 0) {
        return {
          available: false,
          reason: `No hay mesas disponibles en ${zone.name} para ${party_size} personas`,
        };
      }
    }

    // 8. Check slot-specific capacity (max covers per time slot)
    if (settings.max_covers_per_slot) {
      const slotStart = this.roundToSlot(time, settings.slot_duration_minutes);
      const slotReservations = activeReservations.filter(r => {
        const resSlot = this.roundToSlot(r.reservation_time, settings.slot_duration_minutes);
        return resSlot === slotStart;
      });

      const slotCovers = slotReservations.reduce((sum, r) => sum + r.party_size, 0);

      if (slotCovers + party_size > settings.max_covers_per_slot) {
        return {
          available: false,
          reason: 'Franja horaria completa',
        };
      }
    }

    // All checks passed!
    return {
      available: true,
    };
  }

  /**
   * Get available time slots for a given date and service
   */
  async getAvailableTimeSlots(
    locationId: string,
    date: string,
    serviceId: string,
    partySize: number
  ): Promise<TimeSlot[]> {
    const service = await this.dataLayer.services.findById(serviceId);
    if (!service) return [];

    const settings = await this.dataLayer.settings.findByLocation(locationId);
    if (!settings) return [];

    const slots: TimeSlot[] = [];
    const slotDuration = service.slot_duration_minutes;

    // Generate all possible slots within service hours
    const startTime = parse(service.start_time, 'HH:mm', new Date());
    const endTime = parse(service.end_time, 'HH:mm', new Date());

    let currentSlot = startTime;
    const existingReservations = await this.dataLayer.reservations.findByDate(locationId, date);
    const activeReservations = existingReservations.filter(
      r => !['cancelled', 'no_show'].includes(r.status)
    );

    while (currentSlot <= endTime) {
      const slotTime = format(currentSlot, 'HH:mm');
      
      // Calculate available covers for this slot
      const overlapping = this.findOverlappingReservations(
        activeReservations,
        slotTime,
        service.default_reservation_duration
      );

      const bookedCovers = overlapping.reduce((sum, r) => sum + r.party_size, 0);
      const availableCovers = (service.max_covers || 999) - bookedCovers;

      slots.push({
        time: slotTime,
        available_covers: availableCovers,
        booked_covers: bookedCovers,
        reservations: overlapping,
      });

      currentSlot = addMinutes(currentSlot, slotDuration);
    }

    return slots;
  }

  /**
   * Get capacity summary for a given date
   */
  async getCapacitySummary(locationId: string, date: string) {
    const services = await this.dataLayer.services.findForDate(locationId, date);
    const reservations = await this.dataLayer.reservations.findByDate(locationId, date);
    const activeReservations = reservations.filter(
      r => !['cancelled', 'no_show'].includes(r.status)
    );

    const summary = services.map(service => {
      const serviceReservations = activeReservations.filter(r => r.service_id === service.id);
      const totalCovers = serviceReservations.reduce((sum, r) => sum + r.party_size, 0);
      const maxCovers = service.max_covers || 0;
      const occupancyRate = maxCovers > 0 ? (totalCovers / maxCovers) * 100 : 0;

      return {
        service_id: service.id,
        service_name: service.name,
        total_covers: totalCovers,
        max_covers: maxCovers,
        occupancy_rate: occupancyRate,
        reservations_count: serviceReservations.length,
      };
    });

    return summary;
  }

  /**
   * Find which service a given time belongs to
   */
  private findServiceForTime(services: Service[], time: string): Service | null {
    const timeObj = parse(time, 'HH:mm', new Date());

    for (const service of services) {
      const startTime = parse(service.start_time, 'HH:mm', new Date());
      const endTime = parse(service.end_time, 'HH:mm', new Date());

      if (endTime < startTime) {
        endTime.setDate(endTime.getDate() + 1);
      }

      if (isWithinInterval(timeObj, { start: startTime, end: endTime })) {
        return service;
      }
    }

    return null;
  }

  /**
   * Find reservations that overlap with a given time window
   */
  private findOverlappingReservations(
    reservations: Reservation[],
    time: string,
    durationMinutes: number
  ): Reservation[] {
    const checkStart = parse(time, 'HH:mm', new Date());
    const checkEnd = addMinutes(checkStart, durationMinutes);

    return reservations.filter(reservation => {
      const resStart = parse(reservation.reservation_time, 'HH:mm', new Date());
      const resEnd = addMinutes(resStart, reservation.duration_minutes);

      // Check if time windows overlap
      return (
        (resStart <= checkStart && resEnd > checkStart) || // reservation starts before and ends during
        (resStart >= checkStart && resStart < checkEnd) || // reservation starts during
        (resStart <= checkStart && resEnd >= checkEnd) // reservation completely encompasses check window
      );
    });
  }

  /**
   * Round time to nearest slot
   */
  private roundToSlot(time: string, slotDuration: number): string {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const roundedMinutes = Math.floor(totalMinutes / slotDuration) * slotDuration;
    const roundedHours = Math.floor(roundedMinutes / 60);
    const roundedMins = roundedMinutes % 60;
    return `${roundedHours.toString().padStart(2, '0')}:${roundedMins.toString().padStart(2, '0')}`;
  }

  /**
   * Suggest alternative times when requested slot is full
   */
  private async suggestAlternativeTimes(
    locationId: string,
    date: string,
    service: Service,
    partySize: number,
    existingReservations: Reservation[]
  ): Promise<string[]> {
    const suggestions: string[] = [];
    const slotDuration = service.slot_duration_minutes;

    const startTime = parse(service.start_time, 'HH:mm', new Date());
    const endTime = parse(service.end_time, 'HH:mm', new Date());

    let currentSlot = startTime;

    while (currentSlot <= endTime && suggestions.length < 3) {
      const slotTime = format(currentSlot, 'HH:mm');
      
      const overlapping = this.findOverlappingReservations(
        existingReservations,
        slotTime,
        service.default_reservation_duration
      );

      const bookedCovers = overlapping.reduce((sum, r) => sum + r.party_size, 0);
      const availableCovers = (service.max_covers || 999) - bookedCovers;

      if (availableCovers >= partySize) {
        suggestions.push(slotTime);
      }

      currentSlot = addMinutes(currentSlot, slotDuration);
    }

    return suggestions;
  }

  /**
   * Check if tables can be combined to accommodate party size
   */
  async canCombineTablesForPartySize(
    locationId: string,
    partySize: number,
    zoneId?: string
  ): Promise<{ canCombine: boolean; tables?: string[] }> {
    let tables = await this.dataLayer.tables.findByLocation(locationId);
    
    if (zoneId) {
      tables = tables.filter(t => t.zone_id === zoneId);
    }

    const combinableTables = tables.filter(t => t.is_combinable && t.is_active);

    // Try to find combination of 2 tables
    for (let i = 0; i < combinableTables.length; i++) {
      for (let j = i + 1; j < combinableTables.length; j++) {
        const combined_capacity = combinableTables[i].max_capacity + combinableTables[j].max_capacity;
        if (combined_capacity >= partySize) {
          return {
            canCombine: true,
            tables: [combinableTables[i].id, combinableTables[j].id],
          };
        }
      }
    }

    return { canCombine: false };
  }
}
