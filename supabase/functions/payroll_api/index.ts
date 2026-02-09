// Payroll API Edge Function
// Handles all payroll operations with service role key (bypasses RLS)
// Implements Spanish payroll calculations per Convenio Colectivo de Hostelería

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ===== SPANISH PAYROLL CONSTANTS (2025/2026) =====

// Social Security contribution rates
const SS_RATES = {
  employee: {
    contingencias_comunes: 0.0470,
    desempleo_indefinido: 0.0155,
    desempleo_temporal: 0.0160,
    formacion_profesional: 0.0010,
    mei: 0.0013, // Mecanismo de Equidad Intergeneracional
  },
  employer: {
    contingencias_comunes: 0.2360,
    desempleo_indefinido: 0.0550,
    desempleo_temporal: 0.0670,
    at_ep: 0.0150, // Accidentes de Trabajo (CNAE 5610 restaurantes)
    fogasa: 0.0020,
    formacion_profesional: 0.0060,
    mei: 0.0067,
  },
};

// IRPF brackets (national, 2025/2026)
const IRPF_BRACKETS = [
  { upTo: 12450, rate: 0.19 },
  { upTo: 20200, rate: 0.24 },
  { upTo: 35200, rate: 0.30 },
  { upTo: 60000, rate: 0.37 },
  { upTo: 300000, rate: 0.45 },
  { upTo: Infinity, rate: 0.47 },
];

// Minimum personal deduction (mínimo personal)
const IRPF_MINIMO_PERSONAL = 5550;
// Additional for first child, second child, etc.
const IRPF_MINIMOS_HIJOS = [2400, 2700, 4000, 4500];

// Contribution base limits (2025/2026)
const CONTRIBUTION_BASE = {
  max_monthly: 4909.50,
  min_monthly: 1381.20, // SMI + 1/6
};

// SMI 2025/2026
const SMI_MONTHLY_14 = 1184; // In 14 payments
const SMI_ANNUAL = 16576;

// Hostelería salary reference tables (Madrid convenio, approximate 2025)
const SALARY_TABLES: Record<string, number> = {
  'Director': 2800,
  'Jefe de Cocina': 2400,
  'Jefe de Sala': 2200,
  'Segundo Jefe': 2000,
  'Chef': 1850,
  'Cocinero': 1650,
  'Camarero': 1500,
  'Barman': 1550,
  'Host': 1400,
  'Ayudante de Cocina': 1350,
  'Ayudante de Camarero': 1350,
  'Server': 1500,
  'Bartender': 1550,
  'Manager': 2200,
};

// ===== HELPER FUNCTIONS =====

function calculateIRPFRate(annualGross: number, personalSituation: number = 0): number {
  // Calculate taxable base
  const taxableBase = Math.max(0, annualGross - IRPF_MINIMO_PERSONAL);
  
  if (taxableBase <= 0) return 0;
  
  // Calculate total tax using progressive brackets
  let totalTax = 0;
  let remainingBase = taxableBase;
  let prevLimit = 0;
  
  for (const bracket of IRPF_BRACKETS) {
    const bracketSize = bracket.upTo - prevLimit;
    const taxableInBracket = Math.min(remainingBase, bracketSize);
    totalTax += taxableInBracket * bracket.rate;
    remainingBase -= taxableInBracket;
    prevLimit = bracket.upTo;
    if (remainingBase <= 0) break;
  }
  
  // Effective rate
  const effectiveRate = totalTax / annualGross;
  return Math.round(effectiveRate * 10000) / 10000; // 4 decimal places
}

function calculateSSEmployee(baseCotizacion: number, contractType: string): {
  total: number;
  contingencias_comunes: number;
  desempleo: number;
  formacion: number;
  mei: number;
} {
  const cc = baseCotizacion * SS_RATES.employee.contingencias_comunes;
  const desempleo = baseCotizacion * (
    contractType === 'temporal' || contractType === 'formacion'
      ? SS_RATES.employee.desempleo_temporal
      : SS_RATES.employee.desempleo_indefinido
  );
  const fp = baseCotizacion * SS_RATES.employee.formacion_profesional;
  const mei = baseCotizacion * SS_RATES.employee.mei;
  
  return {
    total: round2(cc + desempleo + fp + mei),
    contingencias_comunes: round2(cc),
    desempleo: round2(desempleo),
    formacion: round2(fp),
    mei: round2(mei),
  };
}

