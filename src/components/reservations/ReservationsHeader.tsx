import { format, addDays, subDays, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReservationsHeaderProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onNewReservation: () => void;
}

export function ReservationsHeader({ selectedDate, onDateChange, onNewReservation }: ReservationsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <CalendarDays className="h-4 w-4" />
          <span>Reservas</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Libro de Reservas</h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Date navigation */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDateChange(subDays(selectedDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="px-3 text-sm font-medium min-w-[160px] text-center">
            {format(selectedDate, "EEEE, d MMM yyyy", { locale: es })}
          </span>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDateChange(addDays(selectedDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {!isToday(selectedDate) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(new Date())}
          >
            Hoy
          </Button>
        )}

        <Button onClick={onNewReservation} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Reserva
        </Button>
      </div>
    </div>
  );
}
