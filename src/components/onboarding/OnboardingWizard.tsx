import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Building2, MapPin, UtensilsCrossed, Users, LayoutGrid, Package, 
  ChevronRight, ChevronLeft, Check, Sparkles, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { FloorPlanPreview, TablePreview } from './FloorPlanPreview';
import { 
  RESTAURANT_TEMPLATES, 
  TIMEZONES, 
  CURRENCIES, 
  TABLE_SHAPES,
  type RestaurantTemplate,
  type ProductTemplate,
  type RoleTemplate,
  type TableShape,
} from '@/lib/onboardingTemplates';

interface OnboardingWizardProps {
  onComplete: () => void;
}

interface BusinessInfo {
  name: string;
}

interface LocationInfo {
  name: string;
  city: string;
  timezone: string;
  currency: string;
}

interface EmployeeEntry {
  name: string;
  role: string;
  hourlyCost: number;
}

interface TableEntry {
  id: string;
  table_number: string;
  seats: number;
  shape: TableShape;
}

type Step = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
};

const STEPS: Step[] = [
  { id: 'business', title: 'Tu Negocio', description: 'Nombre de tu empresa', icon: Building2 },
  { id: 'location', title: 'Tu Local', description: 'Primer establecimiento', icon: MapPin },
  { id: 'menu', title: 'Tu Carta', description: 'Productos y precios', icon: UtensilsCrossed },
  { id: 'team', title: 'Tu Equipo', description: 'Empleados iniciales', icon: Users },
  { id: 'floor', title: 'Tu Sala', description: 'Configuración de mesas', icon: LayoutGrid },
  { id: 'inventory', title: 'Inventario', description: 'Ingredientes (opcional)', icon: Package },
];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Business
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({ name: '' });

  // Step 2: Location
  const [locationInfo, setLocationInfo] = useState<LocationInfo>({
    name: '',
    city: '',
    timezone: 'Europe/Madrid',
    currency: 'EUR',
  });

  // Step 3: Menu
  const [selectedTemplate, setSelectedTemplate] = useState<RestaurantTemplate | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [customProducts, setCustomProducts] = useState<ProductTemplate[]>([]);

  // Step 4: Team
  const [employees, setEmployees] = useState<EmployeeEntry[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleTemplate[]>([]);

  // Step 5: Floor
  const [tables, setTables] = useState<TableEntry[]>([]);

  // Step 6: Inventory
  const [includeInventory, setIncludeInventory] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<Set<number>>(new Set());

  // Template selection handler
  const handleTemplateSelect = (template: RestaurantTemplate) => {
    setSelectedTemplate(template);
    setSelectedProducts(new Set(template.products.map((_, i) => i)));
    setAvailableRoles(template.roles);
    if (template.inventory.length > 0) {
      setSelectedInventory(new Set(template.inventory.map((_, i) => i)));
    }
  };

  // Product toggle
  const toggleProduct = (index: number) => {
    const newSet = new Set(selectedProducts);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedProducts(newSet);
  };

  // Employee management
  const addEmployee = () => {
    setEmployees([...employees, { 
      name: '', 
      role: availableRoles[0]?.name || 'Camarero/a',
      hourlyCost: availableRoles[0]?.defaultHourlyCost || 12,
    }]);
  };

  const removeEmployee = (index: number) => {
    setEmployees(employees.filter((_, i) => i !== index));
  };

  const updateEmployee = (index: number, field: keyof EmployeeEntry, value: string | number) => {
    const updated = [...employees];
    if (field === 'role') {
      const role = availableRoles.find(r => r.name === value);
      updated[index] = { 
        ...updated[index], 
        role: value as string,
        hourlyCost: role?.defaultHourlyCost || updated[index].hourlyCost,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setEmployees(updated);
  };

  // Table management
  const addTable = () => {
    const newTable: TableEntry = {
      id: crypto.randomUUID(),
      table_number: String(tables.length + 1),
      seats: 4,
      shape: 'square',
    };
    setTables([...tables, newTable]);
  };

  const removeTable = (index: number) => {
    setTables(tables.filter((_, i) => i !== index));
  };

  const updateTable = (index: number, field: keyof TableEntry, value: string | number) => {
    const updated = [...tables];
    updated[index] = { ...updated[index], [field]: value };
    setTables(updated);
  };

  // Inventory toggle
  const toggleInventory = (index: number) => {
    const newSet = new Set(selectedInventory);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedInventory(newSet);
  };

  // Convert tables to preview format with auto-positioning
  const getTablesPreview = useCallback((): TablePreview[] => {
    const CANVAS_WIDTH = 800;
    const CANVAS_HEIGHT = 500;
    const COLS = 4;
    const PADDING = 40;
    const CELL_WIDTH = (CANVAS_WIDTH - PADDING * 2) / COLS;
    const CELL_HEIGHT = 100;

    return tables.map((table, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const baseWidth = table.shape === 'rectangle' ? 100 : 60;
      const baseHeight = 60;

      return {
        ...table,
        position_x: PADDING + col * CELL_WIDTH + (CELL_WIDTH - baseWidth) / 2,
        position_y: PADDING + row * CELL_HEIGHT + (CELL_HEIGHT - baseHeight) / 2,
        width: baseWidth,
        height: baseHeight,
      };
    });
  }, [tables]);

  // Validation
  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: return businessInfo.name.trim().length >= 2;
      case 1: return locationInfo.name.trim().length >= 2;
      case 2: return selectedTemplate !== null;
      case 3: return true; // Employees optional
      case 4: return true; // Tables optional
      case 5: return true; // Inventory optional
      default: return false;
    }
  };

  // Navigation
  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Complete onboarding
  const handleComplete = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // 1. Create group
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({ name: businessInfo.name })
        .select()
        .single();
      
      if (groupError || !newGroup) throw groupError || new Error('Failed to create group');

      // 2. Update user profile with group_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ group_id: newGroup.id })
        .eq('id', user.id);
      
      if (profileError) throw profileError;

      // 3. Assign owner role
      const { data: ownerRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'owner')
        .single();
      
      if (ownerRole) {
        await supabase.from('user_roles').insert({
          user_id: user.id,
          role_id: ownerRole.id,
          location_id: null, // Global scope
        });
      }

      // 4. Create location
      const { data: newLocation, error: locationError } = await supabase
        .from('locations')
        .insert({
          name: locationInfo.name,
          city: locationInfo.city || null,
          group_id: newGroup.id,
        })
        .select()
        .single();
      
      if (locationError || !newLocation) throw locationError || new Error('Failed to create location');

      // 5. Create location_settings
      await supabase.from('location_settings').insert({
        location_id: newLocation.id,
        timezone: locationInfo.timezone,
        currency: locationInfo.currency,
        target_gp_pct: 70,
        target_col_pct: 25,
      });

      // 6. Create payroll_location_settings (Spanish defaults)
      await supabase.from('payroll_location_settings').insert({
        location_id: newLocation.id,
        contingencias_comunes_employer: 0.2360,
        desempleo_employer_indefinido: 0.0550,
        desempleo_employer_temporal: 0.0670,
        fogasa_employer: 0.0020,
        formacion_employer: 0.0060,
        accident_rate_employer: 0.0150,
        irpf_employee: 0.12,
        contingencias_comunes_employee: 0.0470,
        desempleo_employee: 0.0155,
        formacion_employee: 0.0010,
        mei_employer: 0.0067,
        mei_employee: 0.0058,
        payments_per_year: 14,
      });

      // 7. Create products
      if (selectedTemplate && selectedProducts.size > 0) {
        const productsToInsert = selectedTemplate.products
          .filter((_, i) => selectedProducts.has(i))
          .map(p => ({
            name: p.name,
            category: p.category,
            price: p.price,
            location_id: newLocation.id,
            group_id: newGroup.id,
            is_active: true,
            kds_destination: p.kds_destination,
          }));
        
        if (productsToInsert.length > 0) {
          await supabase.from('products').insert(productsToInsert);
        }
      }

      // 8. Create employees
      if (employees.length > 0) {
        const employeesToInsert = employees
          .filter(e => e.name.trim())
          .map(e => ({
            full_name: e.name,
            role_name: e.role,
            location_id: newLocation.id,
            is_active: true,
            hourly_cost: e.hourlyCost,
          }));
        
        if (employeesToInsert.length > 0) {
          await supabase.from('employees').insert(employeesToInsert);
        }
      }

      // 9. Create floor map and tables
      if (tables.length > 0) {
        const { data: floorMap } = await supabase
          .from('pos_floor_maps')
          .insert({
            location_id: newLocation.id,
            name: 'Sala Principal',
            config_json: { width: 800, height: 500, background: null },
            is_active: true,
          })
          .select()
          .single();
        
        if (floorMap) {
          const tablesPreview = getTablesPreview();
          const tablesToInsert = tablesPreview.map(t => ({
            floor_map_id: floorMap.id,
            table_number: t.table_number,
            seats: t.seats,
            shape: t.shape,
            position_x: t.position_x,
            position_y: t.position_y,
            width: t.width,
            height: t.height,
            status: 'available' as const,
          }));
          
          await supabase.from('pos_tables').insert(tablesToInsert);
        }
      }

      // 10. Create inventory (optional)
      if (includeInventory && selectedTemplate && selectedInventory.size > 0) {
        const inventoryToInsert = selectedTemplate.inventory
          .filter((_, i) => selectedInventory.has(i))
          .map(item => ({
            name: item.name,
            category: item.category,
            unit: item.unit,
            group_id: newGroup.id,
          }));
        
        if (inventoryToInsert.length > 0) {
          await supabase.from('inventory_items').insert(inventoryToInsert);
        }
      }

      toast.success('¡Configuración completada!', {
        description: 'Tu negocio está listo para empezar',
      });

      // Refresh profile to update group_id
      await refreshProfile();
      onComplete();
      navigate('/dashboard');
    } catch (error) {
      console.error('Onboarding error:', error);
      toast.error('Error en la configuración', {
        description: 'Por favor, inténtalo de nuevo',
      });
    } finally {
      setLoading(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Business
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold">¡Bienvenido a Josephine!</h2>
              <p className="text-muted-foreground mt-2">
                Vamos a configurar tu negocio en pocos minutos
              </p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="business-name">Nombre de tu empresa o grupo</Label>
                <Input
                  id="business-name"
                  placeholder="Ej: Restaurantes García S.L."
                  value={businessInfo.name}
                  onChange={(e) => setBusinessInfo({ name: e.target.value })}
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Este nombre agrupa todos tus establecimientos
                </p>
              </div>
            </div>
          </div>
        );

      case 1: // Location
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold">Tu primer local</h2>
              <p className="text-muted-foreground mt-2">
                Configura los datos básicos de tu establecimiento
              </p>
            </div>
            <div className="grid gap-4 max-w-lg mx-auto">
              <div className="space-y-2">
                <Label htmlFor="location-name">Nombre del local</Label>
                <Input
                  id="location-name"
                  placeholder="Ej: La Taberna Centro"
                  value={locationInfo.name}
                  onChange={(e) => setLocationInfo({ ...locationInfo, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-city">Ciudad</Label>
                <Input
                  id="location-city"
                  placeholder="Ej: Madrid"
                  value={locationInfo.city}
                  onChange={(e) => setLocationInfo({ ...locationInfo, city: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Zona horaria</Label>
                  <Select
                    value={locationInfo.timezone}
                    onValueChange={(v) => setLocationInfo({ ...locationInfo, timezone: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select
                    value={locationInfo.currency}
                    onValueChange={(v) => setLocationInfo({ ...locationInfo, currency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        );

      case 2: // Menu
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Tu carta</h2>
              <p className="text-muted-foreground mt-2">
                Elige una plantilla o empieza desde cero
              </p>
            </div>
            
            {/* Template selection */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              {RESTAURANT_TEMPLATES.map(template => (
                <Card
                  key={template.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary",
                    selectedTemplate?.id === template.id && "border-primary ring-2 ring-primary/20"
                  )}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl mb-2">{template.icon}</div>
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-muted-foreground">{template.description}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Product list */}
            {selectedTemplate && selectedTemplate.products.length > 0 && (
              <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-medium">Productos incluidos</span>
                  <span className="text-sm text-muted-foreground">
                    {selectedProducts.size} de {selectedTemplate.products.length} seleccionados
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {selectedTemplate.products.map((product, index) => (
                    <label
                      key={index}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors",
                        selectedProducts.has(index) ? "bg-primary/10 border-primary" : "hover:bg-muted"
                      )}
                    >
                      <Checkbox
                        checked={selectedProducts.has(index)}
                        onCheckedChange={() => toggleProduct(index)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {product.category} · €{product.price.toFixed(2)}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {selectedTemplate?.id === 'custom' && (
              <div className="text-center text-muted-foreground py-8">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Podrás añadir productos después desde el módulo de Menú</p>
              </div>
            )}
          </div>
        );

      case 3: // Team
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Tu equipo</h2>
              <p className="text-muted-foreground mt-2">
                Añade a tus empleados (puedes hacerlo después)
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-3">
              {employees.map((employee, index) => (
                <div key={index} className="flex gap-3 items-start p-3 border rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <Input
                      placeholder="Nombre"
                      value={employee.name}
                      onChange={(e) => updateEmployee(index, 'name', e.target.value)}
                    />
                    <Select
                      value={employee.role}
                      onValueChange={(v) => updateEmployee(index, 'role', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map(role => (
                          <SelectItem key={role.name} value={role.name}>
                            {role.name} ({role.department})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={employee.hourlyCost}
                        onChange={(e) => updateEmployee(index, 'hourlyCost', parseFloat(e.target.value) || 0)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">€/h</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeEmployee(index)}>
                    ✕
                  </Button>
                </div>
              ))}

              <Button variant="outline" onClick={addEmployee} className="w-full">
                + Añadir empleado
              </Button>

              {employees.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Puedes añadir empleados ahora o hacerlo después desde Configuración
                </p>
              )}
            </div>
          </div>
        );

      case 4: // Floor
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Tu sala</h2>
              <p className="text-muted-foreground mt-2">
                Configura las mesas de tu local
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Table list */}
              <div className="space-y-3">
                {tables.map((table, index) => (
                  <div key={table.id} className="flex gap-3 items-center p-3 border rounded-lg">
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nº Mesa</Label>
                        <Input
                          value={table.table_number}
                          onChange={(e) => updateTable(index, 'table_number', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Plazas</Label>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={table.seats}
                          onChange={(e) => updateTable(index, 'seats', parseInt(e.target.value) || 2)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Forma</Label>
                        <Select
                          value={table.shape}
                          onValueChange={(v) => updateTable(index, 'shape', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TABLE_SHAPES.map(shape => (
                              <SelectItem key={shape.value} value={shape.value}>
                                {shape.icon} {shape.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeTable(index)}>
                      ✕
                    </Button>
                  </div>
                ))}

                <Button variant="outline" onClick={addTable} className="w-full">
                  + Añadir mesa
                </Button>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Previsualización</Label>
                <FloorPlanPreview
                  tables={getTablesPreview()}
                  className="min-h-[300px]"
                />
              </div>
            </div>
          </div>
        );

      case 5: // Inventory
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Inventario</h2>
              <p className="text-muted-foreground mt-2">
                Configura tus ingredientes base (opcional)
              </p>
            </div>

            <div className="max-w-lg mx-auto">
              <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                <Checkbox
                  checked={includeInventory}
                  onCheckedChange={(c) => setIncludeInventory(c === true)}
                />
                <div>
                  <div className="font-medium">Incluir inventario inicial</div>
                  <div className="text-sm text-muted-foreground">
                    Añade ingredientes comunes según tu tipo de negocio
                  </div>
                </div>
              </label>
            </div>

            {includeInventory && selectedTemplate && selectedTemplate.inventory.length > 0 && (
              <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-medium">Ingredientes sugeridos</span>
                  <span className="text-sm text-muted-foreground">
                    {selectedInventory.size} seleccionados
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {selectedTemplate.inventory.map((item, index) => (
                    <label
                      key={index}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors",
                        selectedInventory.has(index) ? "bg-primary/10 border-primary" : "hover:bg-muted"
                      )}
                    >
                      <Checkbox
                        checked={selectedInventory.has(index)}
                        onCheckedChange={() => toggleInventory(index)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.category} · {item.unit}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {includeInventory && (!selectedTemplate || selectedTemplate.inventory.length === 0) && (
              <div className="text-center text-muted-foreground py-8">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No hay inventario predefinido para esta plantilla</p>
                <p className="text-sm">Podrás añadir ingredientes después desde el módulo de Inventario</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with progress */}
      <div className="border-b bg-card">
        <div className="container max-w-5xl mx-auto py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              <span className="font-display font-bold text-xl">Josephine</span>
            </div>
            <span className="text-sm text-muted-foreground">
              Paso {currentStep + 1} de {STEPS.length}
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex gap-2">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStep;
              const isComplete = index < currentStep;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex-1 flex items-center gap-2 p-2 rounded-lg transition-colors",
                    isActive && "bg-primary/10",
                    isComplete && "bg-muted"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    isActive && "bg-primary text-primary-foreground",
                    isComplete && "bg-primary/20 text-primary",
                    !isActive && !isComplete && "bg-muted text-muted-foreground"
                  )}>
                    {isComplete ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                  </div>
                  <div className="hidden md:block min-w-0">
                    <div className={cn(
                      "text-sm font-medium truncate",
                      !isActive && !isComplete && "text-muted-foreground"
                    )}>
                      {step.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 container max-w-5xl mx-auto py-8 px-4">
        {renderStepContent()}
      </div>

      {/* Footer */}
      <div className="border-t bg-card">
        <div className="container max-w-5xl mx-auto py-4 flex justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 0 || loading}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canProceed() || loading}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {currentStep === STEPS.length - 1 ? (
              <>
                Finalizar
                <Check className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                Siguiente
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
