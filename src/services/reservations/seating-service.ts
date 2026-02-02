/**
 * Seating Service
 * Maneja la asignación de mesas automática y manual
 */

import type {
  ReservationsDataLayer,
} from './repository-interface';
import type {
  Reservation,
  Table,
} from '@/types/reservations';

export interface SeatingRecommendation {
  table_id: string;
  table_name: string;
  score: number;
  reason: string;
  zone_name?: string;
}

export class SeatingService {
  constructor(private dataLayer: ReservationsDataLayer) {}

  /**
   * Get recommended tables for a reservation
   */
  async getTableRecommendations(
    reservationId: string,
    preferences?: {
      zone_id?: string;
      prefer_window?: boolean;
      prefer_quiet?: boolean;
    }
  ): Promise<SeatingRecommendation[]> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    // Get all active tables for the location
    let tables = await this.dataLayer.tables.findByLocation(reservation.location_id);
    tables = tables.filter(t => t.is_active);

    // Filter by zone if specified
    if (preferences?.zone_id) {
      tables = tables.filter(t => t.zone_id === preferences.zone_id);
    } else if (reservation.zone_id) {
      tables = tables.filter(t => t.zone_id === reservation.zone_id);
    }

    // Get all reservations for the same date/time to check table availability
    const dateReservations = await this.dataLayer.reservations.findByDate(
      reservation.location_id,
      reservation.reservation_date
    );

    const activeReservations = dateReservations.filter(
      r => r.id !== reservationId && !['cancelled', 'no_show', 'completed'].includes(r.status)
    );

    // Check which tables are occupied during this reservation's time
    const occupiedTableIds = this.getOccupiedTables(
      activeReservations,
      reservation.reservation_time,
      reservation.duration_minutes
    );

    // Filter out occupied tables
    const availableTables = tables.filter(t => !occupiedTableIds.includes(t.id));

    // Score each table based on suitability
    const recommendations: SeatingRecommendation[] = [];

