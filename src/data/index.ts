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
  SalesTimeseriesRpcResult,
  TopProductsRpcResult,
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
  KpiPeriodSummary,
  KpiRangeSummary,
} from './types';

export {
  MissingOrgIdError,
  NoLocationsError,
  EMPTY_DASHBOARD_KPIS,
  EMPTY_LABOUR_SUMMARY,
} from './types';

// Client helpers
export { buildQueryContext, assertContext, hasNoLocations, toLegacyDataSource } from './client';

// Sales
export { getDashboardKpis, getSalesTrends, getProductSalesDaily, getSalesTimeseriesRpc, getTopProductsRpc, getInstantPnlRpc, getMenuEngineeringSummaryRpc } from './sales';

// Forecast
export { getForecastDaily, getForecastVsActual } from './forecast';

// Budget
export { getBudgetDaily, getBudgetVsActual } from './budget';

// Labour
export { getLabourDaily, getLabourSummary, getLabourKpisRpc, getLabourTimeseriesRpc, getLabourLocationsRpc, getLaborPlanRpc } from './labour';

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

// KPI Contract
export { getKpiRangeSummary, getKpiDaily } from './kpi';

// Reconciliation
export type {
  ReconciliationLineRpc,
  ReconciliationHeaderRpc,
  ReconciliationTotalsRpc,
  ReconciliationSummary,
} from './reconciliation';
export { getReconciliationSummary, EMPTY_RECONCILIATION_SUMMARY } from './reconciliation';

// Guards (React hooks — only import in components)
export { useQueryContext } from './guards';
