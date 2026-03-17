import React from 'react';
import { cn } from '@/lib/utils';
import type { TableShape } from '@/lib/onboardingTemplates';

export interface TablePreview {
  id: string;
  table_number: string;
  seats: number;
  shape: TableShape;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
}

interface FloorPlanPreviewProps {
  tables: TablePreview[];
  width?: number;
  height?: number;
  className?: string;
  onTableClick?: (tableId: string) => void;
  selectedTableId?: string | null;
  showGrid?: boolean;
}

const SHAPE_COLORS: Record<TableShape, string> = {
  square: 'bg-blue-500/80 border-blue-600',
  round: 'bg-emerald-500/80 border-emerald-600',
  rectangle: 'bg-violet-500/80 border-violet-600',
};

export function FloorPlanPreview({
  tables,
  width = 800,
  height = 500,
  className,
  onTableClick,
  selectedTableId,
  showGrid = true,
}: FloorPlanPreviewProps) {
  const GRID_SIZE = 20;

  return (
    <div 
      className={cn(
        "relative border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden",
        "bg-muted/30",
        className
      )}
      style={{ width: '100%', aspectRatio: `${width}/${height}` }}
    >
      {/* Grid pattern */}
      {showGrid && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: 0.3 }}
        >
          <defs>
            <pattern
              id="grid"
              width={GRID_SIZE}
              height={GRID_SIZE}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-muted-foreground"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      )}

      {/* Tables */}
      <div className="absolute inset-0" style={{ padding: '10px' }}>
        {tables.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Añade mesas para ver la previsualización
          </div>
        ) : (
          tables.map((table) => {
            const isSelected = selectedTableId === table.id;
            const scaleX = 100 / width;
            const scaleY = 100 / height;
            
            return (
              <div
                key={table.id}
                onClick={() => onTableClick?.(table.id)}
                className={cn(
                  "absolute flex flex-col items-center justify-center transition-all duration-200",
                  "border-2 text-white font-medium text-xs shadow-md",
                  SHAPE_COLORS[table.shape],
                  table.shape === 'round' && 'rounded-full',
                  table.shape === 'square' && 'rounded-md',
                  table.shape === 'rectangle' && 'rounded-md',
                  onTableClick && 'cursor-pointer hover:scale-105',
                  isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
                )}
                style={{
                  left: `${table.position_x * scaleX}%`,
                  top: `${table.position_y * scaleY}%`,
                  width: `${table.width * scaleX}%`,
                  height: `${table.height * scaleY}%`,
                  minWidth: '40px',
                  minHeight: '40px',
                }}
              >
                <span className="font-bold text-sm">M{table.table_number}</span>
                <span className="text-[10px] opacity-80">{table.seats} pl</span>
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      {tables.length > 0 && (
        <div className="absolute bottom-2 right-2 flex gap-2 text-[10px] bg-background/80 backdrop-blur-sm rounded px-2 py-1">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span>Cuadrada</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Redonda</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-violet-500" />
            <span>Rectangular</span>
          </div>
        </div>
      )}

      {/* Dimensions label */}
      <div className="absolute top-2 left-2 text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm rounded px-2 py-0.5">
        {width} × {height} px
      </div>
    </div>
  );
}
