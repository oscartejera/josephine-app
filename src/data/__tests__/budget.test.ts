import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBudgetDaily, getBudgetVsActual } from '../budget';
import { type QueryContext, MissingOrgIdError } from '../types';

// ─── Mock Supabase ──────────────────────────────────────────────────────────

function createChainableMock(resolvedData: any[] = [], resolvedError: any = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
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
  orgId: 'org-1',
  locationIds: ['loc-1'],
  dataSource: 'demo',
};

const range = { from: '2026-02-01', to: '2026-02-07' };

describe('getBudgetDaily', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws MissingOrgIdError when orgId is missing', async () => {
    await expect(getBudgetDaily({ ...ctx, orgId: '' }, range)).rejects.toThrow(MissingOrgIdError);
  });

  it('returns empty array for no locations', async () => {
    const result = await getBudgetDaily({ ...ctx, locationIds: [] }, range);
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('maps rows to BudgetDailyRow DTOs', async () => {
    const mockData = [
      { org_id: 'org-1', location_id: 'loc-1', day: '2026-02-01', budget_sales: '1000', budget_labour: '250', budget_cogs: '300', budget_profit: '450', budget_margin_pct: '45', budget_col_pct: '25', budget_cogs_pct: '30' },
    ];
    mockFrom.mockReturnValue(createChainableMock(mockData));

    const result = await getBudgetDaily(ctx, range);
    expect(result).toHaveLength(1);
    expect(result[0].budgetSales).toBe(1000);
    expect(result[0].budgetLabour).toBe(250);
    expect(result[0].budgetProfit).toBe(450);
  });
});

describe('getBudgetVsActual', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty for no locations', async () => {
    const result = await getBudgetVsActual({ ...ctx, locationIds: [] }, range);
    expect(result).toEqual([]);
  });

  it('merges budget, sales, labour, and cogs by day', async () => {
    const budgetData = [
      { day: '2026-02-01', location_id: 'loc-1', budget_sales: '1000', budget_labour: '250', budget_cogs: '300' },
    ];
    const salesData = [
      { date: '2026-02-01', location_id: 'loc-1', net_sales: '950' },
    ];
    const labourData = [
      { day: '2026-02-01', location_id: 'loc-1', actual_cost: '260' },
    ];
    const cogsData = [
      { date: '2026-02-01', location_id: 'loc-1', cogs_amount: '290' },
    ];

    // mockFrom is called 4 times (budget, sales, labour, cogs)
    mockFrom
      .mockReturnValueOnce(createChainableMock(budgetData))
      .mockReturnValueOnce(createChainableMock(salesData))
      .mockReturnValueOnce(createChainableMock(labourData))
      .mockReturnValueOnce(createChainableMock(cogsData));

    const result = await getBudgetVsActual(ctx, range);

    expect(result).toHaveLength(1);
    expect(result[0].salesActual).toBe(950);
    expect(result[0].salesBudget).toBe(1000);
    expect(result[0].labourActual).toBe(260);
    expect(result[0].labourBudget).toBe(250);
    expect(result[0].cogsActual).toBe(290);
    expect(result[0].cogsBudget).toBe(300);
  });
});
