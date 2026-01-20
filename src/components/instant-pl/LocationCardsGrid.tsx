/**
 * LocationCardsGrid - Horizontal scrollable grid of location P&L cards
 */

import { useState } from 'react';
import { LocationPLCard } from './LocationPLCard';
import { LocationPLMetrics, ViewMode } from '@/hooks/useInstantPLData';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LocationCardsGridProps {
  locations: LocationPLMetrics[];
  viewMode: ViewMode;
  isLoading: boolean;
}

export function LocationCardsGrid({ 
  locations, 
  viewMode, 
  isLoading 
}: LocationCardsGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="flex-shrink-0 w-[260px]">
            <Skeleton className="h-[300px] rounded-xl" />
          </div>
        ))}
      </div>
    );
  }
  
  if (locations.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] bg-card rounded-xl border border-border/60">
        <div className="text-center">
          <p className="text-muted-foreground">No locations match the selected filters</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Try adjusting your filter criteria
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className={cn(
        "grid gap-4 pb-4 scrollbar-thin",
        // Responsive grid
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6",
        // Horizontal scroll on small screens
        "overflow-x-auto"
      )}
    >
      {locations.map(location => (
        <LocationPLCard
          key={location.locationId}
          data={location}
          viewMode={viewMode}
          isSelected={selectedId === location.locationId}
          onClick={() => setSelectedId(
            selectedId === location.locationId ? null : location.locationId
          )}
        />
      ))}
    </div>
  );
}
