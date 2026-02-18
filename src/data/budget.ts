/**
 * Data Access Layer — Budget
 *
 * Reads from `budget_daily_unified` + `sales_daily_unified` +
 * `labour_daily_unified` contract views.
 */

import { supabase, assertContext, hasNoLocations, applyFilters, toLegacyDataSource } from './client';
import { type QueryContext, type DateRange, type BudgetDailyRow, type BudgetVsActualRow } from './types';

// ─── getBudgetDaily ─────────────────────────────────────────────────────────

export async function getBudgetDaily(
  ctx: QueryContext,
  range: DateRange
): Promise<BudgetDailyRow[]> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return [];

  let query = supabase
    .from('budget_daily_unified' as any)
    .select('org_id, location_id, day, budget_sales, budget_labour, budget_cogs, budget_profit, budget_margin_pct, budget_col_pct, budget_cogs_pct')
    .order('day', { ascending: true });

  query = applyFilters(query, ctx.locationIds, range, 'day');

  const { data, error } = await query;
  if (error) {
    console.error('[data/budget] getBudgetDaily error:', error.message);
    return [];
  }

  return (data || []).map((r: any) => ({
    orgId: r.org_id,
    locationId: r.location_id,
    day: r.day,
    budgetSales: Number(r.budget_sales) || 0,
    budgetLabour: Number(r.budget_labour) || 0,
    budgetCogs: Number(r.budget_cogs) || 0,
    budgetProfit: Number(r.budget_profit) || 0,
    budgetMarginPct: Number(r.budget_margin_pct) || 0,
    budgetColPct: Number(r.budget_col_pct) || 0,
    budgetCogsPct: Number(r.budget_cogs_pct) || 0,
  }));
}

// ─── getBudgetVsActual ──────────────────────────────────────────────────────

/**
 * Combines budget targets with actual sales and labour data.
 * Reads `budget_daily_unified` + `sales_daily_unified` + `labour_daily_unified` + `cogs_daily`.
 */
export async function getBudgetVsActual(
  ctx: QueryContext,
  range: DateRange
): Promise<BudgetVsActualRow[]> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return [];

  const dsLegacy = toLegacyDataSource(ctx.dataSource);

  // Fetch budget, sales, labour, and cogs in parallel
  let budgetQ = supabase
    .from('budget_daily_unified' as any)
    .select('day, location_id, budget_sales, budget_labour, budget_cogs')
    .order('day', { ascending: true });
  budgetQ = applyFilters(budgetQ, ctx.locationIds, range, 'day');

  let salesQ = supabase
    .from('sales_daily_unified' as any)
    .select('date, location_id, net_sales')
    .eq('data_source', dsLegacy);
  salesQ = applyFilters(salesQ, ctx.locationIds, range, 'date');

  let labourQ = supabase
    .from('labour_daily_unified' as any)
    .select('day, location_id, actual_cost');
  labourQ = applyFilters(labourQ, ctx.locationIds, range, 'day');

  let cogsQ = supabase
    .from('cogs_daily')
    .select('date, location_id, cogs_amount');
  cogsQ = applyFilters(cogsQ, ctx.locationIds, range, 'date');

  const [budgetRes, salesRes, labourRes, cogsRes] = await Promise.all([
    budgetQ, salesQ, labourQ, cogsQ,
  ]);

  // Aggregate by day
  const byDay = new Map<string, BudgetVsActualRow>();

  for (const r of (budgetRes.data || []) as any[]) {
    const day = r.day;
    const existing = byDay.get(day) || { day, salesActual: 0, salesBudget: 0, labourActual: 0, labourBudget: 0, cogsActual: 0, cogsBudget: 0 };
    existing.salesBudget += Number(r.budget_sales) || 0;
    existing.labourBudget += Number(r.budget_labour) || 0;
    existing.cogsBudget += Number(r.budget_cogs) || 0;
    byDay.set(day, existing);
  }

  for (const r of (salesRes.data || []) as any[]) {
    const day = r.date;
    const existing = byDay.get(day) || { day, salesActual: 0, salesBudget: 0, labourActual: 0, labourBudget: 0, cogsActual: 0, cogsBudget: 0 };
    existing.salesActual += Number(r.net_sales) || 0;
    byDay.set(day, existing);
  }

  for (const r of (labourRes.data || []) as any[]) {
    const day = r.day;
    const existing = byDay.get(day) || { day, salesActual: 0, salesBudget: 0, labourActual: 0, labourBudget: 0, cogsActual: 0, cogsBudget: 0 };
    existing.labourActual += Number(r.actual_cost) || 0;
    byDay.set(day, existing);
  }

  for (const r of (cogsRes.data || []) as any[]) {
    const day = r.date;
    const existing = byDay.get(day) || { day, salesActual: 0, salesBudget: 0, labourActual: 0, labourBudget: 0, cogsActual: 0, cogsBudget: 0 };
    existing.cogsActual += Number(r.cogs_amount) || 0;
    byDay.set(day, existing);
  }

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}
