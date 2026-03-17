/**
 * usePublicBooking Hook
 * For public booking widget - no auth required
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format, isBefore, startOfDay } from 'date-fns';

export interface ReservationResult {
  id: string;
  location_name: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  guest_name: string;
  guest_email: string;
}

interface LocationBookingInfo {
  id: string;
  name: string;
  public_name?: string;
  address?: string;
  city?: string;
  phone?: string;
  booking_enabled: boolean;
  booking_min_party: number;
  booking_max_party: number;
  booking_lead_days: number;
  booking_max_days_ahead: number;
  booking_slot_duration: number;
  booking_slots_per_hour: number;
  booking_start_time: string;
  booking_end_time: string;
  booking_notes?: string;
}

interface CreateReservationData {
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  special_requests?: string;
}

export function usePublicBooking(locationId?: string) {
  const [location, setLocation] = useState<LocationBookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [occupiedSlots, setOccupiedSlots] = useState<Record<string, string[]>>({});

  // Load location data
  useEffect(() => {
    const loadLocation = async () => {
      if (!locationId) {
        setLoading(false);
        setError('No location specified');
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('locations')
          .select('id, name, city')
          .eq('id', locationId)
          .single();

        if (fetchError) throw fetchError;

        // Mock booking settings for now
        setLocation({
          id: data.id,
          name: data.name,
          city: data.city || undefined,
          booking_enabled: true,
          booking_min_party: 1,
          booking_max_party: 10,
          booking_lead_days: 0,
          booking_max_days_ahead: 60,
          booking_slot_duration: 30,
          booking_slots_per_hour: 2,
          booking_start_time: '12:00',
          booking_end_time: '23:00',
        });
      } catch (err) {
        console.error('Error loading location:', err);
        setError('Location not found');
      } finally {
        setLoading(false);
      }
    };

    loadLocation();
  }, [locationId]);

  const fetchOccupiedSlots = useCallback(async (dateStr: string) => {
    if (!locationId) return;

    // For now, return empty - in production would fetch from reservations table
    setOccupiedSlots((prev) => ({
      ...prev,
      [dateStr]: [],
    }));
  }, [locationId]);

  const getAvailableSlots = useCallback((dateStr: string): string[] => {
    if (!location) return [];

    const slots: string[] = [];
    const [startHour, startMin] = location.booking_start_time.split(':').map(Number);
    const [endHour, endMin] = location.booking_end_time.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const duration = location.booking_slot_duration;

    for (let m = startMinutes; m < endMinutes; m += duration) {
      const hour = Math.floor(m / 60);
      const min = m % 60;
      const slot = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00`;

      // Check if slot is not occupied
      const occupied = occupiedSlots[dateStr] || [];
      if (!occupied.includes(slot)) {
        slots.push(slot);
      }
    }

    return slots;
  }, [location, occupiedSlots]);

  const isDateAvailable = useCallback((date: Date): boolean => {
    if (!location) return false;

    const today = startOfDay(new Date());
    const minDate = addDays(today, location.booking_lead_days);
    const maxDate = addDays(today, location.booking_max_days_ahead);

    return !isBefore(date, minDate) && !isBefore(maxDate, date);
  }, [location]);

  const createReservation = useCallback(async (data: CreateReservationData): Promise<ReservationResult> => {
    if (!locationId || !location) {
      throw new Error('Location not available');
    }

    // Call edge function to create reservation
    const { data: result, error: invokeError } = await supabase.functions.invoke('public_reservation', {
      body: {
        location_id: locationId,
        ...data,
      },
    });

    if (invokeError) throw invokeError;

    return {
      id: result.reservation_id,
      location_name: location.public_name || location.name,
      reservation_date: data.reservation_date,
      reservation_time: data.reservation_time,
      party_size: data.party_size,
      guest_name: data.guest_name,
      guest_email: data.guest_email,
    };
  }, [locationId, location]);

  return {
    location,
    loading,
    error,
    createReservation,
    fetchOccupiedSlots,
    getAvailableSlots,
    isDateAvailable,
  };
}
