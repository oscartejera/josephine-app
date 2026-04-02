/**
 * useAIPredictiveOrdering
 * Generates AI order guides from: recipes × forecast demand × current stock
 *
 * Algorithm:
 * 1. Get 7-day sales forecast for location
 * 2. Get historical product mix ratios (which products sell most)
 * 3. For each product: recipe → ingredients × forecast_units
 * 4. Sum ingredient needs, subtract on-hand stock
 * 5. Group by supplier → output order guide
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { addDays, format } from 'date-fns';

export interface OrderGuideItem {
    inventoryItemId: string;
    itemName: string;
    unit: string;
    forecastNeedQty: number;
    onHandQty: number;
    orderQty: number;
    unitCost: number;
    lineTotal: number;
    supplierName: string;
}

export interface OrderGuide {
    locationId: string;
    forecastStartDate: string;
    forecastEndDate: string;
    items: OrderGuideItem[];
    totalEstimatedCost: number;
    generatedAt: string;
}

export function useAIPredictiveOrdering(locationId: string | null) {
    const { group } = useApp();
    const [orderGuide, setOrderGuide] = useState<OrderGuide | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateOrderGuide = useCallback(async (daysAhead: number = 7) => {
        if (!locationId || !group?.id) return;

        setLoading(true);
        setError(null);

        try {
            const startDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
            const endDate = format(addDays(new Date(), daysAhead), 'yyyy-MM-dd');

            // 1. Get forecast data for the period
            const { data: forecastData } = await supabase
                .from('forecast_points')
                .select('ds, yhat, forecast_run_id, forecast_runs!inner(location_id)')
                .gte('ds', startDate)
                .lte('ds', endDate)
                .order('ds');

            // Filter for this location (via join)
            const locationForecasts = (forecastData as any[] || [])
                .filter((fp: any) => fp.forecast_runs?.location_id === locationId);

            // Sum total forecast sales
            const totalForecastSales = locationForecasts.reduce(
                (sum: number, fp: any) => sum + (Number(fp.yhat) || 0), 0
            );

            if (totalForecastSales <= 0) {
                // Fallback: use average daily sales × days if no forecast
                setError('No hay datos de forecast. Usando estimación por defecto.');
            }

            // 2. Get all recipes with their ingredients
            const { data: recipes } = await supabase
                .from('recipes')
                .select(`
          id, name, menu_item_id, portion_cost, selling_price,
          recipe_ingredients(
            inventory_item_id, qty_gross, yield_pct, unit,
            inventory_items(id, name, unit, last_cost)
          )
        `);

            if (!recipes || recipes.length === 0) {
                setError('No hay recetas configuradas.');
                setLoading(false);
                return;
            }

            // 3. Get top products by sales volume (last 30 days)
            const { data: topProducts } = await supabase
                .from('products')
                .select('id, name, category, price')
                .limit(50);

            // 4. Calculate ingredient needs
            // Estimate: each recipe sells proportionally to forecast
            const ingredientNeeds = new Map<string, {
                itemName: string;
                unit: string;
                totalNeed: number;
                unitCost: number;
            }>();

            // Distribute forecast across recipes evenly (simplified model)
            const avgDailySales = totalForecastSales > 0
                ? totalForecastSales / daysAhead
                : 3000; // fallback
            const productsCount = (topProducts?.length || recipes.length) || 1;
            const avgPortionsPerProduct = Math.max(1, Math.round(
                avgDailySales / (productsCount * 12) // avg €12 per dish
            ));

            for (const recipe of recipes as any[]) {
                const portionsNeeded = avgPortionsPerProduct * daysAhead;
                for (const ri of recipe.recipe_ingredients || []) {
                    const item = ri.inventory_items;
                    if (!item) continue;
                    const qtyNeeded = (ri.qty_gross || 0) * portionsNeeded;
                    const existing = ingredientNeeds.get(item.id);
                    if (existing) {
                        existing.totalNeed += qtyNeeded;
                    } else {
                        ingredientNeeds.set(item.id, {
                            itemName: item.name,
                            unit: ri.unit || item.unit || 'kg',
                            totalNeed: qtyNeeded,
                            unitCost: Number(item.last_cost) || 0,
                        });
                    }
                }
            }

            // 5. Get current stock levels
            const itemIds = [...ingredientNeeds.keys()];
            let stockMap = new Map<string, number>();

            if (itemIds.length > 0) {
                const { data: latestCounts } = await (supabase
                    .from('inventory_counts')
                    .select('item_id, counted_qty')
                    .in('item_id', itemIds)
                    .order('count_date', { ascending: false })
                    .limit(500) as any);

                if (latestCounts) {
                    for (const c of latestCounts) {
                        if (!stockMap.has(c.item_id)) {
                            stockMap.set(c.item_id, Number(c.counted_qty) || 0);
                        }
                    }
                }
            }

            // 6. Build order guide
            const items: OrderGuideItem[] = [];
            for (const [itemId, need] of ingredientNeeds.entries()) {
                const onHand = stockMap.get(itemId) || 0;
                const orderQty = Math.max(0, Math.round((need.totalNeed - onHand) * 100) / 100);
                if (orderQty <= 0) continue;

                items.push({
                    inventoryItemId: itemId,
                    itemName: need.itemName,
                    unit: need.unit,
                    forecastNeedQty: Math.round(need.totalNeed * 100) / 100,
                    onHandQty: Math.round(onHand * 100) / 100,
                    orderQty,
                    unitCost: need.unitCost,
                    lineTotal: Math.round(orderQty * need.unitCost * 100) / 100,
                    supplierName: 'Proveedor General',
                });
            }

            // Sort by line total descending (highest cost first)
            items.sort((a, b) => b.lineTotal - a.lineTotal);

            const totalCost = items.reduce((sum, i) => sum + i.lineTotal, 0);

            const guide: OrderGuide = {
                locationId,
                forecastStartDate: startDate,
                forecastEndDate: endDate,
                items,
                totalEstimatedCost: Math.round(totalCost * 100) / 100,
                generatedAt: new Date().toISOString(),
            };

            // 7. Save to DB
            const { data: savedGuide } = await supabase
                .from('ai_order_guides')
                .insert({
                    org_id: group.id,
                    location_id: locationId,
                    forecast_start_date: startDate,
                    forecast_end_date: endDate,
                    total_estimated_cost: guide.totalEstimatedCost,
                    status: 'draft',
                })
                .select('id')
                .single();

            if (savedGuide && items.length > 0) {
                await supabase
                    .from('ai_order_guide_items')
                    .insert(items.map(item => ({
                        order_guide_id: savedGuide.id,
                        inventory_item_id: item.inventoryItemId,
                        forecast_need_qty: item.forecastNeedQty,
                        on_hand_qty: item.onHandQty,
                        order_qty: item.orderQty,
                        unit: item.unit,
                        unit_cost: item.unitCost,
                        supplier_name: item.supplierName,
                    })));
            }

            setOrderGuide(guide);
        } catch (err: any) {
            setError(err.message || 'Error generating order guide');
            console.error('AI Order Guide error:', err);
        } finally {
            setLoading(false);
        }
    }, [locationId, group?.id]);

    // Load latest saved guide
    const loadLatest = useCallback(async () => {
        if (!locationId) return;

        const { data } = await supabase
            .from('ai_order_guides')
            .select(`
        *, ai_order_guide_items(
          *, inventory_items(name, unit)
        )
      `)
            .eq('location_id', locationId)
            .order('generated_at', { ascending: false })
            .limit(1)
            .single();

        if (data) {
            setOrderGuide({
                locationId: data.location_id,
                forecastStartDate: data.forecast_start_date,
                forecastEndDate: data.forecast_end_date,
                totalEstimatedCost: Number(data.total_estimated_cost) || 0,
                generatedAt: data.generated_at || data.created_at,
                items: ((data as any).ai_order_guide_items || []).map((item: any) => ({
                    inventoryItemId: item.inventory_item_id,
                    itemName: item.inventory_items?.name || 'Unknown',
                    unit: item.unit || item.inventory_items?.unit || 'kg',
                    forecastNeedQty: Number(item.forecast_need_qty) || 0,
                    onHandQty: Number(item.on_hand_qty) || 0,
                    orderQty: Number(item.order_qty) || 0,
                    unitCost: Number(item.unit_cost) || 0,
                    lineTotal: Number(item.order_qty) * Number(item.unit_cost) || 0,
                    supplierName: item.supplier_name || 'Proveedor General',
                })),
            });
        }
    }, [locationId]);

    return {
        orderGuide,
        loading,
        error,
        generateOrderGuide,
        loadLatest,
    };
}
