import { cn } from '@/lib/utils';
import { POSTable } from '@/hooks/usePOSData';
import { Users, Clock } from 'lucide-react';
import { Reservation } from '@/hooks/useReservationsData';

interface POSTableCardProps {
  table: POSTable;
  isSelected: boolean;
  onClick: () => void;
  reservation?: Reservation | null;
}

const statusColors = {
  available: 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-400',
  occupied: 'bg-destructive/20 border-destructive text-destructive',
  reserved: 'bg-primary/20 border-primary text-primary',
  blocked: 'bg-muted border-muted-foreground/50 text-muted-foreground',
};

const statusLabels = {
  available: 'Libre',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  blocked: 'Bloqueada',
};

export function POSTableCard({ table, isSelected, onClick, reservation }: POSTableCardProps) {
  const shapeStyles = {
    square: 'rounded-lg',
    round: 'rounded-full',
    rectangle: 'rounded-lg',
  };

  // If there's a reservation for this table, show it as reserved
  const effectiveStatus = reservation ? 'reserved' : table.status;
  const reservationTime = reservation?.reservation_time?.substring(0, 5);

  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute flex flex-col items-center justify-center border-2 transition-all cursor-pointer hover:scale-105 active:scale-95",
        shapeStyles[table.shape],
        statusColors[effectiveStatus],
        isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
      )}
      style={{
        left: table.position_x,
        top: table.position_y,
        width: table.width,
        height: table.height,
      }}
    >
      <span className="font-bold text-sm">{table.table_number}</span>
      <div className="flex items-center gap-1 text-xs opacity-80">
        <Users className="h-3 w-3" />
        <span>{table.seats}</span>
      </div>
      
      {/* Show reservation time if reserved */}
      {reservation && reservationTime && (
        <div className="flex items-center gap-1 text-[10px] mt-0.5 font-medium">
          <Clock className="h-2.5 w-2.5" />
          <span>{reservationTime}</span>
        </div>
      )}
      
      {/* Show status label for non-available non-reserved */}
      {!reservation && effectiveStatus !== 'available' && (
        <span className="text-[10px] mt-0.5">{statusLabels[effectiveStatus]}</span>
      )}
    </button>
  );
}
