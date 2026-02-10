import { Users, Clock, MessageSquare, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Reservation, ReservationStatus } from '@/hooks/useReservationsModule';

const STATUS_CONFIG: Record<ReservationStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  confirmed: { label: 'Confirmada', variant: 'default' },
  pending: { label: 'Pendiente', variant: 'outline' },
  seated: { label: 'Sentados', variant: 'secondary' },
  completed: { label: 'Completada', variant: 'secondary' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
  no_show: { label: 'No-show', variant: 'destructive' },
};

interface ReservationCardProps {
  reservation: Reservation;
  onEdit: (reservation: Reservation) => void;
  onSeat: (id: string) => void;
  onCancel: (id: string) => void;
  onNoShow: (id: string) => void;
  onComplete: (id: string) => void;
}

export function ReservationCard({ reservation, onEdit, onSeat, onCancel, onNoShow, onComplete }: ReservationCardProps) {
  const time = reservation.reservation_time.substring(0, 5);
  const statusConfig = STATUS_CONFIG[reservation.status as ReservationStatus] || STATUS_CONFIG.pending;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors group">
      {/* Time */}
      <div className="text-sm font-mono font-medium text-muted-foreground w-12 shrink-0">
        {time}
      </div>

      {/* Guest info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{reservation.guest_name}</span>
          <Badge variant={statusConfig.variant} className="text-[10px] px-1.5 py-0 h-5">
            {statusConfig.label}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {reservation.party_size} pax
          </span>
          {reservation.duration_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {reservation.duration_minutes} min
            </span>
          )}
          {reservation.special_requests && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Nota
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(reservation)}>
            Editar reserva
          </DropdownMenuItem>
          {reservation.status === 'confirmed' && (
            <DropdownMenuItem onClick={() => onSeat(reservation.id)}>
              Sentar comensales
            </DropdownMenuItem>
          )}
          {reservation.status === 'seated' && (
            <DropdownMenuItem onClick={() => onComplete(reservation.id)}>
              Completar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {reservation.status !== 'cancelled' && reservation.status !== 'no_show' && (
            <>
              <DropdownMenuItem onClick={() => onNoShow(reservation.id)} className="text-amber-600">
                Marcar no-show
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCancel(reservation.id)} className="text-destructive">
                Cancelar reserva
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
