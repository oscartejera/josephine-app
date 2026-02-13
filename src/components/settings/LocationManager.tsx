import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Plus, Trash2, Edit2, MapPin, Clock, Loader2, Check, AlertTriangle, Copy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { LocationWizard } from './LocationWizard';

interface LocationFormData {
  name: string;
  city: string;
  timezone: string;
  currency: string;
}

interface DuplicateOptions {
  products: boolean;
  employees: boolean;
  floorMaps: boolean;
  settings: boolean;
}

const TIMEZONES = [
  { value: 'Europe/Madrid', label: 'España (Madrid)' },
  { value: 'Europe/London', label: 'Reino Unido (Londres)' },
  { value: 'Europe/Paris', label: 'Francia (París)' },
  { value: 'Europe/Berlin', label: 'Alemania (Berlín)' },
  { value: 'America/New_York', label: 'EEUU (Nueva York)' },
  { value: 'America/Los_Angeles', label: 'EEUU (Los Ángeles)' },
  { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
];

const CURRENCIES = [
  { value: 'EUR', label: '€ Euro (EUR)' },
  { value: 'USD', label: '$ Dólar (USD)' },
  { value: 'GBP', label: '£ Libra (GBP)' },
  { value: 'MXN', label: '$ Peso Mexicano (MXN)' },
];

const initialFormData: LocationFormData = {
  name: '',
  city: '',
  timezone: 'Europe/Madrid',
  currency: 'EUR',
};

const initialDuplicateOptions: DuplicateOptions = {
  products: true,
  employees: true,
  floorMaps: true,
  settings: true,
};

export function LocationManager() {
  const { locations, group } = useApp();
  const { profile } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [formData, setFormData] = useState<LocationFormData>(initialFormData);
  const [sourceLocationId, setSourceLocationId] = useState<string>('');
  const [duplicateOptions, setDuplicateOptions] = useState<DuplicateOptions>(initialDuplicateOptions);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleAddLocation = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre del local es obligatorio');
      return;
    }

    if (!group?.id) {
      toast.error('No se encontró el grupo');
      return;
    }

    setLoading(true);
    try {
      // Verificar sesión activa antes de insertar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
        setLoading(false);
        return;
      }

      // Verificar que el group_id del usuario coincide
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('group_id')
        .eq('id', session.user.id)
        .single();

      if (userProfile?.group_id !== group.id) {
        toast.error('Error de permisos. Recarga la página e intenta de nuevo.');
        setLoading(false);
        return;
      }

      // 1. Create the location
      const { data: newLocation, error: locationError } = await supabase
        .from('locations')
        .insert({
          group_id: group.id,
          name: formData.name.trim(),
          city: formData.city.trim() || null,
          timezone: formData.timezone,
          currency: formData.currency,
          active: true,
        })
        .select()
        .single();

      if (locationError) throw locationError;

      // 2. Create default location_settings
      await supabase.from('location_settings').insert({
        location_id: newLocation.id,
        target_gp_percent: 70,
        target_col_percent: 25,
        default_cogs_percent: 30,
        default_hourly_cost: 12.00,
      });

      // 3. Create default payroll_location_settings (Spanish defaults)
      await supabase.from('payroll_location_settings').insert({
        location_id: newLocation.id,
        contingencias_comunes_employer: 0.2360,
        desempleo_employer_indefinido: 0.0550,
        desempleo_employer_temporal: 0.0670,
        fogasa_employer: 0.0020,
        formacion_employer: 0.0060,
        mei_employer: 0.0067,
        accident_rate_employer: 0.0150,
      });

      // 4. Create default floor map for POS
      const { data: floorMap } = await supabase
        .from('pos_floor_maps')
        .insert({
          location_id: newLocation.id,
          name: 'Sala Principal',
          config_json: { width: 800, height: 600, background: null },
          is_active: true,
        })
        .select()
        .single();

      // 5. Create a few default tables
      if (floorMap) {
        const defaultTables = [
          { floor_map_id: floorMap.id, table_number: '1', seats: 4, position_x: 100, position_y: 100, shape: 'square', width: 80, height: 80, status: 'available' },
          { floor_map_id: floorMap.id, table_number: '2', seats: 4, position_x: 220, position_y: 100, shape: 'square', width: 80, height: 80, status: 'available' },
          { floor_map_id: floorMap.id, table_number: '3', seats: 6, position_x: 340, position_y: 100, shape: 'rectangle', width: 120, height: 80, status: 'available' },
          { floor_map_id: floorMap.id, table_number: '4', seats: 2, position_x: 100, position_y: 220, shape: 'round', width: 70, height: 70, status: 'available' },
          { floor_map_id: floorMap.id, table_number: '5', seats: 2, position_x: 220, position_y: 220, shape: 'round', width: 70, height: 70, status: 'available' },
        ];
        await supabase.from('pos_tables').insert(defaultTables);
      }

      toast.success(`Local "${formData.name}" creado correctamente`);
      setShowAddDialog(false);
      setFormData(initialFormData);
      window.location.reload();
    } catch (error: any) {
      console.error('Error creating location:', error);
      if (error.code === '42501') {
        toast.error('No tienes permisos para crear locales. Verifica que tienes rol de propietario.');
      } else {
        toast.error(error.message || 'Error al crear el local');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateLocation = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre del local es obligatorio');
      return;
    }

    if (!sourceLocationId) {
      toast.error('Selecciona un local de origen');
      return;
    }

    if (!group?.id) {
      toast.error('No se encontró el grupo');
      return;
    }

    setLoading(true);
    try {
      // Verificar sesión activa antes de insertar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
        setLoading(false);
        return;
      }

      // Verificar que el group_id del usuario coincide
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('group_id')
        .eq('id', session.user.id)
        .single();

      if (userProfile?.group_id !== group.id) {
        toast.error('Error de permisos. Recarga la página e intenta de nuevo.');
        setLoading(false);
        return;
      }

      // 1. Create the new location
      const { data: newLocation, error: locationError } = await supabase
        .from('locations')
        .insert({
          group_id: group.id,
          name: formData.name.trim(),
          city: formData.city.trim() || null,
          timezone: formData.timezone,
          currency: formData.currency,
          active: true,
        })
        .select()
        .single();

      if (locationError) throw locationError;

      const copiedItems = {
        settings: false,
        products: 0,
        employees: 0,
        floorMaps: 0,
        tables: 0,
      };

      // 2. Copy settings if selected
      if (duplicateOptions.settings) {
        // Copy location_settings
        const { data: sourceSettings } = await supabase
          .from('location_settings')
          .select('*')
          .eq('location_id', sourceLocationId)
          .single();

        if (sourceSettings) {
          await supabase.from('location_settings').insert({
            location_id: newLocation.id,
            target_gp_percent: sourceSettings.target_gp_percent,
            target_col_percent: sourceSettings.target_col_percent,
            default_cogs_percent: sourceSettings.default_cogs_percent,
            default_hourly_cost: sourceSettings.default_hourly_cost,
          });
        } else {
          // Insert defaults if source has no settings
          await supabase.from('location_settings').insert({
            location_id: newLocation.id,
            target_gp_percent: 70,
            target_col_percent: 25,
            default_cogs_percent: 30,
            default_hourly_cost: 12.00,
          });
        }

        // Copy payroll_location_settings
        const { data: sourcePayrollSettings } = await supabase
          .from('payroll_location_settings')
          .select('*')
          .eq('location_id', sourceLocationId)
          .single();

        if (sourcePayrollSettings) {
          await supabase.from('payroll_location_settings').insert({
            location_id: newLocation.id,
            contingencias_comunes_employer: sourcePayrollSettings.contingencias_comunes_employer,
            desempleo_employer_indefinido: sourcePayrollSettings.desempleo_employer_indefinido,
            desempleo_employer_temporal: sourcePayrollSettings.desempleo_employer_temporal,
            fogasa_employer: sourcePayrollSettings.fogasa_employer,
            formacion_employer: sourcePayrollSettings.formacion_employer,
            mei_employer: sourcePayrollSettings.mei_employer,
            accident_rate_employer: sourcePayrollSettings.accident_rate_employer,
          });
        } else {
          await supabase.from('payroll_location_settings').insert({
            location_id: newLocation.id,
            contingencias_comunes_employer: 0.2360,
            desempleo_employer_indefinido: 0.0550,
            desempleo_employer_temporal: 0.0670,
            fogasa_employer: 0.0020,
            formacion_employer: 0.0060,
            mei_employer: 0.0067,
            accident_rate_employer: 0.0150,
          });
        }
        copiedItems.settings = true;
      } else {
        // Create defaults
        await supabase.from('location_settings').insert({
          location_id: newLocation.id,
          target_gp_percent: 70,
          target_col_percent: 25,
          default_cogs_percent: 30,
          default_hourly_cost: 12.00,
        });
        await supabase.from('payroll_location_settings').insert({
          location_id: newLocation.id,
          contingencias_comunes_employer: 0.2360,
          desempleo_employer_indefinido: 0.0550,
          desempleo_employer_temporal: 0.0670,
          fogasa_employer: 0.0020,
          formacion_employer: 0.0060,
          mei_employer: 0.0067,
          accident_rate_employer: 0.0150,
        });
      }

      // 3. Copy products if selected
      if (duplicateOptions.products) {
        const { data: sourceProducts } = await supabase
          .from('products')
          .select('*')
          .eq('location_id', sourceLocationId);

        if (sourceProducts && sourceProducts.length > 0) {
          const newProducts = sourceProducts.map(p => ({
            name: p.name,
            category: p.category,
            location_id: newLocation.id,
            group_id: group.id,
            is_active: p.is_active,
            kds_destination: p.kds_destination,
            target_prep_time: p.target_prep_time,
          }));
          await supabase.from('products').insert(newProducts);
          copiedItems.products = sourceProducts.length;
        }
      }

      // 4. Copy employees if selected (without payroll data - clean slate)
      if (duplicateOptions.employees) {
        const { data: sourceEmployees } = await supabase
          .from('employees')
          .select('*')
          .eq('location_id', sourceLocationId)
          .eq('active', true);

        if (sourceEmployees && sourceEmployees.length > 0) {
          // Filter out placeholder employees (OPEN - X)
          const realEmployees = sourceEmployees.filter(e => !e.full_name.startsWith('OPEN - '));
          
          if (realEmployees.length > 0) {
            const newEmployees = realEmployees.map(e => ({
              full_name: e.full_name,
              role_name: e.role_name,
              location_id: newLocation.id,
              hourly_cost: e.hourly_cost,
              active: true,
            }));
            await supabase.from('employees').insert(newEmployees);
            copiedItems.employees = realEmployees.length;
          }
        }
      }

      // 5. Copy floor maps and tables if selected
      if (duplicateOptions.floorMaps) {
        const { data: sourceFloorMaps } = await supabase
          .from('pos_floor_maps')
          .select('*')
          .eq('location_id', sourceLocationId);

        if (sourceFloorMaps && sourceFloorMaps.length > 0) {
          for (const floorMap of sourceFloorMaps) {
            const { data: newFloorMap } = await supabase
              .from('pos_floor_maps')
              .insert({
                location_id: newLocation.id,
                name: floorMap.name,
                config_json: floorMap.config_json,
                is_active: floorMap.is_active,
              })
              .select()
              .single();

            if (newFloorMap) {
              copiedItems.floorMaps++;

              // Copy tables for this floor map
              const { data: sourceTables } = await supabase
                .from('pos_tables')
                .select('*')
                .eq('floor_map_id', floorMap.id);

              if (sourceTables && sourceTables.length > 0) {
                const newTables = sourceTables.map(t => ({
                  floor_map_id: newFloorMap.id,
                  table_number: t.table_number,
                  seats: t.seats,
                  position_x: t.position_x,
                  position_y: t.position_y,
                  shape: t.shape,
                  width: t.width,
                  height: t.height,
                  status: 'available',
                }));
                await supabase.from('pos_tables').insert(newTables);
                copiedItems.tables += sourceTables.length;
              }
            }
          }
        } else {
          // Create default floor map
          const { data: floorMap } = await supabase
            .from('pos_floor_maps')
            .insert({
              location_id: newLocation.id,
              name: 'Sala Principal',
              config_json: { width: 800, height: 600, background: null },
              is_active: true,
            })
            .select()
            .single();

          if (floorMap) {
            const defaultTables = [
              { floor_map_id: floorMap.id, table_number: '1', seats: 4, position_x: 100, position_y: 100, shape: 'square', width: 80, height: 80, status: 'available' },
              { floor_map_id: floorMap.id, table_number: '2', seats: 4, position_x: 220, position_y: 100, shape: 'square', width: 80, height: 80, status: 'available' },
            ];
            await supabase.from('pos_tables').insert(defaultTables);
          }
        }
      } else {
        // Create default floor map
        const { data: floorMap } = await supabase
          .from('pos_floor_maps')
          .insert({
            location_id: newLocation.id,
            name: 'Sala Principal',
            config_json: { width: 800, height: 600, background: null },
            is_active: true,
          })
          .select()
          .single();

        if (floorMap) {
          const defaultTables = [
            { floor_map_id: floorMap.id, table_number: '1', seats: 4, position_x: 100, position_y: 100, shape: 'square', width: 80, height: 80, status: 'available' },
            { floor_map_id: floorMap.id, table_number: '2', seats: 4, position_x: 220, position_y: 100, shape: 'square', width: 80, height: 80, status: 'available' },
          ];
          await supabase.from('pos_tables').insert(defaultTables);
        }
      }

      // Build success message
      const parts: string[] = [];
      if (copiedItems.settings) parts.push('configuración');
      if (copiedItems.products > 0) parts.push(`${copiedItems.products} productos`);
      if (copiedItems.employees > 0) parts.push(`${copiedItems.employees} empleados`);
      if (copiedItems.floorMaps > 0) parts.push(`${copiedItems.floorMaps} planos con ${copiedItems.tables} mesas`);

      const sourceLocation = locations.find(l => l.id === sourceLocationId);
      const message = parts.length > 0
        ? `Local "${formData.name}" creado copiando ${parts.join(', ')} de "${sourceLocation?.name}"`
        : `Local "${formData.name}" creado correctamente`;

      toast.success(message);
      setShowDuplicateDialog(false);
      setFormData(initialFormData);
      setSourceLocationId('');
      setDuplicateOptions(initialDuplicateOptions);
      window.location.reload();
    } catch (error: any) {
      console.error('Error duplicating location:', error);
      toast.error(error.message || 'Error al duplicar el local');
    } finally {
      setLoading(false);
    }
  };

  const handleEditLocation = async (locationId: string) => {
    if (!formData.name.trim()) {
      toast.error('El nombre del local es obligatorio');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('locations')
        .update({
          name: formData.name.trim(),
          city: formData.city.trim() || null,
          timezone: formData.timezone,
          currency: formData.currency,
        })
        .eq('id', locationId);

      if (error) throw error;

      toast.success('Local actualizado');
      setEditingLocation(null);
      setFormData(initialFormData);
      window.location.reload();
    } catch (error: any) {
      console.error('Error updating location:', error);
      toast.error(error.message || 'Error al actualizar el local');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    
    if (locations.length <= 1) {
      toast.error('No puedes eliminar el único local del grupo');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;

      toast.success(`Local "${location?.name}" eliminado`);
      setDeleteConfirmId(null);
      window.location.reload();
    } catch (error: any) {
      console.error('Error deleting location:', error);
      toast.error(error.message || 'Error al eliminar el local');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (loc: { id: string; name: string; city: string | null }) => {
    setFormData({
      name: loc.name,
      city: loc.city || '',
      timezone: 'Europe/Madrid',
      currency: 'EUR',
    });
    setEditingLocation(loc.id);
  };

  const openDuplicateDialog = (loc: { id: string; name: string; city: string | null }) => {
    setSourceLocationId(loc.id);
    setFormData({
      name: `${loc.name} (Copia)`,
      city: loc.city || '',
      timezone: 'Europe/Madrid',
      currency: 'EUR',
    });
    setDuplicateOptions(initialDuplicateOptions);
    setShowDuplicateDialog(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Locales de {group?.name || 'Grupo'}
            </CardTitle>
            <CardDescription>
              Gestiona los locales de tu grupo. Cada local tiene su propio POS, KDS, inventario y métricas.
            </CardDescription>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowWizard(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Wizard Guiado
            </Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => setFormData(initialFormData)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir Rápido
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo Local</DialogTitle>
                <DialogDescription>
                  Crea un nuevo local para tu grupo. Se configurará automáticamente con POS, KDS y estructura de datos lista para usar.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Local *</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Restaurante Centro"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input
                    id="city"
                    placeholder="Ej: Madrid"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Zona Horaria</Label>
                    <Select 
                      value={formData.timezone} 
                      onValueChange={(v) => setFormData({ ...formData, timezone: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map(tz => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Moneda</Label>
                    <Select 
                      value={formData.currency} 
                      onValueChange={(v) => setFormData({ ...formData, currency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Se creará automáticamente:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Plano de sala con 5 mesas de ejemplo</li>
                    <li>Configuración de objetivos (GP, COL)</li>
                    <li>Configuración de nóminas (España)</li>
                    <li>Conexión con POS y KDS</li>
                  </ul>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddLocation} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Crear Local
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </CardHeader>

      {/* Duplicate Location Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Duplicar Local
            </DialogTitle>
            <DialogDescription>
              Crea un nuevo local copiando la configuración de uno existente. No se copiarán datos históricos (ventas, tickets, turnos).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Local de origen</Label>
              <Select value={sourceLocationId} onValueChange={setSourceLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el local a copiar" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dup-name">Nombre del nuevo local *</Label>
              <Input
                id="dup-name"
                placeholder="Ej: Restaurante Centro 2"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dup-city">Ciudad</Label>
              <Input
                id="dup-city"
                placeholder="Ej: Madrid"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <Label>¿Qué copiar?</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dup-products"
                    checked={duplicateOptions.products}
                    onCheckedChange={(checked) => 
                      setDuplicateOptions({ ...duplicateOptions, products: checked === true })
                    }
                  />
                  <label htmlFor="dup-products" className="text-sm cursor-pointer">
                    Productos y categorías
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dup-employees"
                    checked={duplicateOptions.employees}
                    onCheckedChange={(checked) => 
                      setDuplicateOptions({ ...duplicateOptions, employees: checked === true })
                    }
                  />
                  <label htmlFor="dup-employees" className="text-sm cursor-pointer">
                    Empleados (sin datos de nómina)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dup-floormaps"
                    checked={duplicateOptions.floorMaps}
                    onCheckedChange={(checked) => 
                      setDuplicateOptions({ ...duplicateOptions, floorMaps: checked === true })
                    }
                  />
                  <label htmlFor="dup-floormaps" className="text-sm cursor-pointer">
                    Planos de sala y mesas
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dup-settings"
                    checked={duplicateOptions.settings}
                    onCheckedChange={(checked) => 
                      setDuplicateOptions({ ...duplicateOptions, settings: checked === true })
                    }
                  />
                  <label htmlFor="dup-settings" className="text-sm cursor-pointer">
                    Configuración (objetivos GP, COL, nóminas)
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">
                <strong className="text-foreground">Nota:</strong> El nuevo local empezará sin datos históricos. Los datos de ventas, inventario y turnos se generarán desde cero.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDuplicateLocation} disabled={loading || !sourceLocationId}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Duplicar Local
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Zona Horaria</TableHead>
              <TableHead>Moneda</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((loc) => (
              <TableRow key={loc.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {editingLocation === loc.id ? (
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="h-8 w-40"
                      />
                    ) : (
                      loc.name
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {editingLocation === loc.id ? (
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="h-8 w-32"
                      placeholder="Ciudad"
                    />
                  ) : (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {loc.city || '-'}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    Europe/Madrid
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">EUR</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {editingLocation === loc.id ? (
                      <>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => {
                            setEditingLocation(null);
                            setFormData(initialFormData);
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleEditLocation(loc.id)}
                          disabled={loading}
                        >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => openDuplicateDialog(loc)}
                          title="Duplicar local"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => openEditDialog(loc)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        
                        <AlertDialog 
                          open={deleteConfirmId === loc.id} 
                          onOpenChange={(open) => !open && setDeleteConfirmId(null)}
                        >
                          <AlertDialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirmId(loc.id)}
                              disabled={locations.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                ¿Eliminar "{loc.name}"?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="space-y-2">
                                <p>Esta acción eliminará permanentemente:</p>
                                <ul className="list-disc list-inside text-sm">
                                  <li>Todos los tickets y ventas del local</li>
                                  <li>Empleados asignados a este local</li>
                                  <li>Turnos, horarios y nóminas</li>
                                  <li>Inventario y pedidos</li>
                                  <li>Configuración de mesas y planos</li>
                                </ul>
                                <p className="font-medium text-destructive">
                                  Esta acción no se puede deshacer.
                                </p>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteLocation(loc.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Eliminar Local
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {locations.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hay locales configurados</p>
            <p className="text-sm">Añade tu primer local para empezar</p>
          </div>
        )}
      </CardContent>

      {/* Location Wizard */}
      {group?.id && (
        <LocationWizard
          open={showWizard}
          onOpenChange={setShowWizard}
          groupId={group.id}
          onSuccess={() => window.location.reload()}
        />
      )}
    </Card>
  );
}
