/**
 * useWasteSimulation — "What-If" Impact Simulator
 * Calculates the financial impact of reducing waste to different target levels.
 * "If you reduce waste from 1.65% to X%, your margin improves by Y%"
 */

import { useMemo } from 'react';

// ── Types ──

export interface SimulationScenario {
  label: string;
  targetPercent: number;
  currentWaste: number;
  projectedWaste: number;
  wasteSaved: number;
  annualSaving: number;
  marginImprovement: number;    // percentage points
  newFoodCostPercent: number;
  roiMultiple: number;          // annual saving / josephine cost
}

export interface SimulationResult {
  currentWastePercent: number;
  currentWasteAmount: number;
  totalSales: number;
  annualSalesEstimate: number;
  scenarios: SimulationScenario[];
  customScenario: (targetPercent: number) => SimulationScenario;
  isAvailable: boolean;
}

// ── Hook ──

export function useWasteSimulation(
  wastePercent: number,
  wasteAmount: number,
  totalSales: number,
  periodDays: number = 30,
): SimulationResult {
  return useMemo(() => {
    if (totalSales <= 0 || wastePercent <= 0) {
      return {
        currentWastePercent: 0,
        currentWasteAmount: 0,
        totalSales: 0,
        annualSalesEstimate: 0,
        scenarios: [],
        customScenario: () => ({
          label: '-', targetPercent: 0, currentWaste: 0, projectedWaste: 0,
          wasteSaved: 0, annualSaving: 0, marginImprovement: 0,
          newFoodCostPercent: 0, roiMultiple: 0,
        }),
        isAvailable: false,
      };
    }

    const annualSales = (totalSales / periodDays) * 365;
    const annualWaste = (wasteAmount / periodDays) * 365;

    // Typical food cost for a restaurant (30-35%)
    const baseFoodCostPercent = 32;

    const buildScenario = (label: string, targetPercent: number): SimulationScenario => {
      const projectedWaste = totalSales * (targetPercent / 100);
      const wasteSaved = wasteAmount - projectedWaste;
      const annualSaving = (wasteSaved / periodDays) * 365;
      const marginImprovement = wastePercent - targetPercent;
      const newFoodCostPercent = baseFoodCostPercent - marginImprovement;
      // ROI: annual saving vs ~€200/month tool cost
      const toolCostAnnual = 200 * 12;
      const roiMultiple = toolCostAnnual > 0 ? annualSaving / toolCostAnnual : 0;

      return {
        label,
        targetPercent,
        currentWaste: wasteAmount,
        projectedWaste: Math.max(0, projectedWaste),
        wasteSaved: Math.max(0, wasteSaved),
        annualSaving: Math.max(0, annualSaving),
        marginImprovement: Math.max(0, marginImprovement),
        newFoodCostPercent,
        roiMultiple: Math.max(0, roiMultiple),
      };
    };

    // Pre-built scenarios
    const scenarios: SimulationScenario[] = [];

    // Only show scenarios that are improvements
    if (wastePercent > 3.0) {
      scenarios.push(buildScenario('Objetivo 3%', 3.0));
    }
    if (wastePercent > 2.0) {
      scenarios.push(buildScenario('Buena práctica (2%)', 2.0));
    }
    if (wastePercent > 1.0) {
      scenarios.push(buildScenario('Excelencia (1%)', 1.0));
    }
    if (wastePercent > 0.5) {
      scenarios.push(buildScenario('Best-in-class (0.5%)', 0.5));
    }

    // 50% reduction scenario
    const halfTarget = wastePercent / 2;
    scenarios.push(buildScenario(`Reducción 50% (${halfTarget.toFixed(1)}%)`, halfTarget));

    // Sort by target descending (easiest first)
    scenarios.sort((a, b) => b.targetPercent - a.targetPercent);

    return {
      currentWastePercent: wastePercent,
      currentWasteAmount: wasteAmount,
      totalSales,
      annualSalesEstimate: annualSales,
      scenarios,
      customScenario: (targetPercent: number) =>
        buildScenario(`Personalizado (${targetPercent.toFixed(1)}%)`, targetPercent),
      isAvailable: true,
    };
  }, [wastePercent, wasteAmount, totalSales, periodDays]);
}
