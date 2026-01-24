import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PublicLocation {
  id: string;
  name: string;
  public_name: string | null;
  address: string | null;
  phone: string | null;
  city: string | null;
  booking_min_party: number;
  booking_max_party: number;
  booking_advance_days: number;
  booking_time_slots: string[];
  booking_closed_days: number[];
  booking_notes: string | null;
}

export interface ReservationResult {
  id: string;
  guest_name: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  location_name: string;
}

export function usePublicBooking(locationId: string | undefined) {
  const [location, setLocation] = useState<PublicLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [occupiedSlots, setOccupiedSlots] = useState<Map<string, string[]>>(new Map());

  const fetchLocation = useCallback(async () => {
    if (!locationId) {
      setError('ID de ubicación no proporcionado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch using raw query to handle columns not yet in generated types
      const { data, error: fetchError } = await supabase
        .from('locations')
        .select('*')
        .eq('id', locationId)
        .eq('active', true)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('Este restaurante no acepta reservas online actualmente');
        } else {
          setError('Error al cargar información del restaurante');
        }
        return;
      }

      // Cast to any to access dynamic columns
      const rawData = data as Record<string, unknown>;

      // Check if booking is enabled
      if (!rawData.booking_enabled) {
        setError('Este restaurante no acepta reservas online actualmente');
        return;
      }

      // Build the location object with proper type casting
      const locationData: PublicLocation = {
        id: String(rawData.id || ''),
        name: String(rawData.name || ''),
        public_name: rawData.public_name ? String(rawData.public_name) : null,
        address: rawData.address ? String(rawData.address) : null,
        phone: rawData.phone ? String(rawData.phone) : null,
        city: rawData.city ? String(rawData.city) : null,
        booking_min_party: Number(rawData.booking_min_party) || 1,
        booking_max_party: Number(rawData.booking_max_party) || 12,
        booking_advance_days: Number(rawData.booking_advance_days) || 30,
        booking_time_slots: Array.isArray(rawData.booking_time_slots)
          ? (rawData.booking_time_slots as string[])
          : [],
        booking_closed_days: Array.isArray(rawData.booking_closed_days)
          ? (rawData.booking_closed_days as number[])
          : [],
        booking_notes: rawData.booking_notes ? String(rawData.booking_notes) : null,
      };

      setLocation(locationData);
    } catch (err) {
      console.error('Error fetching location:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  const fetchOccupiedSlots = useCallback(
    async (date: string) => {
      if (!locationId) return;

      try {
        const { data } = await supabase
          .from('reservations')
          .select('reservation_time')
          .eq('location_id', locationId)
          .eq('reservation_date', date)
          .in('status', ['pending', 'confirmed', 'seated']);

        if (data) {
          // Count reservations per slot
          const slotCounts = new Map<string, number>();
          data.forEach((r) => {
            const count = slotCounts.get(r.reservation_time) || 0;
            slotCounts.set(r.reservation_time, count + 1);
          });

          // Mark slots as occupied if they have 10+ reservations
          const occupied: string[] = [];
          slotCounts.forEach((count, slot) => {
            if (count >= 10) {
              occupied.push(slot);
            }
          });

          setOccupiedSlots((prev) => new Map(prev).set(date, occupied));
        }
      } catch (err) {
        console.error('Error fetching occupied slots:', err);
      }
    },
    [locationId]
  );

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const createReservation = async (data: {
    guest_name: string;
    guest_email: string;
    guest_phone?: string;
    party_size: number;
    reservation_date: string;
    reservation_time: string;
    special_requests?: string;
  }): Promise<ReservationResult> => {
    const { data: result, error: fnError } = await supabase.functions.invoke(
      'public_reservation',
      {
        body: {
          location_id: locationId,
          ...data,
        },
      }
    );

    if (fnError) {
      throw new Error('Error al conectar con el servidor');
    }

    if (result.error) {
      throw new Error(result.error);
    }

    return result.reservation;
  };

  const getAvailableSlots = (date: string): string[] => {
    if (!location) return [];

    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();

    // Check if day is closed
    if (location.booking_closed_days.includes(dayOfWeek)) {
      return [];
    }

    const occupied = occupiedSlots.get(date) || [];
    return location.booking_time_slots.filter((slot) => !occupied.includes(slot));
  };

  const isDateAvailable = (date: Date): boolean => {
    if (!location) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + location.booking_advance_days);

    // Check date range
    if (date < today || date > maxDate) {
      return false;
    }

    // Check if day is closed
    const dayOfWeek = date.getDay();
    if (location.booking_closed_days.includes(dayOfWeek)) {
      return false;
    }

    return true;
  };

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
