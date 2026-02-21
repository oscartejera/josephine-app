import { useState, useMemo, useCallback, useEffect } from 'react';
import { addDays, format, isAfter, isBefore, getDay, setHours, setMinutes } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  Supplier,
  RecommendationSettings,
  RecommendationBreakdown,
  ProcurementCategorySettings,
  DEFAULT_CATEGORY_SETTINGS,
  FALLBACK_SUPPLIERS,
  getCategoryWasteFactor,
  calculateRecommendation as calculateRecommendationBase,
  mapDbCategoryToProcurement,
} from '@/lib/procurementConstants';

// ============= Types =============

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
  wasteFactor: number;
  yieldFactor: number;
  safetyStockPct: number;
  inventoryItemId?: string;
  isRealData?: boolean;
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
  minOrder: number;
  minOrderProgress: number;
}

// Re-export types from constants
export type { Supplier, RecommendationSettings, RecommendationBreakdown, ProcurementCategorySettings };

// ============= Fallback SKUs (for demo mode only) =============

const FALLBACK_SKUS: Omit<IngredientSku, 'forecastDailyUsage' | 'wasteFactor' | 'yieldFactor' | 'safetyStockPct'>[] = [
  // Proteins
  { id: 'sku-001', supplierId: 'macro', name: 'Chicken Breast', category: 'Proteins', packSize: '1×5kg', packSizeUnits: 5, unit: 'kg', unitPrice: 42.50, onHandUnits: 8, parLevelUnits: 25, onOrderUnits: 0, paused: false },
  { id: 'sku-002', supplierId: 'macro', name: 'Beef Mince 80/20', category: 'Proteins', packSize: '1×3kg', packSizeUnits: 3, unit: 'kg', unitPrice: 28.90, onHandUnits: 4, parLevelUnits: 15, onOrderUnits: 0, paused: false },
  { id: 'sku-003', supplierId: 'macro', name: 'Salmon Fillet', category: 'Proteins', packSize: '1×2kg', packSizeUnits: 2, unit: 'kg', unitPrice: 38.00, onHandUnits: 2, parLevelUnits: 10, onOrderUnits: 0, paused: false },
  { id: 'sku-005', supplierId: 'sysco', name: 'Lamb Leg Boneless', category: 'Proteins', packSize: '1×3kg', packSizeUnits: 3, unit: 'kg', unitPrice: 52.00, onHandUnits: 3, parLevelUnits: 9, onOrderUnits: 0, paused: false },
  { id: 'sku-007', supplierId: 'bidfood', name: 'Prawns Tiger 16/20', category: 'Proteins', packSize: '1×1kg', packSizeUnits: 1, unit: 'kg', unitPrice: 18.90, onHandUnits: 2, parLevelUnits: 6, onOrderUnits: 0, paused: false },
  
  // Dairy
  { id: 'sku-010', supplierId: 'macro', name: 'Whole Milk', category: 'Dairy', packSize: '12×1L', packSizeUnits: 12, unit: 'L', unitPrice: 14.40, onHandUnits: 18, parLevelUnits: 48, onOrderUnits: 0, paused: false },
  { id: 'sku-011', supplierId: 'macro', name: 'Double Cream', category: 'Dairy', packSize: '6×1L', packSizeUnits: 6, unit: 'L', unitPrice: 18.00, onHandUnits: 4, parLevelUnits: 18, onOrderUnits: 0, paused: false },
  { id: 'sku-013', supplierId: 'sysco', name: 'Mozzarella Block', category: 'Dairy', packSize: '1×2.5kg', packSizeUnits: 2.5, unit: 'kg', unitPrice: 19.50, onHandUnits: 3, parLevelUnits: 10, onOrderUnits: 0, paused: false },
  { id: 'sku-016', supplierId: 'bidfood', name: 'Greek Yogurt', category: 'Dairy', packSize: '4×1kg', packSizeUnits: 4, unit: 'kg', unitPrice: 12.80, onHandUnits: 6, parLevelUnits: 16, onOrderUnits: 0, paused: false },
  
  // Produce
  { id: 'sku-020', supplierId: 'macro', name: 'Onions Brown', category: 'Produce', packSize: '1×10kg', packSizeUnits: 10, unit: 'kg', unitPrice: 8.50, onHandUnits: 12, parLevelUnits: 40, onOrderUnits: 0, paused: false },
  { id: 'sku-021', supplierId: 'macro', name: 'Tomatoes Vine', category: 'Produce', packSize: '1×5kg', packSizeUnits: 5, unit: 'kg', unitPrice: 12.00, onHandUnits: 4, parLevelUnits: 20, onOrderUnits: 0, paused: false },
  { id: 'sku-024', supplierId: 'sysco', name: 'Lettuce Romaine', category: 'Produce', packSize: '6 heads', packSizeUnits: 6, unit: 'heads', unitPrice: 9.00, onHandUnits: 4, parLevelUnits: 18, onOrderUnits: 0, paused: false },
  { id: 'sku-027', supplierId: 'bidfood', name: 'Avocados Hass', category: 'Produce', packSize: '20 units', packSizeUnits: 20, unit: 'units', unitPrice: 24.00, onHandUnits: 12, parLevelUnits: 40, onOrderUnits: 0, paused: false },
  
  // Dry Goods
  { id: 'sku-030', supplierId: 'macro', name: 'Pasta Penne', category: 'Dry Goods', packSize: '1×5kg', packSizeUnits: 5, unit: 'kg', unitPrice: 8.00, onHandUnits: 6, parLevelUnits: 20, onOrderUnits: 0, paused: false },
  { id: 'sku-031', supplierId: 'macro', name: 'Rice Basmati', category: 'Dry Goods', packSize: '1×10kg', packSizeUnits: 10, unit: 'kg', unitPrice: 22.00, onHandUnits: 8, parLevelUnits: 30, onOrderUnits: 0, paused: false },
  { id: 'sku-032', supplierId: 'sysco', name: 'Flour Plain', category: 'Dry Goods', packSize: '1×16kg', packSizeUnits: 16, unit: 'kg', unitPrice: 14.00, onHandUnits: 10, parLevelUnits: 48, onOrderUnits: 0, paused: false },
  { id: 'sku-036', supplierId: 'bidfood', name: 'Chickpeas Tinned', category: 'Dry Goods', packSize: '6×400g', packSizeUnits: 2.4, unit: 'kg', unitPrice: 6.00, onHandUnits: 3, parLevelUnits: 9.6, onOrderUnits: 0, paused: false },
  
  // Beverages
  { id: 'sku-040', supplierId: 'macro', name: 'Coca-Cola Classic', category: 'Beverages', packSize: '24×330ml', packSizeUnits: 24, unit: 'cans', unitPrice: 16.80, onHandUnits: 48, parLevelUnits: 120, onOrderUnits: 0, paused: false },
  { id: 'sku-042', supplierId: 'sysco', name: 'San Pellegrino', category: 'Beverages', packSize: '24×500ml', packSizeUnits: 24, unit: 'bottles', unitPrice: 24.00, onHandUnits: 24, parLevelUnits: 72, onOrderUnits: 0, paused: false },
  { id: 'sku-045', supplierId: 'bidfood', name: 'Ginger Beer', category: 'Beverages', packSize: '12×330ml', packSizeUnits: 12, unit: 'cans', unitPrice: 14.00, onHandUnits: 12, parLevelUnits: 48, onOrderUnits: 0, paused: false },
  
  // Bakery
  { id: 'sku-050', supplierId: 'macro', name: 'Burger Buns', category: 'Bakery', packSize: '48 units', packSizeUnits: 48, unit: 'units', unitPrice: 12.00, onHandUnits: 32, parLevelUnits: 96, onOrderUnits: 0, paused: false },
  { id: 'sku-052', supplierId: 'sysco', name: 'Croissants Frozen', category: 'Bakery', packSize: '30 units', packSizeUnits: 30, unit: 'units', unitPrice: 18.00, onHandUnits: 20, parLevelUnits: 60, onOrderUnits: 0, paused: false },
  
  // Condiments
  { id: 'sku-060', supplierId: 'macro', name: 'Mayonnaise', category: 'Condiments', packSize: '1×5L', packSizeUnits: 5, unit: 'L', unitPrice: 12.00, onHandUnits: 3, parLevelUnits: 10, onOrderUnits: 0, paused: false },
  { id: 'sku-062', supplierId: 'bidfood', name: 'Soy Sauce', category: 'Condiments', packSize: '1×1.8L', packSizeUnits: 1.8, unit: 'L', unitPrice: 8.50, onHandUnits: 1, parLevelUnits: 5.4, onOrderUnits: 0, paused: false },
];

