import { useState, useMemo, useCallback } from 'react';
import { addDays, format, isAfter, isBefore, getDay, setHours, setMinutes } from 'date-fns';

// Types
export interface Supplier {
  id: string;
  name: string;
  logo?: string;
  deliveryDays: number[]; // 0=Sun, 1=Mon, etc.
  cutoffHour: number;
  cutoffMinute: number;
  leadTimeDays: number;
  minOrder: number;
  deliveryFee: number;
}

export interface IngredientSku {
  id: string;
  supplierId: string;
  name: string;
  category: string;
  packSize: string;
  packSizeUnits: number;
  unit: string;
  unitPrice: number;
  onHandUnits: number;
  parLevelUnits: number;
  onOrderUnits: number;
  forecastDailyUsage: number[];
  paused: boolean;
  pauseReason?: string;
}

export interface CartItem {
  skuId: string;
  packs: number;
}

export interface OrderSummary {
  supplierId: string;
  supplierName: string;
  deliveryDate: Date;
  coverageEndDate: Date;
  items: { sku: IngredientSku; packs: number }[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
}

// Seed data - 50 realistic SKUs
const SEED_SUPPLIERS: Supplier[] = [
  {
    id: 'macro',
    name: 'Macro',
    logo: 'M',
    deliveryDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
    cutoffHour: 17,
    cutoffMinute: 0,
    leadTimeDays: 1,
    minOrder: 50,
    deliveryFee: 0,
  },
  {
    id: 'sysco',
    name: 'Sysco',
    logo: 'S',
    deliveryDays: [1, 3, 5], // Mon, Wed, Fri
    cutoffHour: 14,
    cutoffMinute: 0,
    leadTimeDays: 2,
    minOrder: 100,
    deliveryFee: 15,
  },
  {
    id: 'bidfood',
    name: 'Bidfood',
    logo: 'B',
    deliveryDays: [2, 4], // Tue, Thu
    cutoffHour: 12,
    cutoffMinute: 0,
    leadTimeDays: 2,
    minOrder: 75,
    deliveryFee: 10,
  },
];

const SEED_SKUS: Omit<IngredientSku, 'forecastDailyUsage'>[] = [
  // Proteins
  { id: 'sku-001', supplierId: 'macro', name: 'Chicken Breast', category: 'Proteins', packSize: '1×5kg', packSizeUnits: 5, unit: 'kg', unitPrice: 42.50, onHandUnits: 8, parLevelUnits: 25, onOrderUnits: 0, paused: false },
  { id: 'sku-002', supplierId: 'macro', name: 'Beef Mince 80/20', category: 'Proteins', packSize: '1×3kg', packSizeUnits: 3, unit: 'kg', unitPrice: 28.90, onHandUnits: 4, parLevelUnits: 15, onOrderUnits: 0, paused: false },
  { id: 'sku-003', supplierId: 'macro', name: 'Salmon Fillet', category: 'Proteins', packSize: '1×2kg', packSizeUnits: 2, unit: 'kg', unitPrice: 38.00, onHandUnits: 2, parLevelUnits: 10, onOrderUnits: 0, paused: false },
  { id: 'sku-004', supplierId: 'macro', name: 'Pork Loin', category: 'Proteins', packSize: '1×4kg', packSizeUnits: 4, unit: 'kg', unitPrice: 35.20, onHandUnits: 6, parLevelUnits: 16, onOrderUnits: 0, paused: false },
  { id: 'sku-005', supplierId: 'sysco', name: 'Lamb Leg Boneless', category: 'Proteins', packSize: '1×3kg', packSizeUnits: 3, unit: 'kg', unitPrice: 52.00, onHandUnits: 3, parLevelUnits: 9, onOrderUnits: 0, paused: false },
  { id: 'sku-006', supplierId: 'macro', name: 'Duck Breast', category: 'Proteins', packSize: '4×200g', packSizeUnits: 0.8, unit: 'kg', unitPrice: 24.50, onHandUnits: 1.2, parLevelUnits: 4, onOrderUnits: 0, paused: false },
  { id: 'sku-007', supplierId: 'bidfood', name: 'Prawns Tiger 16/20', category: 'Proteins', packSize: '1×1kg', packSizeUnits: 1, unit: 'kg', unitPrice: 18.90, onHandUnits: 2, parLevelUnits: 6, onOrderUnits: 0, paused: false },
  { id: 'sku-008', supplierId: 'macro', name: 'Bacon Rashers', category: 'Proteins', packSize: '1×2.5kg', packSizeUnits: 2.5, unit: 'kg', unitPrice: 22.00, onHandUnits: 3, parLevelUnits: 10, onOrderUnits: 0, paused: false },
  
  // Dairy
  { id: 'sku-010', supplierId: 'macro', name: 'Whole Milk', category: 'Dairy', packSize: '12×1L', packSizeUnits: 12, unit: 'L', unitPrice: 14.40, onHandUnits: 18, parLevelUnits: 48, onOrderUnits: 0, paused: false },
  { id: 'sku-011', supplierId: 'macro', name: 'Double Cream', category: 'Dairy', packSize: '6×1L', packSizeUnits: 6, unit: 'L', unitPrice: 18.00, onHandUnits: 4, parLevelUnits: 18, onOrderUnits: 0, paused: false },
  { id: 'sku-012', supplierId: 'macro', name: 'Butter Unsalted', category: 'Dairy', packSize: '10×250g', packSizeUnits: 2.5, unit: 'kg', unitPrice: 21.50, onHandUnits: 1.5, parLevelUnits: 7.5, onOrderUnits: 0, paused: false },
  { id: 'sku-013', supplierId: 'sysco', name: 'Mozzarella Block', category: 'Dairy', packSize: '1×2.5kg', packSizeUnits: 2.5, unit: 'kg', unitPrice: 19.50, onHandUnits: 3, parLevelUnits: 10, onOrderUnits: 0, paused: false },
  { id: 'sku-014', supplierId: 'macro', name: 'Parmesan Wedge', category: 'Dairy', packSize: '1×1kg', packSizeUnits: 1, unit: 'kg', unitPrice: 22.00, onHandUnits: 0.8, parLevelUnits: 3, onOrderUnits: 0, paused: false },
  { id: 'sku-015', supplierId: 'macro', name: 'Eggs Free Range', category: 'Dairy', packSize: '180 eggs', packSizeUnits: 180, unit: 'eggs', unitPrice: 32.00, onHandUnits: 90, parLevelUnits: 360, onOrderUnits: 0, paused: false },
  { id: 'sku-016', supplierId: 'bidfood', name: 'Greek Yogurt', category: 'Dairy', packSize: '4×1kg', packSizeUnits: 4, unit: 'kg', unitPrice: 12.80, onHandUnits: 6, parLevelUnits: 16, onOrderUnits: 0, paused: false },
  
  // Produce
  { id: 'sku-020', supplierId: 'macro', name: 'Onions Brown', category: 'Produce', packSize: '1×10kg', packSizeUnits: 10, unit: 'kg', unitPrice: 8.50, onHandUnits: 12, parLevelUnits: 40, onOrderUnits: 0, paused: false },
  { id: 'sku-021', supplierId: 'macro', name: 'Tomatoes Vine', category: 'Produce', packSize: '1×5kg', packSizeUnits: 5, unit: 'kg', unitPrice: 12.00, onHandUnits: 4, parLevelUnits: 20, onOrderUnits: 0, paused: false },
  { id: 'sku-022', supplierId: 'macro', name: 'Potatoes Maris Piper', category: 'Produce', packSize: '1×25kg', packSizeUnits: 25, unit: 'kg', unitPrice: 18.00, onHandUnits: 20, parLevelUnits: 75, onOrderUnits: 0, paused: false },
  { id: 'sku-023', supplierId: 'macro', name: 'Carrots', category: 'Produce', packSize: '1×10kg', packSizeUnits: 10, unit: 'kg', unitPrice: 7.50, onHandUnits: 8, parLevelUnits: 30, onOrderUnits: 0, paused: false },
  { id: 'sku-024', supplierId: 'sysco', name: 'Lettuce Romaine', category: 'Produce', packSize: '6 heads', packSizeUnits: 6, unit: 'heads', unitPrice: 9.00, onHandUnits: 4, parLevelUnits: 18, onOrderUnits: 0, paused: false },
  { id: 'sku-025', supplierId: 'macro', name: 'Garlic Bulbs', category: 'Produce', packSize: '1×1kg', packSizeUnits: 1, unit: 'kg', unitPrice: 8.00, onHandUnits: 0.5, parLevelUnits: 3, onOrderUnits: 0, paused: false },
  { id: 'sku-026', supplierId: 'macro', name: 'Lemons', category: 'Produce', packSize: '50 units', packSizeUnits: 50, unit: 'units', unitPrice: 15.00, onHandUnits: 30, parLevelUnits: 100, onOrderUnits: 0, paused: false },
  { id: 'sku-027', supplierId: 'bidfood', name: 'Avocados Hass', category: 'Produce', packSize: '20 units', packSizeUnits: 20, unit: 'units', unitPrice: 24.00, onHandUnits: 12, parLevelUnits: 40, onOrderUnits: 0, paused: false },
  { id: 'sku-028', supplierId: 'macro', name: 'Mushrooms Button', category: 'Produce', packSize: '1×3kg', packSizeUnits: 3, unit: 'kg', unitPrice: 11.00, onHandUnits: 2, parLevelUnits: 9, onOrderUnits: 0, paused: false },
  { id: 'sku-029', supplierId: 'macro', name: 'Spinach Baby', category: 'Produce', packSize: '1×1kg', packSizeUnits: 1, unit: 'kg', unitPrice: 8.50, onHandUnits: 1, parLevelUnits: 4, onOrderUnits: 0, paused: false },
  
  // Dry Goods
  { id: 'sku-030', supplierId: 'macro', name: 'Pasta Penne', category: 'Dry Goods', packSize: '1×5kg', packSizeUnits: 5, unit: 'kg', unitPrice: 8.00, onHandUnits: 6, parLevelUnits: 20, onOrderUnits: 0, paused: false },
  { id: 'sku-031', supplierId: 'macro', name: 'Rice Basmati', category: 'Dry Goods', packSize: '1×10kg', packSizeUnits: 10, unit: 'kg', unitPrice: 22.00, onHandUnits: 8, parLevelUnits: 30, onOrderUnits: 0, paused: false },
  { id: 'sku-032', supplierId: 'sysco', name: 'Flour Plain', category: 'Dry Goods', packSize: '1×16kg', packSizeUnits: 16, unit: 'kg', unitPrice: 14.00, onHandUnits: 10, parLevelUnits: 48, onOrderUnits: 0, paused: false },
  { id: 'sku-033', supplierId: 'macro', name: 'Olive Oil Extra Virgin', category: 'Dry Goods', packSize: '1×5L', packSizeUnits: 5, unit: 'L', unitPrice: 35.00, onHandUnits: 3, parLevelUnits: 15, onOrderUnits: 0, paused: false },
  { id: 'sku-034', supplierId: 'macro', name: 'Vegetable Oil', category: 'Dry Goods', packSize: '1×10L', packSizeUnits: 10, unit: 'L', unitPrice: 18.00, onHandUnits: 8, parLevelUnits: 30, onOrderUnits: 0, paused: false },
  { id: 'sku-035', supplierId: 'macro', name: 'Tomato Passata', category: 'Dry Goods', packSize: '6×700g', packSizeUnits: 4.2, unit: 'kg', unitPrice: 9.50, onHandUnits: 5, parLevelUnits: 16.8, onOrderUnits: 0, paused: false },
  { id: 'sku-036', supplierId: 'bidfood', name: 'Chickpeas Tinned', category: 'Dry Goods', packSize: '6×400g', packSizeUnits: 2.4, unit: 'kg', unitPrice: 6.00, onHandUnits: 3, parLevelUnits: 9.6, onOrderUnits: 0, paused: false },
  { id: 'sku-037', supplierId: 'macro', name: 'Sugar Caster', category: 'Dry Goods', packSize: '1×5kg', packSizeUnits: 5, unit: 'kg', unitPrice: 6.50, onHandUnits: 4, parLevelUnits: 15, onOrderUnits: 0, paused: false },
  
  // Beverages
  { id: 'sku-040', supplierId: 'macro', name: 'Coca-Cola Classic', category: 'Beverages', packSize: '24×330ml', packSizeUnits: 24, unit: 'cans', unitPrice: 16.80, onHandUnits: 48, parLevelUnits: 120, onOrderUnits: 0, paused: false },
  { id: 'sku-041', supplierId: 'macro', name: 'Sprite', category: 'Beverages', packSize: '24×330ml', packSizeUnits: 24, unit: 'cans', unitPrice: 16.80, onHandUnits: 36, parLevelUnits: 96, onOrderUnits: 0, paused: false },
  { id: 'sku-042', supplierId: 'sysco', name: 'San Pellegrino', category: 'Beverages', packSize: '24×500ml', packSizeUnits: 24, unit: 'bottles', unitPrice: 24.00, onHandUnits: 24, parLevelUnits: 72, onOrderUnits: 0, paused: false },
  { id: 'sku-043', supplierId: 'macro', name: 'Orange Juice Fresh', category: 'Beverages', packSize: '6×1L', packSizeUnits: 6, unit: 'L', unitPrice: 15.00, onHandUnits: 8, parLevelUnits: 24, onOrderUnits: 0, paused: false },
  { id: 'sku-044', supplierId: 'macro', name: 'Tonic Water', category: 'Beverages', packSize: '24×200ml', packSizeUnits: 24, unit: 'bottles', unitPrice: 18.00, onHandUnits: 20, parLevelUnits: 72, onOrderUnits: 0, paused: false },
  { id: 'sku-045', supplierId: 'bidfood', name: 'Ginger Beer', category: 'Beverages', packSize: '12×330ml', packSizeUnits: 12, unit: 'cans', unitPrice: 14.00, onHandUnits: 12, parLevelUnits: 48, onOrderUnits: 0, paused: false },
  
  // Bakery
  { id: 'sku-050', supplierId: 'macro', name: 'Burger Buns', category: 'Bakery', packSize: '48 units', packSizeUnits: 48, unit: 'units', unitPrice: 12.00, onHandUnits: 32, parLevelUnits: 96, onOrderUnits: 0, paused: false },
  { id: 'sku-051', supplierId: 'macro', name: 'Sourdough Loaf', category: 'Bakery', packSize: '6 loaves', packSizeUnits: 6, unit: 'loaves', unitPrice: 15.00, onHandUnits: 4, parLevelUnits: 18, onOrderUnits: 0, paused: false },
  { id: 'sku-052', supplierId: 'sysco', name: 'Croissants Frozen', category: 'Bakery', packSize: '30 units', packSizeUnits: 30, unit: 'units', unitPrice: 18.00, onHandUnits: 20, parLevelUnits: 60, onOrderUnits: 0, paused: false },
  { id: 'sku-053', supplierId: 'macro', name: 'Tortilla Wraps 12"', category: 'Bakery', packSize: '18 units', packSizeUnits: 18, unit: 'units', unitPrice: 8.50, onHandUnits: 12, parLevelUnits: 36, onOrderUnits: 0, paused: false },
  
  // Condiments & Sauces
  { id: 'sku-060', supplierId: 'macro', name: 'Mayonnaise', category: 'Condiments', packSize: '1×5L', packSizeUnits: 5, unit: 'L', unitPrice: 12.00, onHandUnits: 3, parLevelUnits: 10, onOrderUnits: 0, paused: false },
  { id: 'sku-061', supplierId: 'macro', name: 'Ketchup', category: 'Condiments', packSize: '1×4.5kg', packSizeUnits: 4.5, unit: 'kg', unitPrice: 10.00, onHandUnits: 2, parLevelUnits: 9, onOrderUnits: 0, paused: false },
  { id: 'sku-062', supplierId: 'bidfood', name: 'Soy Sauce', category: 'Condiments', packSize: '1×1.8L', packSizeUnits: 1.8, unit: 'L', unitPrice: 8.50, onHandUnits: 1, parLevelUnits: 5.4, onOrderUnits: 0, paused: false },
  { id: 'sku-063', supplierId: 'macro', name: 'Balsamic Vinegar', category: 'Condiments', packSize: '1×1L', packSizeUnits: 1, unit: 'L', unitPrice: 14.00, onHandUnits: 0.5, parLevelUnits: 3, onOrderUnits: 0, paused: false },
  { id: 'sku-064', supplierId: 'macro', name: 'Dijon Mustard', category: 'Condiments', packSize: '1×2kg', packSizeUnits: 2, unit: 'kg', unitPrice: 11.00, onHandUnits: 1, parLevelUnits: 4, onOrderUnits: 0, paused: false, pauseReason: 'Seasonal item - out of stock until March' },
];

// Generate realistic forecast data
const generateForecastUsage = (): number[] => {
  // 7 days of usage: Today, +1, +2, +3, +4, +5, +6
  const baseUsage = Math.floor(Math.random() * 6) + 2; // 2-7 base
  return Array.from({ length: 7 }, () => {
    const variance = (Math.random() - 0.5) * 4;
    return Math.max(1, Math.round(baseUsage + variance));
  });
};

const FULL_SKUS: IngredientSku[] = SEED_SKUS.map(sku => ({
  ...sku,
  forecastDailyUsage: generateForecastUsage(),
  paused: sku.id === 'sku-064', // Only mustard is paused
}));

// Utility functions
function getNextDeliveryDate(supplier: Supplier, orderDate: Date): Date {
  const cutoffTime = setMinutes(setHours(orderDate, supplier.cutoffHour), supplier.cutoffMinute);
  let checkDate = isAfter(orderDate, cutoffTime) 
    ? addDays(orderDate, supplier.leadTimeDays + 1)
    : addDays(orderDate, supplier.leadTimeDays);
  
  // Find next delivery day
  for (let i = 0; i < 14; i++) {
    const dayOfWeek = getDay(checkDate);
    if (supplier.deliveryDays.includes(dayOfWeek)) {
      return checkDate;
    }
    checkDate = addDays(checkDate, 1);
  }
  return checkDate;
}

function calculateRecommendedPacks(
  sku: IngredientSku,
  deliveryDate: Date,
  orderDate: Date
): number {
  // Calculate days until next delivery after this one (buffer)
  const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
  const bufferDays = daysUntilDelivery + 1;
  
  // Sum expected consumption
  const expectedConsumption = sku.forecastDailyUsage
    .slice(0, Math.min(bufferDays, 7))
    .reduce((sum, usage) => sum + usage, 0);
  
  const targetStock = expectedConsumption + sku.parLevelUnits * 0.5;
  const netNeededUnits = Math.max(0, targetStock - sku.onHandUnits - sku.onOrderUnits);
  const recommendedPacks = Math.ceil(netNeededUnits / sku.packSizeUnits);
  
  return recommendedPacks;
}

function getCoverageEndDate(
  cart: Map<string, number>,
  skus: IngredientSku[],
  orderDate: Date
): Date {
  if (cart.size === 0) return orderDate;
  
  let minCoverageDays = 14;
  
  cart.forEach((packs, skuId) => {
    const sku = skus.find(s => s.id === skuId);
    if (!sku || packs === 0) return;
    
    const totalUnits = sku.onHandUnits + sku.onOrderUnits + (packs * sku.packSizeUnits);
    let remainingUnits = totalUnits;
    let coverageDays = 0;
    
    for (const dailyUsage of sku.forecastDailyUsage) {
      if (remainingUnits >= dailyUsage) {
        remainingUnits -= dailyUsage;
        coverageDays++;
      } else {
        break;
      }
    }
    
    minCoverageDays = Math.min(minCoverageDays, coverageDays);
  });
  
  return addDays(orderDate, minCoverageDays);
}

// Main hook
export function useProcurementData() {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('macro');
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');

  const suppliers = SEED_SUPPLIERS;
  const allSkus = FULL_SKUS;

  const selectedSupplier = useMemo(
    () => suppliers.find(s => s.id === selectedSupplierId) || suppliers[0],
    [selectedSupplierId]
  );

  const deliveryDate = useMemo(
    () => getNextDeliveryDate(selectedSupplier, orderDate),
    [selectedSupplier, orderDate]
  );

  const filteredSkus = useMemo(() => {
    const supplierSkus = allSkus.filter(sku => sku.supplierId === selectedSupplierId);
    if (!searchQuery.trim()) return supplierSkus;
    const query = searchQuery.toLowerCase();
    return supplierSkus.filter(sku => 
      sku.name.toLowerCase().includes(query) ||
      sku.category.toLowerCase().includes(query)
    );
  }, [selectedSupplierId, searchQuery, allSkus]);

  const categories = useMemo(() => {
    const cats = new Set(filteredSkus.map(s => s.category));
    return Array.from(cats).sort();
  }, [filteredSkus]);

  // Auto-fill recommended quantities
  const autofillCart = useCallback(() => {
    const newCart = new Map<string, number>();
    const supplierSkus = allSkus.filter(sku => sku.supplierId === selectedSupplierId);
    
    supplierSkus.forEach(sku => {
      if (sku.paused) return;
      const recommended = calculateRecommendedPacks(sku, deliveryDate, orderDate);
      if (recommended > 0) {
        newCart.set(sku.id, recommended);
      }
    });
    
    setCart(newCart);
  }, [selectedSupplierId, deliveryDate, orderDate, allSkus]);

  const updateCartItem = useCallback((skuId: string, packs: number) => {
    setCart(prev => {
      const newCart = new Map(prev);
      if (packs <= 0) {
        newCart.delete(skuId);
      } else {
        newCart.set(skuId, packs);
      }
      return newCart;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart(new Map());
  }, []);

  const getRecommendedPacks = useCallback((sku: IngredientSku) => {
    return calculateRecommendedPacks(sku, deliveryDate, orderDate);
  }, [deliveryDate, orderDate]);

  const orderSummary = useMemo((): OrderSummary => {
    const items: { sku: IngredientSku; packs: number }[] = [];
    let subtotal = 0;
    
    cart.forEach((packs, skuId) => {
      const sku = allSkus.find(s => s.id === skuId);
      if (sku && packs > 0) {
        items.push({ sku, packs });
        subtotal += packs * sku.unitPrice;
      }
    });
    
    const deliveryFee = subtotal >= selectedSupplier.minOrder ? 0 : selectedSupplier.deliveryFee;
    const tax = subtotal * 0.21; // 21% VAT
    const total = subtotal + deliveryFee + tax;
    const coverageEndDate = getCoverageEndDate(cart, allSkus, orderDate);
    
    return {
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      deliveryDate,
      coverageEndDate,
      items,
      subtotal,
      deliveryFee,
      tax,
      total,
    };
  }, [cart, allSkus, selectedSupplier, deliveryDate, orderDate]);

  const dayLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(orderDate, i);
      labels.push(i === 0 ? 'Today' : format(date, 'EEE'));
    }
    return labels;
  }, [orderDate]);

