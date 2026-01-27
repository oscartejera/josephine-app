import { format, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ReservationsHeaderProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onCreateNew: () => void;
  totalReservations: number;
}

export function ReservationsHeader({
  selectedDate,
  onDateChange,
  onCreateNew,
  totalReservations,
}: ReservationsHeaderProps) {
  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Reservas</h1>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Radio className="h-2 w-2 text-green-500 animate-pulse" />
          Live
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {/* Date Navigation */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDateChange(subDays(selectedDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="h-8 px-3 text-sm font-medium min-w-[140px]">
                {format(selectedDate, "d 'de' MMMM", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && onDateChange(date)}
                initialFocus
                locale={es}
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDateChange(addDays(selectedDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Today button */}
        {!isToday && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(new Date())}
          >
            Hoy
          </Button>
        )}

        {/* Create button */}
        <Button onClick={onCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Reserva
        </Button>
      </div>
    </div>
  );
}
