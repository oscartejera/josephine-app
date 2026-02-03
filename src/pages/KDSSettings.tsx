/**
 * KDS Settings Page
 * Configuración de monitores estilo Ágora
 */

import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Monitor, Plus, Edit, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { KDSMonitorsService } from '@/services/kds/monitors-service';
import type { KDSMonitor } from '@/services/kds/types';

const monitorsService = new KDSMonitorsService();

export default function KDSSettings() {
  const { selectedLocationId } = useApp();
  const [monitors, setMonitors] = useState<KDSMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<Partial<KDSMonitor> | null>(null);

  const locationId = selectedLocationId === 'all' ? null : selectedLocationId;

  useEffect(() => {
    loadMonitors();
  }, [locationId]);

  const loadMonitors = async () => {
    if (!locationId) {
      setLoading(false);
      return;
    }

    try {
      const data = await monitorsService.getActiveMonitors(locationId);
      setMonitors(data);
    } catch (error) {
      console.error('Error loading monitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingMonitor({
      location_id: locationId!,
      name: '',
      type: 'restaurant',
      destinations: ['kitchen'],
      courses: null,
      primary_statuses: ['pending', 'preparing'],
      secondary_statuses: ['ready'],
      view_mode: 'classic',
      rows_count: 3,
      newest_side: 'right',
      auto_serve_on_finish: false,
      history_window_minutes: 30,
      show_start_btn: true,
      show_finish_btn: true,
      show_serve_btn: false,
      styles_rules: [],
      is_active: true,
    });
    setEditDialog(true);
  };

  const handleEdit = (monitor: KDSMonitor) => {
    setEditingMonitor(monitor);
    setEditDialog(true);
  };

  const handleSave = async () => {
    if (!editingMonitor || !editingMonitor.name) {
      toast.error('Nombre requerido');
      return;
    }

    try {
      if (editingMonitor.id) {
        await monitorsService.updateMonitor(editingMonitor.id, editingMonitor);
        toast.success('Monitor actualizado');
      } else {
        await monitorsService.createMonitor(editingMonitor as any);
        toast.success('Monitor creado');
      }
      
      setEditDialog(false);
      setEditingMonitor(null);
      loadMonitors();
    } catch (error) {
      toast.error('Error al guardar');
      console.error(error);
    }
  };

  const handleDelete = async (monitorId: string) => {
    if (!confirm('¿Eliminar este monitor?')) return;

    try {
      await monitorsService.deleteMonitor(monitorId);
      toast.success('Monitor eliminado');
      loadMonitors();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  if (!locationId) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <p>Selecciona una ubicación</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Monitor className="h-6 w-6" />
            Configuración KDS
          </h1>
          <p className="text-muted-foreground">Gestiona monitores y pantallas KDS</p>
        </div>

        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Monitor
        </Button>
      </div>

      <div className="grid gap-4">
        {monitors.map(monitor => (
          <Card key={monitor.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{monitor.name}</CardTitle>
                  <CardDescription>
                    <Badge variant="outline" className="mr-2">{monitor.type}</Badge>
                    {monitor.destinations.join(', ')} • {monitor.view_mode}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(monitor)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(monitor.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Estados primarios:</span>
                  <p className="font-medium">{monitor.primary_statuses.join(', ')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Estados secundarios:</span>
                  <p className="font-medium">{monitor.secondary_statuses.join(', ')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Botones:</span>
                  <p className="font-medium">
                    {[monitor.show_start_btn && 'Start', monitor.show_finish_btn && 'Finish', monitor.show_serve_btn && 'Serve']
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Historial:</span>
                  <p className="font-medium">{monitor.history_window_minutes} min</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {monitors.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay monitores configurados</p>
              <Button onClick={handleCreateNew} variant="outline" className="mt-4">
                Crear Primer Monitor
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog (simplified) */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingMonitor?.id ? 'Editar Monitor' : 'Nuevo Monitor'}
            </DialogTitle>
          </DialogHeader>

          {editingMonitor && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={editingMonitor.name}
                  onChange={(e) =>
                    setEditingMonitor({ ...editingMonitor, name: e.target.value })
                  }
                  placeholder="Ej: Cocina Principal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={editingMonitor.type}
                    onValueChange={(v: any) =>
                      setEditingMonitor({ ...editingMonitor, type: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="fast_food">Fast Food</SelectItem>
                      <SelectItem value="expeditor">Expeditor/Pase</SelectItem>
                      <SelectItem value="customer_display">Customer Display</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Modo de Vista</Label>
                  <Select
                    value={editingMonitor.view_mode}
                    onValueChange={(v: any) =>
                      setEditingMonitor({ ...editingMonitor, view_mode: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classic">Clásico (Columnas)</SelectItem>
                      <SelectItem value="rows_interactive">Rows Interactivo</SelectItem>
                      <SelectItem value="mixed">Mixto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Auto-servir al terminar</Label>
                <Switch
                  checked={editingMonitor.auto_serve_on_finish}
                  onCheckedChange={(checked) =>
                    setEditingMonitor({ ...editingMonitor, auto_serve_on_finish: checked })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
