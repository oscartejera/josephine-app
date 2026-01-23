/**
 * Plantillas de proveedores nacionales españoles para hostelería
 * Solo incluye proveedores con cobertura nacional confirmada
 */

export interface SupplierTemplate {
  name: string;
  category: string;
  phone?: string;
  email?: string;
  website?: string;
  coverage: 'national' | 'regional';
  regions?: string[];
  integrationAvailable: boolean;
  integrationType?: 'api' | 'edi' | 'email';
}

export type SupplierCategory = 
  | 'multisector'
  | 'bebidas'
  | 'lacteos'
  | 'panaderia'
  | 'congelados'
  | 'cafe'
  | 'carnes'
  | 'frutas';

export const SUPPLIER_CATEGORY_LABELS: Record<SupplierCategory, { label: string; icon: string }> = {
  multisector: { label: 'Cash & Carry', icon: '📦' },
  bebidas: { label: 'Bebidas', icon: '🍺' },
  lacteos: { label: 'Lácteos', icon: '🥛' },
  panaderia: { label: 'Panadería', icon: '🥖' },
  congelados: { label: 'Congelados', icon: '🧊' },
  cafe: { label: 'Café', icon: '☕' },
  carnes: { label: 'Carnes', icon: '🥩' },
  frutas: { label: 'Frutas y Verduras', icon: '🥬' },
};

export const SUPPLIER_TEMPLATES: Record<SupplierCategory, SupplierTemplate[]> = {
  multisector: [
    {
      name: 'Makro',
      category: 'General',
      phone: '900 300 400',
      website: 'makro.es',
      email: 'pedidos@makro.es',
      coverage: 'national',
      integrationAvailable: true,
      integrationType: 'api',
    },
    {
      name: 'Transgourmet',
      category: 'General',
      phone: '902 500 500',
      website: 'transgourmet.es',
      email: 'pedidos@transgourmet.es',
      coverage: 'national',
      integrationAvailable: true,
      integrationType: 'edi',
    },
    {
      name: 'Sysco España',
      category: 'General',
      phone: '900 100 300',
      website: 'sysco.es',
      email: 'pedidos@sysco.es',
      coverage: 'national',
      integrationAvailable: true,
      integrationType: 'api',
    },
    {
      name: 'Gros Mercat',
      category: 'General',
      phone: '902 200 400',
      website: 'grosmercat.es',
      email: 'pedidos@grosmercat.es',
      coverage: 'national',
      integrationAvailable: false,
    },
  ],
  bebidas: [
    {
      name: 'Coca-Cola Europacific',
      category: 'Bebidas',
      phone: '900 100 100',
      website: 'cocacolaep.com',
      email: 'pedidos.espana@ccep.com',
      coverage: 'national',
      integrationAvailable: true,
      integrationType: 'api',
    },
    {
      name: 'Mahou San Miguel',
      category: 'Bebidas',
      phone: '900 220 220',
      website: 'mahou-sanmiguel.com',
      email: 'pedidos@mahou-sanmiguel.com',
      coverage: 'national',
      integrationAvailable: true,
      integrationType: 'api',
    },
    {
      name: 'Heineken España',
      category: 'Bebidas',
      phone: '900 500 500',
      website: 'heinekenespana.es',
      email: 'pedidos@heineken.es',
      coverage: 'national',
      integrationAvailable: true,
      integrationType: 'api',
    },
    {
      name: 'Estrella Galicia',
      category: 'Bebidas',
      phone: '981 901 901',
      website: 'estrellagalicia.es',
      email: 'pedidos@estrellagalicia.es',
      coverage: 'national',
      integrationAvailable: false,
    },
    {
      name: 'Damm',
      category: 'Bebidas',
      phone: '902 300 300',
      website: 'damm.com',
      email: 'pedidos@damm.com',
      coverage: 'national',
      integrationAvailable: true,
      integrationType: 'api',
    },
    {
      name: 'Pernod Ricard España',
      category: 'Bebidas',
      phone: '900 400 400',
      website: 'pernod-ricard.es',
      email: 'pedidos@pernod-ricard.es',
      coverage: 'national',
      integrationAvailable: false,
    },
  ],
  lacteos: [
    {
      name: 'Pascual',
      category: 'Lácteos',
      phone: '900 100 200',
      website: 'pascual.es',
      email: 'pedidos@pascual.es',
      coverage: 'national',
      integrationAvailable: true,
      integrationType: 'api',
    },
    {
      name: 'Danone',
      category: 'Lácteos',
      phone: '900 200 300',
      website: 'danone.es',
      email: 'pedidos@danone.es',
      coverage: 'national',
      integrationAvailable: true,
      integrationType: 'api',
    },
    {
      name: 'Central Lechera Asturiana',
      category: 'Lácteos',
      phone: '900 300 400',
      website: 'centrallecheraasturiana.es',
      email: 'pedidos@clas.es',
      coverage: 'national',
      integrationAvailable: false,
    },
    {
      name: 'Lactalis Iberia',
      category: 'Lácteos',
      phone: '900 150 150',
      website: 'lactalis.es',
      email: 'pedidos@lactalis.es',
      coverage: 'national',
      integrationAvailable: false,
    },
  ],
  panaderia: [
    {
      name: 'Europastry',
      category: 'Panadería',
      phone: '902 200 600',
      website: 'europastry.com',
      email: 'pedidos@europastry.com',
      coverage: 'national',
      integrationAvailable: true,
      integrationType: 'api',
    },
    {
      name: 'Fripan',
      category: 'Panadería',
      phone: '900 400 400',
      website: 'fripan.es',
      email: 'pedidos@fripan.es',
      coverage: 'national',
      integrationAvailable: false,
    },
    {
      name: 'Berlys',
      category: 'Panadería',
      phone: '900 350 350',
      website: 'berlys.es',
      email: 'pedidos@berlys.es',
      coverage: 'national',
      integrationAvailable: false,
    },
  ],
  congelados: [
    {
      name: 'Grupo Frial',
      category: 'Congelados',
      phone: '900 100 400',
      website: 'frial.es',
      email: 'pedidos@frial.es',
      coverage: 'national',
      integrationAvailable: false,
    },
    {
      name: 'Bidfood Iberia',
      category: 'Congelados',
      phone: '900 200 200',
      website: 'bidfood.es',
      email: 'pedidos@bidfood.es',
      coverage: 'national',
      integrationAvailable: true,
      integrationType: 'api',
    },
    {
      name: 'Findus Food Services',
      category: 'Congelados',
      phone: '900 250 250',
      website: 'findusfoodservices.es',
      email: 'pedidos@findus.es',
      coverage: 'national',
      integrationAvailable: false,
    },
  ],
  cafe: [
    {
      name: 'Nestlé Professional',
      category: 'Café',
      phone: '900 600 600',
      website: 'nestle-professional.es',
      email: 'pedidos@nestle.es',
      coverage: 'national',
      integrationAvailable: true,
      integrationType: 'api',
    },
    {
      name: 'Lavazza España',
      category: 'Café',
      phone: '900 700 700',
      website: 'lavazza.es',
      email: 'pedidos@lavazza.es',
      coverage: 'national',
      integrationAvailable: false,
    },
    {
      name: 'Cafés Candelas',
      category: 'Café',
      phone: '988 391 901',
      website: 'cafescandelas.com',
      email: 'pedidos@cafescandelas.com',
      coverage: 'national',
      integrationAvailable: false,
    },
    {
      name: 'Illy España',
      category: 'Café',
      phone: '900 800 800',
      website: 'illy.com',
      email: 'pedidos@illy.es',
      coverage: 'national',
      integrationAvailable: false,
    },
  ],
  carnes: [
    {
      name: 'Grupo Norteños',
      category: 'Carnes',
      phone: '900 150 150',
      website: 'norteños.es',
      email: 'pedidos@norteños.es',
      coverage: 'national',
      integrationAvailable: false,
    },
    {
      name: 'Frigoríficos Costa Brava',
      category: 'Carnes',
      phone: '972 300 400',
      website: 'fribrava.com',
      email: 'pedidos@fribrava.com',
      coverage: 'national',
      integrationAvailable: false,
    },
    {
      name: 'Incarlopsa',
      category: 'Carnes',
      phone: '967 490 000',
      website: 'incarlopsa.es',
      email: 'pedidos@incarlopsa.es',
      coverage: 'national',
      integrationAvailable: false,
    },
  ],
  frutas: [
    {
      name: 'Mercabarna Distribución',
      category: 'Frutas y Verduras',
      phone: '932 636 200',
      website: 'mercabarna.es',
      email: 'pedidos@mercabarna.es',
      coverage: 'regional',
      regions: ['Cataluña', 'Aragón', 'Baleares'],
      integrationAvailable: false,
    },
    {
      name: 'Agrícola Famosa',
      category: 'Frutas y Verduras',
      phone: '965 505 000',
      website: 'famosa.es',
      email: 'pedidos@famosa.es',
      coverage: 'national',
      integrationAvailable: false,
    },
    {
      name: 'Frutas Nieves',
      category: 'Frutas y Verduras',
      phone: '912 345 678',
      website: 'frutasnieves.es',
      email: 'pedidos@frutasnieves.es',
      coverage: 'national',
      integrationAvailable: false,
    },
  ],
};

