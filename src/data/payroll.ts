/**
 * Data Access Layer — Payroll
 *
 * Wraps direct supabase.from() calls for payroll tables.
 * Complex operations (calculate, SEPA) go through the Edge Function
 * via payroll-api.ts; this module handles the simple CRUD reads.
 */

import { supabase, assertContext } from './client';
import { type QueryContext, type PayrollRun, type Payslip } from './types';

// ─── listPayrollRuns ────────────────────────────────────────────────────────

/**
 * List payroll runs for a legal entity, ordered by period desc.
 */
export async function listPayrollRuns(
  ctx: QueryContext,
  legalEntityId: string
): Promise<PayrollRun[]> {
  assertContext(ctx);

  const { data, error } = await supabase
    .from('payroll_runs')
    .select('id, group_id, legal_entity_id, period_year, period_month, status, created_at')
    .eq('legal_entity_id', legalEntityId)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false });

  if (error) {
    console.error('[data/payroll] listPayrollRuns error:', error.message);
    return [];
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    groupId: r.group_id,
    legalEntityId: r.legal_entity_id,
    periodYear: r.period_year,
    periodMonth: r.period_month,
    status: r.status,
    createdAt: r.created_at,
  }));
}

// ─── generatePayrollRunDraft ────────────────────────────────────────────────

/**
 * Creates a draft payroll run. The actual calculation is done via
 * the payroll Edge Function (payroll-api.ts calculatePayroll).
 * This just creates the run record with status='draft'.
 */
export async function generatePayrollRunDraft(
  ctx: QueryContext,
  legalEntityId: string,
  periodYear: number,
  periodMonth: number
): Promise<PayrollRun> {
  assertContext(ctx);

  const { data, error } = await supabase
    .from('payroll_runs')
    .insert({
      group_id: ctx.orgId,
      legal_entity_id: legalEntityId,
      period_year: periodYear,
      period_month: periodMonth,
      status: 'draft',
    })
    .select('id, group_id, legal_entity_id, period_year, period_month, status, created_at')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create payroll run: ${error?.message || 'no data returned'}`);
  }

  return {
    id: data.id,
    groupId: data.group_id,
    legalEntityId: data.legal_entity_id,
    periodYear: data.period_year,
    periodMonth: data.period_month,
    status: data.status,
    createdAt: data.created_at,
  };
}

// ─── approvePayrollRun ──────────────────────────────────────────────────────

export async function approvePayrollRun(
  ctx: QueryContext,
  runId: string,
  approvedBy: string
): Promise<void> {
  assertContext(ctx);

  const { error } = await supabase
    .from('payroll_runs')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })
    .eq('id', runId);

  if (error) {
    throw new Error(`Failed to approve payroll run: ${error.message}`);
  }
}

// ─── listPayslips ───────────────────────────────────────────────────────────

/**
 * List payslips for a specific payroll run.
 * Enriches with employee names via a separate query.
 */
export async function listPayslips(
  ctx: QueryContext,
  runId: string
): Promise<Payslip[]> {
  assertContext(ctx);

  const { data: payslips, error } = await supabase
    .from('payslips')
    .select('id, payroll_run_id, employee_id, gross_pay, net_pay, irpf_withheld, employee_ss, employer_ss, other_deductions')
    .eq('payroll_run_id', runId);

  if (error) {
    console.error('[data/payroll] listPayslips error:', error.message);
    return [];
  }

  if (!payslips || payslips.length === 0) return [];

  // Enrich with employee names
  const empIds = [...new Set(payslips.map((p: any) => p.employee_id))];
  const { data: employees } = await supabase
    .from('employees')
    .select('id, full_name')
    .in('id', empIds);

  const nameMap = new Map<string, string>();
  (employees || []).forEach((e: any) => nameMap.set(e.id, e.full_name));

  return payslips.map((r: any) => ({
    id: r.id,
    payrollRunId: r.payroll_run_id,
    employeeId: r.employee_id,
    employeeName: nameMap.get(r.employee_id) || 'Unknown',
    grossPay: Number(r.gross_pay) || 0,
    netPay: Number(r.net_pay) || 0,
    irpfWithheld: Number(r.irpf_withheld) || 0,
    employeeSs: Number(r.employee_ss) || 0,
    employerSs: Number(r.employer_ss) || 0,
    otherDeductions: Number(r.other_deductions) || 0,
  }));
}

// ─── getMyPayslips ──────────────────────────────────────────────────────────

/**
 * Get payslips for a specific employee (the logged-in user).
 * Looks up the employee record by user_id, then fetches their payslips.
 */
export async function getMyPayslips(
  ctx: QueryContext,
  userId: string
): Promise<Payslip[]> {
  assertContext(ctx);

  // Find the employee record linked to this user
  const { data: employee } = await supabase
    .from('employees')
    .select('id, full_name')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!employee) return [];

  const { data: payslips, error } = await supabase
    .from('payslips')
    .select('id, payroll_run_id, employee_id, gross_pay, net_pay, irpf_withheld, employee_ss, employer_ss, other_deductions')
    .eq('employee_id', employee.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[data/payroll] getMyPayslips error:', error.message);
    return [];
  }

  return (payslips || []).map((r: any) => ({
    id: r.id,
    payrollRunId: r.payroll_run_id,
    employeeId: r.employee_id,
    employeeName: employee.full_name,
    grossPay: Number(r.gross_pay) || 0,
    netPay: Number(r.net_pay) || 0,
    irpfWithheld: Number(r.irpf_withheld) || 0,
    employeeSs: Number(r.employee_ss) || 0,
    employerSs: Number(r.employer_ss) || 0,
    otherDeductions: Number(r.other_deductions) || 0,
  }));
}
