import { cn } from '@/lib/utils';
import { POSTable } from '@/hooks/usePOSData';
import { Users } from 'lucide-react';

interface POSTableCardProps {
  table: POSTable;
  isSelected: boolean;
  onClick: () => void;
}

const statusColors = {
  available: 'bg-green-500/20 border-green-500 text-green-700 dark:text-green-400',
  occupied: 'bg-red-500/20 border-red-500 text-red-700 dark:text-red-400',
  reserved: 'bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-400',
  blocked: 'bg-gray-500/20 border-gray-500 text-gray-700 dark:text-gray-400',
};

const statusLabels = {
  available: 'Libre',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  blocked: 'Bloqueada',
};

export function POSTableCard({ table, isSelected, onClick }: POSTableCardProps) {
  const shapeStyles = {
    square: 'rounded-lg',
    round: 'rounded-full',
    rectangle: 'rounded-lg',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute flex flex-col items-center justify-center border-2 transition-all cursor-pointer hover:scale-105 active:scale-95",
        shapeStyles[table.shape],
        statusColors[table.status],
        isSelected && "ring-2 ring-primary ring-offset-2"
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
      {table.status !== 'available' && (
        <span className="text-[10px] mt-0.5">{statusLabels[table.status]}</span>
      )}
    </button>
  );
}
