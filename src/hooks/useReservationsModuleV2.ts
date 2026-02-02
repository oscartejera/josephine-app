/**
 * useReservationsModuleV2
 * Nueva versión del hook que usa los servicios completos del módulo
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useReservations } from '@/contexts/ReservationsContext';
import { format } from 'date-fns';
import type {
  Reservation,
  WaitlistEntry,
  ReservationSettings,
  CreateReservationInput,
  AddToWaitlistInput,
} from '@/types/reservations';

export interface DayStats {
  totalReservations: number;
  totalCovers: number;
  confirmedReservations: number;
  pendingReservations: number;
  seatedReservations: number;
  noShows: number;
  cancellations: number;
  occupancyByHour: Record<string, { reservations: number; covers: number }>;
}

export function useReservationsModuleV2() {
  const { selectedLocationId } = useApp();
  const {
    dataLayer,
    availabilityService,
    seatingService,
    messagingService,
    depositService,
    posIntegration,
  } = useReservations();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [settings, setSettings] = useState<ReservationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Get the actual location ID string (handle 'all' case)
  const locationId = selectedLocationId === 'all' ? null : selectedLocationId;

  // Fetch reservations for selected date and location
  const fetchReservations = useCallback(async () => {
    if (!locationId) {
      setReservations([]);
      return;
    }

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const data = await dataLayer.reservations.findByDate(locationId, dateStr);
      setReservations(data);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    }
  }, [locationId, selectedDate, dataLayer]);

  // Fetch waitlist
  const fetchWaitlist = useCallback(async () => {
    if (!locationId) {
      setWaitlist([]);
      return;
    }

    try {
      const data = await dataLayer.waitlist.findActive(locationId);
      setWaitlist(data);
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    }
  }, [locationId, dataLayer]);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    if (!locationId) {
      setSettings(null);
      return;
    }

    try {
      const data = await dataLayer.settings.getOrCreate(locationId);
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, [locationId, dataLayer]);

  // Initial fetch
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchReservations(),
        fetchWaitlist(),
        fetchSettings(),
      ]);
      setLoading(false);
    };
    fetchAll();
  }, [fetchReservations, fetchWaitlist, fetchSettings]);

  // Calculate day stats
  const dayStats = useMemo<DayStats>(() => {
    const stats: DayStats = {
      totalReservations: 0,
      totalCovers: 0,
      confirmedReservations: 0,
      pendingReservations: 0,
      seatedReservations: 0,
      noShows: 0,
      cancellations: 0,
      occupancyByHour: {},
    };

    reservations.forEach((res) => {
      stats.totalReservations++;
      stats.totalCovers += res.party_size;

      switch (res.status) {
        case 'confirmed':
        case 'reconfirmed':
          stats.confirmedReservations++;
          break;
        case 'pending':
          stats.pendingReservations++;
          break;
        case 'seated':
          stats.seatedReservations++;
          break;
        case 'no_show':
          stats.noShows++;
          break;
        case 'cancelled':
          stats.cancellations++;
          break;
      }

      // Group by hour
      const hour = res.reservation_time.substring(0, 5);
      if (!stats.occupancyByHour[hour]) {
        stats.occupancyByHour[hour] = { reservations: 0, covers: 0 };
      }
      stats.occupancyByHour[hour].reservations++;
      stats.occupancyByHour[hour].covers += res.party_size;
    });

    return stats;
  }, [reservations]);

  // Create reservation with availability check
  const createReservation = useCallback(
    async (data: CreateReservationInput) => {
      if (!locationId) throw new Error('No location selected');

      // Check availability first
      const availabilityCheck = await availabilityService.checkAvailability({
        locationId,
        date: data.reservation_date,
        time: data.reservation_time,
        party_size: data.party_size,
        zone_id: data.zone_id,
        service_id: data.service_id,
      });

      if (!availabilityCheck.available) {
        throw new Error(availabilityCheck.reason || 'No disponible');
      }

      // Create reservation
      const reservation = await dataLayer.reservations.createReservation(locationId, data);

      // Auto-assign table if possible
      if (!data.pos_table_id) {
        try {
          await seatingService.autoAssignTable(reservation.id);
        } catch (error) {
          console.warn('Could not auto-assign table:', error);
        }
      }

      // Send confirmation if email provided
      if (data.guest_email && settings?.send_confirmation_email) {
        try {
          await messagingService.sendConfirmation(reservation.id);
        } catch (error) {
          console.error('Failed to send confirmation:', error);
        }
      }

      // Check if deposit is required
      if (settings?.require_deposit) {
        const isRequired = await depositService.isDepositRequired(reservation);
        if (isRequired) {
          console.log('Deposit required for this reservation');
          // In real app, would trigger payment flow
        }
      }

      await fetchReservations();
      return reservation;
    },
    [locationId, settings, dataLayer, availabilityService, seatingService, messagingService, depositService, fetchReservations]
  );

  // Update reservation
  const updateReservation = useCallback(
    async (id: string, updates: Partial<Reservation>) => {
      await dataLayer.reservations.updateReservation(id, updates);
      await fetchReservations();
    },
    [dataLayer, fetchReservations]
  );

  // Cancel reservation
  const cancelReservation = useCallback(
    async (id: string, reason?: string) => {
      await dataLayer.reservations.cancelReservation(id, reason);
      
      // Handle deposit refund if applicable
      const reservation = await dataLayer.reservations.findById(id);
      if (reservation?.deposit_id) {
        try {
          await depositService.handleCancellation(id);
        } catch (error) {
          console.error('Failed to handle deposit:', error);
        }
      }

      // Send cancellation email
      try {
        await messagingService.sendCancellation(id);
      } catch (error) {
        console.error('Failed to send cancellation:', error);
      }

      await fetchReservations();
    },
    [dataLayer, depositService, messagingService, fetchReservations]
  );

  // Confirm reservation
  const confirmReservation = useCallback(
    async (id: string) => {
      await dataLayer.reservations.confirmReservation(id);
      await fetchReservations();
    },
    [dataLayer, fetchReservations]
  );

  // Seat guests
  const seatGuests = useCallback(
    async (id: string, tableId?: string) => {
      if (tableId) {
        // Use POS integration for proper seating
        await posIntegration.seatReservation(id, tableId);
      } else {
        // Auto-assign and seat
        const assignedTableId = await seatingService.autoAssignTable(id);
        if (assignedTableId) {
          await posIntegration.seatReservation(id, assignedTableId);
        } else {
          // Just mark as seated without table
          await dataLayer.reservations.markAsSeated(id);
        }
      }
      
      await fetchReservations();
    },
    [dataLayer, posIntegration, seatingService, fetchReservations]
  );

  // Mark as no-show
  const markNoShow = useCallback(
    async (id: string) => {
      await dataLayer.reservations.markAsNoShow(id);
      
      // Handle deposit and customer tracking
      try {
        await depositService.handleNoShow(id);
      } catch (error) {
        console.error('Failed to handle no-show:', error);
      }
      
      await fetchReservations();
    },
    [dataLayer, depositService, fetchReservations]
  );

  // Complete reservation
  const completeReservation = useCallback(
    async (id: string) => {
      await dataLayer.reservations.markAsCompleted(id);
      
      // Send post-visit survey if configured
      try {
        await messagingService.sendPostVisitSurvey(id);
      } catch (error) {
        console.error('Failed to send survey:', error);
      }
      
      await fetchReservations();
    },
    [dataLayer, messagingService, fetchReservations]
  );

  // Assign table
  const assignTable = useCallback(
    async (reservationId: string, tableId: string) => {
      await seatingService.assignTable(reservationId, tableId);
      await fetchReservations();
    },
    [seatingService, fetchReservations]
  );

  // Get table recommendations
  const getTableRecommendations = useCallback(
    async (reservationId: string) => {
      return await seatingService.getTableRecommendations(reservationId);
    },
    [seatingService]
  );

  // Add to waitlist
  const addToWaitlist = useCallback(
    async (data: AddToWaitlistInput) => {
      if (!locationId) throw new Error('No location selected');
      await dataLayer.waitlist.addToWaitlist(locationId, data);
      await fetchWaitlist();
    },
    [locationId, dataLayer, fetchWaitlist]
  );

  // Remove from waitlist
  const removeFromWaitlist = useCallback(
    async (id: string) => {
      await dataLayer.waitlist.markAsLeft(id);
      await fetchWaitlist();
    },
    [dataLayer, fetchWaitlist]
  );

  // Seat from waitlist
  const seatFromWaitlist = useCallback(
    async (id: string, tableId?: string) => {
      await dataLayer.waitlist.markAsSeated(id);
      
      // Send notification
      try {
        await messagingService.sendWaitlistNotification(id);
      } catch (error) {
        console.error('Failed to send notification:', error);
      }
      
      await fetchWaitlist();
    },
    [dataLayer, messagingService, fetchWaitlist]
  );

  // Get time slots for the day
  const getTimeSlots = useCallback(() => {
    const slots: string[] = [];
    for (let hour = 12; hour <= 23; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  // Get available time slots with capacity info
  const getAvailableTimeSlots = useCallback(
    async (serviceId: string, partySize: number) => {
      if (!locationId) return [];
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      return await availabilityService.getAvailableTimeSlots(
        locationId,
        dateStr,
        serviceId,
        partySize
      );
    },
    [locationId, selectedDate, availabilityService]
  );

  // Get capacity summary
  const getCapacitySummary = useCallback(
    async () => {
      if (!locationId) return [];
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      return await availabilityService.getCapacitySummary(locationId, dateStr);
    },
    [locationId, selectedDate, availabilityService]
  );

  return {
    // State
    reservations,
    waitlist,
    settings,
    loading,
    selectedDate,
    setSelectedDate,
    dayStats,
    locationId,

    // Reservation actions
    createReservation,
    updateReservation,
    cancelReservation,
    confirmReservation,
    seatGuests,
    markNoShow,
    completeReservation,
    assignTable,
    getTableRecommendations,

    // Waitlist actions
    addToWaitlist,
    removeFromWaitlist,
    seatFromWaitlist,

    // Availability
    getTimeSlots,
    getAvailableTimeSlots,
    getCapacitySummary,

    // Services access
    services: {
      availability: availabilityService,
      seating: seatingService,
      messaging: messagingService,
      deposit: depositService,
      posIntegration,
    },

    // Utilities
    refetch: fetchReservations,
  };
}
