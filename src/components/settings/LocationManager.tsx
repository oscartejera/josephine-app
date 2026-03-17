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
import { useTranslation } from 'react-i18next';

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
  { value: 'Europe/Madrid', label: t('settings.countrySpain') },
  { value: 'Europe/London', label: 'Reino Unido (Londres)' },
  { value: 'Europe/Paris', label: t('settings.countryFrance') },
  { value: 'Europe/Berlin', label: t('settings.countryGermany') },
  { value: 'America/New_York', label: 'EEUU (Nueva York)' },
  { value: 'America/Los_Angeles', label: t('settings.countryUS') },
  { value: 'America/Mexico_City', label: t('settings.countryMexico') },
];

const CURRENCIES = [
  { value: 'EUR', label: '€ Euro (EUR)' },
  { value: 'USD', label: t('settings.currencyDollarUsd') },
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
  const { t } = useTranslation();
  const { locations, group } = useApp();
  const { profile } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<string | null>{t('settings.LocationManager.nullConstFormdataSetformdataUsestate')}<LocationFormData>{t('settings.LocationManager.initialformdataConstSourcelocationidSets')}<string>{t('settings.LocationManager.constDuplicateoptionsSetduplicateoptions')}<DuplicateOptions>{t('settings.LocationManager.initialduplicateoptionsConstLoadingSetlo')}<string | null>(null);

  const handleAddLocation = async () => {
    if (!formData.name.trim()) {
      toast.error(t('locationManager.toastNameRequired'));
      return;
    }

    if (!group?.id) {
      toast.error(t('locationManager.toastGroupNotFound'));
      return;
    }

    setLoading(true);
    try {
      // Verificar sesión activa antes de insertar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t('locationManager.toastSessionExpired'));
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
        toast.error(t('locationManager.toastPermissionsError'));
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
        toast.error(t('locationManager.toastNoPermissions'));
      } else {
        toast.error(error.message || t('settings.errorAlCrearElLocal'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateLocation = async () => {
    if (!formData.name.trim()) {
      toast.error(t('locationManager.toastNameRequired'));
      return;
    }

    if (!sourceLocationId) {
      toast.error(t('locationManager.toastSelectSource'));
      return;
    }

    if (!group?.id) {
      toast.error(t('locationManager.toastGroupNotFound'));
      return;
    }

    setLoading(true);
    try {
      // Verificar sesión activa antes de insertar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t('locationManager.toastSessionExpired'));
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
        toast.error(t('locationManager.toastPermissionsError'));
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

      let copiedItems = {
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
      if (copiedItems.settings) parts.push(t('settings.configuracion'));
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
      toast.error(error.message || t('settings.errorAlDuplicarElLocal'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditLocation = async (locationId: string) => {
    if (!formData.name.trim()) {
      toast.error(t('locationManager.toastNameRequired'));
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

      toast.success(t('locationManager.toastUpdated'));
      setEditingLocation(null);
      setFormData(initialFormData);
      window.location.reload();
    } catch (error: any) {
      console.error('Error updating location:', error);
      toast.error(error.message || t('settings.errorAlActualizarElLocal'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    
    if (locations.length <= 1) {
      toast.error(t('locationManager.toastCannotDelete'));
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
      toast.error(error.message || t('settings.errorAlEliminarElLocal'));
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
              {t('settings.LocationManager.gestionaLosLocalesDeTu')}
            </CardDescription>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowWizard(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              {t('settings.LocationManager.wizardGuiado')}
            </Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => setFormData(initialFormData)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('settings.LocationManager.anadirRapido')}
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('settings.LocationManager.nuevoLocal')}</DialogTitle>
                <DialogDescription>
                  {t('settings.LocationManager.creaUnNuevoLocalPara')}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("location.locationName")} *</Label>
                  <Input
                    id="name"
                    placeholder={t('settings.ejRestauranteCentro')}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="city">{t("common.city")}</Label>
                  <Input
                    id="city"
                    placeholder={t('settings.LocationManager.ejMadrid')}
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('settings.LocationManager.zonaHoraria')}</Label>
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
                    <Label>{t('settings.LocationManager.moneda')}</Label>
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
                  <p className="font-medium text-foreground mb-1">{t("settings.autoCreated")}:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>{t("settings.floorPlan5Tables")}</li>
                    <li>{t("settings.objectivesConfig")}</li>
                    <li>{t("settings.payrollConfig")}</li>
                    <li>{t('settings.conexionConPosYKds')}</li>
                  </ul>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  {t('settings.LocationManager.cancelar')}
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
              {t('settings.LocationManager.duplicarLocal')}
            </DialogTitle>
            <DialogDescription>
              {t('settings.LocationManager.creaUnNuevoLocalCopiando')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("settings.sourceLocation")}</Label>
              <Select value={sourceLocationId} onValueChange={setSourceLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('settings.seleccionaElLocalACopiar')} />
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
              <Label htmlFor="dup-name">{t("location.newLocationName")} *</Label>
              <Input
                id="dup-name"
                placeholder={t('settings.ejRestauranteCentro2')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dup-city">{t("common.city")}</Label>
              <Input
                id="dup-city"
                placeholder={t('settings.LocationManager.ejMadrid1')}
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <Label>{t('settings.queCopiar')}</Label>
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
                    {t('settings.LocationManager.productosYCategorias')}
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
                    {t('settings.LocationManager.empleadosSinDatosDeNomina')}
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
                    {t('settings.LocationManager.planosDeSalaYMesas')}
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
                    {t('settings.LocationManager.configuracionObjetivosGpColNominas')}
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">
                <strong className="text-foreground">{t('settings.LocationManager.nota')}</strong> {t('settings.LocationManager.elNuevoLocalEmpezaraSin')}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
              {t('settings.LocationManager.cancelar1')}
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
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.city")}</TableHead>
              <TableHead>{t('settings.LocationManager.zonaHoraria1')}</TableHead>
              <TableHead>{t('settings.LocationManager.moneda1')}</TableHead>
              <TableHead className="text-right">{t('settings.acciones')}</TableHead>
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
                      placeholder={t('settings.LocationManager.ciudad')}
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
                    {t('settings.LocationManager.europemadrid')}
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
                          {t('settings.LocationManager.cancelar2')}
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleEditLocation(loc.id)}
                          disabled={loading}
                        >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('settings.guardar')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => openDuplicateDialog(loc)}
                          title={t('settings.LocationManager.duplicarLocal1')}
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
                                <p>{t("settings.deleteWarning")}:</p>
                                <ul className="list-disc list-inside text-sm">
                                  <li>{t("settings.allTicketsAndSales")}</li>
                                  <li>{t("settings.assignedEmployees")}</li>
                                  <li>{t('settings.turnosHorariosYNominas')}</li>
                                  <li>{t("settings.inventoryAndOrders")}</li>
                                  <li>{t("settings.tablesAndFloorPlans")}</li>
                                </ul>
                                <p className="font-medium text-destructive">
                                  {t('settings.LocationManager.estaAccionNoSePuede')}
                                </p>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
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
            <p>{t("dashboard.noLocations")}</p>
            <p className="text-sm">{t("settings.addFirstLocation")}</p>
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
