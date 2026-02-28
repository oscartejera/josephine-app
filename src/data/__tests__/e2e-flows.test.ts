/**
 * E2E-style integration tests for the data access layer.
 *
 * These test complete user flows end-to-end through the data layer:
 *   1. Dashboard load: fetch KPIs → verify shape
 *   2. Low stock → create PO draft
 *   3. Payroll run → issue payslips
 *
 * Uses mocked Supabase client to simulate DB responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDashboardKpis, getSalesTrends, type QueryContext, type DateRange } from '../index';
import { getLowStockAlerts, createPurchaseOrderDraftFromAlerts } from '../inventory';
import { listPayrollRuns, generatePayrollRunDraft, approvePayrollRun, listPayslips } from '../payroll';

// ─── Mock Supabase ──────────────────────────────────────────────────────────

function createChainableMock(resolvedData: any = [], resolvedError: any = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  const result = { data: resolvedData, error: resolvedError };
  chain.then = (resolve: any) => resolve(result);
  return chain;
}

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

const ctx: QueryContext = {
  orgId: 'org-test',
  locationIds: ['loc-centro', 'loc-norte'],
  dataSource: 'demo',
};
const range: DateRange = { from: '2026-02-01', to: '2026-02-14' };

// ─── Flow 1: Dashboard Load ────────────────────────────────────────────────

describe('E2E Flow: Dashboard Load', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads KPIs and daily trends for the dashboard', async () => {
    const kpiData = [
      { net_sales: '5000', gross_sales: '6000', orders_count: '200', avg_check: '25', payments_cash: '1500', payments_card: '3500', payments_other: '0', refunds_amount: '50', discounts_amount: '100', comps_amount: '20', voids_amount: '10', labor_cost: '1200', labor_hours: '150' },
      { net_sales: '4000', gross_sales: '4800', orders_count: '160', avg_check: '25', payments_cash: '1000', payments_card: '3000', payments_other: '0', refunds_amount: '30', discounts_amount: '80', comps_amount: '10', voids_amount: '5', labor_cost: '1000', labor_hours: '120' },
    ];

    const trendData = [
      { org_id: 'org-test', location_id: 'loc-centro', date: '2026-02-01', net_sales: '500', gross_sales: '600', orders_count: '25', avg_check: '20', payments_cash: '100', payments_card: '400', payments_other: '0', refunds_amount: '5', refunds_count: '1', discounts_amount: '10', comps_amount: '0', voids_amount: '0', labor_cost: '100', labor_hours: '12', data_source: 'demo' },
    ];

    // Step 1: Load KPIs
    mockFrom.mockReturnValue(createChainableMock(kpiData));
    const kpis = await getDashboardKpis(ctx, range);

    expect(kpis.sales).toBe(9000);
    expect(kpis.grossSales).toBe(10800);
    expect(kpis.ordersCount).toBe(360);
    expect(kpis.avgCheck).toBe(25);
    expect(kpis.laborCost).toBe(2200);

    // Step 2: Load daily trends
    mockFrom.mockReturnValue(createChainableMock(trendData));
    const trends = await getSalesTrends(ctx, range, 'daily');

    expect(trends.length).toBeGreaterThan(0);
    const firstDay = trends[0] as any;
    expect(firstDay.orgId).toBe('org-test');
    expect(firstDay.netSales).toBe(500);
  });
});

// ─── Flow 2: Low Stock → Create PO Draft ────────────────────────────────────

describe('E2E Flow: Low Stock → Create PO Draft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects low stock and creates a purchase order draft', async () => {
    // Step 1: Get low stock alerts
    const inventoryData = [
      { id: 'item-tomato', name: 'Tomates', unit: 'kg', current_stock: '2', par_level: '15', group_id: 'org-test' },
      { id: 'item-onion', name: 'Cebollas', unit: 'kg', current_stock: '5', par_level: '20', group_id: 'org-test' },
      { id: 'item-salt', name: 'Sal', unit: 'kg', current_stock: '50', par_level: '10', group_id: 'org-test' }, // above par
    ];

    mockFrom.mockReturnValue(createChainableMock(inventoryData));
    const alerts = await getLowStockAlerts(ctx);

    expect(alerts).toHaveLength(2);
    expect(alerts[0].itemName).toBe('Cebollas'); // highest deficit (15)
    expect(alerts[0].deficit).toBe(15);
    expect(alerts[1].itemName).toBe('Tomates'); // deficit = 13
    expect(alerts[1].deficit).toBe(13);

    // Step 2: Build PO draft from the alerts
    const draft = {
      supplierId: 'supplier-mercamadrid',
      locationId: 'loc-centro',
      lines: alerts.map(a => ({
        itemId: a.itemId,
        qty: a.deficit,
        priceEstimate: 2.0,
      })),
    };

    // Mock PO header insert
    const poHeaderMock = createChainableMock({ id: 'po-new-1', status: 'draft' });
    // Mock PO lines insert
    const poLinesMock = createChainableMock([]);

    mockFrom
      .mockReturnValueOnce(poHeaderMock)
      .mockReturnValueOnce(poLinesMock);

    const result = await createPurchaseOrderDraftFromAlerts(ctx, draft);

    expect(result.id).toBe('po-new-1');
    expect(result.status).toBe('draft');
    expect(result.totalLines).toBe(2);
  });
});

// ─── Flow 3: Payroll Run → Issue Payslips ────────────────────────────────────

describe('E2E Flow: Payroll Run → Issue Payslips', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a payroll run, approves it, and lists payslips', async () => {
    const legalEntityId = 'entity-tapas-sl';

    // Step 1: Check existing runs (expect none for March)
    mockFrom.mockReturnValue(createChainableMock([]));
    const existingRuns = await listPayrollRuns(ctx, legalEntityId);
    expect(existingRuns).toHaveLength(0);

    // Step 2: Generate draft payroll run
    const newRun = { id: 'run-march-2026', group_id: 'org-test', legal_entity_id: legalEntityId, period_year: 2026, period_month: 3, status: 'draft', created_at: '2026-03-01T00:00:00Z' };
    mockFrom.mockReturnValue(createChainableMock(newRun));
    const draft = await generatePayrollRunDraft(ctx, legalEntityId, 2026, 3);
    expect(draft.id).toBe('run-march-2026');
    expect(draft.status).toBe('draft');

    // Step 3: Approve the run
    mockFrom.mockReturnValue(createChainableMock(null, null));
    await approvePayrollRun(ctx, draft.id, 'user-owner');
    // No error thrown = success

    // Step 4: List payslips
    const payslipData = [
      { id: 'ps-1', payroll_run_id: 'run-march-2026', employee_id: 'emp-1', gross_pay: '2500', net_pay: '1800', irpf_withheld: '400', employee_ss: '150', employer_ss: '300', other_deductions: '50' },
      { id: 'ps-2', payroll_run_id: 'run-march-2026', employee_id: 'emp-2', gross_pay: '2000', net_pay: '1500', irpf_withheld: '300', employee_ss: '120', employer_ss: '250', other_deductions: '30' },
    ];
    const employeeData = [
      { id: 'emp-1', full_name: 'Ana Martínez' },
      { id: 'emp-2', full_name: 'Carlos López' },
    ];

    mockFrom
      .mockReturnValueOnce(createChainableMock(payslipData))
      .mockReturnValueOnce(createChainableMock(employeeData));

    const payslips = await listPayslips(ctx, draft.id);

    expect(payslips).toHaveLength(2);
    expect(payslips[0].employeeName).toBe('Ana Martínez');
    expect(payslips[0].grossPay).toBe(2500);
    expect(payslips[1].employeeName).toBe('Carlos López');
    expect(payslips[1].netPay).toBe(1500);
  });
});
