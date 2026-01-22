import { useState, useRef, useCallback } from 'react';
import { FloorMap, POSTable } from '@/hooks/usePOSData';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, Move } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface POSFloorEditorProps {
  locationId: string;
  floorMap?: FloorMap;
  tables?: POSTable[];
  onClose: () => void;
  onSave: () => void;
}

interface TableDraft {
  id?: string;
  table_number: string;
  seats: number;
  position_x: number;
  position_y: number;
  shape: 'square' | 'round' | 'rectangle';
  width: number;
  height: number;
}

export function POSFloorEditor({ locationId, floorMap, tables = [], onClose, onSave }: POSFloorEditorProps) {
  const [name, setName] = useState(floorMap?.name || 'Sala Principal');
  const [mapWidth, setMapWidth] = useState(floorMap?.config_json?.width || 800);
  const [mapHeight, setMapHeight] = useState(floorMap?.config_json?.height || 600);
  const [tableDrafts, setTableDrafts] = useState<TableDraft[]>(
    tables.map(t => ({
      id: t.id,
      table_number: t.table_number,
      seats: t.seats,
      position_x: t.position_x,
      position_y: t.position_y,
      shape: t.shape,
      width: t.width,
      height: t.height,
    }))
  );
  const [loading, setLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const addTable = () => {
    const nextNumber = tableDrafts.length + 1;
    setTableDrafts([...tableDrafts, {
      table_number: `Mesa ${nextNumber}`,
      seats: 4,
      position_x: 50 + (tableDrafts.length % 5) * 100,
      position_y: 50 + Math.floor(tableDrafts.length / 5) * 100,
      shape: 'square',
      width: 80,
      height: 80,
    }]);
  };

  const removeTable = (index: number) => {
    setTableDrafts(tableDrafts.filter((_, i) => i !== index));
    if (selectedTable === index) setSelectedTable(null);
  };

  const updateTable = (index: number, updates: Partial<TableDraft>) => {
    const updated = [...tableDrafts];
    updated[index] = { ...updated[index], ...updates };
    setTableDrafts(updated);
  };

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    const table = tableDrafts[index];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragOffset.current = {
      x: e.clientX - rect.left - table.position_x,
      y: e.clientY - rect.top - table.position_y,
    };
    setSelectedTable(index);
    setIsDragging(true);
  }, [tableDrafts]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || selectedTable === null) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const newX = Math.max(0, Math.min(mapWidth - tableDrafts[selectedTable].width, 
      e.clientX - rect.left - dragOffset.current.x));
    const newY = Math.max(0, Math.min(mapHeight - tableDrafts[selectedTable].height, 
      e.clientY - rect.top - dragOffset.current.y));

    updateTable(selectedTable, { 
      position_x: Math.round(newX), 
      position_y: Math.round(newY) 
    });
  }, [isDragging, selectedTable, mapWidth, mapHeight, tableDrafts]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      let mapId = floorMap?.id;

      // Create or update floor map
      if (mapId) {
        await supabase
          .from('pos_floor_maps')
          .update({
            name,
            config_json: { width: mapWidth, height: mapHeight, background: null },
          })
          .eq('id', mapId);
      } else {
        const { data, error } = await supabase
          .from('pos_floor_maps')
          .insert({
            location_id: locationId,
            name,
            config_json: { width: mapWidth, height: mapHeight, background: null },
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;
        mapId = data.id;
      }

      // Delete removed tables
      const existingIds = tables.map(t => t.id);
      const keptIds = tableDrafts.filter(t => t.id).map(t => t.id);
      const toDelete = existingIds.filter(id => !keptIds.includes(id));

      if (toDelete.length > 0) {
        await supabase
          .from('pos_tables')
          .delete()
          .in('id', toDelete);
      }

      // Upsert tables
      for (const draft of tableDrafts) {
        if (draft.id) {
          await supabase
            .from('pos_tables')
            .update({
              table_number: draft.table_number,
              seats: draft.seats,
              position_x: draft.position_x,
              position_y: draft.position_y,
              shape: draft.shape,
              width: draft.width,
              height: draft.height,
            })
            .eq('id', draft.id);
        } else {
          await supabase
            .from('pos_tables')
            .insert({
              floor_map_id: mapId,
              table_number: draft.table_number,
              seats: draft.seats,
              position_x: draft.position_x,
              position_y: draft.position_y,
              shape: draft.shape,
              width: draft.width,
              height: draft.height,
              status: 'available',
            });
        }
      }

      toast.success('Plano guardado');
      onSave();
    } catch (error) {
      console.error('Error saving floor plan:', error);
      toast.error('Error al guardar plano');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Configurar Plano de Sala</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6 py-4">
          {/* Floor Map Settings */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Nombre de la sala</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sala Principal"
              />
            </div>
            <div>
              <Label>Ancho (px)</Label>
              <Input
                type="number"
                value={mapWidth}
                onChange={(e) => setMapWidth(parseInt(e.target.value) || 800)}
              />
            </div>
            <div>
              <Label>Alto (px)</Label>
              <Input
                type="number"
                value={mapHeight}
                onChange={(e) => setMapHeight(parseInt(e.target.value) || 600)}
              />
            </div>
          </div>

          <div className="flex gap-6">
            {/* Visual Canvas with Drag & Drop */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2">
                  <Move className="h-4 w-4" />
                  Arrastra las mesas para posicionarlas
                </Label>
                <Button variant="outline" size="sm" onClick={addTable}>
                  <Plus className="h-4 w-4 mr-1" />
                  Añadir mesa
                </Button>
              </div>
              <div 
                ref={canvasRef}
                className="relative bg-muted/30 rounded-lg border-2 border-dashed border-border overflow-auto cursor-crosshair"
                style={{ width: '100%', height: 400 }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div 
                  className="relative"
                  style={{ width: mapWidth, height: mapHeight, minWidth: mapWidth }}
                >
                  {/* Grid overlay */}
                  <div 
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: 'linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)',
                      backgroundSize: '50px 50px'
                    }}
                  />
                  
                  {tableDrafts.map((table, index) => (
                    <div
                      key={index}
                      className={cn(
                        "absolute flex items-center justify-center text-xs font-bold cursor-move transition-shadow select-none",
                        table.shape === 'round' ? 'rounded-full' : 'rounded-lg',
                        selectedTable === index 
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 shadow-lg' 
                          : 'bg-primary/20 border-2 border-primary text-primary hover:bg-primary/30'
                      )}
                      style={{
                        left: table.position_x,
                        top: table.position_y,
                        width: table.width,
                        height: table.height,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, index)}
                      onClick={() => setSelectedTable(index)}
                    >
                      <span className="pointer-events-none">{table.table_number}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Selected Table Properties */}
            <div className="w-64 space-y-4">
              <Label>Propiedades de mesa</Label>
              {selectedTable !== null ? (
                <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-xs">Nombre</Label>
                    <Input
                      value={tableDrafts[selectedTable].table_number}
                      onChange={(e) => updateTable(selectedTable, { table_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Asientos</Label>
                    <Input
                      type="number"
                      value={tableDrafts[selectedTable].seats}
                      onChange={(e) => updateTable(selectedTable, { seats: parseInt(e.target.value) || 4 })}
                      min={1}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Forma</Label>
                    <Select
                      value={tableDrafts[selectedTable].shape}
                      onValueChange={(v) => updateTable(selectedTable, { shape: v as TableDraft['shape'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="square">Cuadrada</SelectItem>
                        <SelectItem value="round">Redonda</SelectItem>
                        <SelectItem value="rectangle">Rectangular</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Ancho</Label>
                      <Input
                        type="number"
                        value={tableDrafts[selectedTable].width}
                        onChange={(e) => updateTable(selectedTable, { width: parseInt(e.target.value) || 80 })}
                        min={40}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Alto</Label>
                      <Input
                        type="number"
                        value={tableDrafts[selectedTable].height}
                        onChange={(e) => updateTable(selectedTable, { height: parseInt(e.target.value) || 80 })}
                        min={40}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">X</Label>
                      <Input
                        type="number"
                        value={tableDrafts[selectedTable].position_x}
                        onChange={(e) => updateTable(selectedTable, { position_x: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Y</Label>
                      <Input
                        type="number"
                        value={tableDrafts[selectedTable].position_y}
                        onChange={(e) => updateTable(selectedTable, { position_y: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => removeTable(selectedTable)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar mesa
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                  Selecciona una mesa en el plano para editar sus propiedades
                </p>
              )}
              
              {tableDrafts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No hay mesas. Añade una para empezar.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
