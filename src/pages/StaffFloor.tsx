import { useParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { usePOSData } from '@/hooks/usePOSData';
import { POSTableCard } from '@/components/pos/POSTableCard';
import { Skeleton } from '@/components/ui/skeleton';

export default function StaffFloor() {
  const { locationId } = useParams<{ locationId: string }>();
  const { locations } = useApp();
  
  const location = locations.find(l => l.id === locationId);
  
  const { floorMaps, tables, loading, refetch } = usePOSData(locationId || '');

  if (!locationId) {
    return (
      <div className="p-6 flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-muted-foreground">Selecciona un local</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const currentFloorMap = floorMaps[0];
  const floorTables = tables.filter(t => t.floor_map_id === currentFloorMap?.id);

  return (
    <div className="h-[calc(100vh-3.5rem)] lg:h-screen flex flex-col">
      <div className="p-4 border-b border-border bg-card shrink-0">
        <h1 className="text-xl font-semibold">{location?.name || 'Mesas'}</h1>
        <p className="text-sm text-muted-foreground">
          {floorTables.length} mesas • {currentFloorMap?.name || 'Sala Principal'}
        </p>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {floorTables.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No hay mesas configuradas</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {floorTables.map((table) => (
                <POSTableCard
                  key={table.id}
                  table={table}
                  isSelected={false}
                  onClick={() => {
                    refetch();
                  }}
                />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
