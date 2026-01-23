// Onboarding templates for different restaurant types

export interface ProductTemplate {
  name: string;
  category: string;
  price: number;
  kds_destination: 'kitchen' | 'bar' | 'prep';
}

export interface InventoryTemplate {
  name: string;
  category: string;
  unit: string;
  avg_cost: number;
}

export interface RoleTemplate {
  name: string;
  department: 'FOH' | 'BOH';
  defaultHourlyCost: number;
}

export interface RestaurantTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  products: ProductTemplate[];
  inventory: InventoryTemplate[];
  roles: RoleTemplate[];
}

export const RESTAURANT_TEMPLATES: RestaurantTemplate[] = [
  {
    id: 'spanish',
    name: 'Restaurante Español',
    description: 'Tapas, raciones y menú del día',
    icon: '🥘',
    products: [
      // Entrantes
      { name: 'Tortilla Española', category: 'Entrantes', price: 8.50, kds_destination: 'kitchen' },
      { name: 'Patatas Bravas', category: 'Entrantes', price: 6.00, kds_destination: 'kitchen' },
      { name: 'Croquetas de Jamón', category: 'Entrantes', price: 7.50, kds_destination: 'kitchen' },
      { name: 'Gambas al Ajillo', category: 'Entrantes', price: 12.00, kds_destination: 'kitchen' },
      { name: 'Pan con Tomate', category: 'Entrantes', price: 3.50, kds_destination: 'kitchen' },
      { name: 'Jamón Ibérico', category: 'Entrantes', price: 18.00, kds_destination: 'prep' },
      { name: 'Queso Manchego', category: 'Entrantes', price: 9.00, kds_destination: 'prep' },
      { name: 'Gazpacho', category: 'Entrantes', price: 5.50, kds_destination: 'kitchen' },
      { name: 'Pimientos de Padrón', category: 'Entrantes', price: 7.00, kds_destination: 'kitchen' },
      { name: 'Ensalada Mixta', category: 'Entrantes', price: 6.50, kds_destination: 'prep' },
      // Principales
      { name: 'Paella Valenciana', category: 'Principales', price: 16.50, kds_destination: 'kitchen' },
      { name: 'Pulpo a la Gallega', category: 'Principales', price: 18.00, kds_destination: 'kitchen' },
      { name: 'Merluza a la Vasca', category: 'Principales', price: 15.00, kds_destination: 'kitchen' },
      { name: 'Entrecot a la Brasa', category: 'Principales', price: 22.00, kds_destination: 'kitchen' },
      { name: 'Secreto Ibérico', category: 'Principales', price: 17.50, kds_destination: 'kitchen' },
      { name: 'Cochinillo Asado', category: 'Principales', price: 24.00, kds_destination: 'kitchen' },
      // Postres
      { name: 'Crema Catalana', category: 'Postres', price: 5.50, kds_destination: 'kitchen' },
      { name: 'Flan Casero', category: 'Postres', price: 4.50, kds_destination: 'prep' },
      { name: 'Tarta de Queso', category: 'Postres', price: 6.00, kds_destination: 'prep' },
      { name: 'Arroz con Leche', category: 'Postres', price: 4.00, kds_destination: 'kitchen' },
      // Bebidas
      { name: 'Agua Mineral', category: 'Bebidas', price: 2.50, kds_destination: 'bar' },
      { name: 'Refresco', category: 'Bebidas', price: 2.80, kds_destination: 'bar' },
      { name: 'Cerveza Caña', category: 'Bebidas', price: 2.50, kds_destination: 'bar' },
      { name: 'Vino Tinto (copa)', category: 'Bebidas', price: 3.50, kds_destination: 'bar' },
      { name: 'Vino Blanco (copa)', category: 'Bebidas', price: 3.50, kds_destination: 'bar' },
      { name: 'Sangría (jarra)', category: 'Bebidas', price: 12.00, kds_destination: 'bar' },
      { name: 'Café Solo', category: 'Bebidas', price: 1.50, kds_destination: 'bar' },
      { name: 'Café con Leche', category: 'Bebidas', price: 1.80, kds_destination: 'bar' },
    ],
    inventory: [
      { name: 'Aceite de Oliva Virgen', category: 'Aceites', unit: 'L', avg_cost: 8.00 },
      { name: 'Patatas', category: 'Verduras', unit: 'kg', avg_cost: 1.20 },
      { name: 'Huevos (docena)', category: 'Lácteos', unit: 'ud', avg_cost: 3.50 },
      { name: 'Arroz Bomba', category: 'Secos', unit: 'kg', avg_cost: 4.50 },
      { name: 'Azafrán', category: 'Especias', unit: 'g', avg_cost: 0.80 },
      { name: 'Tomate Triturado', category: 'Conservas', unit: 'kg', avg_cost: 2.00 },
      { name: 'Cebolla', category: 'Verduras', unit: 'kg', avg_cost: 1.00 },
      { name: 'Ajo', category: 'Verduras', unit: 'kg', avg_cost: 4.00 },
      { name: 'Pimiento Rojo', category: 'Verduras', unit: 'kg', avg_cost: 2.50 },
      { name: 'Jamón Ibérico', category: 'Embutidos', unit: 'kg', avg_cost: 85.00 },
    ],
    roles: [
      { name: 'Jefe de Cocina', department: 'BOH', defaultHourlyCost: 18.00 },
      { name: 'Cocinero/a', department: 'BOH', defaultHourlyCost: 14.00 },
      { name: 'Ayudante de Cocina', department: 'BOH', defaultHourlyCost: 11.00 },
      { name: 'Gerente', department: 'FOH', defaultHourlyCost: 16.00 },
      { name: 'Camarero/a', department: 'FOH', defaultHourlyCost: 12.00 },
      { name: 'Barra', department: 'FOH', defaultHourlyCost: 12.00 },
    ],
  },
  {
    id: 'cafe',
    name: 'Cafetería',
    description: 'Cafés, desayunos y meriendas',
    icon: '☕',
    products: [
      // Cafés
      { name: 'Café Solo', category: 'Cafés', price: 1.40, kds_destination: 'bar' },
      { name: 'Café con Leche', category: 'Cafés', price: 1.70, kds_destination: 'bar' },
      { name: 'Cortado', category: 'Cafés', price: 1.50, kds_destination: 'bar' },
      { name: 'Americano', category: 'Cafés', price: 1.80, kds_destination: 'bar' },
      { name: 'Cappuccino', category: 'Cafés', price: 2.50, kds_destination: 'bar' },
      { name: 'Latte', category: 'Cafés', price: 2.80, kds_destination: 'bar' },
      { name: 'Té / Infusión', category: 'Cafés', price: 1.80, kds_destination: 'bar' },
      // Desayunos
      { name: 'Tostada con Tomate', category: 'Desayunos', price: 2.50, kds_destination: 'kitchen' },
      { name: 'Tostada con Mantequilla', category: 'Desayunos', price: 2.00, kds_destination: 'kitchen' },
      { name: 'Croissant', category: 'Desayunos', price: 2.00, kds_destination: 'prep' },
      { name: 'Napolitana de Chocolate', category: 'Desayunos', price: 2.20, kds_destination: 'prep' },
      { name: 'Porras con Chocolate', category: 'Desayunos', price: 4.50, kds_destination: 'kitchen' },
      { name: 'Huevos Revueltos', category: 'Desayunos', price: 4.00, kds_destination: 'kitchen' },
      // Meriendas
      { name: 'Sandwich Mixto', category: 'Bocadillos', price: 3.50, kds_destination: 'kitchen' },
      { name: 'Sandwich Vegetal', category: 'Bocadillos', price: 4.00, kds_destination: 'kitchen' },
      { name: 'Bocadillo de Jamón', category: 'Bocadillos', price: 4.50, kds_destination: 'prep' },
      { name: 'Bocadillo de Tortilla', category: 'Bocadillos', price: 4.00, kds_destination: 'kitchen' },
      // Postres
      { name: 'Tarta del Día', category: 'Postres', price: 4.50, kds_destination: 'prep' },
      { name: 'Brownie', category: 'Postres', price: 3.50, kds_destination: 'prep' },
      { name: 'Muffin', category: 'Postres', price: 2.50, kds_destination: 'prep' },
      // Bebidas
      { name: 'Zumo Natural', category: 'Bebidas', price: 3.50, kds_destination: 'bar' },
      { name: 'Batido', category: 'Bebidas', price: 4.00, kds_destination: 'bar' },
      { name: 'Agua', category: 'Bebidas', price: 1.80, kds_destination: 'bar' },
      { name: 'Refresco', category: 'Bebidas', price: 2.20, kds_destination: 'bar' },
    ],
    inventory: [
      { name: 'Café en Grano', category: 'Bebidas', unit: 'kg', avg_cost: 18.00 },
      { name: 'Leche Entera', category: 'Lácteos', unit: 'L', avg_cost: 0.90 },
      { name: 'Leche de Avena', category: 'Lácteos', unit: 'L', avg_cost: 1.80 },
      { name: 'Pan de Molde', category: 'Pan', unit: 'ud', avg_cost: 1.50 },
      { name: 'Croissants (6 ud)', category: 'Bollería', unit: 'pack', avg_cost: 3.00 },
      { name: 'Tomate Rallado', category: 'Verduras', unit: 'kg', avg_cost: 2.50 },
      { name: 'Mantequilla', category: 'Lácteos', unit: 'kg', avg_cost: 8.00 },
      { name: 'Huevos (docena)', category: 'Lácteos', unit: 'ud', avg_cost: 3.50 },
    ],
    roles: [
      { name: 'Encargado/a', department: 'FOH', defaultHourlyCost: 14.00 },
      { name: 'Barista', department: 'FOH', defaultHourlyCost: 12.00 },
      { name: 'Camarero/a', department: 'FOH', defaultHourlyCost: 11.00 },
      { name: 'Cocinero/a', department: 'BOH', defaultHourlyCost: 12.00 },
    ],
  },
  {
    id: 'bar',
    name: 'Bar / Pub',
    description: 'Bebidas, copas y picoteo',
    icon: '🍺',
    products: [
      // Cervezas
      { name: 'Caña', category: 'Cervezas', price: 2.00, kds_destination: 'bar' },
      { name: 'Doble', category: 'Cervezas', price: 3.00, kds_destination: 'bar' },
      { name: 'Cerveza Botellín', category: 'Cervezas', price: 2.50, kds_destination: 'bar' },
      { name: 'Cerveza Especial', category: 'Cervezas', price: 3.50, kds_destination: 'bar' },
      { name: 'Cerveza sin Alcohol', category: 'Cervezas', price: 2.50, kds_destination: 'bar' },
      // Copas
      { name: 'Gin Tonic', category: 'Copas', price: 8.00, kds_destination: 'bar' },
      { name: 'Mojito', category: 'Copas', price: 8.00, kds_destination: 'bar' },
      { name: 'Ron Cola', category: 'Copas', price: 6.50, kds_destination: 'bar' },
      { name: 'Whisky Cola', category: 'Copas', price: 7.00, kds_destination: 'bar' },
      { name: 'Vodka Naranja', category: 'Copas', price: 6.50, kds_destination: 'bar' },
      // Vinos
      { name: 'Vino Tinto (copa)', category: 'Vinos', price: 3.00, kds_destination: 'bar' },
      { name: 'Vino Blanco (copa)', category: 'Vinos', price: 3.00, kds_destination: 'bar' },
      { name: 'Vermut', category: 'Vinos', price: 3.50, kds_destination: 'bar' },
      { name: 'Tinto de Verano', category: 'Vinos', price: 2.50, kds_destination: 'bar' },
      // Sin Alcohol
      { name: 'Refresco', category: 'Sin Alcohol', price: 2.50, kds_destination: 'bar' },
      { name: 'Agua', category: 'Sin Alcohol', price: 2.00, kds_destination: 'bar' },
      { name: 'Zumo', category: 'Sin Alcohol', price: 2.80, kds_destination: 'bar' },
      { name: 'Café', category: 'Sin Alcohol', price: 1.50, kds_destination: 'bar' },
      // Picoteo
      { name: 'Aceitunas', category: 'Picoteo', price: 3.00, kds_destination: 'prep' },
      { name: 'Patatas Fritas', category: 'Picoteo', price: 3.50, kds_destination: 'kitchen' },
      { name: 'Nachos con Queso', category: 'Picoteo', price: 6.00, kds_destination: 'kitchen' },
      { name: 'Tabla de Embutidos', category: 'Picoteo', price: 12.00, kds_destination: 'prep' },
      { name: 'Montaditos Variados', category: 'Picoteo', price: 8.00, kds_destination: 'kitchen' },
    ],
    inventory: [
      { name: 'Cerveza Barril (30L)', category: 'Bebidas', unit: 'ud', avg_cost: 85.00 },
      { name: 'Ginebra Premium', category: 'Bebidas', unit: 'L', avg_cost: 25.00 },
      { name: 'Ron', category: 'Bebidas', unit: 'L', avg_cost: 18.00 },
      { name: 'Vodka', category: 'Bebidas', unit: 'L', avg_cost: 15.00 },
      { name: 'Tónica (pack 24)', category: 'Bebidas', unit: 'pack', avg_cost: 18.00 },
      { name: 'Limones', category: 'Frutas', unit: 'kg', avg_cost: 2.00 },
      { name: 'Hielo (saco)', category: 'Otros', unit: 'ud', avg_cost: 3.00 },
    ],
    roles: [
      { name: 'Encargado/a', department: 'FOH', defaultHourlyCost: 14.00 },
      { name: 'Camarero/a Barra', department: 'FOH', defaultHourlyCost: 12.00 },
      { name: 'Camarero/a Sala', department: 'FOH', defaultHourlyCost: 11.00 },
    ],
  },
  {
    id: 'fastfood',
    name: 'Fast Food',
    description: 'Combos, burgers y comida rápida',
    icon: '🍔',
    products: [
      // Burgers
      { name: 'Hamburguesa Clásica', category: 'Burgers', price: 8.50, kds_destination: 'kitchen' },
      { name: 'Cheeseburger', category: 'Burgers', price: 9.00, kds_destination: 'kitchen' },
      { name: 'Bacon Burger', category: 'Burgers', price: 10.50, kds_destination: 'kitchen' },
      { name: 'Burger Veggie', category: 'Burgers', price: 9.50, kds_destination: 'kitchen' },
      { name: 'Double Burger', category: 'Burgers', price: 12.00, kds_destination: 'kitchen' },
      // Combos
      { name: 'Combo Clásico', category: 'Combos', price: 11.50, kds_destination: 'kitchen' },
      { name: 'Combo Cheese', category: 'Combos', price: 12.00, kds_destination: 'kitchen' },
      { name: 'Combo Bacon', category: 'Combos', price: 13.50, kds_destination: 'kitchen' },
      { name: 'Combo Kids', category: 'Combos', price: 7.50, kds_destination: 'kitchen' },
      // Acompañamientos
      { name: 'Patatas Fritas', category: 'Extras', price: 3.00, kds_destination: 'kitchen' },
      { name: 'Patatas Deluxe', category: 'Extras', price: 3.50, kds_destination: 'kitchen' },
      { name: 'Aros de Cebolla', category: 'Extras', price: 4.00, kds_destination: 'kitchen' },
      { name: 'Nuggets (6 ud)', category: 'Extras', price: 4.50, kds_destination: 'kitchen' },
      { name: 'Alitas BBQ', category: 'Extras', price: 6.00, kds_destination: 'kitchen' },
      // Bebidas
      { name: 'Refresco Pequeño', category: 'Bebidas', price: 2.00, kds_destination: 'bar' },
      { name: 'Refresco Grande', category: 'Bebidas', price: 2.80, kds_destination: 'bar' },
      { name: 'Batido', category: 'Bebidas', price: 3.50, kds_destination: 'bar' },
      { name: 'Agua', category: 'Bebidas', price: 1.80, kds_destination: 'bar' },
      // Postres
      { name: 'Helado Soft', category: 'Postres', price: 2.50, kds_destination: 'bar' },
      { name: 'Sundae', category: 'Postres', price: 3.50, kds_destination: 'bar' },
      { name: 'Cookie', category: 'Postres', price: 1.50, kds_destination: 'prep' },
    ],
    inventory: [
      { name: 'Pan de Hamburguesa', category: 'Pan', unit: 'ud', avg_cost: 0.40 },
      { name: 'Carne de Burger (150g)', category: 'Carnes', unit: 'ud', avg_cost: 1.80 },
      { name: 'Queso Cheddar (lonchas)', category: 'Lácteos', unit: 'kg', avg_cost: 12.00 },
      { name: 'Bacon (lonchas)', category: 'Carnes', unit: 'kg', avg_cost: 8.00 },
      { name: 'Lechuga', category: 'Verduras', unit: 'kg', avg_cost: 2.00 },
      { name: 'Tomate', category: 'Verduras', unit: 'kg', avg_cost: 2.50 },
      { name: 'Patatas Congeladas', category: 'Congelados', unit: 'kg', avg_cost: 2.00 },
      { name: 'Aceite de Fritura', category: 'Aceites', unit: 'L', avg_cost: 3.00 },
    ],
    roles: [
      { name: 'Encargado/a', department: 'FOH', defaultHourlyCost: 13.00 },
      { name: 'Cajero/a', department: 'FOH', defaultHourlyCost: 11.00 },
      { name: 'Cocinero/a', department: 'BOH', defaultHourlyCost: 12.00 },
      { name: 'Preparador/a', department: 'BOH', defaultHourlyCost: 11.00 },
    ],
  },
  {
    id: 'custom',
    name: 'Personalizado',
    description: 'Empieza desde cero',
    icon: '✨',
    products: [],
    inventory: [],
    roles: [
      { name: 'Gerente', department: 'FOH', defaultHourlyCost: 15.00 },
      { name: 'Camarero/a', department: 'FOH', defaultHourlyCost: 12.00 },
      { name: 'Cocinero/a', department: 'BOH', defaultHourlyCost: 13.00 },
    ],
  },
];

