/**
 * Data Access Layer — Barrel Export
 *
 * Usage:
 *   import { getDashboardKpis, buildQueryContext } from '@/data';
 */

// Types
export type {
  QueryContext,
  DateRange,
  DashboardKpis,
  SalesDailyRow,
  SalesHourlyRow,
  ForecastDailyRow,
  ForecastVsActualRow,
  BudgetDailyRow,
  BudgetVsActualRow,
  LabourDailyRow,
  LabourSummary,
  ProductSalesDailyRow,
  LowStockAlert,
  PurchaseOrderDraft,
  PurchaseOrderResult,
  PayrollRun,
  PayrollRunDraftParams,
  Payslip,
} from './types';

export {
  MissingOrgIdError,
  NoLocationsError,
  EMPTY_DASHBOARD_KPIS,
  EMPTY_LABOUR_SUMMARY,
} from './types';

// Client helpers
export { buildQueryContext, assertContext, hasNoLocations } from './client';

// Sales
export { getDashboardKpis, getSalesTrends } from './sales';

// Forecast
export { getForecastDaily, getForecastVsActual } from './forecast';

// Budget
export { getBudgetDaily, getBudgetVsActual } from './budget';

// Labour
export { getLabourDaily, getLabourSummary } from './labour';

// Inventory
export { getLowStockAlerts, createPurchaseOrderDraftFromAlerts } from './inventory';

// Payroll
export {
  listPayrollRuns,
  generatePayrollRunDraft,
  approvePayrollRun,
  listPayslips,
  getMyPayslips,
} from './payroll';

// Guards (React hooks — only import in components)
export { useQueryContext } from './guards';
