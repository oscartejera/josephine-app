import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";

interface PayrollInput {
  employee_id: string;
  hours_regular: number;
  hours_night: number;
  hours_holiday: number;
  hours_overtime: number;
  bonuses_json: Array<{ code: string; amount: number }> | null;
  deductions_json: Array<{ code: string; amount: number }> | null;
  tips_json: Array<{ code: string; amount: number }> | null;
}

interface Contract {
  employee_id: string;
  base_salary_monthly: number;
  hourly_rate: number | null;
  jornada_pct: number;
  group_ss: string;
  extra_pays: 'prorrateada' | 'no_prorrateada';
  irpf_mode: 'manual' | 'tabla';
  irpf_rate: number | null;
  convenio_code: string | null;
}

interface ConvenioRules {
  plus_nocturnidad_pct: number;
  plus_festivo_pct: number;
  hora_extra_pct: number;
  pagas_extra: number;
}

interface SSRates {
  contingencias_comunes_empresa: number;
  contingencias_comunes_trabajador: number;
  desempleo_empresa: number;
  desempleo_trabajador: number;
  fogasa: number;
  formacion_empresa: number;
  formacion_trabajador: number;
  base_minima: number;
  base_maxima: number;
}

interface IRPFTramo {
  desde: number;
  hasta: number | null;
  tipo: number;
}

const DEFAULT_SS_RATES: SSRates = {
  contingencias_comunes_empresa: 23.60,
  contingencias_comunes_trabajador: 4.70,
  desempleo_empresa: 5.50,
  desempleo_trabajador: 1.55,
  fogasa: 0.20,
  formacion_empresa: 0.60,
  formacion_trabajador: 0.10,
  base_minima: 1260.00,
  base_maxima: 4720.50,
};