export const TIMEZONES = [
  { value: 'Europe/Madrid', label: 'España (Península)' },
  { value: 'Atlantic/Canary', label: 'España (Canarias)' },
  { value: 'Europe/London', label: 'Reino Unido' },
  { value: 'Europe/Paris', label: 'Francia' },
  { value: 'Europe/Berlin', label: 'Alemania' },
  { value: 'Europe/Rome', label: 'Italia' },
  { value: 'Europe/Lisbon', label: 'Portugal' },
  { value: 'America/Mexico_City', label: 'México' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina' },
  { value: 'America/Bogota', label: 'Colombia' },
];

export const CURRENCIES = [
  { value: 'EUR', label: '€ Euro', symbol: '€' },
  { value: 'USD', label: '$ Dólar', symbol: '$' },
  { value: 'GBP', label: '£ Libra', symbol: '£' },
  { value: 'MXN', label: '$ Peso Mexicano', symbol: '$' },
  { value: 'ARS', label: '$ Peso Argentino', symbol: '$' },
  { value: 'COP', label: '$ Peso Colombiano', symbol: '$' },
];

export const TABLE_SHAPES = [
  { value: 'square', label: 'Cuadrada', icon: '⬜' },
  { value: 'round', label: 'Redonda', icon: '⚪' },
  { value: 'rectangle', label: 'Rectangular', icon: '▭' },
] as const;

export type TableShape = typeof TABLE_SHAPES[number]['value'];
