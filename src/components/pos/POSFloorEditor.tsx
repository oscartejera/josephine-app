import { useState } from 'react';
import { FloorMap, POSTable } from '@/hooks/usePOSData';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

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
  };

  const updateTable = (index: number, updates: Partial<TableDraft>) => {
    const updated = [...tableDrafts];
    updated[index] = { ...updated[index], ...updates };
    setTableDrafts(updated);
  };

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
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

          {/* Tables List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Mesas</Label>
              <Button variant="outline" size="sm" onClick={addTable}>
                <Plus className="h-4 w-4 mr-1" />
                Añadir mesa
              </Button>
            </div>

            <div className="space-y-2 max-h-64 overflow-auto">
              {tableDrafts.map((table, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  
                  <Input
                    value={table.table_number}
                    onChange={(e) => updateTable(index, { table_number: e.target.value })}
                    placeholder="Nombre"
                    className="w-28"
                  />

                  <div className="flex items-center gap-1">
                    <Label className="text-xs">Asientos:</Label>
                    <Input
                      type="number"
                      value={table.seats}
                      onChange={(e) => updateTable(index, { seats: parseInt(e.target.value) || 4 })}
                      className="w-16"
                      min={1}
                    />
                  </div>

                  <Select
                    value={table.shape}
                    onValueChange={(v) => updateTable(index, { shape: v as TableDraft['shape'] })}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="square">Cuadrada</SelectItem>
                      <SelectItem value="round">Redonda</SelectItem>
                      <SelectItem value="rectangle">Rectangular</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1">
                    <Label className="text-xs">X:</Label>
                    <Input
                      type="number"
                      value={table.position_x}
                      onChange={(e) => updateTable(index, { position_x: parseInt(e.target.value) || 0 })}
                      className="w-16"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <Label className="text-xs">Y:</Label>
                    <Input
                      type="number"
                      value={table.position_y}
                      onChange={(e) => updateTable(index, { position_y: parseInt(e.target.value) || 0 })}
                      className="w-16"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive shrink-0"
                    onClick={() => removeTable(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {tableDrafts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No hay mesas. Añade una para empezar.
                </p>
              )}
            </div>
          </div>

          {/* Visual Preview */}
          <div>
            <Label>Vista previa</Label>
            <div 
              className="relative bg-muted/30 rounded-lg border border-border mt-2 overflow-auto"
              style={{ width: '100%', height: 300 }}
            >
              <div 
                className="relative"
                style={{ width: mapWidth, height: mapHeight, minWidth: mapWidth }}
              >
                {tableDrafts.map((table, index) => (
                  <div
                    key={index}
                    className={`absolute flex items-center justify-center bg-primary/20 border-2 border-primary text-primary text-xs font-bold
                      ${table.shape === 'round' ? 'rounded-full' : 'rounded-lg'}
                    `}
                    style={{
                      left: table.position_x,
                      top: table.position_y,
                      width: table.width,
                      height: table.height,
                    }}
                  >
                    {table.table_number}
                  </div>
                ))}
              </div>
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
