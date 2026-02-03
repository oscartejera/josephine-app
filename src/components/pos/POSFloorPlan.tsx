/**
 * POSFloorPlan Component
 * Visual floor plan with table layout
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { FloorMap, POSTable, POSProduct, POSTicket } from '@/hooks/usePOSData';

interface POSFloorPlanProps {
  locationId: string;
  floorMaps: FloorMap[];
  tables: POSTable[];
  products: POSProduct[];
  openTickets: POSTicket[];
  onRefresh: () => void;
}

export function POSFloorPlan({
  locationId,
  floorMaps,
  tables,
  products,
  openTickets,
  onRefresh,
}: POSFloorPlanProps) {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [activeFloor, setActiveFloor] = useState(floorMaps[0]?.id);

  const currentTables = tables.filter(t => t.floor_map_id === activeFloor);

  const getTableColor = (status: string) => {
    switch (status) {
      case 'occupied': return 'bg-amber-500 border-amber-600';
      case 'reserved': return 'bg-purple-500 border-purple-600';
      default: return 'bg-emerald-500 border-emerald-600';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Floor tabs */}
      {floorMaps.length > 1 && (
        <div className="flex gap-2 p-4 border-b">
          {floorMaps.map(floor => (
            <button
              key={floor.id}
              onClick={() => setActiveFloor(floor.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeFloor === floor.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              {floor.name}
            </button>
          ))}
        </div>
      )}

      {/* Floor plan canvas */}
      <div className="flex-1 relative bg-muted/30 overflow-auto p-4">
        <div className="relative min-w-[600px] min-h-[400px]">
          {currentTables.map(table => (
            <button
              key={table.id}
              onClick={() => setSelectedTable(table.id)}
              className={cn(
                "absolute flex items-center justify-center text-white font-bold text-sm border-2 transition-transform hover:scale-105",
                getTableColor(table.status),
                table.shape === 'round' && "rounded-full",
                table.shape === 'square' && "rounded-lg",
                table.shape === 'rectangle' && "rounded-lg",
                selectedTable === table.id && "ring-2 ring-offset-2 ring-primary"
              )}
              style={{
                left: table.pos_x,
                top: table.pos_y,
                width: table.shape === 'rectangle' ? 120 : 80,
                height: 80,
              }}
            >
              <div className="text-center">
                <div>{table.name}</div>
                <div className="text-xs opacity-80">{table.seats} pax</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 p-3 border-t bg-card text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-500"></div>
          <span>Libre</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-amber-500"></div>
          <span>Ocupada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-500"></div>
          <span>Reservada</span>
        </div>
      </div>
    </div>
  );
}
