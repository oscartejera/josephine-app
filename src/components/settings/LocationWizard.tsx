import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Building2, ChevronRight, ChevronLeft, Check, Loader2, 
  Package, Users, LayoutGrid, Sparkles, Plus, X, Utensils
} from 'lucide-react';
import { toast } from 'sonner';

interface LocationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onSuccess: () => void;
}

interface BasicInfo {
  name: string;
  city: string;
  timezone: string;
  currency: string;
}

interface ProductTemplate {
  name: string;
  category: string;
  selected: boolean;
}

interface EmployeeEntry {
  name: string;
  role: string;
}

interface TableEntry {
  number: string;
  seats: number;
  shape: 'square' | 'round' | 'rectangle';
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
  { value: 'EUR', label: '€ Euro' },
  { value: 'USD', label: '$ Dólar' },
  { value: 'GBP', label: '£ Libra' },
  { value: 'MXN', label: '$ Peso MX' },
];

const PRODUCT_TEMPLATES: ProductTemplate[] = [
  // Bebidas
  { name: 'Agua mineral', category: 'Bebidas', selected: true },
  { name: 'Coca-Cola', category: 'Bebidas', selected: true },
  { name: 'Cerveza', category: 'Bebidas', selected: true },
  { name: 'Vino Tinto', category: 'Bebidas', selected: true },
  { name: 'Vino Blanco', category: 'Bebidas', selected: true },
  { name: 'Café Solo', category: 'Bebidas', selected: true },
  { name: 'Café con Leche', category: 'Bebidas', selected: true },
  // Entrantes
  { name: 'Patatas Bravas', category: 'Entrantes', selected: true },
  { name: 'Croquetas', category: 'Entrantes', selected: true },
  { name: 'Ensalada Mixta', category: 'Entrantes', selected: true },
  { name: 'Pan con Tomate', category: 'Entrantes', selected: false },
  // Principales
  { name: 'Paella', category: 'Principales', selected: true },
  { name: 'Entrecot', category: 'Principales', selected: true },
  { name: 'Hamburguesa', category: 'Principales', selected: true },
  { name: 'Pizza Margherita', category: 'Principales', selected: false },
  { name: 'Pasta Carbonara', category: 'Principales', selected: false },
  // Postres
  { name: 'Tarta de Queso', category: 'Postres', selected: true },
  { name: 'Flan Casero', category: 'Postres', selected: true },
  { name: 'Helado', category: 'Postres', selected: false },
];

const ROLE_OPTIONS = [
  'Camarero/a',
  'Cocinero/a',
  'Personal de barra',
  'Gerente',
  'Lavaplatos',
  'Personal de preparación',
];

const STEPS = [
  { id: 'info', label: 'Información', icon: Building2 },
  { id: 'products', label: 'Productos', icon: Package },
  { id: 'employees', label: 'Empleados', icon: Users },
  { id: 'tables', label: 'Mesas', icon: LayoutGrid },
];

