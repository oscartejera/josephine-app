/**
 * POSTableCard Component
 * Card representation of a table with KDS status
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { POSTable } from '@/hooks/usePOSData';

interface TableKDSInfo {
  hasActiveOrders: boolean;
  pendingCount: number;
  preparingCount: number;
  readyCount: number;
  allReady: boolean;
}

interface POSTableCardProps {
  table: POSTable;
  isSelected: boolean;
  onClick: () => void;
  kdsInfo?: TableKDSInfo;
}

export function POSTableCard({
  table,
  isSelected,
  onClick,
  kdsInfo,
}: POSTableCardProps) {
  const getStatusColor = () => {
    if (kdsInfo?.allReady) return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30';
    if (kdsInfo?.preparingCount) return 'border-amber-500 bg-amber-50 dark:bg-amber-950/30';
    if (table.status === 'occupied') return 'border-blue-500 bg-blue-50 dark:bg-blue-950/30';
    if (table.status === 'reserved') return 'border-purple-500 bg-purple-50 dark:bg-purple-950/30';
    return 'border-border';
  };

  return (
    <Card
      className={cn(
        "p-4 cursor-pointer transition-all border-2",
        getStatusColor(),
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{table.name}</h3>
        {kdsInfo?.hasActiveOrders && (
          <ChefHat className={cn(
            "h-4 w-4",
            kdsInfo.allReady ? "text-emerald-500" : "text-amber-500"
          )} />
        )}
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span>{table.seats}</span>
        </div>
        
        {kdsInfo?.hasActiveOrders && (
          <div className="flex gap-1">
            {kdsInfo.pendingCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {kdsInfo.pendingCount} P
              </Badge>
            )}
            {kdsInfo.preparingCount > 0 && (
              <Badge className="h-5 px-1.5 text-xs bg-amber-500">
                {kdsInfo.preparingCount} C
              </Badge>
            )}
            {kdsInfo.readyCount > 0 && (
              <Badge className="h-5 px-1.5 text-xs bg-emerald-500">
                {kdsInfo.readyCount} L
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="mt-2">
        <Badge
          variant={
            table.status === 'available' ? 'outline' :
            table.status === 'occupied' ? 'default' : 'secondary'
          }
          className="text-xs"
        >
          {table.status === 'available' ? 'Libre' :
           table.status === 'occupied' ? 'Ocupada' : 'Reservada'}
        </Badge>
      </div>
    </Card>
  );
}
