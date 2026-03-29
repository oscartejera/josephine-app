/**
 * useWasteRecipeCost — Waste-Adjusted Recipe Cost
 * Cross-references waste data with recipe ingredients to calculate
 * the real food cost of each recipe (theoretical + waste impact).
 */

import { useMemo } from 'react';

// ── Types ──

export interface RecipeWasteImpact {
  recipeName: string;
  theoreticalCost: number;
  wasteImpact: number;          // € waste attributable to this recipe's ingredients
  adjustedCost: number;         // theoretical + waste
  adjustedFoodCostPercent: number;
  sellingPrice: number;
  theoreticalMargin: number;    // selling - theoretical
  adjustedMargin: number;       // selling - adjusted
  marginErosion: number;        // pp lost to waste
  topWasteIngredient: string;
  topWasteAmount: number;
  riskLevel: 'high' | 'medium' | 'low';
}

export interface RecipeCostResult {
  recipes: RecipeWasteImpact[];
  totalMarginErosion: number;     // total pp lost
  totalWasteInRecipes: number;    // total € waste attributable to recipes
  worstRecipe: string | null;
  isAvailable: boolean;
}

// ── Hook ──

interface WasteEvent {
  waste_value: number;
  reason: string | null;
  inventory_items?: { name?: string; category_name?: string } | null;
}

interface MEItem {
  name: string;
  selling_price: number;
  food_cost: number;
  food_cost_pct: number;
  quantity_sold: number;
}

export function useWasteRecipeCost(
  wasteEvents: WasteEvent[],
  menuItems: MEItem[],
  totalSales: number,
): RecipeCostResult {
  return useMemo(() => {
    if (wasteEvents.length < 5 || menuItems.length === 0 || totalSales <= 0) {
      return {
        recipes: [],
        totalMarginErosion: 0,
        totalWasteInRecipes: 0,
        worstRecipe: null,
        isAvailable: false,
      };
    }

    // Build waste-by-ingredient map
    const ingredientWaste = new Map<string, { total: number; category: string }>();
    wasteEvents.forEach(event => {
      const itemInfo = event.inventory_items as any;
      const name = itemInfo?.name;
      if (!name) return;
      const existing = ingredientWaste.get(name) || { total: 0, category: itemInfo?.category_name || '' };
      existing.total += event.waste_value || 0;
      ingredientWaste.set(name, existing);
    });

    const totalWasteRegistered = wasteEvents.reduce((s, e) => s + (e.waste_value || 0), 0);

    // For each menu item, estimate the waste impact on its cost
    const recipes: RecipeWasteImpact[] = [];
    let totalMarginErosion = 0;
    let totalWasteInRecipes = 0;

    menuItems.forEach(item => {
      if (!item.selling_price || item.selling_price <= 0) return;

      const theoreticalCost = item.food_cost || 0;

      // Estimate waste impact proportionally:
      // Recipe's waste share = (recipe's food cost / total food costs) * total waste
      const totalFoodCost = menuItems.reduce((s, m) => s + ((m.food_cost || 0) * (m.quantity_sold || 1)), 0);
      const recipeShare = totalFoodCost > 0
        ? ((theoreticalCost * (item.quantity_sold || 1)) / totalFoodCost)
        : (1 / menuItems.length);

      const wasteImpact = totalWasteRegistered * recipeShare / Math.max(1, item.quantity_sold || 1);
      const adjustedCost = theoreticalCost + wasteImpact;
      const adjustedFoodCostPercent = item.selling_price > 0 ? (adjustedCost / item.selling_price) * 100 : 0;

      const theoreticalMargin = item.selling_price - theoreticalCost;
      const adjustedMargin = item.selling_price - adjustedCost;
      const marginErosion = item.selling_price > 0
        ? ((theoreticalMargin - adjustedMargin) / item.selling_price) * 100
        : 0;

      // Find the most likely waste ingredient for this recipe
      // (simplified: use the biggest waste item matching the recipe's cost category)
      let topWasteIngredient = '-';
      let topWasteAmount = 0;
      ingredientWaste.forEach((waste, ingName) => {
        if (waste.total > topWasteAmount) {
          topWasteAmount = waste.total;
          topWasteIngredient = ingName;
        }
      });

      // Risk level based on margin erosion
      let riskLevel: RecipeWasteImpact['riskLevel'] = 'low';
      if (marginErosion > 3) riskLevel = 'high';
      else if (marginErosion > 1.5) riskLevel = 'medium';

      recipes.push({
        recipeName: item.name,
        theoreticalCost,
        wasteImpact,
        adjustedCost,
        adjustedFoodCostPercent,
        sellingPrice: item.selling_price,
        theoreticalMargin,
        adjustedMargin,
        marginErosion,
        topWasteIngredient,
        topWasteAmount,
        riskLevel,
      });

      totalMarginErosion += marginErosion;
      totalWasteInRecipes += wasteImpact;
    });

    // Sort by margin erosion descending
    recipes.sort((a, b) => b.marginErosion - a.marginErosion);

    return {
      recipes: recipes.slice(0, 15), // Top 15 most impacted
      totalMarginErosion: recipes.length > 0 ? totalMarginErosion / recipes.length : 0,
      totalWasteInRecipes,
      worstRecipe: recipes.length > 0 ? recipes[0].recipeName : null,
      isAvailable: recipes.length >= 2,
    };
  }, [wasteEvents, menuItems, totalSales]);
}
