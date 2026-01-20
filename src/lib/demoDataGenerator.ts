/**
 * Demo Data Generator for Josephine
 * Generates coherent, realistic data for Inventory and Waste modules
 * Mimics Nory's data patterns and ensures consistency across views
 * Uses deterministic seeding for reproducible data
 */

import { format, subDays, addHours, startOfDay } from 'date-fns';

// ============= SEEDED RANDOM =============

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  between(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  intBetween(min: number, max: number): number {
    return Math.floor(this.between(min, max + 1));
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  weightedPick<T>(items: T[], weights: number[]): T {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = this.next() * totalWeight;
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

// ============= TYPES =============

export interface DemoLocation {
  id: string;
  name: string;
  dailySalesRange: [number, number];
  hasStockCount: boolean;
}

export interface DemoEmployee {
  id: string;
  fullName: string;
  locationId: string;
  initials: string;
}

export interface DemoTicket {
  id: string;
  locationId: string;
  closedAt: Date;
  netTotal: number;
  channel: 'dinein' | 'takeaway' | 'delivery';
}

export interface DemoWasteEvent {
  id: string;
  locationId: string;
  occurredAt: Date;
  itemName: string;
  itemCategory: string;
  quantity: number;
  unit: string;
  valueEur: number;
  reason: 'broken' | 'end_of_day' | 'expired' | 'theft' | 'other';
  employeeId: string | null;
  type: 'ingredient' | 'product';
}

export interface StockCountRowData {
  id: string;
  itemName: string;
  unit: string;
  varianceQty: number;
  openingQty: number;
  deliveriesQty: number;
  netTransferredQty: number;
  closingQty: number;
  usedQty: number;
  salesQty: number;
  batchBalance: number;
}

export interface DailyMetrics {
  date: Date;
  locationId: string;
  sales: number;
  theoreticalCOGS: { food: number; beverage: number; misc: number };
  actualCOGS: { food: number; beverage: number; misc: number };
  accountedWaste: number;
  unaccountedWaste: number;
  wasteByReason: Record<string, number>;
  wasteByCategory: Record<string, number>;
}

// ============= DEMO LOCATIONS (6 as requested) =============

export const DEMO_LOCATIONS: DemoLocation[] = [
  { id: 'loc-cpu-001', name: 'CPU', dailySalesRange: [3000, 6000], hasStockCount: false },
  { id: 'loc-west-002', name: 'Westside', dailySalesRange: [2500, 5000], hasStockCount: true },
  { id: 'loc-south-003', name: 'Southside', dailySalesRange: [2000, 4500], hasStockCount: true },
  { id: 'loc-hq-005', name: 'HQ', dailySalesRange: [1500, 3000], hasStockCount: false },
  { id: 'loc-westend-006', name: 'Westend', dailySalesRange: [2200, 4200], hasStockCount: true },
  { id: 'loc-east-004', name: 'Eastside', dailySalesRange: [2000, 4000], hasStockCount: true },
];

// ============= DEMO EMPLOYEES =============

const EMPLOYEE_NAMES = [
  'María García', 'Carlos López', 'Ana Martínez', 'José Rodríguez',
  'Laura Sánchez', 'Miguel Fernández', 'Carmen Ruiz', 'David Torres',
  'Elena Díaz', 'Pablo Moreno', 'Isabel Jiménez', 'Antonio Romero',
  'Lucía Navarro', 'Francisco Gil', 'Marta Serrano'
];

// ============= STOCK COUNT ITEMS =============

const STOCK_COUNT_ITEMS = [
  { name: 'Tender fillets (fresh)', unit: 'kg' },
  { name: 'Chicken breast', unit: 'kg' },
  { name: 'House sauce', unit: 'L' },
  { name: 'Plain flour', unit: 'kg' },
  { name: 'Spice mix original', unit: 'kg' },
  { name: 'Spice mix hot', unit: 'kg' },
  { name: 'Bread crumbs', unit: 'kg' },
  { name: 'Vegetable oil', unit: 'L' },
  { name: 'Lettuce iceberg', unit: 'kg' },
  { name: 'Tomatoes fresh', unit: 'kg' },
  { name: 'Onions', unit: 'kg' },
  { name: 'Cheese slices', unit: 'kg' },
  { name: 'Burger buns', unit: 'units' },
  { name: 'Fries frozen', unit: 'kg' },
  { name: 'Cola syrup', unit: 'L' },
  { name: 'Orange juice', unit: 'L' },
  { name: 'Mayonnaise', unit: 'L' },
  { name: 'Ketchup', unit: 'L' },
  { name: 'Mustard', unit: 'L' },
  { name: 'Pickles sliced', unit: 'kg' },
  { name: 'Bacon rashers', unit: 'kg' },
  { name: 'Egg liquid', unit: 'L' },
  { name: 'Milk whole', unit: 'L' },
  { name: 'Ice cream vanilla', unit: 'L' },
  { name: 'Coffee beans', unit: 'kg' },
];

function weightedPick<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
// ============= WASTE ITEMS =============

const WASTE_ITEMS: { name: string; category: string; unit: string; avgCost: number; type: 'ingredient' | 'product' }[] = [
  { name: 'Tomatoes', category: 'Fresh', unit: 'kg', avgCost: 2.5, type: 'ingredient' },
  { name: 'Lettuce', category: 'Fresh', unit: 'kg', avgCost: 1.8, type: 'ingredient' },
  { name: 'Avocado', category: 'Fresh', unit: 'units', avgCost: 1.5, type: 'ingredient' },
  { name: 'Onions', category: 'Fresh', unit: 'kg', avgCost: 1.2, type: 'ingredient' },
  { name: 'Milk', category: 'Dairy', unit: 'L', avgCost: 1.1, type: 'ingredient' },
  { name: 'Cheese', category: 'Dairy', unit: 'kg', avgCost: 8.5, type: 'ingredient' },
  { name: 'Butter', category: 'Dairy', unit: 'kg', avgCost: 6.0, type: 'ingredient' },
  { name: 'Chicken Breast', category: 'Protein', unit: 'kg', avgCost: 7.5, type: 'ingredient' },
  { name: 'Beef Steak', category: 'Protein', unit: 'kg', avgCost: 18.0, type: 'ingredient' },
  { name: 'Salmon Fillet', category: 'Protein', unit: 'kg', avgCost: 22.0, type: 'ingredient' },
  { name: 'Frozen Fries', category: 'Frozen', unit: 'kg', avgCost: 2.0, type: 'ingredient' },
  { name: 'Ice Cream', category: 'Frozen', unit: 'L', avgCost: 4.5, type: 'product' },
  { name: 'House Dressing', category: 'Sauce', unit: 'L', avgCost: 3.0, type: 'ingredient' },
  { name: 'BBQ Sauce', category: 'Sauce', unit: 'L', avgCost: 2.5, type: 'ingredient' },
  { name: 'Bread Rolls', category: 'Dry Goods', unit: 'units', avgCost: 0.3, type: 'ingredient' },
  { name: 'Pasta', category: 'Dry Goods', unit: 'kg', avgCost: 1.5, type: 'ingredient' },
  { name: 'Burger', category: 'Product', unit: 'units', avgCost: 4.5, type: 'product' },
  { name: 'Salad Bowl', category: 'Product', unit: 'units', avgCost: 3.0, type: 'product' },
];

// ============= MAIN GENERATOR CLASS =============

export class DemoDataGenerator {
  private locations: DemoLocation[];
  private employees: DemoEmployee[];
  private dailyMetrics: Map<string, DailyMetrics[]>;
  private tickets: DemoTicket[];
  private wasteEvents: DemoWasteEvent[];
  private stockCountData: Map<string, StockCountRowData[]>;
  private rng: SeededRandom;
  private baseSeed: number;

  constructor(seed?: number) {
    this.baseSeed = seed || 12345; // Deterministic default
    this.rng = new SeededRandom(this.baseSeed);
    this.locations = DEMO_LOCATIONS;
    this.employees = [];
    this.dailyMetrics = new Map();
    this.tickets = [];
    this.wasteEvents = [];
    this.stockCountData = new Map();
  }

  private generateUUID(): string {
    const chars = '0123456789abcdef';
    let uuid = '';
    for (let i = 0; i < 32; i++) {
      uuid += chars[Math.floor(this.rng.next() * 16)];
      if (i === 7 || i === 11 || i === 15 || i === 19) uuid += '-';
    }
    return uuid;
  }

  // Generate all demo data for a date range
  generate(fromDate: Date, toDate: Date): void {
    // Reset RNG with base seed for determinism
    this.rng = new SeededRandom(this.baseSeed);
    this.generateEmployees();
    this.generateDailyMetrics(fromDate, toDate);
    this.generateTickets(fromDate, toDate);
    this.generateWasteEvents(fromDate, toDate);
    this.generateStockCountData(fromDate, toDate);
  }

  private generateEmployees(): void {
    this.employees = EMPLOYEE_NAMES.map((name, idx) => {
      const location = this.locations[idx % this.locations.length];
      const nameParts = name.split(' ');
      return {
        id: `emp-${this.generateUUID().slice(0, 8)}`,
        fullName: name,
        locationId: location.id,
        initials: nameParts.map(p => p[0]).join('').toUpperCase()
      };
    });
  }

  private generateDailyMetrics(fromDate: Date, toDate: Date): void {
    const days = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    for (const location of this.locations) {
      const metrics: DailyMetrics[] = [];
      
      for (let d = 0; d < days; d++) {
        const date = subDays(toDate, days - 1 - d);
        const dayOfWeek = date.getDay();
        
        // Weekend boost
        const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.2 : 1.0;
        
        // Base sales with some variation
        const baseSales = this.rng.between(location.dailySalesRange[0], location.dailySalesRange[1]);
        const sales = Math.round(baseSales * weekendMultiplier);
        
        // Theoretical COGS (target percentages)
        const theoreticalFood = sales * this.rng.between(0.22, 0.28);
        const theoreticalBeverage = sales * this.rng.between(0.04, 0.08);
        const theoreticalMisc = sales * this.rng.between(0.005, 0.02);
        
        // Actual COGS (slightly higher than theoretical)
        const actualFood = theoreticalFood * this.rng.between(1.02, 1.12);
        const actualBeverage = theoreticalBeverage * this.rng.between(1.01, 1.08);
        const actualMisc = theoreticalMisc * this.rng.between(1.0, 1.15);
        
        // Waste calculations
        const accountedWaste = sales * this.rng.between(0.002, 0.008);
        const unaccountedWaste = sales * this.rng.between(0.001, 0.012);
        
        // Waste by reason (must sum to accountedWaste)
        const endOfDayPct = this.rng.between(0.55, 0.75);
        const brokenPct = this.rng.between(0.10, 0.20);
        const expiredPct = this.rng.between(0.05, 0.15);
        const theftPct = this.rng.between(0.0, 0.05);
        const otherPct = 1 - endOfDayPct - brokenPct - expiredPct - theftPct;
        
        const wasteByReason = {
          end_of_day: accountedWaste * endOfDayPct,
          broken: accountedWaste * brokenPct,
          expired: accountedWaste * expiredPct,
          theft: accountedWaste * theftPct,
          other: accountedWaste * Math.max(0, otherPct)
        };
        
        // Waste by category (must sum to accountedWaste)
        const categoryDistribution = {
          Fresh: this.rng.between(0.15, 0.30),
          Protein: this.rng.between(0.20, 0.35),
          Dairy: this.rng.between(0.08, 0.15),
          Frozen: this.rng.between(0.03, 0.10),
          Sauce: this.rng.between(0.03, 0.08),
          'Dry Goods': this.rng.between(0.05, 0.12),
          Product: this.rng.between(0.05, 0.15)
        };
        
        const catTotal = Object.values(categoryDistribution).reduce((a, b) => a + b, 0);
        const wasteByCategory: Record<string, number> = {};
        for (const [cat, pct] of Object.entries(categoryDistribution)) {
          wasteByCategory[cat] = accountedWaste * (pct / catTotal);
        }
        
        metrics.push({
          date,
          locationId: location.id,
          sales,
          theoreticalCOGS: { food: theoreticalFood, beverage: theoreticalBeverage, misc: theoreticalMisc },
          actualCOGS: { food: actualFood, beverage: actualBeverage, misc: actualMisc },
          accountedWaste,
          unaccountedWaste,
          wasteByReason,
          wasteByCategory
        });
      }
      
      this.dailyMetrics.set(location.id, metrics);
    }
  }

  private generateTickets(fromDate: Date, toDate: Date): void {
    this.tickets = [];
    
    for (const location of this.locations) {
      const metrics = this.dailyMetrics.get(location.id) || [];
      
      for (const day of metrics) {
        // Generate 50-150 tickets per day to reach the daily sales
        const ticketCount = this.rng.intBetween(50, 150);
        const avgTicket = day.sales / ticketCount;
        
        // Channel distribution
        const channels: ('dinein' | 'takeaway' | 'delivery')[] = ['dinein', 'takeaway', 'delivery'];
        const channelWeights = [
          this.rng.between(0.55, 0.75),
          this.rng.between(0.05, 0.20),
          this.rng.between(0.10, 0.35)
        ];
        
        let remainingSales = day.sales;
        
        for (let t = 0; t < ticketCount; t++) {
          const isLast = t === ticketCount - 1;
          const ticketAmount = isLast 
            ? remainingSales 
            : Math.max(5, Math.round(avgTicket * this.rng.between(0.3, 2.0)));
          
          remainingSales -= ticketAmount;
          
          // Random time during the day (11:00 - 23:00)
          const hour = this.rng.intBetween(11, 23);
          const minute = this.rng.intBetween(0, 59);
          const closedAt = addHours(startOfDay(day.date), hour + minute / 60);
          
          this.tickets.push({
            id: this.generateUUID(),
            locationId: location.id,
            closedAt,
            netTotal: Math.max(5, ticketAmount),
            channel: this.rng.weightedPick(channels, channelWeights)
          });
        }
      }
    }
  }

  private generateWasteEvents(fromDate: Date, toDate: Date): void {
    this.wasteEvents = [];
    
    for (const location of this.locations) {
      const metrics = this.dailyMetrics.get(location.id) || [];
      const locationEmployees = this.employees.filter(e => e.locationId === location.id);
      
      for (const day of metrics) {
        // Generate 3-12 waste events per day
        const eventCount = this.rng.intBetween(3, 12);
        let remainingWaste = day.accountedWaste;
        
        const reasons: ('broken' | 'end_of_day' | 'expired' | 'theft' | 'other')[] = 
          ['end_of_day', 'broken', 'expired', 'theft', 'other'];
        const reasonWeights = [
          day.wasteByReason.end_of_day,
          day.wasteByReason.broken,
          day.wasteByReason.expired,
          day.wasteByReason.theft,
          day.wasteByReason.other
        ];
        
        for (let e = 0; e < eventCount; e++) {
          const isLast = e === eventCount - 1;
          const item = this.rng.pick(WASTE_ITEMS);
          const reason = this.rng.weightedPick(reasons, reasonWeights);
          
          // Calculate waste value
          const avgEventValue = remainingWaste / (eventCount - e);
          const eventValue = isLast 
            ? remainingWaste 
            : Math.max(0.5, avgEventValue * this.rng.between(0.3, 2.0));
          
          remainingWaste -= eventValue;
          
          // Calculate quantity from value and cost
          const quantity = Math.max(0.1, eventValue / item.avgCost);
          
          // Random time during the day
          const hour = this.rng.intBetween(11, 23);
          const minute = this.rng.intBetween(0, 59);
          const occurredAt = addHours(startOfDay(day.date), hour + minute / 60);
          
          this.wasteEvents.push({
            id: this.generateUUID(),
            locationId: location.id,
            occurredAt,
            itemName: item.name,
            itemCategory: item.category,
            quantity: Math.round(quantity * 100) / 100,
            unit: item.unit,
            valueEur: Math.round(eventValue * 100) / 100,
            reason,
            employeeId: locationEmployees.length > 0 ? this.rng.pick(locationEmployees).id : null,
            type: item.type
          });
        }
      }
    }
  }

  private generateStockCountData(fromDate: Date, toDate: Date): void {
    this.stockCountData = new Map();

    for (const location of this.locations) {
      if (!location.hasStockCount) continue;

      const rows: StockCountRowData[] = STOCK_COUNT_ITEMS.map(item => {
        const openingQty = this.rng.between(10, 100);
        const deliveriesQty = this.rng.between(0, 50);
        const netTransferredQty = this.rng.between(-5, 5);
        const salesQty = this.rng.between(20, 80);
        const usedQty = salesQty * this.rng.between(1.0, 1.2);
        const closingQty = openingQty + deliveriesQty + netTransferredQty - usedQty;
        const batchBalance = this.rng.between(-2, 2);
        const varianceQty = closingQty - (openingQty + deliveriesQty + netTransferredQty - salesQty) + batchBalance;

        return {
          id: this.generateUUID(),
          itemName: item.name,
          unit: item.unit,
          varianceQty: Math.round(varianceQty * 100) / 100,
          openingQty: Math.round(openingQty * 100) / 100,
          deliveriesQty: Math.round(deliveriesQty * 100) / 100,
          netTransferredQty: Math.round(netTransferredQty * 100) / 100,
          closingQty: Math.round(Math.max(0, closingQty) * 100) / 100,
          usedQty: Math.round(usedQty * 100) / 100,
          salesQty: Math.round(salesQty * 100) / 100,
          batchBalance: Math.round(batchBalance * 100) / 100
        };
      });

      this.stockCountData.set(location.id, rows);
    }
  }

  // ============= GETTERS =============

  getLocations(): DemoLocation[] {
    return this.locations;
  }

  getEmployees(): DemoEmployee[] {
    return this.employees;
  }

  getTickets(): DemoTicket[] {
    return this.tickets;
  }

  getWasteEvents(): DemoWasteEvent[] {
    return this.wasteEvents;
  }

  getStockCountData(locationId: string): StockCountRowData[] {
    return this.stockCountData.get(locationId) || [];
  }

  // ============= AGGREGATED DATA GETTERS =============

  getInventoryMetrics(fromDate: Date, toDate: Date, locationIds: string[]) {
    const filteredLocations = locationIds.length > 0 
      ? this.locations.filter(l => locationIds.includes(l.id))
      : this.locations;

    let totalSales = 0;
    let theoreticalCOGS = { food: 0, beverage: 0, misc: 0 };
    let actualCOGS = { food: 0, beverage: 0, misc: 0 };
    let accountedWaste = 0;
    let unaccountedWaste = 0;

    for (const location of filteredLocations) {
      const metrics = this.dailyMetrics.get(location.id) || [];
      const filtered = metrics.filter(m => m.date >= fromDate && m.date <= toDate);
      
      for (const day of filtered) {
        totalSales += day.sales;
        theoreticalCOGS.food += day.theoreticalCOGS.food;
        theoreticalCOGS.beverage += day.theoreticalCOGS.beverage;
        theoreticalCOGS.misc += day.theoreticalCOGS.misc;
        actualCOGS.food += day.actualCOGS.food;
        actualCOGS.beverage += day.actualCOGS.beverage;
        actualCOGS.misc += day.actualCOGS.misc;
        accountedWaste += day.accountedWaste;
        unaccountedWaste += day.unaccountedWaste;
      }
    }

    const totalTheoreticalCOGS = theoreticalCOGS.food + theoreticalCOGS.beverage + theoreticalCOGS.misc;
    const totalActualCOGS = actualCOGS.food + actualCOGS.beverage + actualCOGS.misc;
    const gapCOGS = totalActualCOGS - totalTheoreticalCOGS;
    const surplus = Math.max(0, gapCOGS - accountedWaste - unaccountedWaste) * 0.1;

    return {
      totalSales,
      assignedSales: totalSales * 0.85,
      unassignedSales: totalSales * 0.15,
      theoreticalCOGS: totalTheoreticalCOGS,
      theoreticalCOGSPercent: totalSales > 0 ? (totalTheoreticalCOGS / totalSales) * 100 : 0,
      actualCOGS: totalActualCOGS,
      actualCOGSPercent: totalSales > 0 ? (totalActualCOGS / totalSales) * 100 : 0,
      theoreticalGP: totalSales - totalTheoreticalCOGS,
      theoreticalGPPercent: totalSales > 0 ? ((totalSales - totalTheoreticalCOGS) / totalSales) * 100 : 0,
      actualGP: totalSales - totalActualCOGS,
      actualGPPercent: totalSales > 0 ? ((totalSales - totalActualCOGS) / totalSales) * 100 : 0,
      gapCOGS,
      gapCOGSPercent: totalSales > 0 ? (gapCOGS / totalSales) * 100 : 0,
      gapGP: -(totalSales - totalActualCOGS - (totalSales - totalTheoreticalCOGS)),
      gapGPPercent: totalSales > 0 ? -((gapCOGS / totalSales) * 100) : 0,
      accountedWaste,
      unaccountedWaste,
      surplus
    };
  }

  getCategoryBreakdown(fromDate: Date, toDate: Date, locationIds: string[]) {
    const metrics = this.getInventoryMetrics(fromDate, toDate, locationIds);
    const totalSales = metrics.totalSales;

    // Calculate category breakdown from daily metrics
    let food = { actual: 0, theoretical: 0 };
    let beverage = { actual: 0, theoretical: 0 };
    let misc = { actual: 0, theoretical: 0 };

    const filteredLocations = locationIds.length > 0 
      ? this.locations.filter(l => locationIds.includes(l.id))
      : this.locations;

    for (const location of filteredLocations) {
      const dailyMetrics = this.dailyMetrics.get(location.id) || [];
      const filtered = dailyMetrics.filter(m => m.date >= fromDate && m.date <= toDate);
      
      for (const day of filtered) {
        food.actual += day.actualCOGS.food;
        food.theoretical += day.theoreticalCOGS.food;
        beverage.actual += day.actualCOGS.beverage;
        beverage.theoretical += day.theoreticalCOGS.beverage;
        misc.actual += day.actualCOGS.misc;
        misc.theoretical += day.theoreticalCOGS.misc;
      }
    }

    return [
      {
        category: 'Food',
        actualPercent: totalSales > 0 ? (food.actual / totalSales) * 100 : 0,
        actualAmount: food.actual,
        theoreticalPercent: totalSales > 0 ? (food.theoretical / totalSales) * 100 : 0,
        theoreticalAmount: food.theoretical
      },
      {
        category: 'Beverage',
        actualPercent: totalSales > 0 ? (beverage.actual / totalSales) * 100 : 0,
        actualAmount: beverage.actual,
        theoreticalPercent: totalSales > 0 ? (beverage.theoretical / totalSales) * 100 : 0,
        theoreticalAmount: beverage.theoretical
      },
      {
        category: 'Miscellaneous',
        actualPercent: totalSales > 0 ? (misc.actual / totalSales) * 100 : 0,
        actualAmount: misc.actual,
        theoreticalPercent: totalSales > 0 ? (misc.theoretical / totalSales) * 100 : 0,
        theoreticalAmount: misc.theoretical
      }
    ];
  }

  getWasteByCategory(fromDate: Date, toDate: Date, locationIds: string[]) {
    const filteredLocations = locationIds.length > 0 
      ? this.locations.filter(l => locationIds.includes(l.id))
      : this.locations;

    // Map waste categories to COGS categories
    const categoryMapping: Record<string, string> = {
      Fresh: 'Food',
      Protein: 'Food',
      Dairy: 'Food',
      Frozen: 'Food',
      Sauce: 'Food',
      'Dry Goods': 'Miscellaneous',
      Product: 'Food',
      Beverage: 'Beverage'
    };

    const accounted: Record<string, number> = { Food: 0, Beverage: 0, Miscellaneous: 0 };
    const unaccounted: Record<string, number> = { Food: 0, Beverage: 0, Miscellaneous: 0 };

    for (const location of filteredLocations) {
      const dailyMetrics = this.dailyMetrics.get(location.id) || [];
      const filtered = dailyMetrics.filter(m => m.date >= fromDate && m.date <= toDate);
      
      for (const day of filtered) {
        // Distribute accounted waste by category
        for (const [cat, value] of Object.entries(day.wasteByCategory)) {
          const mappedCat = categoryMapping[cat] || 'Miscellaneous';
          accounted[mappedCat] += value;
        }
        
        // Distribute unaccounted proportionally to COGS
        const totalActual = day.actualCOGS.food + day.actualCOGS.beverage + day.actualCOGS.misc;
        if (totalActual > 0) {
          unaccounted.Food += day.unaccountedWaste * (day.actualCOGS.food / totalActual);
          unaccounted.Beverage += day.unaccountedWaste * (day.actualCOGS.beverage / totalActual);
          unaccounted.Miscellaneous += day.unaccountedWaste * (day.actualCOGS.misc / totalActual);
        }
      }
    }

    return [
      { category: 'Food', accounted: accounted.Food, unaccounted: unaccounted.Food },
      { category: 'Beverage', accounted: accounted.Beverage, unaccounted: unaccounted.Beverage },
      { category: 'Miscellaneous', accounted: accounted.Miscellaneous, unaccounted: unaccounted.Miscellaneous }
    ];
  }

  getWasteByLocation(fromDate: Date, toDate: Date, locationIds: string[]) {
    const filteredLocations = locationIds.length > 0 
      ? this.locations.filter(l => locationIds.includes(l.id))
      : this.locations;

    return filteredLocations.map((location, idx) => {
      const dailyMetrics = this.dailyMetrics.get(location.id) || [];
      const filtered = dailyMetrics.filter(m => m.date >= fromDate && m.date <= toDate);
      
      let sales = 0;
      let accounted = 0;
      let unaccounted = 0;

      for (const day of filtered) {
        sales += day.sales;
        accounted += day.accountedWaste;
        unaccounted += day.unaccountedWaste;
      }

      // Simulate one location without stock count for realism
      const hasStockCount = idx !== filteredLocations.length - 1;

      return {
        locationId: location.id,
        locationName: location.name,
        accountedPercent: sales > 0 ? (accounted / sales) * 100 : 0,
        accountedAmount: accounted,
        unaccountedPercent: sales > 0 ? (unaccounted / sales) * 100 : 0,
        unaccountedAmount: unaccounted,
        hasStockCount
      };
    });
  }

  getLocationPerformance(fromDate: Date, toDate: Date, locationIds: string[]) {
    const filteredLocations = locationIds.length > 0 
      ? this.locations.filter(l => locationIds.includes(l.id))
      : this.locations;

    return filteredLocations.map((location, idx) => {
      const dailyMetrics = this.dailyMetrics.get(location.id) || [];
      const filtered = dailyMetrics.filter(m => m.date >= fromDate && m.date <= toDate);
      
      let sales = 0;
      let theoreticalCOGS = 0;
      let actualCOGS = 0;

      for (const day of filtered) {
        sales += day.sales;
        theoreticalCOGS += day.theoreticalCOGS.food + day.theoreticalCOGS.beverage + day.theoreticalCOGS.misc;
        actualCOGS += day.actualCOGS.food + day.actualCOGS.beverage + day.actualCOGS.misc;
      }

      const theoreticalGP = sales - theoreticalCOGS;
      const actualGP = sales - actualCOGS;
      const variance = actualGP - theoreticalGP;

      // Simulate one location without stock count
      const hasStockCount = idx !== filteredLocations.length - 1;

      return {
        locationId: location.id,
        locationName: location.name,
        sales,
        theoreticalValue: theoreticalCOGS,
        theoreticalPercent: sales > 0 ? (theoreticalCOGS / sales) * 100 : 0,
        actualValue: actualCOGS,
        actualPercent: sales > 0 ? (actualCOGS / sales) * 100 : 0,
        variancePercent: sales > 0 ? (variance / sales) * 100 : 0,
        varianceAmount: variance,
        hasStockCount
      };
    });
  }

  // ============= WASTE MODULE SPECIFIC GETTERS =============

  getWasteMetrics(fromDate: Date, toDate: Date, locationIds: string[]) {
    const inventoryMetrics = this.getInventoryMetrics(fromDate, toDate, locationIds);
    
    return {
      totalSales: inventoryMetrics.totalSales,
      totalAccountedWaste: inventoryMetrics.accountedWaste,
      wastePercentOfSales: inventoryMetrics.totalSales > 0 
        ? (inventoryMetrics.accountedWaste / inventoryMetrics.totalSales) * 100 
        : 0
    };
  }

  getWasteTrendByReason(fromDate: Date, toDate: Date, locationIds: string[]) {
    const filteredLocations = locationIds.length > 0 
      ? this.locations.filter(l => locationIds.includes(l.id))
      : this.locations;

    const trendData: Map<string, Record<string, number>> = new Map();

    for (const location of filteredLocations) {
      const dailyMetrics = this.dailyMetrics.get(location.id) || [];
      const filtered = dailyMetrics.filter(m => m.date >= fromDate && m.date <= toDate);
      
      for (const day of filtered) {
        const dateKey = format(day.date, 'yyyy-MM-dd');
        const existing = trendData.get(dateKey) || {
          end_of_day: 0,
          broken: 0,
          expired: 0,
          theft: 0,
          other: 0
        };
        
        for (const [reason, value] of Object.entries(day.wasteByReason)) {
          existing[reason] = (existing[reason] || 0) + value;
        }
        
        trendData.set(dateKey, existing);
      }
    }

    return Array.from(trendData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, reasons]) => ({
        date,
        ...reasons
      }));
  }

  getWasteByReasonValue(fromDate: Date, toDate: Date, locationIds: string[]) {
    const filteredLocations = locationIds.length > 0 
      ? this.locations.filter(l => locationIds.includes(l.id))
      : this.locations;

    const totals: Record<string, { value: number; count: number }> = {
      end_of_day: { value: 0, count: 0 },
      broken: { value: 0, count: 0 },
      expired: { value: 0, count: 0 },
      theft: { value: 0, count: 0 },
      other: { value: 0, count: 0 }
    };

    for (const location of filteredLocations) {
      const dailyMetrics = this.dailyMetrics.get(location.id) || [];
      const filtered = dailyMetrics.filter(m => m.date >= fromDate && m.date <= toDate);
      
      for (const day of filtered) {
        for (const [reason, value] of Object.entries(day.wasteByReason)) {
          totals[reason].value += value;
          totals[reason].count += Math.ceil(value / 10); // Estimate count from value
        }
      }
    }

    return Object.entries(totals).map(([reason, data]) => ({
      reason,
      value: data.value,
      count: data.count
    }));
  }

  getWasteByIngredientCategory(fromDate: Date, toDate: Date, locationIds: string[]) {
    const filteredLocations = locationIds.length > 0 
      ? this.locations.filter(l => locationIds.includes(l.id))
      : this.locations;

    const totals: Record<string, number> = {};

    for (const location of filteredLocations) {
      const dailyMetrics = this.dailyMetrics.get(location.id) || [];
      const filtered = dailyMetrics.filter(m => m.date >= fromDate && m.date <= toDate);
      
      for (const day of filtered) {
        for (const [category, value] of Object.entries(day.wasteByCategory)) {
          totals[category] = (totals[category] || 0) + value;
        }
      }
    }

    const total = Object.values(totals).reduce((a, b) => a + b, 0);

    return Object.entries(totals).map(([category, value]) => ({
      category,
      value,
      percent: total > 0 ? (value / total) * 100 : 0
    }));
  }

  getWasteLeaderboard(fromDate: Date, toDate: Date, locationIds: string[]) {
    const filteredLocations = locationIds.length > 0 
      ? this.locations.filter(l => locationIds.includes(l.id))
      : this.locations;

    // Create synthetic leaderboard from employees and waste
    const employeeWaste: Map<string, { logs: number; value: number; locationName: string }> = new Map();

    for (const location of filteredLocations) {
      const dailyMetrics = this.dailyMetrics.get(location.id) || [];
      const filtered = dailyMetrics.filter(m => m.date >= fromDate && m.date <= toDate);
      const locationEmployees = this.employees.filter(e => e.locationId === location.id);
      
      if (locationEmployees.length === 0) continue;

      let totalWaste = 0;
      for (const day of filtered) {
        totalWaste += day.accountedWaste;
      }

      // Distribute waste among employees (weighted randomly)
      const weights = locationEmployees.map(() => Math.random());
      const totalWeight = weights.reduce((a, b) => a + b, 0);

      locationEmployees.forEach((emp, idx) => {
        const share = totalWaste * (weights[idx] / totalWeight);
        const logs = Math.ceil(share / 15); // Approximate logs
        
        employeeWaste.set(emp.id, {
          logs,
          value: share,
          locationName: location.name
        });
      });
    }

    return this.employees
      .filter(emp => employeeWaste.has(emp.id))
      .map(emp => {
        const data = employeeWaste.get(emp.id)!;
        return {
          employeeId: emp.id,
          employeeName: emp.fullName,
          initials: emp.initials,
          locationName: data.locationName,
          logs: data.logs,
          value: data.value
        };
      })
      .sort((a, b) => b.value - a.value);
  }

  getWasteItems(fromDate: Date, toDate: Date, locationIds: string[]) {
    const filteredLocations = locationIds.length > 0 
      ? this.locations.filter(l => locationIds.includes(l.id))
      : this.locations;

    const filteredEvents = this.wasteEvents.filter(e => 
      filteredLocations.some(l => l.id === e.locationId) &&
      e.occurredAt >= fromDate &&
      e.occurredAt <= toDate
    );

    // Aggregate by item
    const itemAggregates: Map<string, {
      quantity: number;
      value: number;
      type: 'ingredient' | 'product';
      reasons: Record<string, number>;
    }> = new Map();

    for (const event of filteredEvents) {
      const existing = itemAggregates.get(event.itemName) || {
        quantity: 0,
        value: 0,
        type: event.type,
        reasons: {}
      };
      
      existing.quantity += event.quantity;
      existing.value += event.valueEur;
      existing.reasons[event.reason] = (existing.reasons[event.reason] || 0) + event.valueEur;
      
      itemAggregates.set(event.itemName, existing);
    }

    // Get total sales for % calculation
    const metrics = this.getInventoryMetrics(fromDate, toDate, locationIds.length > 0 ? locationIds : []);
    const totalSales = metrics.totalSales;

    return Array.from(itemAggregates.entries())
      .map(([itemName, data]) => {
        // Find top reason by value
        const topReason = Object.entries(data.reasons)
          .sort(([, a], [, b]) => b - a)[0]?.[0] || 'other';

        return {
          itemName,
          quantity: data.quantity,
          value: data.value,
          type: data.type,
          topReason,
          percentOfSales: totalSales > 0 ? (data.value / totalSales) * 100 : 0
        };
      })
      .sort((a, b) => b.value - a.value);
  }
}

// Singleton instance for consistent data across views
let generatorInstance: DemoDataGenerator | null = null;

export function getDemoGenerator(fromDate: Date, toDate: Date): DemoDataGenerator {
  if (!generatorInstance) {
    generatorInstance = new DemoDataGenerator();
    // Generate 60 days of data to cover most date ranges
    const extendedFrom = subDays(fromDate, 30);
    const extendedTo = subDays(toDate, -30);
    generatorInstance.generate(extendedFrom, extendedTo);
  }
  return generatorInstance;
}

export function resetDemoGenerator(): void {
  generatorInstance = null;
}
