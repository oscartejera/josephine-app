import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPayrollRuns, approvePayrollRun, listPayslips } from '../payroll';
import { type QueryContext, MissingOrgIdError } from '../types';

// ─── Mock Supabase ──────────────────────────────────────────────────────────

function createChainableMock(resolvedData: any = [], resolvedError: any = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
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
  orgId: 'org-1',
  locationIds: ['loc-1'],
  dataSource: 'demo',
};

describe('listPayrollRuns', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws MissingOrgIdError when orgId is missing', async () => {
    await expect(listPayrollRuns({ ...ctx, orgId: '' }, 'entity-1')).rejects.toThrow(MissingOrgIdError);
  });

  it('maps rows to PayrollRun DTOs', async () => {
    const mockData = [
      { id: 'run-1', group_id: 'org-1', legal_entity_id: 'entity-1', period_year: 2026, period_month: 2, status: 'draft', created_at: '2026-02-01T00:00:00Z' },
    ];
    mockFrom.mockReturnValue(createChainableMock(mockData));

    const result = await listPayrollRuns(ctx, 'entity-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('run-1');
    expect(result[0].periodYear).toBe(2026);
    expect(result[0].status).toBe('draft');
  });
});

describe('approvePayrollRun', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws MissingOrgIdError when orgId is missing', async () => {
    await expect(approvePayrollRun({ ...ctx, orgId: '' }, 'run-1', 'user-1')).rejects.toThrow(MissingOrgIdError);
  });

  it('calls update with approved status', async () => {
    mockFrom.mockReturnValue(createChainableMock(null, null));

    await approvePayrollRun(ctx, 'run-1', 'user-1');
    expect(mockFrom).toHaveBeenCalledWith('payroll_runs');
  });
});

describe('listPayslips', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enriches payslips with employee names', async () => {
    const payslipData = [
      { id: 'ps-1', payroll_run_id: 'run-1', employee_id: 'emp-1', gross_pay: '2500', net_pay: '1800', irpf_withheld: '400', employee_ss: '150', employer_ss: '300', other_deductions: '50' },
    ];
    const employeeData = [
      { id: 'emp-1', full_name: 'María García' },
    ];

    mockFrom
      .mockReturnValueOnce(createChainableMock(payslipData))
      .mockReturnValueOnce(createChainableMock(employeeData));

    const result = await listPayslips(ctx, 'run-1');

    expect(result).toHaveLength(1);
    expect(result[0].employeeName).toBe('María García');
    expect(result[0].grossPay).toBe(2500);
    expect(result[0].netPay).toBe(1800);
  });

  it('returns empty array when no payslips exist', async () => {
    mockFrom.mockReturnValue(createChainableMock([]));

    const result = await listPayslips(ctx, 'run-nonexistent');
    expect(result).toEqual([]);
  });
});
