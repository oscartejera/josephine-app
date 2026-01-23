import { cn } from '@/lib/utils';
import { POSTable } from '@/hooks/usePOSData';
import { Users, Clock, ChefHat, Check, Flame } from 'lucide-react';
import { Reservation } from '@/hooks/useReservationsData';
import { KDSTableStatus, TableKDSInfo } from '@/hooks/useTableKDSStatus';
import { Button } from '@/components/ui/button';

interface POSTableCardProps {
  table: POSTable;
  isSelected: boolean;
  onClick: () => void;
  reservation?: Reservation | null;
  kdsInfo?: TableKDSInfo;
  onServe?: () => void;
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

const kdsStatusStyles: Record<KDSTableStatus, { bg: string; text: string; animate: boolean }> = {
  idle: { bg: '', text: '', animate: false },
  pending: { bg: 'bg-orange-500', text: 'text-white', animate: true },
  preparing: { bg: 'bg-blue-500', text: 'text-white', animate: true },
  ready: { bg: 'bg-emerald-500', text: 'text-white', animate: true },
  served: { bg: 'bg-zinc-500', text: 'text-white', animate: false },
};

export function POSTableCard({ 
  table, 
  isSelected, 
  onClick, 
  reservation, 
  kdsInfo,
  onServe 
}: POSTableCardProps) {
  const shapeStyles = {
    square: 'rounded-lg',
    round: 'rounded-full',
    rectangle: 'rounded-lg',
  };

  // If there's a reservation for this table, show it as reserved
  const effectiveStatus = reservation ? 'reserved' : table.status;
  const reservationTime = reservation?.reservation_time?.substring(0, 5);

  // KDS status info
  const hasKDSActivity = kdsInfo && kdsInfo.status !== 'idle' && kdsInfo.totalItems > 0;
  const kdsStyle = kdsInfo ? kdsStatusStyles[kdsInfo.status] : kdsStatusStyles.idle;
  const isReady = kdsInfo?.status === 'ready';

  const handleServeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onServe?.();
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute flex flex-col items-center justify-center border-2 transition-all cursor-pointer hover:scale-105 active:scale-95",
        shapeStyles[table.shape],
        statusColors[effectiveStatus],
        isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        // Ready state - glow effect
        isReady && "ring-2 ring-emerald-400 ring-offset-2 ring-offset-background shadow-lg shadow-emerald-500/30"
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
      
      {/* KDS Status Badge - Square style */}
      {hasKDSActivity && (
        <div 
          className={cn(
            "absolute -top-2 -right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-md",
            kdsStyle.bg,
            kdsStyle.text,
            kdsStyle.animate && "animate-pulse"
          )}
        >
          {kdsInfo.hasRushItems && (
            <Flame className="h-2.5 w-2.5 text-amber-300" />
          )}
          {kdsInfo.status === 'pending' && (
            <>
              <ChefHat className="h-2.5 w-2.5" />
              <span>{kdsInfo.pendingCount}</span>
            </>
          )}
          {kdsInfo.status === 'preparing' && (
            <>
              <ChefHat className="h-2.5 w-2.5" />
              <span>{kdsInfo.preparingCount}/{kdsInfo.totalItems}</span>
            </>
          )}
          {kdsInfo.status === 'ready' && (
            <>
              <Check className="h-2.5 w-2.5" />
              <span>¡Listo!</span>
            </>
          )}
          {kdsInfo.status === 'served' && (
            <>
              <Check className="h-2.5 w-2.5" />
            </>
          )}
        </div>
      )}

      {/* Time elapsed badge */}
      {hasKDSActivity && kdsInfo.elapsedMinutes > 0 && (
        <div className={cn(
          "absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-medium",
          kdsInfo.elapsedMinutes > 15 ? "bg-red-500 text-white" : "bg-zinc-700 text-zinc-200"
        )}>
          {kdsInfo.elapsedMinutes}min
        </div>
      )}

      {/* Quick Serve button when ready */}
      {isReady && onServe && (
        <Button
          size="sm"
          variant="default"
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 shadow-lg"
          onClick={handleServeClick}
        >
          Servir
        </Button>
      )}
      
      {/* Show status label for non-available non-reserved */}
      {!reservation && !hasKDSActivity && effectiveStatus !== 'available' && (
        <span className="text-[10px] mt-0.5">{statusLabels[effectiveStatus]}</span>
      )}
    </button>
  );
}
