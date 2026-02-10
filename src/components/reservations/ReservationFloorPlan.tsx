import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Reservation, FloorTable } from '@/hooks/useReservationsModule';

interface ReservationFloorPlanProps {
  tables: FloorTable[];
  reservations: Reservation[];
  onTableClick?: (table: FloorTable) => void;
}

type TableStatus = 'free' | 'reserved' | 'seated' | 'completed';

const STATUS_STYLES: Record<TableStatus, string> = {
  free: 'bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted',
  reserved: 'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300',
  seated: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
  completed: 'bg-muted/30 border-border/30 text-muted-foreground',
};

const STATUS_LABELS: Record<TableStatus, string> = {
  free: 'Libre',
  reserved: 'Reservada',
  seated: 'Ocupada',
  completed: 'Completada',
};

export function ReservationFloorPlan({ tables, reservations, onTableClick }: ReservationFloorPlanProps) {
  // Map table -> reservation for today
  const tableReservationMap = useMemo(() => {
    const map = new Map<string, Reservation>();
    for (const res of reservations) {
      if (res.pos_table_id && (res.status === 'confirmed' || res.status === 'seated')) {
        map.set(res.pos_table_id, res);
      }
    }
    return map;
  }, [reservations]);

  const getTableStatus = (table: FloorTable): TableStatus => {
    const reservation = tableReservationMap.get(table.id);
    if (!reservation) return 'free';
    if (reservation.status === 'seated') return 'seated';
    return 'reserved';
  };

  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No hay mesas configuradas para este local</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        {(Object.entries(STATUS_LABELS) as [TableStatus, string][]).map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded border', STATUS_STYLES[status])} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Grid layout for tables */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {tables.map((table) => {
          const status = getTableStatus(table);
          const reservation = tableReservationMap.get(table.id);

          return (
            <button
              key={table.id}
              onClick={() => onTableClick?.(table)}
              className={cn(
                'relative p-3 rounded-xl border-2 transition-all text-center cursor-pointer',
                'hover:scale-105 hover:shadow-md',
                STATUS_STYLES[status],
                table.shape === 'circle' && 'rounded-full aspect-square flex flex-col items-center justify-center',
              )}
            >
              <div className="font-bold text-sm">
                {table.table_number}
              </div>
              <div className="text-[10px] opacity-70">
                {table.seats} pax
              </div>
              {reservation && (
                <div className="text-[10px] font-medium mt-1 truncate max-w-full">
                  {reservation.guest_name.split(' ')[0]}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
