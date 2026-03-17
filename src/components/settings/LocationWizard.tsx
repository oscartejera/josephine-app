import { useState, useCallback, useMemo } from 'react';
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
  Package, Users, LayoutGrid, Sparkles, Plus, X, Utensils, Truck, GripVertical, Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  SUPPLIER_TEMPLATES, 
  SUPPLIER_CATEGORY_LABELS, 
  SUGGESTED_SUPPLIERS_BY_RESTAURANT_TYPE,
  type SupplierTemplate,
  type SupplierCategory 
} from '@/lib/supplierTemplates';

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
  id: string;
  number: string;
  seats: number;
  shape: 'square' | 'round' | 'rectangle';
  position_x: number;
  position_y: number;
}

interface SupplierEntry {
  name: string;
  email: string;
  phone: string;
  category: string;
  website?: string;
  isTemplate?: boolean;
}

type SupplierMode = 'suggested' | 'custom' | 'skip';

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

const SUPPLIER_CATEGORIES = [
  'Frutas y Verduras',
  'Carnes',
  'Pescados y Mariscos',
  'Lácteos',
  'Bebidas',
  'Panadería',
  'Congelados',
  'Limpieza',
  'General',
];

const STEPS = [
  { id: 'info', label: 'Información', icon: Building2 },
  { id: 'products', label: 'Productos', icon: Package },
  { id: 'employees', label: 'Empleados', icon: Users },
  { id: 'tables', label: 'Mesas', icon: LayoutGrid },
  { id: 'suppliers', label: 'Proveedores', icon: Truck },
];

// Canvas constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 350;
const TABLE_BASE_SIZE = 50;

