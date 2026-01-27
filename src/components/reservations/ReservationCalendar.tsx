import { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Plus, Phone, Globe, MapPin, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateReservationDialog } from './CreateReservationDialog';
import { ReservationDetailDialog } from './ReservationDetailDialog';

interface Reservation {
  id: string;
  guest_name: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  status: string;
  guest_phone: string | null;
  guest_email: string | null;
  special_requests: string | null;
}

interface ReservationCalendarProps {
  locationId: string | null;
}

export function ReservationCalendar({ locationId }: ReservationCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  const fetchReservations = useCallback(async () => {
    if (!locationId) return;

    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const { data } = await supabase
      .from('reservations')
      .select('id, guest_name, party_size, reservation_date, reservation_time, status, guest_phone, guest_email, special_requests')
      .eq('location_id', locationId)
      .gte('reservation_date', format(start, 'yyyy-MM-dd'))
      .lte('reservation_date', format(end, 'yyyy-MM-dd'))
      .order('reservation_time');

    setReservations((data || []) as Reservation[]);
    setLoading(false);
  }, [locationId, currentMonth]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getReservationsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return reservations.filter(r => r.reservation_date === dateStr);
  };

  const selectedDayReservations = getReservationsForDay(selectedDate);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-500/20 text-emerald-400';
      case 'pending': return 'bg-amber-500/20 text-amber-400';
      case 'seated': return 'bg-blue-500/20 text-blue-400';
      case 'completed': return 'bg-muted text-muted-foreground';
      case 'cancelled': return 'bg-destructive/20 text-destructive';
      case 'no_show': return 'bg-red-500/20 text-red-400';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar Grid */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
              Hoy
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const dayReservations = getReservationsForDay(day);
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              const totalCovers = dayReservations.reduce((sum, r) => sum + r.party_size, 0);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "aspect-square p-1 rounded-lg text-sm transition-colors relative",
                    isSelected && "bg-primary text-primary-foreground",
                    !isSelected && isToday && "bg-accent",
                    !isSelected && !isToday && "hover:bg-muted"
                  )}
                >
                  <span className={cn("font-medium", isToday && !isSelected && "text-primary")}>
                    {format(day, 'd')}
                  </span>
                  {dayReservations.length > 0 && (
                    <div className="absolute bottom-1 left-1 right-1 flex justify-center gap-0.5">
                      <span className={cn(
                        "text-[10px] px-1 rounded",
                        isSelected ? "bg-primary-foreground/20" : "bg-primary/20 text-primary"
                      )}>
                        {dayReservations.length}
                      </span>
                      {totalCovers > 0 && (
                        <span className={cn(
                          "text-[10px] px-1 rounded flex items-center gap-0.5",
                          isSelected ? "bg-primary-foreground/20" : "bg-muted"
                        )}>
                          <Users className="h-2 w-2" />
                          {totalCovers}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">
              {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {selectedDayReservations.length} reservas • {selectedDayReservations.reduce((s, r) => s + r.party_size, 0)} comensales
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="p-4 space-y-2">
              {selectedDayReservations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No hay reservas para este día</p>
                  <Button variant="link" onClick={() => setShowCreateDialog(true)}>
                    Crear nueva reserva
                  </Button>
                </div>
              ) : (
                selectedDayReservations.map(res => (
                  <button
                    key={res.id}
                    onClick={() => setSelectedReservation(res)}
                    className="w-full text-left p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold">{res.reservation_time.substring(0, 5)}</span>
                      <Badge className={getStatusColor(res.status)}>
                        {res.status === 'confirmed' ? 'Confirmada' : 
                         res.status === 'pending' ? 'Pendiente' :
                         res.status === 'seated' ? 'Sentados' : res.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{res.guest_name}</span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {res.party_size}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <CreateReservationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        locationId={locationId}
        defaultDate={selectedDate}
        onSuccess={fetchReservations}
      />

      {/* Detail Dialog */}
      {selectedReservation && (
        <ReservationDetailDialog
          reservation={selectedReservation}
          open={!!selectedReservation}
          onOpenChange={(open) => !open && setSelectedReservation(null)}
          onUpdate={fetchReservations}
        />
      )}
    </div>
  );
}
