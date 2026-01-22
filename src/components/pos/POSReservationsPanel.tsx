import { useState } from 'react';
import { Reservation } from '@/hooks/useReservationsData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Clock, Users, Phone, Mail, Check, X, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface POSReservationsPanelProps {
  reservations: Reservation[];
  onSeatGuests: (reservationId: string) => void;
  onCancel: (reservationId: string) => void;
  onAssignTable: (reservationId: string) => void;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export function POSReservationsPanel({
  reservations,
  onSeatGuests,
  onCancel,
  onAssignTable,
  selectedDate,
  onDateChange,
}: POSReservationsPanelProps) {
  const getStatusColor = (status: Reservation['status']) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'pending': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'seated': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: Reservation['status']) => {
    switch (status) {
      case 'confirmed': return 'Confirmada';
      case 'pending': return 'Pendiente';
      case 'seated': return 'Sentados';
      default: return status;
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const formatTime = (time: string) => time.substring(0, 5);

  // Sort by time
  const sortedReservations = [...reservations].sort((a, b) => 
    a.reservation_time.localeCompare(b.reservation_time)
  );

  return (
    <div className="flex flex-col max-h-[65vh]">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4" />
          Reservas del día
        </h3>
        
        {/* Date Navigation */}
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              const prev = new Date(selectedDate);
              prev.setDate(prev.getDate() - 1);
              onDateChange(prev);
            }}
          >
            ←
          </Button>
          <span className="flex-1 text-center text-xs font-medium">
            {isToday(selectedDate) ? 'Hoy' : format(selectedDate, 'EEE d MMM', { locale: es })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              const next = new Date(selectedDate);
              next.setDate(next.getDate() + 1);
              onDateChange(next);
            }}
          >
            →
          </Button>
        </div>
      </div>

      {/* Reservations List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {sortedReservations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay reservas para este día</p>
            </div>
          ) : (
            sortedReservations.map((res) => (
              <div
                key={res.id}
                className={cn(
                  "p-3 rounded-lg border",
                  res.status === 'seated' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-muted/30 border-border'
                )}
              >
                {/* Time & Status */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-bold text-lg">{formatTime(res.reservation_time)}</span>
                  </div>
                  <Badge className={cn("text-xs", getStatusColor(res.status))}>
                    {getStatusLabel(res.status)}
                  </Badge>
                </div>

                {/* Guest Info */}
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{res.guest_name}</p>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {res.party_size}
                    </span>
                    {res.guest_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {res.guest_phone}
                      </span>
                    )}
                  </div>
                  {res.special_requests && (
                    <p className="text-xs text-amber-500 mt-1">
                      📝 {res.special_requests}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {res.status !== 'seated' && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1"
                      onClick={() => onSeatGuests(res.id)}
                    >
                      <UserCheck className="h-4 w-4 mr-1" />
                      Sentar
                    </Button>
                    {!res.pos_table_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAssignTable(res.id)}
                      >
                        Asignar Mesa
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => onCancel(res.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Summary Footer */}
      <div className="p-2 border-t border-border bg-muted/30 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Reservas: {reservations.length}</span>
          <span className="text-muted-foreground">
            Comensales: {reservations.reduce((sum, r) => sum + r.party_size, 0)}
          </span>
        </div>
      </div>
    </div>
  );
}
