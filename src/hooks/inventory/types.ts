// Inventory module — shared types and defaults

export interface InventoryMetrics {
    totalSales: number;
    assignedSales: number;
    unassignedSales: number;
    theoreticalCOGS: number;
    theoreticalCOGSPercent: number;
    actualCOGS: number;
    actualCOGSPercent: number;
    theoreticalGP: number;
    theoreticalGPPercent: number;
    actualGP: number;
    actualGPPercent: number;
    gapCOGS: number;
    gapCOGSPercent: number;
    gapGP: number;
    gapGPPercent: number;
    accountedWaste: number;
    unaccountedWaste: number;
    surplus: number;
}

export interface CategoryBreakdown {
    category: string;
    actualPercent: number;
    actualAmount: number;
    theoreticalPercent: number;
    theoreticalAmount: number;
}

export interface WasteByCategory {
    category: string;
    accounted: number;
    unaccounted: number;
}

export interface WasteByLocation {
    locationId: string;
    locationName: string;
    accountedPercent: number;
    accountedAmount: number;
    unaccountedPercent: number;
    unaccountedAmount: number;
    hasStockCount: boolean;
}

export interface LocationPerformance {
    locationId: string;
    locationName: string;
    sales: number;
    theoreticalValue: number;
    theoreticalPercent: number;
    actualValue: number;
    actualPercent: number;
    variancePercent: number;
    varianceAmount: number;
    hasStockCount?: boolean;
}

export const defaultMetrics: InventoryMetrics = {
    totalSales: 0,
    assignedSales: 0,
    unassignedSales: 0,
    theoreticalCOGS: 0,
    theoreticalCOGSPercent: 0,
    actualCOGS: 0,
    actualCOGSPercent: 0,
    theoreticalGP: 0,
    theoreticalGPPercent: 0,
    actualGP: 0,
    actualGPPercent: 0,
    gapCOGS: 0,
    gapCOGSPercent: 0,
    gapGP: 0,
    gapGPPercent: 0,
    accountedWaste: 0,
    unaccountedWaste: 0,
    surplus: 0,
};
