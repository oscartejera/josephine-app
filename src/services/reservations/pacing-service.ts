/**
 * Pacing Service
 * Controla el ritmo de reservas por tramo horario (capacity pacing)
 */

import type { ReservationsDataLayer } from './repository-interface';
import type { Reservation } from '@/types/reservations';
import { parse, format, addMinutes, isWithinInterval } from 'date-fns';

export interface PacingRule {
  id: string;
  service_id: string;
  time_from: string; // HH:mm
  time_to: string; // HH:mm
  max_covers: number;
  max_reservations?: number;
  priority: number; // Para reglas solapadas
}

export interface PacingStatus {
  time_slot: string;
  current_covers: number;
  max_covers: number;
  current_reservations: number;
  max_reservations?: number;
  utilization_percentage: number;
  status: 'available' | 'almost_full' | 'full';
}

export class PacingService {
  constructor(private dataLayer: ReservationsDataLayer) {}

  /**
   * Check if a time slot is within pacing limits
   */
  async checkPacing(
    locationId: string,
    date: string,
    time: string,
    partySize: number,
    serviceId: string
  ): Promise<{
    allowed: boolean;
    current_covers: number;
    max_covers: number;
    reason?: string;
  }> {
    // Get all reservations for this date
    const reservations = await this.dataLayer.reservations.findByDate(locationId, date);
    const activeReservations = reservations.filter(r => 
      !['cancelled', 'no_show'].includes(r.status)
    );

    // Get service to determine pacing window
    const service = await this.dataLayer.services.findById(serviceId);
    if (!service) {
      return { allowed: false, current_covers: 0, max_covers: 0, reason: 'Service not found' };
    }

    // Calculate pacing window (default: 15 minutes)
    const pacingWindowMinutes = service.slot_duration_minutes || 15;
    
    // Get reservations within the pacing window
    const windowStart = parse(time, 'HH:mm', new Date());
    const windowEnd = addMinutes(windowStart, pacingWindowMinutes);

    const windowReservations = activeReservations.filter(r => {
      const resTime = parse(r.reservation_time, 'HH:mm', new Date());
      return isWithinInterval(resTime, { start: windowStart, end: windowEnd });
    });

    const currentCovers = windowReservations.reduce((sum, r) => sum + r.party_size, 0);
    
    // Determine max covers for this window
    // Could be from service-level setting or specific pacing rule
    const maxCovers = await this.getMaxCoversForWindow(serviceId, time);

    const allowed = (currentCovers + partySize) <= maxCovers;

    return {
      allowed,
      current_covers: currentCovers,
      max_covers: maxCovers,
      reason: allowed ? undefined : `Slot lleno (${currentCovers}/${maxCovers} cubiertos)`,
    };
  }

  /**
   * Get pacing status for all time slots in a service
   */
  async getPacingStatusForService(
    locationId: string,
    date: string,
    serviceId: string
  ): Promise<PacingStatus[]> {
    const service = await this.dataLayer.services.findById(serviceId);
    if (!service) return [];

    const reservations = await this.dataLayer.reservations.findByDate(locationId, date);
    const activeReservations = reservations.filter(r =>
      r.service_id === serviceId && !['cancelled', 'no_show'].includes(r.status)
    );

    const pacingStatuses: PacingStatus[] = [];
    const slotDuration = service.slot_duration_minutes || 15;

    let currentTime = parse(service.start_time, 'HH:mm', new Date());
    const endTime = parse(service.end_time, 'HH:mm', new Date());

    while (currentTime <= endTime) {
      const timeStr = format(currentTime, 'HH:mm');
      const windowEnd = addMinutes(currentTime, slotDuration);

      const windowReservations = activeReservations.filter(r => {
        const resTime = parse(r.reservation_time, 'HH:mm', new Date());
        return isWithinInterval(resTime, { start: currentTime, end: windowEnd });
      });

      const currentCovers = windowReservations.reduce((sum, r) => sum + r.party_size, 0);
      const maxCovers = await this.getMaxCoversForWindow(serviceId, timeStr);
      const utilization = maxCovers > 0 ? (currentCovers / maxCovers) * 100 : 0;

      let status: PacingStatus['status'] = 'available';
      if (utilization >= 100) status = 'full';
      else if (utilization >= 80) status = 'almost_full';

      pacingStatuses.push({
        time_slot: timeStr,
        current_covers: currentCovers,
        max_covers: maxCovers,
        current_reservations: windowReservations.length,
        utilization_percentage: utilization,
        status,
      });

      currentTime = addMinutes(currentTime, slotDuration);
    }

    return pacingStatuses;
  }

  /**
   * Get maximum covers allowed for a specific time window
   * Can be overridden by custom pacing rules
   */
  private async getMaxCoversForWindow(
    serviceId: string,
    time: string
  ): Promise<number> {
    const service = await this.dataLayer.services.findById(serviceId);
    if (!service) return 0;

    // Check for custom pacing rules (would be in a separate table/config)
    // For now, use service max_covers divided by slots per hour
    const slotsPerHour = 60 / (service.slot_duration_minutes || 15);
    const maxCoversPerSlot = service.max_covers 
      ? Math.ceil(service.max_covers / slotsPerHour)
      : 30; // Default

    return maxCoversPerSlot;
  }

  /**
   * Suggest best time slots based on pacing
   */
  async suggestOptimalTimeSlots(
    locationId: string,
    date: string,
    serviceId: string,
    partySize: number,
    count: number = 3
  ): Promise<string[]> {
    const pacingStatuses = await this.getPacingStatusForService(locationId, date, serviceId);

    // Sort by lowest utilization first
    const sortedSlots = pacingStatuses
      .filter(ps => ps.max_covers - ps.current_covers >= partySize)
      .sort((a, b) => a.utilization_percentage - b.utilization_percentage);

    return sortedSlots.slice(0, count).map(ps => ps.time_slot);
  }
}
