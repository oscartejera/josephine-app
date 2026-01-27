import { useState, useEffect, useCallback } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Reservation {
  id: string;
  guest_name: string;
  party_size: number;
  reservation_time: string;
  duration_minutes: number;
  status: string;
  pos_table_id: string | null;
}

interface Table {
  id: string;
  table_number: string;
  seats: number;
}

interface ReservationTimelineProps {
  locationId: string | null;
}

export function ReservationTimeline({ locationId }: ReservationTimelineProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = Math.floor(i / 2) + 12;
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  }).filter(t => {
    const hour = parseInt(t.split(':')[0]);
    return (hour >= 12 && hour <= 16) || (hour >= 19 && hour <= 24);
  });

  const fetchData = useCallback(async () => {
    if (!locationId) return;

    setLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const [resResult, tablesResult] = await Promise.all([
      supabase
        .from('reservations')
        .select('id, guest_name, party_size, reservation_time, duration_minutes, status, pos_table_id')
        .eq('location_id', locationId)
        .eq('reservation_date', dateStr)
        .in('status', ['pending', 'confirmed', 'seated']),
      supabase
        .from('pos_tables')
        .select('id, table_number, seats')
        .in('floor_map_id', 
          (await supabase
            .from('pos_floor_maps')
            .select('id')
            .eq('location_id', locationId)
            .eq('is_active', true)
          ).data?.map(m => m.id) || []
        )
    ]);

    setReservations((resResult.data || []) as Reservation[]);
    setTables((tablesResult.data || []) as Table[]);
    setLoading(false);
  }, [locationId, selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getReservationPosition = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const startHour = 12;
    const totalMinutes = (hours - startHour) * 60 + minutes;
    return (totalMinutes / 30) * 60; // 60px per 30min slot
  };

  const getReservationWidth = (duration: number) => {
    return (duration / 30) * 60; // 60px per 30min
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-500';
      case 'pending': return 'bg-amber-500';
      case 'seated': return 'bg-blue-500';
      default: return 'bg-muted';
    }
  };

  const unassignedReservations = reservations.filter(r => !r.pos_table_id);

  return (
    <div className="space-y-4">
      {/* Date Navigation */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {reservations.length} reservas • {reservations.reduce((s, r) => s + r.party_size, 0)} comensales
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Vista de Turnos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[800px]">
              {/* Time header */}
              <div className="flex border-b sticky top-0 bg-background z-10">
                <div className="w-24 shrink-0 p-2 border-r font-medium text-sm">Mesa</div>
                <div className="flex">
                  {timeSlots.map(slot => (
                    <div key={slot} className="w-[60px] text-center text-xs py-2 border-r text-muted-foreground">
                      {slot}
                    </div>
                  ))}
                </div>
              </div>

              {/* Table rows */}
              {tables.map(table => {
                const tableReservations = reservations.filter(r => r.pos_table_id === table.id);
                
                return (
                  <div key={table.id} className="flex border-b hover:bg-muted/30">
                    <div className="w-24 shrink-0 p-2 border-r flex items-center gap-2">
                      <span className="font-medium">{table.table_number}</span>
                      <span className="text-xs text-muted-foreground flex items-center">
                        <Users className="h-3 w-3 mr-0.5" />
                        {table.seats}
                      </span>
                    </div>
                    <div className="flex-1 relative h-12">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex">
                        {timeSlots.map((_, i) => (
                          <div key={i} className="w-[60px] border-r border-dashed border-muted" />
                        ))}
                      </div>
                      {/* Reservations */}
                      {tableReservations.map(res => (
                        <div
                          key={res.id}
                          className={cn(
                            "absolute top-1 bottom-1 rounded px-2 flex items-center text-white text-xs font-medium truncate cursor-pointer hover:opacity-90",
                            getStatusColor(res.status)
                          )}
                          style={{
                            left: getReservationPosition(res.reservation_time),
                            width: getReservationWidth(res.duration_minutes || 90),
                          }}
                          title={`${res.guest_name} (${res.party_size}p) - ${res.reservation_time.substring(0, 5)}`}
                        >
                          {res.guest_name} ({res.party_size})
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Unassigned reservations */}
              {unassignedReservations.length > 0 && (
                <div className="flex border-b bg-amber-500/5">
                  <div className="w-24 shrink-0 p-2 border-r flex items-center">
                    <span className="text-xs font-medium text-amber-600">Sin mesa</span>
                  </div>
                  <div className="flex-1 relative h-12">
                    {unassignedReservations.map(res => (
                      <div
                        key={res.id}
                        className="absolute top-1 bottom-1 rounded px-2 flex items-center bg-amber-500 text-white text-xs font-medium truncate cursor-pointer"
                        style={{
                          left: getReservationPosition(res.reservation_time),
                          width: getReservationWidth(res.duration_minutes || 90),
                        }}
                      >
                        {res.guest_name} ({res.party_size})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          <span>Confirmada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <span>Pendiente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>Sentados</span>
        </div>
      </div>
    </div>
  );
}
