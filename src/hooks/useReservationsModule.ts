import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';

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
  customer_profile_id?: string | null;
  source?: string | null;
}

export interface CustomerProfile {
  id: string;
  group_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  total_visits: number | null;
  total_spent: number | null;
  last_visit_at: string | null;
  created_at: string;
}

export interface WaitlistEntry {
  id: string;
  location_id: string;
  guest_name: string;
  guest_phone: string | null;
  party_size: number;
  quoted_wait_minutes: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface ReservationSettings {
  id: string;
  location_id: string | null;
  default_reservation_duration: number | null;
  max_covers_per_slot: number | null;
  require_deposit: boolean | null;
  deposit_amount_per_person: number | null;
  auto_confirm: boolean | null;
  confirmation_message: string | null;
  slot_duration_minutes: number | null;
  cancellation_deadline_hours: number | null;
}

export interface ReservationTurn {
  id: string;
  location_id: string;
  name: string;
  start_time: string;
  end_time: string;
  max_covers: number;
  day_of_week: number[];
}

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

interface CreateReservationInput {
  guest_name: string;
  guest_phone?: string;
  guest_email?: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  duration_minutes?: number;
  notes?: string;
  special_requests?: string;
  pos_table_id?: string;
  customer_profile_id?: string;
  source?: string;
}

interface AddToWaitlistInput {
  guest_name: string;
  guest_phone?: string;
  party_size: number;
  quoted_wait_minutes?: number;
  notes?: string;
}

export function useReservationsModule() {
  const { selectedLocationId } = useApp();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [settings, setSettings] = useState<ReservationSettings | null>(null);
  const [turns, setTurns] = useState<ReservationTurn[]>([]);
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
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('location_id', locationId)
        .eq('reservation_date', dateStr)
        .order('reservation_time', { ascending: true });

      if (error) throw error;
      setReservations((data || []) as Reservation[]);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    }
  }, [locationId, selectedDate]);

  // Fetch waitlist
  const fetchWaitlist = useCallback(async () => {
    if (!locationId) {
      setWaitlist([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('reservation_waitlist')
        .select('*')
        .eq('location_id', locationId)
        .in('status', ['waiting', 'notified'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Map the data to our interface
      const mapped = (data || []).map((item: any) => ({
        id: item.id,
        location_id: item.location_id,
        guest_name: item.guest_name,
        guest_phone: item.guest_phone,
        party_size: item.party_size,
        quoted_wait_minutes: item.quoted_wait_minutes || null,
        status: item.status,
        notes: item.notes,
        created_at: item.created_at,
      }));
      
      setWaitlist(mapped);
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    }
  }, [locationId]);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    if (!locationId) {
      setSettings(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('reservation_settings')
        .select('*')
        .eq('location_id', locationId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setSettings(data as ReservationSettings);
      } else {
        setSettings(null);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, [locationId]);

  // Fetch turns
  const fetchTurns = useCallback(async () => {
    if (!locationId) {
      setTurns([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('reservation_turns')
        .select('*')
        .eq('location_id', locationId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      // Map the data to our interface
      const mapped = (data || []).map((item: any) => ({
        id: item.id,
        location_id: item.location_id,
        name: item.name,
        start_time: item.start_time,
        end_time: item.end_time,
        max_covers: item.max_covers,
        day_of_week: item.day_of_week || [],
      }));
      
      setTurns(mapped);
    } catch (error) {
      console.error('Error fetching turns:', error);
    }
  }, [locationId]);

  // Initial fetch
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchReservations(),
        fetchWaitlist(),
        fetchSettings(),
        fetchTurns(),
      ]);
      setLoading(false);
    };
    fetchAll();
  }, [fetchReservations, fetchWaitlist, fetchSettings, fetchTurns]);

  // Realtime subscription
  useEffect(() => {
    if (!locationId) return;

    const channel = supabase
      .channel(`reservations-module-${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `location_id=eq.${locationId}`,
        },
        () => fetchReservations()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservation_waitlist',
          filter: `location_id=eq.${locationId}`,
        },
        () => fetchWaitlist()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, fetchReservations, fetchWaitlist]);

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

  // Create reservation
  const createReservation = useCallback(
    async (data: CreateReservationInput) => {
      if (!locationId) throw new Error('No location selected');

      const { data: newRes, error } = await supabase
        .from('reservations')
        .insert({
          location_id: locationId,
          guest_name: data.guest_name,
          guest_phone: data.guest_phone || null,
          guest_email: data.guest_email || null,
          party_size: data.party_size,
          reservation_date: data.reservation_date,
          reservation_time: data.reservation_time,
          duration_minutes: data.duration_minutes || settings?.default_reservation_duration || 90,
          notes: data.notes || null,
          special_requests: data.special_requests || null,
          pos_table_id: data.pos_table_id || null,
          customer_profile_id: data.customer_profile_id || null,
          source: data.source || 'manual',
          status: settings?.auto_confirm ? 'confirmed' : 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Send confirmation email if email provided
      if (newRes && data.guest_email) {
        try {
          await supabase.functions.invoke('send_reservation_confirmation', {
            body: { reservationId: newRes.id, type: 'confirmation' },
          });
        } catch (emailError) {
          console.error('Failed to send confirmation email:', emailError);
        }
      }

      return newRes as Reservation;
    },
    [locationId, settings]
  );

  // Update reservation
  const updateReservation = useCallback(
    async (id: string, updates: Partial<Reservation>) => {
      const { error } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    []
  );

  // Cancel reservation
  const cancelReservation = useCallback(
    async (id: string, reason?: string) => {
      const updates: Partial<Reservation> = { status: 'cancelled' };
      if (reason) {
        updates.notes = reason;
      }

      const { error } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Send cancellation email
      try {
        await supabase.functions.invoke('send_reservation_confirmation', {
          body: { reservationId: id, type: 'cancellation' },
        });
      } catch (emailError) {
        console.error('Failed to send cancellation email:', emailError);
      }
    },
    []
  );

  // Confirm reservation
  const confirmReservation = useCallback(async (id: string) => {
    await updateReservation(id, { status: 'confirmed' });
  }, [updateReservation]);

  // Seat guests
  const seatGuests = useCallback(
    async (id: string, tableId?: string) => {
      const updates: Partial<Reservation> = { status: 'seated' };
      if (tableId) {
        updates.pos_table_id = tableId;
      }
      await updateReservation(id, updates);
    },
    [updateReservation]
  );

  // Mark as no-show
  const markNoShow = useCallback(async (id: string) => {
    await updateReservation(id, { status: 'no_show' });
  }, [updateReservation]);

  // Complete reservation
  const completeReservation = useCallback(async (id: string) => {
    await updateReservation(id, { status: 'completed' });
  }, [updateReservation]);

  // Assign table
  const assignTable = useCallback(
    async (reservationId: string, tableId: string) => {
      await updateReservation(reservationId, { pos_table_id: tableId });
    },
    [updateReservation]
  );

  // Add to waitlist
  const addToWaitlist = useCallback(
    async (data: AddToWaitlistInput) => {
      if (!locationId) throw new Error('No location selected');

      const insertData: Record<string, unknown> = {
        location_id: locationId,
        guest_name: data.guest_name,
        party_size: data.party_size,
        status: 'waiting',
      };
      
      if (data.guest_phone) insertData.guest_phone = data.guest_phone;
      if (data.quoted_wait_minutes) insertData.quoted_wait_minutes = data.quoted_wait_minutes;
      if (data.notes) insertData.notes = data.notes;

      const { error } = await supabase
        .from('reservation_waitlist')
        .insert(insertData as any);

      if (error) throw error;
    },
    [locationId]
  );

  // Remove from waitlist
  const removeFromWaitlist = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('reservation_waitlist')
      .update({ status: 'left' })
      .eq('id', id);

    if (error) throw error;
  }, []);

  // Seat from waitlist
  const seatFromWaitlist = useCallback(async (id: string, tableId?: string) => {
    const { error } = await supabase
      .from('reservation_waitlist')
      .update({ status: 'seated' })
      .eq('id', id);

    if (error) throw error;
  }, []);

  // Get time slots for the day
  const getTimeSlots = useCallback(() => {
    const slots: string[] = [];
    for (let hour = 12; hour <= 23; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  return {
    // State
    reservations,
    waitlist,
    settings,
    turns,
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

    // Waitlist actions
    addToWaitlist,
    removeFromWaitlist,
    seatFromWaitlist,

    // Utilities
    getTimeSlots,
    refetch: fetchReservations,
  };
}
