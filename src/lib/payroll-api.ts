// Payroll API client - calls the payroll_api Edge Function
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface PayrollApiResponse<T = any> {
  data?: T;
  error?: string;
  success?: boolean;
  [key: string]: any;
}

async function callPayrollApi<T = any>(action: string, body: Record<string, any> = {}): Promise<PayrollApiResponse<T>> {
  // Use anon key for Authorization - the Edge Function uses service role key internally
  // This avoids 401 errors from expired user session tokens
  const response = await fetch(`${SUPABASE_URL}/functions/v1/payroll_api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
    },
    body: JSON.stringify({ action, ...body }),
  });
  
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  
  if (!response.ok || result.error) {
    throw new Error(result.error || `Error ${response.status}`);
  }
  
  return result;
}

// ===== Public API methods =====

export const payrollApi = {
  // Setup: ensures all payroll tables exist in the database
  setup: () => callPayrollApi('setup', {}),

  createEntity: (groupId: string, data: {
    razon_social: string;
    nif: string;
    domicilio_fiscal: string;
    cnae?: string;
  }) => callPayrollApi('create_entity', { group_id: groupId, ...data }),

  createPayrollRun: (groupId: string, legalEntityId: string, year: number, month: number) =>
    callPayrollApi('create_payroll_run', {
      group_id: groupId,
      legal_entity_id: legalEntityId,
      period_year: year,
      period_month: month,
    }),

  saveEmployeeLegal: (employeeId: string, legalEntityId: string, data: {
    nif?: string;
    nss?: string;
    iban?: string;
    domicilio?: string;
  }) => callPayrollApi('save_employee_legal', {
    employee_id: employeeId,
    legal_entity_id: legalEntityId,
    ...data,
  }),

  createContract: (employeeId: string, legalEntityId: string, locationId: string, data: {
    contract_type?: string;
    base_salary_monthly?: string | number;
    group_ss?: string;
    category?: string;
    jornada_pct?: string | number;
    irpf_rate?: string | number;
  }) => callPayrollApi('create_contract', {
    employee_id: employeeId,
    legal_entity_id: legalEntityId,
    location_id: locationId,
    ...data,
  }),

  calculatePayroll: (payrollRunId: string) =>
    callPayrollApi('calculate', { payroll_run_id: payrollRunId }),

  updateStatus: (payrollRunId: string, status: string, userId?: string) =>
    callPayrollApi('update_status', {
      payroll_run_id: payrollRunId,
      status,
      user_id: userId,
    }),

  createSubmission: (payrollRunId: string, agency: string, isSandbox: boolean) =>
    callPayrollApi('create_submission', {
      payroll_run_id: payrollRunId,
      agency,
      is_sandbox: isSandbox,
    }),

  generateSEPA: (payrollRunId: string) =>
    callPayrollApi('generate_sepa', { payroll_run_id: payrollRunId }),
};
