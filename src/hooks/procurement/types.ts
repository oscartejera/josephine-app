// Procurement module — shared types

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