    for (const table of availableTables) {
      const score = this.scoreTable(table, reservation, preferences);
      
      if (score > 0) {
        const zone = table.zone_id ? await this.dataLayer.zones.findById(table.zone_id) : null;
        
        recommendations.push({
          table_id: table.id,
          table_name: table.name,
          score,
          reason: this.getRecommendationReason(table, reservation),
          zone_name: zone?.name,
        });
      }
    }

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations.slice(0, 5); // Return top 5 recommendations
  }

  /**
   * Automatically assign best table to a reservation
   */
  async autoAssignTable(reservationId: string): Promise<string | null> {
    const recommendations = await this.getTableRecommendations(reservationId);
    
    if (recommendations.length === 0) {
      return null;
    }

    const bestTable = recommendations[0];
    await this.dataLayer.reservations.updateReservation(reservationId, {
      pos_table_id: bestTable.table_id,
    });

    // Mark as auto-assigned
    await this.dataLayer.reservations.update(reservationId, {
      auto_assigned: true,
    });

    return bestTable.table_id;
  }

  /**
   * Manually assign table to reservation
   */
  async assignTable(reservationId: string, tableId: string): Promise<void> {
    const table = await this.dataLayer.tables.findById(tableId);
    if (!table || !table.is_active) {
      throw new Error('Table not available');
    }

    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    // Check table capacity
    if (reservation.party_size < table.min_capacity || reservation.party_size > table.max_capacity) {
      throw new Error(`Table capacity (${table.min_capacity}-${table.max_capacity}) doesn't match party size (${reservation.party_size})`);
    }

    // Check if table is available at this time
    const dateReservations = await this.dataLayer.reservations.findByDate(
      reservation.location_id,
      reservation.reservation_date
    );

    const occupiedTableIds = this.getOccupiedTables(
      dateReservations.filter(r => r.id !== reservationId),
      reservation.reservation_time,
      reservation.duration_minutes
    );

    if (occupiedTableIds.includes(tableId)) {
      throw new Error('Table is occupied at this time');
    }

    await this.dataLayer.reservations.updateReservation(reservationId, {
      pos_table_id: tableId,
    });
  }

  /**
   * Unassign table from reservation
   */
  async unassignTable(reservationId: string): Promise<void> {
    await this.dataLayer.reservations.updateReservation(reservationId, {
      pos_table_id: null,
    });
  }

  /**
   * Get table status for a specific date/time
   */
  async getTableStatus(
    locationId: string,
    date: string,
    time: string
  ): Promise<{ table: Table; status: 'available' | 'occupied' | 'reserved'; reservation?: Reservation }[]> {
    const tables = await this.dataLayer.tables.findByLocation(locationId);
    const reservations = await this.dataLayer.reservations.findByDate(locationId, date);

    const activeReservations = reservations.filter(
      r => !['cancelled', 'no_show'].includes(r.status)
    );

    return tables.map(table => {
      // Find if table has a reservation at this time
      const tableReservation = activeReservations.find(r => {
        if (r.pos_table_id !== table.id) return false;
        
        // Check if time overlaps
        return this.timeOverlaps(
          time,
          120, // Check 2 hours window
          r.reservation_time,
          r.duration_minutes
        );
      });

      if (tableReservation) {
        const status = tableReservation.status === 'seated' ? 'occupied' : 'reserved';
        return {
          table,
          status,
          reservation: tableReservation,
        };
      }

      return {
        table,
        status: 'available' as const,
      };
    });
  }

  /**
   * Auto-assign tables for all pending reservations on a date
   */
  async autoAssignAllPending(locationId: string, date: string): Promise<number> {
    const reservations = await this.dataLayer.reservations.findByDate(locationId, date);
    
    const pendingWithoutTable = reservations.filter(
      r => r.status === 'confirmed' && !r.pos_table_id
    );

    // Sort by time
    pendingWithoutTable.sort((a, b) => a.reservation_time.localeCompare(b.reservation_time));

    let assignedCount = 0;

    for (const reservation of pendingWithoutTable) {
      try {
        const tableId = await this.autoAssignTable(reservation.id);
        if (tableId) {
          assignedCount++;
        }
      } catch (error) {
        console.error(`Failed to assign table for reservation ${reservation.id}:`, error);
      }
    }

    return assignedCount;
  }

  /**
   * Release table from reservation (when guests finish)
   */
  async releaseTable(reservationId: string): Promise<void> {
    await this.dataLayer.reservations.markAsCompleted(reservationId);

    // Check waitlist and notify next in line
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (reservation && reservation.pos_table_id) {
      const table = await this.dataLayer.tables.findById(reservation.pos_table_id);
      if (table) {
        await this.notifyWaitlistForTable(reservation.location_id, table);
      }
    }
  }

  /**
   * Notify waitlist when table becomes available
   */
  private async notifyWaitlistForTable(locationId: string, table: Table): Promise<void> {
    const waitlist = await this.dataLayer.waitlist.findActive(locationId);
    
    // Find suitable waitlist entry
    const suitable = waitlist.find(
      w => w.party_size >= table.min_capacity && w.party_size <= table.max_capacity
    );

    if (suitable && suitable.status === 'waiting') {
      await this.dataLayer.waitlist.markAsNotified(suitable.id);
      
      // Log message to notify customer
      await this.dataLayer.messageLogs.logMessage({
        reservation_id: null,
        waitlist_id: suitable.id,
        customer_profile_id: null,
        type: 'waitlist_notification',
        channel: 'sms',
        recipient: suitable.guest_phone || '',
        subject: null,
        body: `Tu mesa está lista! Mesa ${table.name} para ${suitable.party_size} personas.`,
        status: 'pending',
        sent_at: null,
        delivered_at: null,
        error: null,
      });
    }
  }

  /**
   * Score a table based on suitability for the reservation
   */
  private scoreTable(
    table: Table,
    reservation: Reservation,
    preferences?: any
  ): number {
    let score = 100;

    // Perfect capacity match gets bonus
    if (table.max_capacity === reservation.party_size) {
      score += 50;
    } else if (table.min_capacity === reservation.party_size) {
      score += 30;
    }

    // Penalty for oversized tables
    const wastedSeats = table.max_capacity - reservation.party_size;
    if (wastedSeats > 0) {
      score -= wastedSeats * 10;
    }

    // Penalty for undersized (shouldn't happen but just in case)
    if (table.max_capacity < reservation.party_size) {
      return 0; // Table not suitable
    }

    // Zone match bonus
    if (reservation.zone_id && table.zone_id === reservation.zone_id) {
      score += 20;
    }

    // Preferences bonus
    if (preferences) {
      // Add preference-based scoring here
      // For now, simple implementation
    }

    return Math.max(0, score);
  }

  /**
   * Get human-readable reason for recommendation
   */
  private getRecommendationReason(table: Table, reservation: Reservation): string {
    if (table.max_capacity === reservation.party_size) {
      return `Capacidad perfecta para ${reservation.party_size} personas`;
    }

    if (table.min_capacity === reservation.party_size) {
      return `Capacidad mínima ideal`;
    }

    return `Mesa para ${table.min_capacity}-${table.max_capacity} personas`;
  }

  /**
   * Get tables that are occupied during a time window
   */
  private getOccupiedTables(
    reservations: Reservation[],
    time: string,
    durationMinutes: number
  ): string[] {
    const occupied: string[] = [];

    for (const reservation of reservations) {
      if (!reservation.pos_table_id) continue;

      if (this.timeOverlaps(time, durationMinutes, reservation.reservation_time, reservation.duration_minutes)) {
        occupied.push(reservation.pos_table_id);
        
        // Include combined tables
        if (reservation.pos_table_id) {
          // Get table and its combined_with tables
          // For now, just add the main table
        }
      }
    }

    return occupied;
  }

  /**
   * Check if two time windows overlap
   */
  private timeOverlaps(
    time1: string,
    duration1: number,
    time2: string,
    duration2: number
  ): boolean {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);

    const start1 = h1 * 60 + m1;
    const end1 = start1 + duration1;
    const start2 = h2 * 60 + m2;
    const end2 = start2 + duration2;

    return (
      (start1 <= start2 && end1 > start2) ||
      (start2 <= start1 && end2 > start1) ||
      (start1 <= start2 && end1 >= end2)
    );
  }
}
