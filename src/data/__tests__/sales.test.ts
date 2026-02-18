import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDashboardKpis, getSalesTrends } from '../sales';
import { type QueryContext, EMPTY_DASHBOARD_KPIS, MissingOrgIdError } from '../types';

// ─── Mock Supabase client ───────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();

function createChainableMock(resolvedData: any[] = [], resolvedError: any = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: undefined as any,
  };

  // Make it thenable — when awaited, resolve with { data, error }
  const result = { data: resolvedData, error: resolvedError };
  chain.then = (resolve: any) => resolve(result);
  // Also support direct access to data/error
  Object.defineProperty(chain, 'data', { get: () => resolvedData });
  Object.defineProperty(chain, 'error', { get: () => resolvedError });

  return chain;
}

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

// ─── Test Context ───────────────────────────────────────────────────────────

const validCtx: QueryContext = {
  orgId: 'org-123',
  locationIds: ['loc-1', 'loc-2'],
  dataSource: 'demo',
};

const emptyLocCtx: QueryContext = {
  orgId: 'org-123',
  locationIds: [],
  dataSource: 'demo',
};

const noOrgCtx: QueryContext = {
  orgId: '',
  locationIds: ['loc-1'],
  dataSource: 'demo',
};

const range = { from: '2026-02-01', to: '2026-02-14' };

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('getDashboardKpis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws MissingOrgIdError when orgId is empty', async () => {
    await expect(getDashboardKpis(noOrgCtx, range)).rejects.toThrow(MissingOrgIdError);
  });

  it('returns EMPTY_DASHBOARD_KPIS when locationIds is empty', async () => {
    const result = await getDashboardKpis(emptyLocCtx, range);
    expect(result).toEqual(EMPTY_DASHBOARD_KPIS);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('aggregates sales data from contract view', async () => {
    const mockData = [
      { net_sales: '1000.00', gross_sales: '1200.00', orders_count: '50', avg_check: '20.00', payments_cash: '300', payments_card: '700', payments_other: '0', refunds_amount: '10', discounts_amount: '20', comps_amount: '5', voids_amount: '3', labor_cost: '250', labor_hours: '30' },
      { net_sales: '800.00', gross_sales: '950.00', orders_count: '40', avg_check: '20.00', payments_cash: '200', payments_card: '600', payments_other: '0', refunds_amount: '5', discounts_amount: '15', comps_amount: '0', voids_amount: '2', labor_cost: '200', labor_hours: '25' },
    ];

    mockFrom.mockReturnValue(createChainableMock(mockData));

    const result = await getDashboardKpis(validCtx, range);

    expect(mockFrom).toHaveBeenCalledWith('sales_daily_unified');
    expect(result.sales).toBe(1800);
    expect(result.grossSales).toBe(2150);
    expect(result.ordersCount).toBe(90);
    expect(result.avgCheck).toBe(20);
    expect(result.laborCost).toBe(450);
    expect(result.laborHours).toBe(55);
    expect(result.paymentsCash).toBe(500);
    expect(result.paymentsCard).toBe(1300);
  });

  it('returns EMPTY_DASHBOARD_KPIS on query error', async () => {
    mockFrom.mockReturnValue(createChainableMock(null, { message: 'DB error' }));

    const result = await getDashboardKpis(validCtx, range);
    expect(result).toEqual(EMPTY_DASHBOARD_KPIS);
  });

  it('returns EMPTY_DASHBOARD_KPIS on empty result set', async () => {
    mockFrom.mockReturnValue(createChainableMock([]));

    const result = await getDashboardKpis(validCtx, range);
    expect(result).toEqual(EMPTY_DASHBOARD_KPIS);
  });
});

describe('getSalesTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when locationIds is empty', async () => {
    const result = await getSalesTrends(emptyLocCtx, range, 'daily');
    expect(result).toEqual([]);
  });

  it('maps daily rows to SalesDailyRow DTOs', async () => {
    const mockData = [
      { org_id: 'org-123', location_id: 'loc-1', date: '2026-02-01', net_sales: '500', gross_sales: '600', orders_count: '25', avg_check: '20', payments_cash: '100', payments_card: '400', payments_other: '0', refunds_amount: '5', refunds_count: '1', discounts_amount: '10', comps_amount: '0', voids_amount: '0', labor_cost: '100', labor_hours: '12', data_source: 'simulated' },
    ];

    mockFrom.mockReturnValue(createChainableMock(mockData));

    const result = await getSalesTrends(validCtx, range, 'daily');

    expect(result).toHaveLength(1);
    const row = result[0] as any;
    expect(row.orgId).toBe('org-123');
    expect(row.locationId).toBe('loc-1');
    expect(row.day).toBe('2026-02-01');
    expect(row.netSales).toBe(500);
  });
});
