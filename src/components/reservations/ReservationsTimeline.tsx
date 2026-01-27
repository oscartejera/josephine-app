import { useMemo } from 'react';
import { Clock, Users, Phone, Mail, MoreHorizontal, CheckCircle, XCircle, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/hooks/useReservationsModule';

interface ReservationsTimelineProps {
  reservations: Reservation[];
  timeSlots: string[];
  onReservationClick: (reservation: Reservation) => void;
  selectedReservation: Reservation | null;
  onSeatGuests: (id: string, tableId?: string) => Promise<void>;
  onMarkNoShow: (id: string) => Promise<void>;
  onCancel: (id: string, reason?: string) => Promise<void>;
  onConfirm: (id: string) => Promise<void>;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pendiente', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  confirmed: { label: 'Confirmada', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  seated: { label: 'Sentados', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  completed: { label: 'Completada', color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-900/30' },
  cancelled: { label: 'Cancelada', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  no_show: { label: 'No-show', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
};

export function ReservationsTimeline({
  reservations,
  timeSlots,
  onReservationClick,
  selectedReservation,
  onSeatGuests,
  onMarkNoShow,
  onCancel,
  onConfirm,
}: ReservationsTimelineProps) {
  // Group reservations by time slot
  const reservationsBySlot = useMemo(() => {
    const grouped: Record<string, Reservation[]> = {};
    
    timeSlots.forEach((slot) => {
      grouped[slot] = [];
    });

    reservations.forEach((res) => {
      const time = res.reservation_time.substring(0, 5);
      if (grouped[time]) {
        grouped[time].push(res);
      } else {
        // Find closest slot
        const hour = parseInt(time.split(':')[0]);
        const minutes = parseInt(time.split(':')[1]);
        const roundedMinutes = minutes < 30 ? '00' : '30';
        const slot = `${hour.toString().padStart(2, '0')}:${roundedMinutes}`;
        if (grouped[slot]) {
          grouped[slot].push(res);
        }
      }
    });

    return grouped;
  }, [reservations, timeSlots]);

  // Filter to only show slots with reservations or near current time
  const activeSlots = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    
    return timeSlots.filter((slot) => {
      const slotHour = parseInt(slot.split(':')[0]);
      const hasReservations = reservationsBySlot[slot]?.length > 0;
      const isNearCurrentTime = Math.abs(slotHour - currentHour) <= 2;
      return hasReservations || isNearCurrentTime;
    });
  }, [timeSlots, reservationsBySlot]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Timeline del Día
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <div className="px-4 pb-4 space-y-2">
            {activeSlots.map((slot) => {
              const slotReservations = reservationsBySlot[slot] || [];
              const hasReservations = slotReservations.length > 0;

              return (
                <div key={slot} className="flex gap-4">
                  {/* Time label */}
                  <div className="w-14 shrink-0 text-sm font-medium text-muted-foreground pt-2">
                    {slot}
                  </div>

                  {/* Reservations */}
                  <div className="flex-1 min-h-[60px] border-l border-border pl-4">
                    {hasReservations ? (
                      <div className="space-y-2">
                        {slotReservations.map((res) => {
                          const status = statusConfig[res.status] || statusConfig.pending;
                          const isSelected = selectedReservation?.id === res.id;

                          return (
                            <div
                              key={res.id}
                              onClick={() => onReservationClick(res)}
                              className={cn(
                                'p-3 rounded-lg border cursor-pointer transition-all',
                                status.bgColor,
                                isSelected ? 'ring-2 ring-primary' : 'hover:shadow-md'
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium truncate">{res.guest_name}</span>
                                    <Badge variant="outline" className={cn('text-xs', status.color)}>
                                      {status.label}
                                    </Badge>
                                  </div>

                                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {res.party_size} pax
                                    </span>
                                    {res.guest_phone && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {res.guest_phone}
                                      </span>
                                    )}
                                  </div>

                                  {res.notes && (
                                    <p className="text-xs text-muted-foreground mt-1 truncate">
                                      {res.notes}
                                    </p>
                                  )}
                                </div>

                                {/* Quick actions */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {res.status === 'pending' && (
                                      <DropdownMenuItem onClick={() => onConfirm(res.id)}>
                                        <CheckCircle className="h-4 w-4 mr-2 text-blue-500" />
                                        Confirmar
                                      </DropdownMenuItem>
                                    )}
                                    {(res.status === 'pending' || res.status === 'confirmed') && (
                                      <>
                                        <DropdownMenuItem onClick={() => onSeatGuests(res.id)}>
                                          <UserCheck className="h-4 w-4 mr-2 text-green-500" />
                                          Sentar
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => onMarkNoShow(res.id)}>
                                          <XCircle className="h-4 w-4 mr-2 text-red-500" />
                                          No-show
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => onCancel(res.id)}
                                          className="text-destructive"
                                        >
                                          <XCircle className="h-4 w-4 mr-2" />
                                          Cancelar
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-[60px] flex items-center">
                        <span className="text-sm text-muted-foreground">—</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {activeSlots.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay reservas para este día</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