function calculateSSEmployer(baseCotizacion: number, contractType: string): {
  total: number;
  contingencias_comunes: number;
  at_ep: number;
  desempleo: number;
  fogasa: number;
  formacion: number;
  mei: number;
} {
  const cc = baseCotizacion * SS_RATES.employer.contingencias_comunes;
  const atep = baseCotizacion * SS_RATES.employer.at_ep;
  const desempleo = baseCotizacion * (
    contractType === 'temporal' || contractType === 'formacion'
      ? SS_RATES.employer.desempleo_temporal
      : SS_RATES.employer.desempleo_indefinido
  );
  const fogasa = baseCotizacion * SS_RATES.employer.fogasa;
  const fp = baseCotizacion * SS_RATES.employer.formacion_profesional;
  const mei = baseCotizacion * SS_RATES.employer.mei;
  
  return {
    total: round2(cc + atep + desempleo + fogasa + fp + mei),
    contingencias_comunes: round2(cc),
    at_ep: round2(atep),
    desempleo: round2(desempleo),
    fogasa: round2(fogasa),
    formacion: round2(fp),
    mei: round2(mei),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampContributionBase(base: number): number {
  return Math.min(
    Math.max(base, CONTRIBUTION_BASE.min_monthly),
    CONTRIBUTION_BASE.max_monthly
  );
}

// ===== ACTION HANDLERS =====

async function handleCreateEntity(body: any) {
  const { group_id, razon_social, nif, domicilio_fiscal, cnae } = body;
  
  if (!group_id || !razon_social || !nif || !domicilio_fiscal) {
    return { error: 'Faltan campos obligatorios: razón social, NIF y domicilio fiscal' };
  }
  
  // Validate NIF format (basic)
  const nifRegex = /^[A-Z]\d{7}[A-Z0-9]$/i;
  if (!nifRegex.test(nif)) {
    return { error: 'Formato de NIF inválido. Debe ser letra + 7 dígitos + letra/dígito (ej: B12345678)' };
  }
  
  const { data, error } = await supabase
    .from('legal_entities')
    .insert({
      group_id,
      razon_social,
      nif: nif.toUpperCase(),
      domicilio_fiscal,
      cnae: cnae || '5610',
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating entity:', error);
    if (error.code === '23505') {
      return { error: 'Ya existe una entidad con ese NIF' };
    }
    return { error: `Error al crear entidad: ${error.message}` };
  }
  
  return { data };
}

async function handleCreatePayrollRun(body: any) {
  const { group_id, legal_entity_id, period_year, period_month } = body;
  
  if (!group_id || !legal_entity_id || !period_year || !period_month) {
    return { error: 'Faltan campos obligatorios' };
  }
  
  // Check if run already exists
  const { data: existing } = await supabase
    .from('payroll_runs')
    .select('id, status')
    .eq('legal_entity_id', legal_entity_id)
    .eq('period_year', period_year)
    .eq('period_month', period_month)
    .maybeSingle();
  
  if (existing) {
    return { data: existing };
  }
  
  const { data, error } = await supabase
    .from('payroll_runs')
    .insert({ group_id, legal_entity_id, period_year, period_month, status: 'draft' })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating payroll run:', error);
    return { error: `Error al crear nómina: ${error.message}` };
  }
  
  return { data };
}

async function handleSaveEmployeeLegal(body: any) {
  const { employee_id, legal_entity_id, nif, nss, iban, domicilio } = body;
  
  if (!employee_id || !legal_entity_id) {
    return { error: 'Falta employee_id o legal_entity_id' };
  }
  
  const { data, error } = await supabase
    .from('employee_legal')
    .upsert({
      employee_id,
      legal_entity_id,
      nif: nif || null,
      nss: nss || null,
      iban: iban || null,
      domicilio: domicilio || null,
    }, { onConflict: 'employee_id,legal_entity_id' })
    .select()
    .single();
  
  if (error) {
    console.error('Error saving employee legal data:', error);
    return { error: `Error al guardar datos: ${error.message}` };
  }
  
  return { data };
}

async function handleCreateContract(body: any) {
  const { 
    employee_id, legal_entity_id, location_id, 
    contract_type, base_salary_monthly, group_ss, category,
    jornada_pct, irpf_rate 
  } = body;
  
  if (!employee_id || !legal_entity_id) {
    return { error: 'Falta employee_id o legal_entity_id' };
  }
  
  // Deactivate previous contracts for this employee
  await supabase
    .from('employment_contracts')
    .update({ active: false })
    .eq('employee_id', employee_id)
    .eq('active', true);
  
  const salary = parseFloat(base_salary_monthly) || SALARY_TABLES[category] || SMI_MONTHLY_14;
  
  // Auto-calculate IRPF rate if not provided
  const annualGross = salary * 14; // 14 pagas
  const autoIrpfRate = calculateIRPFRate(annualGross);
  
  const { data, error } = await supabase
    .from('employment_contracts')
    .insert({
      employee_id,
      legal_entity_id,
      location_id,
      start_date: new Date().toISOString().split('T')[0],
      contract_type: contract_type || 'indefinido',
      base_salary_monthly: salary,
      group_ss: group_ss || '5',
      category: category || 'Camarero',
      jornada_pct: parseFloat(jornada_pct) || 100,
      irpf_rate: irpf_rate ? parseFloat(irpf_rate) : round2(autoIrpfRate * 100),
      active: true,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating contract:', error);
    return { error: `Error al crear contrato: ${error.message}` };
  }
  
  return { data, auto_irpf_rate: round2(autoIrpfRate * 100) };
}

async function handleCalculatePayroll(body: any) {
  const { payroll_run_id } = body;
  
  if (!payroll_run_id) {
    return { error: 'Falta payroll_run_id' };
  }
  
  // 1. Get the payroll run
  const { data: run, error: runError } = await supabase
    .from('payroll_runs')
    .select('*, legal_entities(razon_social, nif, cnae)')
    .eq('id', payroll_run_id)
    .single();
  
  if (runError || !run) {
    return { error: 'Nómina no encontrada' };
  }
  
  // 2. Get all active employees with contracts for this legal entity
  const { data: contracts, error: contractsError } = await supabase
    .from('employment_contracts')
    .select(`
      id, employee_id, contract_type, base_salary_monthly, 
      group_ss, category, jornada_pct, irpf_rate,
      employees(id, full_name, role_name, location_id)
    `)
    .eq('legal_entity_id', run.legal_entity_id)
    .eq('active', true);
  
  if (contractsError) {
    return { error: `Error al cargar contratos: ${contractsError.message}` };
  }
  
  if (!contracts || contracts.length === 0) {
    // If no contracts found, try getting all active employees and create default payslips
    const { data: allEmployees } = await supabase
      .from('employees')
      .select('id, full_name, role_name, location_id')
      .eq('group_id', run.group_id)
      .eq('active', true);
    
    if (!allEmployees || allEmployees.length === 0) {
      return { error: 'No hay empleados activos' };
    }
    
    // Create payslips with estimated values based on role
    const payslips = allEmployees.map((emp: any) => {
      const baseSalary = SALARY_TABLES[emp.role_name] || SMI_MONTHLY_14;
      const jornadaPct = 100;
      const contractType = 'indefinido';
      
      return calculatePayslip(emp, baseSalary, contractType, jornadaPct, null, run);
    });
    
    // Delete existing payslips for this run
    await supabase.from('payslips').delete().eq('payroll_run_id', payroll_run_id);
    
    // Insert new payslips
    const { error: insertError } = await supabase
      .from('payslips')
      .insert(payslips.map(p => p.payslipRow));
    
    if (insertError) {
      console.error('Error inserting payslips:', insertError);
      return { error: `Error al guardar nóminas: ${insertError.message}` };
    }
    
    // Update payroll run status
    await supabase
      .from('payroll_runs')
      .update({ status: 'calculated' })
      .eq('id', payroll_run_id);
    
    const totals = payslips.reduce((acc, p) => ({
      gross_pay: acc.gross_pay + p.gross,
      net_pay: acc.net_pay + p.net,
      employee_ss: acc.employee_ss + p.employeeSS,
      employer_ss: acc.employer_ss + p.employerSS,
      irpf_total: acc.irpf_total + p.irpf,
    }), { gross_pay: 0, net_pay: 0, employee_ss: 0, employer_ss: 0, irpf_total: 0 });
    
    return {
      success: true,
      employees_calculated: payslips.length,
      totals: {
        gross_pay: round2(totals.gross_pay),
        net_pay: round2(totals.net_pay),
        employee_ss: round2(totals.employee_ss),
        employer_ss: round2(totals.employer_ss),
        irpf_total: round2(totals.irpf_total),
        total_cost: round2(totals.gross_pay + totals.employer_ss),
      },
    };
  }
  
  // 3. Get payroll inputs (hours, bonuses) for this period
  const { data: inputs } = await supabase
    .from('payroll_inputs')
    .select('*')
    .eq('period_year', run.period_year)
    .eq('period_month', run.period_month);
  
  const inputsByEmployee = new Map((inputs || []).map((i: any) => [i.employee_id, i]));
  
  // 4. Calculate each employee's payslip
  const payslips = contracts.map((contract: any) => {
    const emp = contract.employees;
    if (!emp) return null;
    
    const input = inputsByEmployee.get(emp.id);
    
    return calculatePayslip(
      emp,
      contract.base_salary_monthly,
      contract.contract_type,
      contract.jornada_pct,
      input,
      run,
      contract.irpf_rate
    );
  }).filter(Boolean);
  
  // 5. Delete existing payslips and insert new ones
  await supabase.from('payslips').delete().eq('payroll_run_id', payroll_run_id);
  
  const { error: insertError } = await supabase
    .from('payslips')
    .insert(payslips.map((p: any) => p.payslipRow));
  
  if (insertError) {
    console.error('Error inserting payslips:', insertError);
    return { error: `Error al guardar nóminas: ${insertError.message}` };
  }
  
  // 6. Update payroll run status
  await supabase
    .from('payroll_runs')
    .update({ status: 'calculated' })
    .eq('id', payroll_run_id);
  
  // 7. Return summary
  const totals = payslips.reduce((acc: any, p: any) => ({
    gross_pay: acc.gross_pay + p.gross,
    net_pay: acc.net_pay + p.net,
    employee_ss: acc.employee_ss + p.employeeSS,
    employer_ss: acc.employer_ss + p.employerSS,
    irpf_total: acc.irpf_total + p.irpf,
  }), { gross_pay: 0, net_pay: 0, employee_ss: 0, employer_ss: 0, irpf_total: 0 });
  
  return {
    success: true,
    employees_calculated: payslips.length,
    totals: {
      gross_pay: round2(totals.gross_pay),
      net_pay: round2(totals.net_pay),
      employee_ss: round2(totals.employee_ss),
      employer_ss: round2(totals.employer_ss),
      irpf_total: round2(totals.irpf_total),
      total_cost: round2(totals.gross_pay + totals.employer_ss),
    },
  };
}

function calculatePayslip(
  emp: any,
  baseSalaryMonthly: number,
  contractType: string,
  jornadaPct: number,
  input: any,
  run: any,
  manualIrpfRate?: number,
) {
  // --- GROSS PAY CALCULATION ---
  
  // Base salary adjusted for jornada
  const jornada = (jornadaPct || 100) / 100;
  const baseSalary = round2(baseSalaryMonthly * jornada);
  
  // Pro-rata pagas extras (2 extra pays / 12 months = salary * 2/12)
  const prorrataPagas = round2(baseSalary * 2 / 12);
  
  // Variable components from inputs
  const hoursOvertime = input?.hours_overtime || 0;
  const hoursNight = input?.hours_night || 0;
  const hoursHoliday = input?.hours_holiday || 0;
  
  // Calculate hourly rate (base salary / ~170 hours/month for full time)
  const monthlyHours = 170 * jornada;
  const hourlyRate = baseSalary / monthlyHours;
  
  // Overtime: 175% of hourly rate (per typical convenio)
  const overtimePay = round2(hoursOvertime * hourlyRate * 1.75);
  
  // Night supplement: 25% of hourly rate
  const nightPay = round2(hoursNight * hourlyRate * 0.25);
  
  // Holiday worked: 175% of hourly rate
  const holidayPay = round2(hoursHoliday * hourlyRate * 1.75);
  
  // Bonuses from inputs
  let bonuses = 0;
  if (input?.bonuses_json) {
    try {
      const b = typeof input.bonuses_json === 'string' ? JSON.parse(input.bonuses_json) : input.bonuses_json;
      bonuses = Object.values(b).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
    } catch {}
  }
  
  // Tips (propinas)
  let tips = 0;
  if (input?.tips_json) {
    try {
      const t = typeof input.tips_json === 'string' ? JSON.parse(input.tips_json) : input.tips_json;
      tips = Object.values(t).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
    } catch {}
  }
  
  // Total gross
  const grossPay = round2(baseSalary + prorrataPagas + overtimePay + nightPay + holidayPay + bonuses + tips);
  
  // --- CONTRIBUTION BASE ---
  // Base de cotización = salario bruto (clamped to min/max)
  const baseCotizacion = clampContributionBase(grossPay);
  
  // --- SS EMPLOYEE DEDUCTIONS ---
  const ssEmployee = calculateSSEmployee(baseCotizacion, contractType);
  
  // --- SS EMPLOYER COST ---
  const ssEmployer = calculateSSEmployer(baseCotizacion, contractType);
  
  // --- IRPF WITHHOLDING ---
  let irpfRate: number;
  if (manualIrpfRate && manualIrpfRate > 0) {
    irpfRate = manualIrpfRate / 100;
  } else {
    // Auto-calculate based on annual projection
    const annualGross = grossPay * 12;
    irpfRate = calculateIRPFRate(annualGross);
  }
  const irpfWithheld = round2(grossPay * irpfRate);
  
  // --- OTHER DEDUCTIONS ---
  let otherDeductions = 0;
  if (input?.deductions_json) {
    try {
      const d = typeof input.deductions_json === 'string' ? JSON.parse(input.deductions_json) : input.deductions_json;
      otherDeductions = Object.values(d).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
    } catch {}
  }
  
  // --- NET PAY ---
  const netPay = round2(grossPay - ssEmployee.total - irpfWithheld - otherDeductions);
  
  return {
    gross: grossPay,
    net: netPay,
    employeeSS: ssEmployee.total,
    employerSS: ssEmployer.total,
    irpf: irpfWithheld,
    payslipRow: {
      payroll_run_id: run.id,
      employee_id: emp.id,
      gross_pay: grossPay,
      employee_ss: ssEmployee.total,
      employer_ss: ssEmployer.total,
      irpf_withheld: irpfWithheld,
      other_deductions: otherDeductions,
      net_pay: netPay,
      breakdown_json: {
        base_salary: baseSalary,
        prorrata_pagas: prorrataPagas,
        overtime_pay: overtimePay,
        night_supplement: nightPay,
        holiday_pay: holidayPay,
        bonuses,
        tips,
        base_cotizacion: baseCotizacion,
        ss_employee_detail: ssEmployee,
        ss_employer_detail: ssEmployer,
        irpf_rate: round2(irpfRate * 100),
        contract_type: contractType,
        jornada_pct: jornadaPct,
      },
    },
  };
}

async function handleUpdatePayrollStatus(body: any) {
  const { payroll_run_id, status, user_id } = body;
  
  const validTransitions: Record<string, string[]> = {
    draft: ['validated'],
    validated: ['calculated', 'draft'],
    calculated: ['approved', 'validated'],
    approved: ['submitted', 'calculated'],
    submitted: ['paid', 'approved'],
  };
  
  const { data: run } = await supabase
    .from('payroll_runs')
    .select('status')
    .eq('id', payroll_run_id)
    .single();
  
  if (!run) return { error: 'Nómina no encontrada' };
  
  if (!validTransitions[run.status]?.includes(status)) {
    return { error: `Transición no válida: ${run.status} → ${status}` };
  }
  
  const updatePayload: any = { status };
  if (status === 'approved') {
    updatePayload.approved_at = new Date().toISOString();
    updatePayload.approved_by = user_id;
  }
  
  const { error } = await supabase
    .from('payroll_runs')
    .update(updatePayload)
    .eq('id', payroll_run_id);
  
  if (error) return { error: error.message };
  
  // Log audit trail
  if (user_id) {
    await supabase.from('payroll_audit').insert({
      actor_user_id: user_id,
      action: `STATUS_${status.toUpperCase()}`,
      payload_json: { payroll_run_id, from: run.status, to: status },
    }).then(() => {}).catch(() => {}); // Non-blocking
  }
  
  return { success: true, new_status: status };
}

async function handleCreateSubmission(body: any) {
  const { payroll_run_id, agency, submission_type, is_sandbox } = body;
  
  const { data, error } = await supabase
    .from('compliance_submissions')
    .insert({
      payroll_run_id,
      agency,
      submission_type: submission_type || getDefaultSubmissionType(agency),
      status: is_sandbox ? 'accepted' : 'sent',
      response_json: is_sandbox 
        ? { sandbox: true, message: `Simulación ${agency} OK`, timestamp: new Date().toISOString() } 
        : null,
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) return { error: error.message };
  return { data };
}

function getDefaultSubmissionType(agency: string): string {
  switch (agency) {
    case 'TGSS': return 'RLC_RNT';
    case 'AEAT': return 'Modelo_111';
    case 'SEPE': return 'Certificado';
    default: return 'General';
  }
}

async function handleGenerateSEPA(body: any) {
  const { payroll_run_id } = body;
  
  // Get payslips with employee IBAN
  const { data: payslips } = await supabase
    .from('payslips')
    .select(`
      id, employee_id, net_pay,
      employees(full_name)
    `)
    .eq('payroll_run_id', payroll_run_id);
  
  if (!payslips || payslips.length === 0) {
    return { error: 'No hay nóminas calculadas' };
  }
  
  // Get legal entity info
  const { data: run } = await supabase
    .from('payroll_runs')
    .select('*, legal_entities(razon_social, nif)')
    .eq('id', payroll_run_id)
    .single();
  
  // Generate SEPA XML structure (simplified)
  const totalAmount = payslips.reduce((s: number, p: any) => s + Number(p.net_pay), 0);
  const sepaData = {
    messageId: `JOSE-${payroll_run_id.slice(0, 8)}`,
    initiatorName: (run as any)?.legal_entities?.razon_social || 'Josephine',
    numberOfTransactions: payslips.length,
    controlSum: round2(totalAmount),
    payments: payslips.map((p: any) => ({
      employee: (p as any).employees?.full_name,
      amount: round2(Number(p.net_pay)),
    })),
  };
  
  // Mark as paid
  await supabase
    .from('payroll_runs')
    .update({ status: 'paid' })
    .eq('id', payroll_run_id);
  
  return { success: true, sepa: sepaData };
}

// ===== MAIN HANDLER =====

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...body } = await req.json();
    
    let result;
    
    switch (action) {
      case 'create_entity':
        result = await handleCreateEntity(body);
        break;
      case 'create_payroll_run':
        result = await handleCreatePayrollRun(body);
        break;
      case 'save_employee_legal':
        result = await handleSaveEmployeeLegal(body);
        break;
      case 'create_contract':
        result = await handleCreateContract(body);
        break;
      case 'calculate':
        result = await handleCalculatePayroll(body);
        break;
      case 'update_status':
        result = await handleUpdatePayrollStatus(body);
        break;
      case 'create_submission':
        result = await handleCreateSubmission(body);
        break;
      case 'generate_sepa':
        result = await handleGenerateSEPA(body);
        break;
      default:
        result = { error: `Acción no reconocida: ${action}` };
    }
    
    const status = result.error ? 400 : 200;
    return new Response(JSON.stringify(result), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Payroll API error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