// ============= Utility Functions =============

function generateForecastUsage(days: number = 30, seed: string = ''): number[] {
  // Deterministic forecast based on seed — no Math.random
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const baseUsage = 2 + ((h >>> 0) % 6);
  return Array.from({ length: days }, (_, i) => {
    const v = Math.sin(h + i * 0.7) * 2;
    return Math.max(1, Math.round(baseUsage + v));
  });
}

function getNextDeliveryDate(supplier: Supplier, orderDate: Date): Date {
  const cutoffTime = setMinutes(setHours(orderDate, supplier.cutoffHour), supplier.cutoffMinute);
  let checkDate = isAfter(orderDate, cutoffTime) 
    ? addDays(orderDate, supplier.leadTimeDays + 1)
    : addDays(orderDate, supplier.leadTimeDays);
  
  for (let i = 0; i < 14; i++) {
    const dayOfWeek = getDay(checkDate);
    if (supplier.deliveryDays.includes(dayOfWeek)) {
      return checkDate;
    }
    checkDate = addDays(checkDate, 1);
  }
  return checkDate;
}

/**
 * Calculate recommendation with full breakdown for a SKU
 * Uses the shared calculateRecommendation from procurementConstants
 */
export function calculateSkuRecommendation(
  sku: IngredientSku,
  horizonDays: number,
  settings: RecommendationSettings
): RecommendationBreakdown {
  const forecastUsage = sku.forecastDailyUsage
    .slice(0, horizonDays)
    .reduce((sum, usage) => sum + usage, 0);

  return calculateRecommendationBase(
    forecastUsage,
    sku.onHandUnits,
    sku.onOrderUnits,
    sku.packSizeUnits,
    { wasteFactor: sku.wasteFactor, safetyStockPct: sku.safetyStockPct, yieldFactor: sku.yieldFactor },
    settings.includeSafetyStock
  );
}