const DEFAULT_CONVENIO: ConvenioRules = {
  plus_nocturnidad_pct: 25,
  plus_festivo_pct: 50,
  hora_extra_pct: 75,
  pagas_extra: 2,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { payroll_run_id }: { payroll_run_id: string } = await req.json();

    if (!payroll_run_id) {
      return new Response(
        JSON.stringify({ error: "payroll_run_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get payroll run
    const { data: payrollRun, error: runError } = await supabase
      .from("payroll_runs")
      .select("*, legal_entities(*)")
      .eq("id", payroll_run_id)
      .maybeSingle();

    if (runError || !payrollRun) {
      return new Response(
        JSON.stringify({ error: "Payroll run not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { period_year, period_month, legal_entity_id, group_id } = payrollRun;

    // Get SS rates from settings
    const { data: ssSettings } = await supabase
      .from("payroll_settings")
      .select("setting_json")
      .eq("group_id", group_id)
      .eq("setting_type", "ss_rates")
      .lte("valid_from", `${period_year}-${String(period_month).padStart(2, '0')}-01`)
      .order("valid_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    const ssRates: SSRates = ssSettings?.setting_json as SSRates || DEFAULT_SS_RATES;

    // Get IRPF tables from settings
    const { data: irpfSettings } = await supabase
      .from("payroll_settings")
      .select("setting_json")
      .eq("group_id", group_id)
      .eq("setting_type", "irpf_tables")
      .lte("valid_from", `${period_year}-${String(period_month).padStart(2, '0')}-01`)
      .order("valid_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    const irpfTramos: IRPFTramo[] = (irpfSettings?.setting_json as { tramos: IRPFTramo[] })?.tramos || [];

    // Get convenio rules
    const { data: convenioRulesData } = await supabase
      .from("convenio_rules")
      .select("convenio_code, rule_json")
      .eq("group_id", group_id);

    const convenioRulesMap = new Map<string, ConvenioRules>();
    convenioRulesData?.forEach((rule) => {
      convenioRulesMap.set(rule.convenio_code, rule.rule_json as ConvenioRules);
    });

    // Get active contracts for this legal entity
    const { data: contracts, error: contractsError } = await supabase
      .from("employment_contracts")
      .select("*")
      .eq("legal_entity_id", legal_entity_id)
      .eq("active", true);

    if (contractsError) {
      throw contractsError;
    }

    // Get payroll inputs for this period
    const { data: inputs, error: inputsError } = await supabase
      .from("payroll_inputs")
      .select("*")
      .eq("period_year", period_year)
      .eq("period_month", period_month);

    if (inputsError) {
      throw inputsError;
    }

    const inputsMap = new Map<string, PayrollInput>();
    inputs?.forEach((input) => {
      inputsMap.set(input.employee_id, input as PayrollInput);
    });

    // Delete existing payslips for this run (recalculation)
    await supabase
      .from("payslips")
      .delete()
      .eq("payroll_run_id", payroll_run_id);

    const payslips: Array<{
      payroll_run_id: string;
      employee_id: string;
      gross_pay: number;
      employee_ss: number;
      employer_ss: number;
      irpf_withheld: number;
      other_deductions: number;
      net_pay: number;
    }> = [];

    const payslipLinesMap = new Map<string, Array<{
      concept_code: string;
      concept_name: string;
      amount: number;
      type: 'earning' | 'deduction';
    }>>();

    // Calculate payslip for each contract
    for (const contract of contracts || []) {
      const input = inputsMap.get(contract.employee_id);
      if (!input) continue; // Skip if no input for this employee

      const lines: Array<{
        concept_code: string;
        concept_name: string;
        amount: number;
        type: 'earning' | 'deduction';
      }> = [];

      const convenioRules = contract.convenio_code 
        ? convenioRulesMap.get(contract.convenio_code) || DEFAULT_CONVENIO
        : DEFAULT_CONVENIO;

      // ========== EARNINGS ==========
      
      // 1. Base salary (prorated by jornada)
      const baseSalary = (contract.base_salary_monthly * contract.jornada_pct) / 100;
      lines.push({
        concept_code: 'SAL_BASE',
        concept_name: 'Salario Base',
        amount: baseSalary,
        type: 'earning',
      });

      // 2. Prorrata pagas extra (if prorrateada)
      let pagasExtra = 0;
      if (contract.extra_pays === 'prorrateada') {
        pagasExtra = (baseSalary * convenioRules.pagas_extra) / 12;
        lines.push({
          concept_code: 'PAGA_EXTRA',
          concept_name: 'Prorrata Pagas Extra',
          amount: pagasExtra,
          type: 'earning',
        });
      }

      // 3. Night bonus
      const hourlyRate = contract.hourly_rate || (baseSalary / 160);
      let plusNocturnidad = 0;
      if (input.hours_night > 0) {
        plusNocturnidad = input.hours_night * hourlyRate * (convenioRules.plus_nocturnidad_pct / 100);
        lines.push({
          concept_code: 'PLUS_NOCT',
          concept_name: 'Plus Nocturnidad',
          amount: plusNocturnidad,
          type: 'earning',
        });
      }

      // 4. Holiday bonus
      let plusFestivos = 0;
      if (input.hours_holiday > 0) {
        plusFestivos = input.hours_holiday * hourlyRate * (convenioRules.plus_festivo_pct / 100);
        lines.push({
          concept_code: 'PLUS_FEST',
          concept_name: 'Plus Festivos',
          amount: plusFestivos,
          type: 'earning',
        });
      }

      // 5. Overtime
      let horasExtra = 0;
      if (input.hours_overtime > 0) {
        horasExtra = input.hours_overtime * hourlyRate * (1 + convenioRules.hora_extra_pct / 100);
        lines.push({
          concept_code: 'HORAS_EXTRA',
          concept_name: 'Horas Extraordinarias',
          amount: horasExtra,
          type: 'earning',
        });
      }

      // 6. Additional bonuses from input
      let otherBonuses = 0;
      if (input.bonuses_json && Array.isArray(input.bonuses_json)) {
        for (const bonus of input.bonuses_json) {
          otherBonuses += bonus.amount;
          lines.push({
            concept_code: bonus.code,
            concept_name: bonus.code.replace(/_/g, ' '),
            amount: bonus.amount,
            type: 'earning',
          });
        }
      }

      // 7. Tips (usually non-taxable)
      let tips = 0;
      if (input.tips_json && Array.isArray(input.tips_json)) {
        for (const tip of input.tips_json) {
          tips += tip.amount;
          lines.push({
            concept_code: 'PROPINAS',
            concept_name: 'Propinas',
            amount: tip.amount,
            type: 'earning',
          });
        }
      }

      // Calculate gross pay (SS cotizable)
      const grossPayCotizable = baseSalary + pagasExtra + plusNocturnidad + plusFestivos + horasExtra;
      const grossPayTotal = grossPayCotizable + otherBonuses + tips;

      // ========== SOCIAL SECURITY ==========
      
      // Clamp to SS bases
      const baseCotizacion = Math.max(
        ssRates.base_minima,
        Math.min(ssRates.base_maxima, grossPayCotizable)
      );

      // Employee SS contributions
      const ssEmpleadoCC = baseCotizacion * (ssRates.contingencias_comunes_trabajador / 100);
      const ssEmpleadoDesempleo = baseCotizacion * (ssRates.desempleo_trabajador / 100);
      const ssEmpleadoFormacion = baseCotizacion * (ssRates.formacion_trabajador / 100);
      const totalEmployeeSS = ssEmpleadoCC + ssEmpleadoDesempleo + ssEmpleadoFormacion;

      lines.push({
        concept_code: 'SS_CC',
        concept_name: 'SS Contingencias Comunes',
        amount: ssEmpleadoCC,
        type: 'deduction',
      });
      lines.push({
        concept_code: 'SS_DESEMPLEO',
        concept_name: 'SS Desempleo',
        amount: ssEmpleadoDesempleo,
        type: 'deduction',
      });
      lines.push({
        concept_code: 'SS_FORMACION',
        concept_name: 'SS Formación',
        amount: ssEmpleadoFormacion,
        type: 'deduction',
      });

      // Employer SS contributions (not deducted from employee, but tracked)
      const ssEmpresaCC = baseCotizacion * (ssRates.contingencias_comunes_empresa / 100);
      const ssEmpresaDesempleo = baseCotizacion * (ssRates.desempleo_empresa / 100);
      const ssEmpresaFogasa = baseCotizacion * (ssRates.fogasa / 100);
      const ssEmpresaFormacion = baseCotizacion * (ssRates.formacion_empresa / 100);
      const totalEmployerSS = ssEmpresaCC + ssEmpresaDesempleo + ssEmpresaFogasa + ssEmpresaFormacion;

      // ========== IRPF ==========
      
      let irpfRate: number;
      if (contract.irpf_mode === 'manual' && contract.irpf_rate !== null) {
        irpfRate = contract.irpf_rate;
      } else {
        // Calculate from IRPF tables based on annual gross
        const annualGross = grossPayTotal * 12;
        irpfRate = calculateIRPFRate(annualGross, irpfTramos);
      }

      const baseIRPF = grossPayTotal - totalEmployeeSS; // Base after SS deductions
      const irpfWithheld = baseIRPF * (irpfRate / 100);

      lines.push({
        concept_code: 'IRPF',
        concept_name: `Retención IRPF (${irpfRate.toFixed(2)}%)`,
        amount: irpfWithheld,
        type: 'deduction',
      });

      // ========== OTHER DEDUCTIONS ==========
      
      let otherDeductions = 0;
      if (input.deductions_json && Array.isArray(input.deductions_json)) {
        for (const deduction of input.deductions_json) {
          otherDeductions += deduction.amount;
          lines.push({
            concept_code: deduction.code,
            concept_name: deduction.code.replace(/_/g, ' '),
            amount: deduction.amount,
            type: 'deduction',
          });
        }
      }

      // ========== NET PAY ==========
      
      const netPay = grossPayTotal - totalEmployeeSS - irpfWithheld - otherDeductions;

      payslips.push({
        payroll_run_id,
        employee_id: contract.employee_id,
        gross_pay: Math.round(grossPayTotal * 100) / 100,
        employee_ss: Math.round(totalEmployeeSS * 100) / 100,
        employer_ss: Math.round(totalEmployerSS * 100) / 100,
        irpf_withheld: Math.round(irpfWithheld * 100) / 100,
        other_deductions: Math.round(otherDeductions * 100) / 100,
        net_pay: Math.round(netPay * 100) / 100,
      });

      payslipLinesMap.set(contract.employee_id, lines.map(l => ({
        ...l,
        amount: Math.round(l.amount * 100) / 100,
      })));
    }

    // Insert payslips
    const { data: insertedPayslips, error: insertError } = await supabase
      .from("payslips")
      .insert(payslips)
      .select();

    if (insertError) {
      throw insertError;
    }

    // Insert payslip lines
    const allLines: Array<{
      payslip_id: string;
      concept_code: string;
      concept_name: string;
      amount: number;
      type: 'earning' | 'deduction';
    }> = [];

    for (const payslip of insertedPayslips || []) {
      const lines = payslipLinesMap.get(payslip.employee_id) || [];
      for (const line of lines) {
        allLines.push({
          payslip_id: payslip.id,
          ...line,
        });
      }
    }

    if (allLines.length > 0) {
      const { error: linesError } = await supabase
        .from("payslip_lines")
        .insert(allLines);

      if (linesError) {
        throw linesError;
      }
    }

    // Update payroll run status
    await supabase
      .from("payroll_runs")
      .update({ status: 'calculated' })
      .eq("id", payroll_run_id);

    // Log audit
    await supabase.from("payroll_audit").insert({
      group_id,
      actor_user_id: user.id,
      action: "calculate_payroll",
      payload_json: {
        payroll_run_id,
        period: `${period_year}-${period_month}`,
        employees_count: payslips.length,
        total_gross: payslips.reduce((sum, p) => sum + p.gross_pay, 0),
        total_net: payslips.reduce((sum, p) => sum + p.net_pay, 0),
      },
    });

    // Summary
    const summary = {
      payroll_run_id,
      period: `${period_year}-${String(period_month).padStart(2, '0')}`,
      employees_calculated: payslips.length,
      totals: {
        gross_pay: payslips.reduce((sum, p) => sum + p.gross_pay, 0),
        employee_ss: payslips.reduce((sum, p) => sum + p.employee_ss, 0),
        employer_ss: payslips.reduce((sum, p) => sum + p.employer_ss, 0),
        irpf_withheld: payslips.reduce((sum, p) => sum + p.irpf_withheld, 0),
        other_deductions: payslips.reduce((sum, p) => sum + p.other_deductions, 0),
        net_pay: payslips.reduce((sum, p) => sum + p.net_pay, 0),
      },
      payslips: insertedPayslips,
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return createErrorResponse("payroll", "calculate", error);
  }
});

function calculateIRPFRate(annualGross: number, tramos: IRPFTramo[]): number {
  if (tramos.length === 0) {
    // Default simplified rate
    if (annualGross <= 12450) return 10;
    if (annualGross <= 20200) return 15;
    if (annualGross <= 35200) return 18;
    if (annualGross <= 60000) return 22;
    return 24;
  }

  // Calculate effective rate based on tramos
  let totalTax = 0;
  let remainingIncome = annualGross;

  for (const tramo of tramos.sort((a, b) => a.desde - b.desde)) {
    if (remainingIncome <= 0) break;

    const tramoMax = tramo.hasta || Infinity;
    const tramoWidth = tramoMax - tramo.desde;
    const taxableInTramo = Math.min(remainingIncome, tramoWidth);

    totalTax += taxableInTramo * (tramo.tipo / 100);
    remainingIncome -= taxableInTramo;
  }

  // Return effective rate (simplified for monthly withholding)
  return annualGross > 0 ? (totalTax / annualGross) * 100 : 0;
}
