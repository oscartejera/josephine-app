import { useState } from 'react';
import { cn } from '@/lib/utils';
import { FloorMap, POSTable, POSProduct } from '@/hooks/usePOSData';
import { POSOrderPanel } from './POSOrderPanel';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Settings } from 'lucide-react';
import { POSTableCard } from './POSTableCard';
import { POSFloorEditor } from './POSFloorEditor';

interface POSFloorPlanProps {
  locationId: string;
  floorMaps: FloorMap[];
  tables: POSTable[];
  products: POSProduct[];
  onRefresh: () => void;
}

export function POSFloorPlan({ locationId, floorMaps, tables, products, onRefresh }: POSFloorPlanProps) {
  const [selectedMapId, setSelectedMapId] = useState<string>(floorMaps[0]?.id || '');
  const [selectedTable, setSelectedTable] = useState<POSTable | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const currentMap = floorMaps.find(m => m.id === selectedMapId);
  const currentTables = tables.filter(t => t.floor_map_id === selectedMapId);

  // Empty state - no floor maps configured
  if (floorMaps.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Settings className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">Sin plano de sala</h3>
          <p className="text-muted-foreground max-w-sm">
            Configura el plano de tu local para gestionar las mesas visualmente.
          </p>
          <Button onClick={() => setShowEditor(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear plano
          </Button>
        </div>

        {showEditor && (
          <POSFloorEditor
            locationId={locationId}
            onClose={() => setShowEditor(false)}
            onSave={() => {
              setShowEditor(false);
              onRefresh();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Floor Plan Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Floor Map Selector */}
        <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
          <Select value={selectedMapId} onValueChange={setSelectedMapId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Seleccionar sala" />
            </SelectTrigger>
            <SelectContent>
              {floorMaps.map((map) => (
                <SelectItem key={map.id} value={map.id}>
                  {map.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => setShowEditor(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>

        {/* Tables Grid */}
        <div className="flex-1 overflow-auto p-4">
          <div 
            className="relative bg-muted/30 rounded-lg min-h-full"
            style={{ 
              width: currentMap?.config_json?.width || 800,
              height: currentMap?.config_json?.height || 600
            }}
          >
            {currentTables.map((table) => (
              <POSTableCard
                key={table.id}
                table={table}
                isSelected={selectedTable?.id === table.id}
                onClick={() => setSelectedTable(table)}
              />
            ))}

            {currentTables.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <p>No hay mesas en esta sala</p>
                  <Button variant="link" onClick={() => setShowEditor(true)}>
                    Añadir mesas
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Panel - slides in when table selected */}
      {selectedTable && (
        <POSOrderPanel
          table={selectedTable}
          products={products}
          locationId={locationId}
          onClose={() => setSelectedTable(null)}
          onRefresh={onRefresh}
        />
      )}

      {/* Floor Editor Modal */}
      {showEditor && (
        <POSFloorEditor
          locationId={locationId}
          floorMap={currentMap}
          tables={currentTables}
          onClose={() => setShowEditor(false)}
          onSave={() => {
            setShowEditor(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