function calculateRecommendedPacks(
  sku: IngredientSku,
  horizonDays: number,
  settings: RecommendationSettings
): number {
  const breakdown = calculateSkuRecommendation(sku, horizonDays, settings);
  return settings.roundToPacks ? breakdown.recommendedPacks : Math.ceil(breakdown.recommendedUnits / sku.packSizeUnits);
}

function getCoverageEndDate(
  cart: Map<string, number>,
  skus: IngredientSku[],
  orderDate: Date
): Date {
  if (cart.size === 0) return orderDate;
  
  let minCoverageDays = 30;
  
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

/**
 * Convert database supplier to Supplier format
 */
function dbSupplierToSupplier(dbSupplier: { id: string; name: string }, index: number): Supplier {
  // Generate reasonable defaults based on index for variety
  const deliveryConfigs = [
    { deliveryDays: [1, 2, 3, 4, 5, 6], cutoffHour: 17, leadTimeDays: 1 },
    { deliveryDays: [1, 3, 5], cutoffHour: 14, leadTimeDays: 2 },
    { deliveryDays: [2, 4], cutoffHour: 12, leadTimeDays: 2 },
    { deliveryDays: [1, 2, 3, 4, 5], cutoffHour: 16, leadTimeDays: 1 },
  ];
  const config = deliveryConfigs[index % deliveryConfigs.length];
  
  return {
    id: dbSupplier.id,
    name: dbSupplier.name,
    logo: dbSupplier.name.charAt(0).toUpperCase(),
    deliveryDays: config.deliveryDays,
    cutoffHour: config.cutoffHour,
    cutoffMinute: 0,
    leadTimeDays: config.leadTimeDays,
    minOrder: 100 + (index * 25),
    deliveryFee: 10 + (index * 2),
  };
}

// ============= Main Hook =============

export function useProcurementData() {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);
  const [recommendationSettings, setRecommendationSettings] = useState<RecommendationSettings>({
    horizon: 7,
    includeSafetyStock: true,
    roundToPacks: true,
  });
  const [categorySettings, setCategorySettings] = useState<ProcurementCategorySettings>(DEFAULT_CATEGORY_SETTINGS);
  
  // State for data from Supabase
  const [suppliers, setSuppliers] = useState<Supplier[]>(FALLBACK_SUPPLIERS);
  const [realInventoryItems, setRealInventoryItems] = useState<IngredientSku[]>([]);

  // Fetch suppliers and inventory from Supabase
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch suppliers from database
        const { data: suppliersData, error: suppliersError } = await supabase
          .from('suppliers')
          .select('id, name')
          .order('name');

        if (!suppliersError && suppliersData && suppliersData.length > 0) {
          const dbSuppliers = suppliersData.map((s, i) => dbSupplierToSupplier(s, i));
          setSuppliers(dbSuppliers);
          setSelectedSupplierId(dbSuppliers[0].id);
        } else {
          // Use fallback suppliers
          setSuppliers(FALLBACK_SUPPLIERS);
          setSelectedSupplierId(FALLBACK_SUPPLIERS[0].id);
        }

        // Fetch inventory items
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('inventory_items')
          .select('*')
          .order('name');

        if (inventoryError || !inventoryData || inventoryData.length === 0) {
          console.log('No inventory data found, using demo data');
          setHasRealData(false);
          setIsLoading(false);
          return;
        }

        // Fetch pending purchase order lines
        const { data: poData } = await supabase
          .from('purchase_orders')
          .select(`
            id,
            status,
            purchase_order_lines (
              inventory_item_id,
              quantity
            )
          `)
          .in('status', ['draft', 'sent']);

        const onOrderMap = new Map<string, number>();
        if (poData) {
          poData.forEach(po => {
            if (po.purchase_order_lines) {
              po.purchase_order_lines.forEach((line: { inventory_item_id: string; quantity: number }) => {
                const current = onOrderMap.get(line.inventory_item_id) || 0;
                onOrderMap.set(line.inventory_item_id, current + (line.quantity || 0));
              });
            }
          });
        }

        // Get supplier IDs for assignment
        const supplierIds = suppliersData?.length 
          ? suppliersData.map(s => s.id)
          : FALLBACK_SUPPLIERS.map(s => s.id);

        // Convert inventory items to IngredientSku format
        const skusFromDb: IngredientSku[] = inventoryData.map((item, index) => {
          const category = mapDbCategoryToProcurement(item.category);
          const wasteFactor = getCategoryWasteFactor(category);
          const supplierId = supplierIds[index % supplierIds.length];
          
          const unit = item.unit || 'kg';
          let packSizeUnits = 1;
          let packSize = `1×1${unit}`;
          
          if (unit === 'kg' || unit === 'L') {
            packSizeUnits = 5;
            packSize = `1×5${unit}`;
          } else if (unit === 'units' || unit === 'ea') {
            packSizeUnits = 12;
            packSize = `12 units`;
          }

          const basePrice = item.last_cost || 10;
          const unitPrice = Number((basePrice * packSizeUnits).toFixed(2));
          
          return {
            id: `db-${item.id}`,
            inventoryItemId: item.id,
            supplierId,
            name: item.name,
            category,
            packSize,
            packSizeUnits,
            unit,
            unitPrice,
            onHandUnits: item.current_stock || 0,
            parLevelUnits: item.par_level || packSizeUnits * 5,
            onOrderUnits: onOrderMap.get(item.id) || 0,
            forecastDailyUsage: generateForecastUsage(30, item.id || item.name),
            paused: false,
            wasteFactor,
            yieldFactor: 1.0,
            safetyStockPct: 0.15,
            isRealData: true,
          };
        });

        setRealInventoryItems(skusFromDb);
        setHasRealData(true);
        console.log(`Loaded ${skusFromDb.length} inventory items from database`);
      } catch (error) {
        console.error('Error fetching data:', error);
        setHasRealData(false);
        setSuppliers(FALLBACK_SUPPLIERS);
        setSelectedSupplierId(FALLBACK_SUPPLIERS[0].id);
      }
      setIsLoading(false);
    }

    fetchData();
  }, []);

  // Combine real data with fallback data
  const allSkus = useMemo(() => {
    if (hasRealData && realInventoryItems.length > 0) {
      return realInventoryItems;
    }
    
    // Fallback to demo data
    return FALLBACK_SKUS.map(sku => ({
      ...sku,
      forecastDailyUsage: generateForecastUsage(30, sku.id),
      wasteFactor: getCategoryWasteFactor(sku.category),
      yieldFactor: 1.0,
      safetyStockPct: 0.15,
      isRealData: false,
    }));
  }, [hasRealData, realInventoryItems]);

  const selectedSupplier = useMemo(
    () => suppliers.find(s => s.id === selectedSupplierId) || suppliers[0],
    [selectedSupplierId, suppliers]
  );

  const deliveryDate = useMemo(
    () => selectedSupplier ? getNextDeliveryDate(selectedSupplier, orderDate) : orderDate,
    [selectedSupplier, orderDate]
  );

  // Apply category settings to SKUs
  const skusWithCategorySettings = useMemo(() => {
    return allSkus.map(sku => {
      const catSettings = categorySettings[sku.category];
      if (catSettings) {
        return {
          ...sku,
          wasteFactor: catSettings.wasteFactor,
          safetyStockPct: catSettings.safetyStockPct,
          yieldFactor: catSettings.yieldFactor,
        };
      }
      return sku;
    });
  }, [allSkus, categorySettings]);

  const filteredSkus = useMemo(() => {
    const supplierSkus = skusWithCategorySettings.filter(sku => sku.supplierId === selectedSupplierId);
    if (!searchQuery.trim()) return supplierSkus;
    const query = searchQuery.toLowerCase();
    return supplierSkus.filter(sku => 
      sku.name.toLowerCase().includes(query) ||
      sku.category.toLowerCase().includes(query)
    );
  }, [selectedSupplierId, searchQuery, skusWithCategorySettings]);

  const categories = useMemo(() => {
    const cats = new Set(filteredSkus.map(s => s.category));
    return Array.from(cats).sort();
  }, [filteredSkus]);

  // AI Recommend function
  const aiRecommend = useCallback(async () => {
    setIsCalculating(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const newCart = new Map<string, number>();
    const supplierSkus = skusWithCategorySettings.filter(sku => sku.supplierId === selectedSupplierId);
    
    supplierSkus.forEach(sku => {
      if (sku.paused) return;
      const recommended = calculateRecommendedPacks(sku, recommendationSettings.horizon, recommendationSettings);
      if (recommended > 0) {
        newCart.set(sku.id, recommended);
      }
    });
    
    setCart(newCart);
    setIsCalculating(false);
  }, [selectedSupplierId, recommendationSettings, skusWithCategorySettings]);

  // Quick autofill (no delay)
  const autofillCart = useCallback(() => {
    const newCart = new Map<string, number>();
    const supplierSkus = skusWithCategorySettings.filter(sku => sku.supplierId === selectedSupplierId);
    
    supplierSkus.forEach(sku => {
      if (sku.paused) return;
      const recommended = calculateRecommendedPacks(sku, recommendationSettings.horizon, recommendationSettings);
      if (recommended > 0) {
        newCart.set(sku.id, recommended);
      }
    });
    
    setCart(newCart);
  }, [selectedSupplierId, recommendationSettings, skusWithCategorySettings]);

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
    return calculateRecommendedPacks(sku, recommendationSettings.horizon, recommendationSettings);
  }, [recommendationSettings]);

  const getRecommendationBreakdown = useCallback((sku: IngredientSku) => {
    return calculateSkuRecommendation(sku, recommendationSettings.horizon, recommendationSettings);
  }, [recommendationSettings]);

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
    
    const minOrder = selectedSupplier?.minOrder ?? 100;
    const meetsMinOrder = subtotal >= minOrder;
    const deliveryFee = meetsMinOrder ? 0 : (selectedSupplier?.deliveryFee ?? 10);
    const tax = subtotal * 0.21;
    const total = subtotal + deliveryFee + tax;
    const coverageEndDate = getCoverageEndDate(cart, allSkus, orderDate);
    const minOrderProgress = Math.min(100, (subtotal / minOrder) * 100);
    
    return {
      supplierId: selectedSupplier?.id ?? '',
      supplierName: selectedSupplier?.name ?? '',
      deliveryDate,
      coverageEndDate,
      items,
      subtotal,
      deliveryFee,
      tax,
      total,
      minOrder,
      minOrderProgress,
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
    if (!selectedSupplier) {
      return { isBeforeCutoff: true, cutoffTimeStr: '17:00', cutoffDay: '', deliveryDateStr: '' };
    }
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
    if (!selectedSupplier) return '';
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
    allSkus: skusWithCategorySettings,
    
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
    aiRecommend,
    getRecommendedPacks,
    getRecommendationBreakdown,
    orderSummary,
    
    // AI Recommendation
    isCalculating,
    recommendationSettings,
    setRecommendationSettings,
    
    // Category settings
    categorySettings,
    setCategorySettings,
    
    // Search
    searchQuery,
    setSearchQuery,
    
    // Loading state
    isLoading,
    hasRealData,
  };
}