export function LocationWizard({ open, onOpenChange, groupId, onSuccess }: LocationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Basic Info
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    name: '',
    city: '',
    timezone: 'Europe/Madrid',
    currency: 'EUR',
  });
  
  // Step 2: Products
  const [products, setProducts] = useState<ProductTemplate[]>(PRODUCT_TEMPLATES);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Principales');
  
  // Step 3: Employees
  const [employees, setEmployees] = useState<EmployeeEntry[]>([
    { name: '', role: 'Camarero/a' },
  ]);
  
  // Step 4: Tables
  const [tables, setTables] = useState<TableEntry[]>([
    { number: '1', seats: 4, shape: 'square' },
    { number: '2', seats: 4, shape: 'square' },
    { number: '3', seats: 2, shape: 'round' },
    { number: '4', seats: 6, shape: 'rectangle' },
  ]);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableSeats, setNewTableSeats] = useState(4);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const toggleProduct = (index: number) => {
    setProducts(prev => prev.map((p, i) => 
      i === index ? { ...p, selected: !p.selected } : p
    ));
  };

  const addCustomProduct = () => {
    if (!newProductName.trim()) return;
    setProducts(prev => [...prev, { 
      name: newProductName.trim(), 
      category: newProductCategory, 
      selected: true 
    }]);
    setNewProductName('');
  };

  const addEmployee = () => {
    setEmployees(prev => [...prev, { name: '', role: 'Camarero/a' }]);
  };

  const removeEmployee = (index: number) => {
    if (employees.length <= 1) return;
    setEmployees(prev => prev.filter((_, i) => i !== index));
  };

  const updateEmployee = (index: number, field: 'name' | 'role', value: string) => {
    setEmployees(prev => prev.map((e, i) => 
      i === index ? { ...e, [field]: value } : e
    ));
  };

  const addTable = () => {
    if (!newTableNumber.trim()) return;
    setTables(prev => [...prev, { 
      number: newTableNumber.trim(), 
      seats: newTableSeats, 
      shape: 'square' 
    }]);
    setNewTableNumber('');
  };

  const removeTable = (index: number) => {
    setTables(prev => prev.filter((_, i) => i !== index));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return basicInfo.name.trim().length > 0;
      case 1:
        return products.some(p => p.selected);
      case 2:
        return true; // Employees optional
      case 3:
        return tables.length > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleCreate();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      // 1. Create location
      const { data: newLocation, error: locationError } = await supabase
        .from('locations')
        .insert({
          group_id: groupId,
          name: basicInfo.name.trim(),
          city: basicInfo.city.trim() || null,
          timezone: basicInfo.timezone,
          currency: basicInfo.currency,
          active: true,
        })
        .select()
        .single();

      if (locationError) throw locationError;

      // 2. Create settings
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

      // 3. Create products
      const selectedProducts = products.filter(p => p.selected);
      if (selectedProducts.length > 0) {
        const productInserts = selectedProducts.map(p => ({
          name: p.name,
          category: p.category,
          location_id: newLocation.id,
          group_id: groupId,
          is_active: true,
          kds_destination: p.category === 'Bebidas' ? 'bar' : 'kitchen',
        }));
        await supabase.from('products').insert(productInserts);
      }

      // 4. Create employees (filter empty names)
      const validEmployees = employees.filter(e => e.name.trim());
      if (validEmployees.length > 0) {
        const employeeInserts = validEmployees.map(e => ({
          full_name: e.name.trim(),
          role_name: e.role,
          location_id: newLocation.id,
          active: true,
        }));
        await supabase.from('employees').insert(employeeInserts);
      }

      // 5. Create floor map and tables
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

      if (floorMap && tables.length > 0) {
        const tableInserts = tables.map((t, i) => ({
          floor_map_id: floorMap.id,
          table_number: t.number,
          seats: t.seats,
          position_x: 100 + (i % 4) * 150,
          position_y: 100 + Math.floor(i / 4) * 120,
          shape: t.shape,
          width: t.shape === 'rectangle' ? 120 : t.shape === 'round' ? 70 : 80,
          height: t.shape === 'round' ? 70 : 80,
          status: 'available',
        }));
        await supabase.from('pos_tables').insert(tableInserts);
      }

      toast.success(`¡Local "${basicInfo.name}" creado con ${selectedProducts.length} productos y ${tables.length} mesas!`);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating location:', error);
      toast.error(error.message || 'Error al crear el local');
    } finally {
      setLoading(false);
    }
  };

  const resetWizard = () => {
    setCurrentStep(0);
    setBasicInfo({ name: '', city: '', timezone: 'Europe/Madrid', currency: 'EUR' });
    setProducts(PRODUCT_TEMPLATES);
    setEmployees([{ name: '', role: 'Camarero/a' }]);
    setTables([
      { number: '1', seats: 4, shape: 'square' },
      { number: '2', seats: 4, shape: 'square' },
      { number: '3', seats: 2, shape: 'round' },
      { number: '4', seats: 6, shape: 'rectangle' },
    ]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetWizard();
    }
    onOpenChange(newOpen);
  };

  const categories = [...new Set(products.map(p => p.category))];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Nuevo Local - Configuración Guiada
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-3">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              return (
                <div 
                  key={step.id} 
                  className={`flex items-center gap-1.5 text-xs ${
                    isActive ? 'text-primary font-medium' : 
                    isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/50'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-primary text-primary-foreground' :
                    isCompleted ? 'bg-primary/20 text-primary' : 'bg-muted'
                  }`}>
                    {isCompleted ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  </div>
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 min-h-[300px]">
          {/* Step 1: Basic Info */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wiz-name">Nombre del Local *</Label>
                <Input
                  id="wiz-name"
                  placeholder="Ej: Restaurante Centro"
                  value={basicInfo.name}
                  onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wiz-city">Ciudad</Label>
                <Input
                  id="wiz-city"
                  placeholder="Ej: Madrid"
                  value={basicInfo.city}
                  onChange={(e) => setBasicInfo({ ...basicInfo, city: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Zona Horaria</Label>
                  <Select 
                    value={basicInfo.timezone} 
                    onValueChange={(v) => setBasicInfo({ ...basicInfo, timezone: v })}
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
                    value={basicInfo.currency} 
                    onValueChange={(v) => setBasicInfo({ ...basicInfo, currency: v })}
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
          )}

          {/* Step 2: Products */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecciona los productos iniciales o añade los tuyos. Podrás modificarlos después.
              </p>
              
              {categories.map(category => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{category}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6"
                      onClick={() => {
                        const allSelected = products.filter(p => p.category === category).every(p => p.selected);
                        setProducts(prev => prev.map(p => 
                          p.category === category ? { ...p, selected: !allSelected } : p
                        ));
                      }}
                    >
                      {products.filter(p => p.category === category).every(p => p.selected) ? 'Deseleccionar' : 'Seleccionar'} todo
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {products.filter(p => p.category === category).map((product, idx) => {
                      const globalIdx = products.findIndex(p => p === product);
                      return (
                        <Badge
                          key={`${product.name}-${idx}`}
                          variant={product.selected ? 'default' : 'outline'}
                          className="cursor-pointer transition-all"
                          onClick={() => toggleProduct(globalIdx)}
                        >
                          {product.selected && <Check className="h-3 w-3 mr-1" />}
                          {product.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="border-t pt-4">
                <Label className="text-sm">Añadir producto personalizado</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Nombre del producto"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && addCustomProduct()}
                  />
                  <Select value={newProductCategory} onValueChange={setNewProductCategory}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="icon" onClick={addCustomProduct} disabled={!newProductName.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                {products.filter(p => p.selected).length} productos seleccionados
              </div>
            </div>
          )}

          {/* Step 3: Employees */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Añade tu equipo inicial (opcional). Podrás añadir más empleados después.
              </p>

              <div className="space-y-3">
                {employees.map((employee, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="Nombre completo"
                      value={employee.name}
                      onChange={(e) => updateEmployee(index, 'name', e.target.value)}
                      className="flex-1"
                    />
                    <Select 
                      value={employee.role} 
                      onValueChange={(v) => updateEmployee(index, 'role', v)}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(role => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => removeEmployee(index)}
                      disabled={employees.length <= 1}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={addEmployee}>
                <Plus className="h-4 w-4 mr-1" />
                Añadir empleado
              </Button>

              <div className="text-sm text-muted-foreground">
                {employees.filter(e => e.name.trim()).length} empleados configurados
              </div>
            </div>
          )}

          {/* Step 4: Tables */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configura las mesas de tu local. Podrás ajustar posiciones en el editor de plano.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {tables.map((table, index) => (
                  <div 
                    key={index}
                    className="border rounded-lg p-3 relative group"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeTable(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <div className="flex items-center gap-2 mb-2">
                      <Utensils className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Mesa {table.number}</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{table.seats} plazas</Badge>
                      <Badge variant="secondary" className="capitalize">{table.shape}</Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm">Añadir mesa</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Número"
                    value={newTableNumber}
                    onChange={(e) => setNewTableNumber(e.target.value)}
                    className="w-24"
                    onKeyDown={(e) => e.key === 'Enter' && addTable()}
                  />
                  <Select 
                    value={newTableSeats.toString()} 
                    onValueChange={(v) => setNewTableSeats(parseInt(v))}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 4, 6, 8, 10, 12].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n} plazas</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addTable} disabled={!newTableNumber.trim()}>
                    <Plus className="h-4 w-4 mr-1" />
                    Añadir
                  </Button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                {tables.length} mesas configuradas
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0 || loading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Atrás
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button 
              onClick={handleNext} 
              disabled={!canProceed() || loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : currentStep === STEPS.length - 1 ? (
                <Check className="h-4 w-4 mr-1" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-1" />
              )}
              {currentStep === STEPS.length - 1 ? 'Crear Local' : 'Siguiente'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
