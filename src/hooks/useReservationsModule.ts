import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';

// Types
export type ReservationStatus = 'confirmed' | 'pending' | 'seated' | 'completed' | 'cancelled' | 'no_show';

export interface Reservation {
  id: string;
  location_id: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  status: ReservationStatus;
  special_requests: string | null;
  notes: string | null;
  pos_table_id: string | null;
  assigned_server_id: string | null;
  duration_minutes: number | null;
  deposit_required: boolean | null;
  deposit_paid: boolean | null;
  deposit_amount: number | null;
  source: string | null;
  customer_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReservationInput {
  guest_name: string;
  guest_email?: string;
  guest_phone?: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  special_requests?: string;
  notes?: string;
  pos_table_id?: string;
  duration_minutes?: number;
  status?: ReservationStatus;
}

export interface FloorTable {
  id: string;
  table_number: string;
  seats: number;
  status: string;
  shape: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  floor_map_id: string;
  current_ticket_id: string | null;
}

export interface ReservationStats {
  totalReservations: number;
  totalCovers: number;
  occupancyRate: number;
  confirmedCount: number;
  pendingCount: number;
  seatedCount: number;
  cancelledCount: number;
  noShowCount: number;
}

export function useReservationsModule() {
  const queryClient = useQueryClient();
  const { selectedLocationId, accessibleLocations } = useApp();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Get location IDs to query
  const locationIds = useMemo(() => {
    if (selectedLocationId === 'all') {
      return accessibleLocations.map(l => l.id);
    }
    return [selectedLocationId];
  }, [selectedLocationId, accessibleLocations]);

  // Fetch reservations for selected date and location
  const { data: reservations = [], isLoading: reservationsLoading } = useQuery({
    queryKey: ['reservations', dateStr, locationIds],
    queryFn: async () => {
      let query = supabase
        .from('reservations')
        .select('*')
        .eq('reservation_date', dateStr)
        .order('reservation_time', { ascending: true });

      if (locationIds.length === 1) {
        query = query.eq('location_id', locationIds[0]);
      } else {
        query = query.in('location_id', locationIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Reservation[];
    },
    enabled: locationIds.length > 0,
  });

  // Fetch floor tables for selected location
  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ['floor-tables', locationIds],
    queryFn: async () => {
      // First get floor maps for the locations
      let mapsQuery = supabase
        .from('pos_floor_maps')
        .select('id')
        .eq('is_active', true);

      if (locationIds.length === 1) {
        mapsQuery = mapsQuery.eq('location_id', locationIds[0]);
      } else {
        mapsQuery = mapsQuery.in('location_id', locationIds);
      }

      const { data: maps, error: mapsError } = await mapsQuery;
      if (mapsError) throw mapsError;
      if (!maps || maps.length === 0) return [];

      const mapIds = maps.map(m => m.id);
      const { data, error } = await supabase
        .from('pos_tables')
        .select('*')
        .in('floor_map_id', mapIds)
        .order('table_number', { ascending: true });

      if (error) throw error;
      return (data || []) as FloorTable[];
    },
    enabled: locationIds.length > 0,
  });

  // Stats
  const stats: ReservationStats = useMemo(() => {
    const totalReservations = reservations.length;
    const totalCovers = reservations.reduce((sum, r) => sum + r.party_size, 0);
    const totalSeats = tables.reduce((sum, t) => sum + t.seats, 0);
    const occupancyRate = totalSeats > 0 ? Math.round((totalCovers / totalSeats) * 100) : 0;

    const confirmedCount = reservations.filter(r => r.status === 'confirmed').length;
    const pendingCount = reservations.filter(r => r.status === 'pending').length;
    const seatedCount = reservations.filter(r => r.status === 'seated').length;
    const cancelledCount = reservations.filter(r => r.status === 'cancelled').length;
    const noShowCount = reservations.filter(r => r.status === 'no_show').length;

    return { totalReservations, totalCovers, occupancyRate, confirmedCount, pendingCount, seatedCount, cancelledCount, noShowCount };
  }, [reservations, tables]);

  // Group reservations by time slot (30 min intervals)
  const timeSlots = useMemo(() => {
    const slots: Record<string, Reservation[]> = {};
    for (const res of reservations) {
      const time = res.reservation_time.substring(0, 5); // HH:mm
      const minutes = parseInt(time.split(':')[1]);
      const slotMinutes = minutes < 30 ? '00' : '30';
      const slotKey = `${time.split(':')[0]}:${slotMinutes}`;
      if (!slots[slotKey]) slots[slotKey] = [];
      slots[slotKey].push(res);
    }
    return slots;
  }, [reservations]);

  // Create reservation
  const createMutation = useMutation({
    mutationFn: async (input: CreateReservationInput) => {
      const locationId = selectedLocationId === 'all' ? accessibleLocations[0]?.id : selectedLocationId;
      if (!locationId) throw new Error('No location selected');

      const { data, error } = await supabase
        .from('reservations')
        .insert({
          ...input,
          location_id: locationId,
          status: input.status || 'confirmed',
          source: 'manual',
        })
        .select()
        .single();

      if (error) throw error;
      return data as Reservation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast.success('Reserva creada correctamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al crear reserva: ${error.message}`);
    },
  });

  // Update reservation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data: updateData }: { id: string; data: Partial<Reservation> }) => {
      const { data, error } = await supabase
        .from('reservations')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Reservation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast.success('Reserva actualizada');
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar: ${error.message}`);
    },
  });

  // Cancel reservation
  const cancelReservation = useCallback(async (id: string) => {
    await updateMutation.mutateAsync({ id, data: { status: 'cancelled' } });
  }, [updateMutation]);

  // Mark as seated
  const seatGuests = useCallback(async (id: string, tableId?: string) => {
    const updateData: Partial<Reservation> = { status: 'seated' };
    if (tableId) updateData.pos_table_id = tableId;
    await updateMutation.mutateAsync({ id, data: updateData });
  }, [updateMutation]);

  // Mark as no-show
  const markNoShow = useCallback(async (id: string) => {
    await updateMutation.mutateAsync({ id, data: { status: 'no_show' } });
  }, [updateMutation]);

  // Mark as completed
  const completeReservation = useCallback(async (id: string) => {
    await updateMutation.mutateAsync({ id, data: { status: 'completed' } });
  }, [updateMutation]);

  return {
    // Data
    reservations,
    tables,
    stats,
    timeSlots,

    // State
    selectedDate,
    setSelectedDate,
    loading: reservationsLoading || tablesLoading,

    // Actions
    createReservation: createMutation.mutateAsync,
    updateReservation: (id: string, data: Partial<Reservation>) =>
      updateMutation.mutateAsync({ id, data }),
    cancelReservation,
    seatGuests,
    markNoShow,
    completeReservation,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
