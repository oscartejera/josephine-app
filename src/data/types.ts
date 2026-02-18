/**
 * Data Access Layer — Shared Types
 *
 * All UI-facing DTOs and query parameters. The data layer is the single
 * source of truth for how the frontend talks to the database; hooks and
 * pages import from here, never from supabase.from("table") directly.
 */

// ─── Query Context ──────────────────────────────────────────────────────────

/** Every data function receives this to scope the query. */
export interface QueryContext {
  orgId: string;
  locationIds: string[];
  /** 'pos' | 'demo' — resolved by DemoModeContext / resolve_data_source RPC */
  dataSource: 'pos' | 'demo';
}

export interface DateRange {
  from: string; // ISO date 'YYYY-MM-DD'
  to: string;
}

// ─── Guard Errors ───────────────────────────────────────────────────────────

export class MissingOrgIdError extends Error {
  constructor() {
    super('org_id is required but was not provided');
    this.name = 'MissingOrgIdError';
  }
}

export class NoLocationsError extends Error {
  constructor() {
    super('No accessible locations — returning empty result');
    this.name = 'NoLocationsError';
  }
}

// ─── Sales DTOs ─────────────────────────────────────────────────────────────

export interface DashboardKpis {
  sales: number;
  grossSales: number;
  ordersCount: number;
  avgCheck: number;
  laborCost: number;
  laborHours: number;
  paymentsCash: number;
  paymentsCard: number;
  paymentsOther: number;
  refundsAmount: number;
  discountsAmount: number;
  compsAmount: number;
  voidsAmount: number;
}

export interface SalesDailyRow {
  orgId: string;
  locationId: string;
  day: string;
  netSales: number;
  grossSales: number;
  ordersCount: number;
  avgCheck: number;
  paymentsCash: number;
  paymentsCard: number;
  paymentsOther: number;
  refundsAmount: number;
  refundsCount: number;
  discountsAmount: number;
  compsAmount: number;
  voidsAmount: number;
  laborCost: number;
  laborHours: number;
  dataSource: string;
}

export interface SalesHourlyRow {
  orgId: string;
  locationId: string;
  day: string;
  hourBucket: string;
  hourOfDay: number;
  netSales: number;
  grossSales: number;
  ordersCount: number;
  covers: number;
  avgCheck: number;
  discounts: number;
  refunds: number;
  dataSource: string;
}

// ─── Forecast DTOs ──────────────────────────────────────────────────────────

export interface ForecastDailyRow {
  orgId: string;
  locationId: string;
  day: string;
  forecastSales: number;
  forecastOrders: number;
  plannedLaborHours: number;
  plannedLaborCost: number;
  forecastAvgCheck: number;
  forecastSalesLower: number;
  forecastSalesUpper: number;
  dataSource: string;
}

export interface ForecastVsActualRow {
  day: string;
  actualSales: number;
  forecastSales: number;
  forecastLower: number;
  forecastUpper: number;
  varianceEur: number;
  variancePct: number;
}

// ─── Budget DTOs ────────────────────────────────────────────────────────────

export interface BudgetDailyRow {
  orgId: string;
  locationId: string;
  day: string;
  budgetSales: number;
  budgetLabour: number;
  budgetCogs: number;
  budgetProfit: number;
  budgetMarginPct: number;
  budgetColPct: number;
  budgetCogsPct: number;
}

export interface BudgetVsActualRow {
  day: string;
  salesActual: number;
  salesBudget: number;
  labourActual: number;
  labourBudget: number;
  cogsActual: number;
  cogsBudget: number;
}

// ─── Labour DTOs ────────────────────────────────────────────────────────────

export interface LabourDailyRow {
  orgId: string;
  locationId: string;
  day: string;
  actualHours: number;
  actualCost: number;
  scheduledHours: number;
  scheduledCost: number;
  scheduledHeadcount: number;
  hoursVariance: number;
  costVariance: number;
  hoursVariancePct: number;
}

export interface LabourSummary {
  totalActualHours: number;
  totalActualCost: number;
  totalScheduledHours: number;
  totalScheduledCost: number;
  avgHeadcount: number;
  hoursVariancePct: number;
  costVariancePct: number;
  daily: LabourDailyRow[];
}

// ─── Product Sales DTOs ─────────────────────────────────────────────────────

export interface ProductSalesDailyRow {
  orgId: string;
  locationId: string;
  day: string;
  productId: string;
  productName: string;
  productCategory: string;
  unitsSold: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  dataSource: string;
}

// ─── Inventory DTOs ─────────────────────────────────────────────────────────

export interface LowStockAlert {
  itemId: string;
  itemName: string;
  locationId: string;
  currentStock: number;
  parLevel: number;
  deficit: number;
  unit: string;
}

export interface PurchaseOrderDraft {
  supplierId: string;
  locationId: string;
  lines: Array<{
    itemId: string;
    qty: number;
    priceEstimate: number;
  }>;
}

export interface PurchaseOrderResult {
  id: string;
  status: string;
  totalLines: number;
}

// ─── Payroll DTOs ───────────────────────────────────────────────────────────

export interface PayrollRun {
  id: string;
  groupId: string;
  legalEntityId: string;
  periodYear: number;
  periodMonth: number;
  status: string;
  createdAt: string;
}

export interface PayrollRunDraftParams {
  legalEntityId: string;
  periodYear: number;
  periodMonth: number;
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName?: string;
  grossPay: number;
  netPay: number;
  irpfWithheld: number;
  employeeSs: number;
  employerSs: number;
  otherDeductions: number;
}

// ─── Empty result helpers ───────────────────────────────────────────────────

export const EMPTY_DASHBOARD_KPIS: DashboardKpis = {
  sales: 0,
  grossSales: 0,
  ordersCount: 0,
  avgCheck: 0,
  laborCost: 0,
  laborHours: 0,
  paymentsCash: 0,
  paymentsCard: 0,
  paymentsOther: 0,
  refundsAmount: 0,
  discountsAmount: 0,
  compsAmount: 0,
  voidsAmount: 0,
};

export const EMPTY_LABOUR_SUMMARY: LabourSummary = {
  totalActualHours: 0,
  totalActualCost: 0,
  totalScheduledHours: 0,
  totalScheduledCost: 0,
  avgHeadcount: 0,
  hoursVariancePct: 0,
  costVariancePct: 0,
  daily: [],
};
