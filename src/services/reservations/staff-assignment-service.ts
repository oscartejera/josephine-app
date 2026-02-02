/**
 * Staff Assignment Service (Feature J)
 * Gestiona turnos por zona y asignación de personal a reservas
 */

import type { ReservationsDataLayer } from './repository-interface';
import type { Reservation } from '@/types/reservations';

export interface StaffMember {
  id: string;
  name: string;
  role: 'server' | 'host' | 'manager';
  zones: string[]; // Zonas donde puede trabajar
}

export interface ZoneShift {
  id: string;
  zone_id: string;
  staff_id: string;
  service_id: string;
  date: string;
  start_time: string;
  end_time: string;
}

export interface StaffKPIs {
  staff_id: string;
  staff_name: string;
  total_reservations: number;
  total_covers: number;
  no_shows: number;
  average_party_size: number;
  on_time_percentage: number;
}

export class StaffAssignmentService {
  constructor(private dataLayer: ReservationsDataLayer) {}

  /**
   * Assign staff member to reservation
   */
  async assignStaff(reservationId: string, staffId: string): Promise<void> {
    // In production would update reservation with assigned_staff_id
    await this.dataLayer.reservations.update(reservationId, {
      notes: `Assigned to staff: ${staffId}`,
    } as any);

    console.log(`[Staff] Assigned ${staffId} to reservation ${reservationId}`);
  }

  /**
   * Get staff KPIs for a period
   */
  async getStaffKPIs(
    locationId: string,
    startDate: string,
    endDate: string
  ): Promise<StaffKPIs[]> {
    const reservations = await this.dataLayer.reservations.findByDateRange(
      locationId,
      startDate,
      endDate
    );

    // Mock staff data (in production would query staff table)
    const mockStaff = [
      { id: 'staff-1', name: 'María Pérez' },
      { id: 'staff-2', name: 'Carlos López' },
      { id: 'staff-3', name: 'Ana García' },
    ];

    return mockStaff.map(staff => {
      // In production, would filter by assigned_staff_id
      const staffReservations = reservations.filter((r, idx) => idx % 3 === parseInt(staff.id.split('-')[1]) - 1);
      
      const totalReservations = staffReservations.length;
      const totalCovers = staffReservations.reduce((sum, r) => sum + r.party_size, 0);
      const noShows = staffReservations.filter(r => r.status === 'no_show').length;
      const avgPartySize = totalReservations > 0 ? totalCovers / totalReservations : 0;

      return {
        staff_id: staff.id,
        staff_name: staff.name,
        total_reservations: totalReservations,
        total_covers: totalCovers,
        no_shows: noShows,
        average_party_size: avgPartySize,
        on_time_percentage: 95, // Mock
      };
    });
  }

  /**
   * Get zone shifts for a date
   */
  async getZoneShifts(locationId: string, date: string): Promise<ZoneShift[]> {
    // Mock implementation
    return [
      {
        id: 'shift-1',
        zone_id: 'zone-1',
        staff_id: 'staff-1',
        service_id: 'service-dinner',
        date,
        start_time: '20:00',
        end_time: '23:30',
      },
    ];
  }
}
