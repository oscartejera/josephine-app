import { useState, useMemo, useCallback, useEffect } from 'react';
import { addDays, format, isBefore, setHours, setMinutes } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  Supplier,
  RecommendationSettings,
  RecommendationBreakdown,
  ProcurementCategorySettings,
  DEFAULT_CATEGORY_SETTINGS,
  FALLBACK_SUPPLIERS,
  getCategoryWasteFactor,
  mapDbCategoryToProcurement,
} from '@/lib/procurementConstants';

// Re-export types for backward compatibility
export type { IngredientSku, CartItem, OrderSummary } from './procurement/types';
export type { Supplier, RecommendationSettings, RecommendationBreakdown, ProcurementCategorySettings };
export { calculateSkuRecommendation } from './procurement/utils';

// Internal imports
import type { IngredientSku, OrderSummary } from './procurement/types';
import {
  FALLBACK_SKUS,
  generateForecastUsage,
  getNextDeliveryDate,
  calculateSkuRecommendation,
  calculateRecommendedPacks,
  getCoverageEndDate,
  dbSupplierToSupplier,
} from './procurement/utils';

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