  const cutoffInfo = useMemo(() => {
    const cutoffTime = setMinutes(setHours(orderDate, selectedSupplier.cutoffHour), selectedSupplier.cutoffMinute);
    const isBeforeCutoff = isBefore(new Date(), cutoffTime);
    const cutoffDay = format(orderDate, 'EEEE (d MMMM)');
    return {
      isBeforeCutoff,
      cutoffTimeStr: format(cutoffTime, 'HH:mm'),
      cutoffDay,
      deliveryDateStr: format(deliveryDate, 'd MMMM'),
    };
  }, [selectedSupplier, orderDate, deliveryDate]);

  const deliveryDaysLabel = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return selectedSupplier.deliveryDays.map(d => dayNames[d]).join(', ');
  }, [selectedSupplier]);

  return {
    // Data
    suppliers,
    selectedSupplier,
    selectedSupplierId,
    setSelectedSupplierId,
    filteredSkus,
    categories,
    allSkus,
    
    // Date & delivery
    orderDate,
    setOrderDate,
    deliveryDate,
    cutoffInfo,
    deliveryDaysLabel,
    dayLabels,
    
    // Cart
    cart,
    updateCartItem,
    clearCart,
    autofillCart,
    getRecommendedPacks,
    orderSummary,
    
    // Search
    searchQuery,
    setSearchQuery,
  };
}
