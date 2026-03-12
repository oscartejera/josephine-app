import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLowStockAlerts, createPurchaseOrderDraftFromAlerts } from '../inventory';
import { type QueryContext, MissingOrgIdError } from '../types';

// ─── Mock Supabase ──────────────────────────────────────────────────────────

function createChainableMock(resolvedData: any = [], resolvedError: any = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  const result = { data: resolvedData, error: resolvedError };
  chain.then = (resolve: any) => resolve(result);
  return chain;
}

const mockFrom = vi.fn();
const mockTypedFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

vi.mock('@/data/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/client')>();
  return {
    ...actual,
    typedFrom: (...args: any[]) => mockTypedFrom(...args),
  };
});

const ctx: QueryContext = {
  orgId: 'org-1',
  locationIds: ['loc-1'],
  dataSource: 'demo',
};

describe('getLowStockAlerts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws MissingOrgIdError when orgId is missing', async () => {
    await expect(getLowStockAlerts({ ...ctx, orgId: '' })).rejects.toThrow(MissingOrgIdError);
  });

  it('returns empty for no locations', async () => {
    const result = await getLowStockAlerts({ ...ctx, locationIds: [] });
    expect(result).toEqual([]);
  });

  it('filters and sorts items below par level', async () => {
    const mockData = [
      { item_id: 'item-1', name: 'Tomatoes', unit: 'kg', on_hand: '3', par_level: '10', location_id: 'loc-1', deficit: '7' },
      { item_id: 'item-2', name: 'Onions', unit: 'kg', on_hand: '8', par_level: '10', location_id: 'loc-1', deficit: '2' },
    ];

    mockTypedFrom.mockReturnValue(createChainableMock(mockData));

    const result = await getLowStockAlerts(ctx);

    expect(result).toHaveLength(2);
    // Should be sorted by deficit descending
    expect(result[0].itemName).toBe('Tomatoes');
    expect(result[0].deficit).toBe(7);
    expect(result[1].itemName).toBe('Onions');
    expect(result[1].deficit).toBe(2);
  });
});

describe('createPurchaseOrderDraftFromAlerts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws MissingOrgIdError when orgId is missing', async () => {
    await expect(
      createPurchaseOrderDraftFromAlerts({ ...ctx, orgId: '' }, {
        supplierId: 's1',
        locationId: 'loc-1',
        lines: [],
      })
    ).rejects.toThrow(MissingOrgIdError);
  });

  it('creates PO header and line items', async () => {
    // First call: idempotency check — no existing PO found
    const idempotencyCheck = createChainableMock(null);
    // Second call: insert PO header
    const poChain = createChainableMock({ id: 'po-1', status: 'draft' });
    // Third call: insert PO lines
    const linesChain = createChainableMock([]);

    mockFrom
      .mockReturnValueOnce(idempotencyCheck)
      .mockReturnValueOnce(poChain)
      .mockReturnValueOnce(linesChain);

    const result = await createPurchaseOrderDraftFromAlerts(ctx, {
      supplierId: 'supplier-1',
      locationId: 'loc-1',
      lines: [
        { itemId: 'item-1', qty: 10, priceEstimate: 2.50 },
        { itemId: 'item-2', qty: 5, priceEstimate: 1.00 },
      ],
    });

    expect(result.id).toBe('po-1');
    expect(result.status).toBe('draft');
    expect(result.totalLines).toBe(2);
    expect(mockFrom).toHaveBeenCalledTimes(3);
    expect(mockFrom).toHaveBeenCalledWith('purchase_orders');
    expect(mockFrom).toHaveBeenCalledWith('purchase_order_lines');
  });
});
