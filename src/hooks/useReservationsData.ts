import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Reservation {
  id: string;
  location_id: string;
  pos_table_id: string | null;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  duration_minutes: number;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  confirmation_sent_at: string | null;
  notes: string | null;
  special_requests: string | null;
  created_at: string;
}

export function useReservationsData(locationId: string, date?: Date) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReservations = useCallback(async () => {
    if (!locationId) return;

    setLoading(true);
    try {
      let query = supabase
        .from('reservations')
        .select('*')
        .eq('location_id', locationId)
        .in('status', ['pending', 'confirmed', 'seated'])
        .order('reservation_time', { ascending: true });

      if (date) {
        const dateStr = date.toISOString().split('T')[0];
        query = query.eq('reservation_date', dateStr);
      } else {
        // Default to today
        const today = new Date().toISOString().split('T')[0];
        query = query.eq('reservation_date', today);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReservations((data || []) as Reservation[]);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoading(false);
    }
  }, [locationId, date]);

  useEffect(() => {
    fetchReservations();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`reservations-${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `location_id=eq.${locationId}`,
        },
        () => {
          fetchReservations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, fetchReservations]);

  const createReservation = async (data: Omit<Reservation, 'id' | 'created_at' | 'confirmation_sent_at'>) => {
    const { data: newRes, error } = await supabase
      .from('reservations')
      .insert(data)
      .select()
      .single();

    if (error) throw error;

    // Send confirmation email
    if (newRes && data.guest_email) {
      try {
        await supabase.functions.invoke('send_reservation_confirmation', {
          body: { reservationId: newRes.id, type: 'confirmation' },
        });
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
    }

    await fetchReservations();
    return newRes;
  };

  const updateReservation = async (id: string, updates: Partial<Reservation>) => {
    const { error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    // If cancelled, send cancellation email
    if (updates.status === 'cancelled') {
      try {
        await supabase.functions.invoke('send_reservation_confirmation', {
          body: { reservationId: id, type: 'cancellation' },
        });
      } catch (emailError) {
        console.error('Failed to send cancellation email:', emailError);
      }
    }

    await fetchReservations();
  };

  const assignTable = async (reservationId: string, tableId: string) => {
    await updateReservation(reservationId, { pos_table_id: tableId });
  };

  const seatGuests = async (reservationId: string) => {
    await updateReservation(reservationId, { status: 'seated' });
  };

  return {
    reservations,
    loading,
    refetch: fetchReservations,
    createReservation,
    updateReservation,
    assignTable,
    seatGuests,
  };
}