// Shape colors
const SHAPE_COLORS: Record<string, string> = {
  square: 'bg-blue-500/80 border-blue-600',
  round: 'bg-emerald-500/80 border-emerald-600',
  rectangle: 'bg-violet-500/80 border-violet-600',
};

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
  
  // Step 4: Tables with positions
  const [tables, setTables] = useState<TableEntry[]>([
    { id: crypto.randomUUID(), number: '1', seats: 4, shape: 'square', position_x: 50, position_y: 50 },
    { id: crypto.randomUUID(), number: '2', seats: 4, shape: 'square', position_x: 180, position_y: 50 },
    { id: crypto.randomUUID(), number: '3', seats: 2, shape: 'round', position_x: 310, position_y: 50 },
    { id: crypto.randomUUID(), number: '4', seats: 6, shape: 'rectangle', position_x: 440, position_y: 50 },
  ]);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableSeats, setNewTableSeats] = useState(4);
  const [newTableShape, setNewTableShape] = useState<'square' | 'round' | 'rectangle'>('square');
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Step 5: Suppliers
  const [suppliers, setSuppliers] = useState<SupplierEntry[]>([]);
  const [supplierMode, setSupplierMode] = useState<SupplierMode>('suggested');
  const [selectedTemplateSuppliers, setSelectedTemplateSuppliers] = useState<Set<string>>(new Set());

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  // Suggested suppliers based on restaurant type (could be derived from products or explicit selection)
  const suggestedSupplierNames = useMemo(() => {
    // For now, suggest a mix of common suppliers
    return new Set(SUGGESTED_SUPPLIERS_BY_RESTAURANT_TYPE.spanish);
  }, []);

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

  // Table management with positions
  const addTable = () => {
    if (!newTableNumber.trim()) return;
    // Find a good position for the new table
    const existingPositions = tables.map(t => ({ x: t.position_x, y: t.position_y }));
    let newX = 50;
    let newY = 50;
    // Simple grid placement
    const cols = Math.floor(CANVAS_WIDTH / 130);
    const idx = tables.length;
    newX = 50 + (idx % cols) * 130;
    newY = 50 + Math.floor(idx / cols) * 100;
    
    setTables(prev => [...prev, { 
      id: crypto.randomUUID(),
      number: newTableNumber.trim(), 
      seats: newTableSeats, 
      shape: newTableShape,
      position_x: Math.min(newX, CANVAS_WIDTH - 80),
      position_y: Math.min(newY, CANVAS_HEIGHT - 60),
    }]);
    setNewTableNumber('');
  };

  const removeTable = (id: string) => {
    setTables(prev => prev.filter(t => t.id !== id));
  };

  // Drag & drop handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    e.preventDefault();
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    
    const canvas = e.currentTarget.closest('.floor-canvas');
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left - table.position_x,
      y: e.clientY - rect.top - table.position_y,
    });
    setDraggingTableId(tableId);
  }, [tables]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingTableId) return;
    
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const table = tables.find(t => t.id === draggingTableId);
    if (!table) return;
    
    const tableWidth = table.shape === 'rectangle' ? 90 : TABLE_BASE_SIZE;
    const tableHeight = TABLE_BASE_SIZE;
    
    let newX = e.clientX - rect.left - dragOffset.x;
    let newY = e.clientY - rect.top - dragOffset.y;
    
    // Constrain to canvas bounds
    newX = Math.max(0, Math.min(newX, CANVAS_WIDTH - tableWidth));
    newY = Math.max(0, Math.min(newY, CANVAS_HEIGHT - tableHeight));
    
    setTables(prev => prev.map(t => 
      t.id === draggingTableId ? { ...t, position_x: newX, position_y: newY } : t
    ));
  }, [draggingTableId, dragOffset, tables]);

  const handleMouseUp = useCallback(() => {
    setDraggingTableId(null);
  }, []);

  // Supplier management
  const addSupplier = () => {
    setSuppliers(prev => [...prev, { name: '', email: '', phone: '', category: 'General', website: '' }]);
  };

  const removeSupplier = (index: number) => {
    setSuppliers(prev => prev.filter((_, i) => i !== index));
  };

  const updateSupplier = (index: number, field: keyof SupplierEntry, value: string) => {
    setSuppliers(prev => prev.map((s, i) => 
      i === index ? { ...s, [field]: value } : s
    ));
  };

  const toggleTemplateSupplier = (supplierName: string) => {
    setSelectedTemplateSuppliers(prev => {
      const next = new Set(prev);
      if (next.has(supplierName)) {
        next.delete(supplierName);
      } else {
        next.add(supplierName);
      }
      return next;
    });
  };

  const addTemplateToCustom = (template: SupplierTemplate) => {
    // Check if already added
    if (suppliers.some(s => s.name === template.name)) {
      toast.info(`${template.name} ya está en tu lista`);
      return;
    }
    setSuppliers(prev => [...prev, {
      name: template.name,
      email: template.email || '',
      phone: template.phone || '',
      category: template.category,
      website: template.website || '',
      isTemplate: true,
    }]);
    toast.success(`${template.name} añadido`);
  };

  const getSelectedTemplateSuppliers = (): SupplierEntry[] => {
    const allTemplates = Object.values(SUPPLIER_TEMPLATES).flat();
    return Array.from(selectedTemplateSuppliers).map(name => {
      const template = allTemplates.find(t => t.name === name);
      if (!template) return null;
      return {
        name: template.name,
        email: template.email || '',
        phone: template.phone || '',
        category: template.category,
        website: template.website || '',
        isTemplate: true,
      };
    }).filter(Boolean) as SupplierEntry[];
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
      case 4:
        return true; // Suppliers optional
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

      if (userProfile?.group_id !== groupId) {
        toast.error('Error de permisos. Recarga la página e intenta de nuevo.');
        setLoading(false);
        return;
      }

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

      // 5. Create floor map and tables with positions
      const { data: floorMap } = await supabase
        .from('pos_floor_maps')
        .insert({
          location_id: newLocation.id,
          name: 'Sala Principal',
          config_json: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: null },
          is_active: true,
        })
        .select()
        .single();

      if (floorMap && tables.length > 0) {
        const tableInserts = tables.map(t => ({
          floor_map_id: floorMap.id,
          table_number: t.number,
          seats: t.seats,
          position_x: t.position_x,
          position_y: t.position_y,
          shape: t.shape,
          width: t.shape === 'rectangle' ? 90 : TABLE_BASE_SIZE,
          height: TABLE_BASE_SIZE,
          status: 'available',
        }));
        await supabase.from('pos_tables').insert(tableInserts);
      }

      // 6. Create suppliers based on mode
      let finalSuppliers: SupplierEntry[] = [];
      
      if (supplierMode === 'suggested') {
        finalSuppliers = getSelectedTemplateSuppliers();
      } else if (supplierMode === 'custom') {
        finalSuppliers = [...suppliers, ...getSelectedTemplateSuppliers()];
      }
      // If skip, finalSuppliers stays empty
      
      const validSuppliers = finalSuppliers.filter(s => s.name.trim());
      if (validSuppliers.length > 0) {
        const supplierInserts = validSuppliers.map(s => ({
          name: s.name.trim(),
          email: s.email?.trim() || null,
          phone: s.phone?.trim() || null,
          category: s.category,
          website: s.website?.trim() || null,
          group_id: groupId,
          integration_type: 'manual' as const,
          coverage: 'national' as const,
          is_template: s.isTemplate || false,
        }));
        await supabase.from('suppliers').insert(supplierInserts);
      }

      toast.success(`¡Local "${basicInfo.name}" creado con ${selectedProducts.length} productos, ${tables.length} mesas y ${validSuppliers.length} proveedores!`);
      onOpenChange(false);
      onSuccess();
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

  const resetWizard = () => {
    setCurrentStep(0);
    setBasicInfo({ name: '', city: '', timezone: 'Europe/Madrid', currency: 'EUR' });
    setProducts(PRODUCT_TEMPLATES);
    setEmployees([{ name: '', role: 'Camarero/a' }]);
    setTables([
      { id: crypto.randomUUID(), number: '1', seats: 4, shape: 'square', position_x: 50, position_y: 50 },
      { id: crypto.randomUUID(), number: '2', seats: 4, shape: 'square', position_x: 180, position_y: 50 },
      { id: crypto.randomUUID(), number: '3', seats: 2, shape: 'round', position_x: 310, position_y: 50 },
      { id: crypto.randomUUID(), number: '4', seats: 6, shape: 'rectangle', position_x: 440, position_y: 50 },
    ]);
    setSuppliers([]);
    setSupplierMode('suggested');
    setSelectedTemplateSuppliers(new Set());
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
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

          {/* Step 4: Tables with Visual Floor Plan */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configura las mesas de tu local. Arrastra para posicionarlas en el plano.
              </p>

              {/* Floor Plan Canvas */}
              <div 
                className="floor-canvas relative border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 overflow-hidden select-none"
                style={{ width: '100%', height: CANVAS_HEIGHT }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Grid overlay */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                  <defs>
                    <pattern id="wizard-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#wizard-grid)" />
                </svg>

                {/* Tables */}
                {tables.map((table) => {
                  const width = table.shape === 'rectangle' ? 90 : TABLE_BASE_SIZE;
                  const isDragging = draggingTableId === table.id;
                  
                  return (
                    <div
                      key={table.id}
                      className={cn(
                        "absolute flex flex-col items-center justify-center transition-shadow",
                        "border-2 text-white font-medium text-xs shadow-md cursor-grab",
                        SHAPE_COLORS[table.shape],
                        table.shape === 'round' && 'rounded-full',
                        table.shape === 'square' && 'rounded-md',
                        table.shape === 'rectangle' && 'rounded-md',
                        isDragging && 'cursor-grabbing shadow-lg ring-2 ring-primary z-10'
                      )}
                      style={{
                        left: table.position_x,
                        top: table.position_y,
                        width: width,
                        height: TABLE_BASE_SIZE,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, table.id)}
                    >
                      <div className="flex items-center gap-1">
                        <GripVertical className="w-3 h-3 opacity-60" />
                        <span className="font-bold">M{table.number}</span>
                      </div>
                      <span className="text-[10px] opacity-80">{table.seats} pl</span>
                      {/* Delete button */}
                      <button
                        className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTable(table.id);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}

                {/* Empty state */}
                {tables.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    Añade mesas para verlas en el plano
                  </div>
                )}

                {/* Legend */}
                <div className="absolute bottom-2 right-2 flex gap-2 text-[10px] bg-background/80 backdrop-blur-sm rounded px-2 py-1">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-blue-500" />
                    <span>Cuadrada</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span>Redonda</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-violet-500" />
                    <span>Rectangular</span>
                  </div>
                </div>
              </div>

              {/* Add table form */}
              <div className="border-t pt-4">
                <Label className="text-sm">Añadir mesa</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
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
                  <Select 
                    value={newTableShape} 
                    onValueChange={(v) => setNewTableShape(v as 'square' | 'round' | 'rectangle')}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="square">⬜ Cuadrada</SelectItem>
                      <SelectItem value="round">⚪ Redonda</SelectItem>
                      <SelectItem value="rectangle">▭ Rectangular</SelectItem>
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

          {/* Step 5: Suppliers */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                ¿Cómo quieres configurar tus proveedores? Podrás modificarlos después desde Procurement.
              </p>

              {/* Mode selection */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={supplierMode === 'suggested' ? 'default' : 'outline'}
                  className="h-auto py-3 flex-col gap-1"
                  onClick={() => setSupplierMode('suggested')}
                >
                  <Truck className="h-5 w-5" />
                  <span className="text-xs">Sugeridos</span>
                </Button>
                <Button
                  variant={supplierMode === 'custom' ? 'default' : 'outline'}
                  className="h-auto py-3 flex-col gap-1"
                  onClick={() => setSupplierMode('custom')}
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-xs">Mis Proveedores</span>
                </Button>
                <Button
                  variant={supplierMode === 'skip' ? 'default' : 'outline'}
                  className="h-auto py-3 flex-col gap-1"
                  onClick={() => setSupplierMode('skip')}
                >
                  <ChevronRight className="h-5 w-5" />
                  <span className="text-xs">Después</span>
                </Button>
              </div>

              {/* Suggested suppliers */}
              {supplierMode === 'suggested' && (
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    Proveedores con cobertura nacional
                  </p>
                  
                  {(Object.keys(SUPPLIER_TEMPLATES) as SupplierCategory[]).map(category => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{SUPPLIER_CATEGORY_LABELS[category].icon}</span>
                        <span className="text-sm font-medium">{SUPPLIER_CATEGORY_LABELS[category].label}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {SUPPLIER_TEMPLATES[category].filter(s => s.coverage === 'national').map(supplier => {
                          const isSelected = selectedTemplateSuppliers.has(supplier.name);
                          const isSuggested = suggestedSupplierNames.has(supplier.name);
                          return (
                            <button
                              key={supplier.name}
                              onClick={() => toggleTemplateSupplier(supplier.name)}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-sm transition-all flex items-center gap-1.5",
                                "border hover:shadow-sm",
                                isSelected 
                                  ? "bg-primary text-primary-foreground border-primary" 
                                  : "bg-card border-border hover:border-primary/50",
                                isSuggested && !isSelected && "ring-1 ring-primary/30"
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                              {supplier.name}
                              {supplier.integrationAvailable && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-success/10 text-success border-success/30">
                                  API
                                </Badge>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 border-t text-sm text-muted-foreground">
                    {selectedTemplateSuppliers.size} proveedores seleccionados
                  </div>
                </div>
              )}

              {/* Custom suppliers */}
              {supplierMode === 'custom' && (
                <div className="space-y-3">
                  {/* Quick add from templates */}
                  <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                    <Label className="text-xs text-muted-foreground">Añadir rápido de sugeridos:</Label>
                    <div className="flex flex-wrap gap-1">
                      {Object.values(SUPPLIER_TEMPLATES).flat().slice(0, 8).map(supplier => (
                        <Button
                          key={supplier.name}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => addTemplateToCustom(supplier)}
                          disabled={suppliers.some(s => s.name === supplier.name)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {supplier.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {suppliers.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Añade tus proveedores actuales</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {suppliers.map((supplier, index) => (
                        <div key={index} className="border rounded-lg p-3 space-y-2">
                          <div className="flex gap-2 items-start">
                            <div className="flex-1 grid grid-cols-2 gap-2">
                              <Input
                                placeholder="Nombre *"
                                value={supplier.name}
                                onChange={(e) => updateSupplier(index, 'name', e.target.value)}
                                className="h-9"
                                disabled={supplier.isTemplate}
                              />
                              <Select 
                                value={supplier.category} 
                                onValueChange={(v) => updateSupplier(index, 'category', v)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SUPPLIER_CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                placeholder="Email"
                                type="email"
                                value={supplier.email}
                                onChange={(e) => updateSupplier(index, 'email', e.target.value)}
                                className="h-9"
                              />
                              <Input
                                placeholder="Teléfono"
                                value={supplier.phone}
                                onChange={(e) => updateSupplier(index, 'phone', e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => removeSupplier(index)}
                              className="text-muted-foreground hover:text-destructive shrink-0 h-9 w-9"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          {supplier.isTemplate && (
                            <Badge variant="secondary" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Proveedor verificado
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Button variant="outline" size="sm" onClick={addSupplier}>
                    <Plus className="h-4 w-4 mr-1" />
                    Añadir proveedor manual
                  </Button>

                  <div className="text-sm text-muted-foreground">
                    {suppliers.filter(s => s.name.trim()).length} proveedores configurados
                  </div>
                </div>
              )}

              {/* Skip mode */}
              {supplierMode === 'skip' && (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Configurar después</p>
                  <p className="text-sm mt-1">
                    Podrás añadir proveedores desde el módulo de Procurement
                  </p>
                </div>
              )}
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