/**
 * Proveedores sugeridos por tipo de restaurante
 */
export const SUGGESTED_SUPPLIERS_BY_RESTAURANT_TYPE: Record<string, string[]> = {
  spanish: ['Makro', 'Mahou San Miguel', 'Pascual', 'Europastry', 'Agrícola Famosa'],
  cafe: ['Makro', 'Pascual', 'Europastry', 'Danone', 'Nestlé Professional', 'Lavazza España'],
  bar: ['Makro', 'Mahou San Miguel', 'Heineken España', 'Coca-Cola Europacific', 'Damm'],
  fastfood: ['Makro', 'Sysco España', 'Coca-Cola Europacific', 'Grupo Frial', 'Europastry'],
  custom: ['Makro', 'Transgourmet'],
};

/**
 * Obtener solo proveedores con cobertura nacional
 */
export function getNationalSuppliers(): SupplierTemplate[] {
  return Object.values(SUPPLIER_TEMPLATES)
    .flat()
    .filter(s => s.coverage === 'national');
}

/**
 * Obtener todos los proveedores de una categoría
 */
export function getSuppliersByCategory(category: SupplierCategory): SupplierTemplate[] {
  return SUPPLIER_TEMPLATES[category] || [];
}

/**
 * Obtener proveedores sugeridos para un tipo de restaurante
 */
export function getSuggestedSuppliersForType(restaurantType: string): SupplierTemplate[] {
  const suggestedNames = SUGGESTED_SUPPLIERS_BY_RESTAURANT_TYPE[restaurantType] || 
                         SUGGESTED_SUPPLIERS_BY_RESTAURANT_TYPE.custom;
  
  const allSuppliers = Object.values(SUPPLIER_TEMPLATES).flat();
  return allSuppliers.filter(s => suggestedNames.includes(s.name));
}

/**
 * Buscar un proveedor por nombre
 */
export function findSupplierTemplate(name: string): SupplierTemplate | undefined {
  return Object.values(SUPPLIER_TEMPLATES)
    .flat()
    .find(s => s.name.toLowerCase() === name.toLowerCase());
}
