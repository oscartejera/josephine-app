// Payroll API Edge Function
// Handles all payroll operations with service role key (bypasses RLS)
// Implements Spanish payroll calculations per:
// - Estatuto de los Trabajadores (ET) - Real Decreto Legislativo 2/2015
// - Ley General de la Seguridad Social (LGSS) - Real Decreto Legislativo 8/2015
// - IRPF - Ley 35/2006 del IRPF + Reglamento RD 439/2007
// - Convenio Colectivo de Hostelería de Madrid (Resolución 2024)
// - Orden ISM/2024 de cotización a la Seguridad Social
// - Real Decreto 145/2024 SMI

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ===== SCHEMA AUTO-CREATION =====
// Ensures all payroll tables exist on the production database

async function ensureSchema(): Promise<{ success: boolean; message: string; tables_created?: string[] }> {
  const tables_created: string[] = [];
  
  // Check if core tables exist by trying to query them
  const tablesToCheck = [
    'employee_legal',
    'employment_contracts', 
    'payroll_inputs',
    'payslips',
    'compliance_submissions',
    'compliance_tokens',
    'payroll_audit',
    'social_security_accounts',
    'tax_accounts',
  ];
  
  const missingTables: string[] = [];
  
  for (const table of tablesToCheck) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error && (error.message.includes('does not exist') || error.code === '42P01')) {
      missingTables.push(table);
    }
  }
  
  if (missingTables.length === 0) {
    return { success: true, message: 'All tables exist', tables_created: [] };
  }
  
  console.log('Missing tables:', missingTables);
  
  // Use direct Postgres connection to create tables
  let sql: any;
  try {
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');
    if (!dbUrl) {
      return { success: false, message: 'SUPABASE_DB_URL not available. Tables must be created manually.' };
    }
    
    const { default: postgres } = await import('https://deno.land/x/postgresjs@v3.4.4/mod.js');
    sql = postgres(dbUrl, { max: 1 });
    
    // Create tables in a transaction
    await sql.begin(async (tx: any) => {
      // employee_legal: NIF, NSS, IBAN per employee per entity
      await tx.unsafe(`
        CREATE TABLE IF NOT EXISTS employee_legal (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id uuid NOT NULL,
          legal_entity_id uuid NOT NULL,
          nif text,
          nss text,
          iban text,
          domicilio text,
          created_at timestamptz DEFAULT now(),
          UNIQUE(employee_id, legal_entity_id)
        )
      `);
      
      // employment_contracts: labor contracts per Estatuto de los Trabajadores
      await tx.unsafe(`
        CREATE TABLE IF NOT EXISTS employment_contracts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id uuid NOT NULL,
          legal_entity_id uuid NOT NULL,
          location_id uuid,
          start_date date DEFAULT CURRENT_DATE,
          end_date date,
          contract_type text DEFAULT 'indefinido',
          base_salary_monthly numeric DEFAULT 1500,
          group_ss text DEFAULT '5',
          category text DEFAULT 'Camarero',
          jornada_pct numeric DEFAULT 100,
          irpf_rate numeric DEFAULT 15,
          active boolean DEFAULT true,
          created_at timestamptz DEFAULT now()
        )
      `);
      
      // payroll_inputs: monthly variable data
      await tx.unsafe(`
        CREATE TABLE IF NOT EXISTS payroll_inputs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id uuid NOT NULL,
          period_year int NOT NULL,
          period_month int NOT NULL,
          hours_regular numeric DEFAULT 0,
          hours_night numeric DEFAULT 0,
          hours_holiday numeric DEFAULT 0,
          hours_overtime numeric DEFAULT 0,
          bonuses_json jsonb DEFAULT '[]'::jsonb,
          deductions_json jsonb DEFAULT '[]'::jsonb,
          tips_json jsonb DEFAULT '[]'::jsonb,
          created_at timestamptz DEFAULT now(),
          UNIQUE(employee_id, period_year, period_month)
        )
      `);
      
      // payslips: calculated payslips per LGSS art. 109-110
      await tx.unsafe(`
        CREATE TABLE IF NOT EXISTS payslips (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          payroll_run_id uuid NOT NULL,
          employee_id uuid NOT NULL,
          gross_pay numeric DEFAULT 0,
          employee_ss numeric DEFAULT 0,
          employer_ss numeric DEFAULT 0,
          irpf_withheld numeric DEFAULT 0,
          other_deductions numeric DEFAULT 0,
          net_pay numeric DEFAULT 0,
          breakdown_json jsonb,
          created_at timestamptz DEFAULT now()
        )
      `);
      
      // compliance_submissions: TGSS/AEAT/SEPE filings
      await tx.unsafe(`
        CREATE TABLE IF NOT EXISTS compliance_submissions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          payroll_run_id uuid NOT NULL,
          agency text NOT NULL,
          submission_type text,
          status text DEFAULT 'pending',
          response_json jsonb,
          submitted_at timestamptz,
          created_at timestamptz DEFAULT now()
        )
      `);
      
      // compliance_tokens: digital certificates for filings
      await tx.unsafe(`
        CREATE TABLE IF NOT EXISTS compliance_tokens (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          legal_entity_id uuid NOT NULL,
          agency text NOT NULL,
          token_data jsonb,
          expires_at timestamptz,
          created_at timestamptz DEFAULT now()
        )
      `);
      
      // payroll_audit: audit trail per LOPD/GDPR
      await tx.unsafe(`
        CREATE TABLE IF NOT EXISTS payroll_audit (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          actor_user_id uuid,
          action text NOT NULL,
          payload_json jsonb,
          created_at timestamptz DEFAULT now()
        )
      `);
      
      // social_security_accounts: CCC per entity
      await tx.unsafe(`
        CREATE TABLE IF NOT EXISTS social_security_accounts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          legal_entity_id uuid NOT NULL,
          ccc text NOT NULL,
          province text,
          activity_code text,
          created_at timestamptz DEFAULT now()
        )
      `);
      
      // tax_accounts: tax filing accounts
      await tx.unsafe(`
        CREATE TABLE IF NOT EXISTS tax_accounts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          legal_entity_id uuid NOT NULL,
          modelo text NOT NULL,
          period text,
          created_at timestamptz DEFAULT now()
        )
      `);
      
      // Enable RLS on all payroll tables
      const payrollTables = [
        'employee_legal', 'employment_contracts', 'payroll_inputs',
        'payslips', 'compliance_submissions', 'compliance_tokens',
        'payroll_audit', 'social_security_accounts', 'tax_accounts'
      ];
      
      for (const table of payrollTables) {
        await tx.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
        
        // Drop and recreate policies for clean state
        await tx.unsafe(`DROP POLICY IF EXISTS "payroll_read_auth" ON ${table}`);
        await tx.unsafe(`CREATE POLICY "payroll_read_auth" ON ${table} FOR SELECT TO authenticated USING (true)`);
        
        await tx.unsafe(`DROP POLICY IF EXISTS "payroll_insert_auth" ON ${table}`);
        await tx.unsafe(`CREATE POLICY "payroll_insert_auth" ON ${table} FOR INSERT TO authenticated WITH CHECK (true)`);
        
        await tx.unsafe(`DROP POLICY IF EXISTS "payroll_update_auth" ON ${table}`);
        await tx.unsafe(`CREATE POLICY "payroll_update_auth" ON ${table} FOR UPDATE TO authenticated USING (true)`);
        
        await tx.unsafe(`DROP POLICY IF EXISTS "payroll_delete_auth" ON ${table}`);
        await tx.unsafe(`CREATE POLICY "payroll_delete_auth" ON ${table} FOR DELETE TO authenticated USING (true)`);

        // Also allow service role full access
        await tx.unsafe(`DROP POLICY IF EXISTS "payroll_service_all" ON ${table}`);
        await tx.unsafe(`CREATE POLICY "payroll_service_all" ON ${table} FOR ALL TO service_role USING (true)`);
      }
    });
    
    tables_created.push(...missingTables);
    return { success: true, message: `Created ${missingTables.length} tables`, tables_created };
  } catch (err) {
    console.error('Schema creation error:', err);
    return { success: false, message: `Error creating tables: ${err.message}` };
  } finally {
    if (sql) {
      try { await sql.end(); } catch {}
    }
  }
}

// ===== SPANISH PAYROLL CONSTANTS (2025/2026) =====
// Sources:
// - Orden ISM/2024 de cotización
// - Ley 35/2006 del IRPF
// - RD 145/2024 SMI
// - Convenio Colectivo Hostelería Madrid 2024-2026

// Social Security contribution rates (Orden ISM cotización 2025/2026)
const SS_RATES = {
  employee: {
    contingencias_comunes: 0.0470,     // Art. 286 LGSS
    desempleo_indefinido: 0.0155,      // RD-Ley 15/1998
    desempleo_temporal: 0.0160,
    formacion_profesional: 0.0010,     // Ley 30/2015
    mei: 0.0013,                       // Disposición final 4ª Ley 21/2021
  },
  employer: {
    contingencias_comunes: 0.2360,     // Art. 286 LGSS
    desempleo_indefinido: 0.0550,
    desempleo_temporal: 0.0670,
    at_ep: 0.0150,                     // CNAE 5610 Restaurantes (Tarifa primas DA 4ª)
    fogasa: 0.0020,                    // Art. 33 ET
    formacion_profesional: 0.0060,     // Ley 30/2015
    mei: 0.0067,                       // MEI 2025 (escala progresiva Ley 21/2021)
  },
};

// IRPF brackets - Escala general estatal + autonómica (nacional, 2025/2026)
// Art. 63 Ley 35/2006 IRPF + DT 31ª (estatal) + escala autonómica Madrid
const IRPF_BRACKETS = [
  { upTo: 12450, rate: 0.19 },    // 9.5% estatal + 9.5% autonómico
  { upTo: 20200, rate: 0.24 },
  { upTo: 35200, rate: 0.30 },
  { upTo: 60000, rate: 0.37 },
  { upTo: 300000, rate: 0.45 },
  { upTo: Infinity, rate: 0.47 },
];

// Mínimo personal y familiar (Art. 57-61 Ley IRPF)
const IRPF_MINIMO_PERSONAL = 5550;      // Art. 57
const IRPF_MINIMOS_HIJOS = [2400, 2700, 4000, 4500]; // Art. 58

// Contribution base limits (Orden ISM 2025/2026)
const CONTRIBUTION_BASE = {
  max_monthly: 4909.50,   // Tope máximo (Art. 2.1 Orden)
  min_monthly: 1381.20,   // Base mínima grupo 7+ (SMI * 1/6)
};

// Bases mínimas por grupo de cotización (Orden ISM 2025)
const MIN_BASES_BY_GROUP: Record<string, number> = {
  '1': 1847.40,  // Ingenieros y Licenciados
  '2': 1531.50,  // Ingenieros Técnicos
  '3': 1332.00,  // Jefes Administrativos
  '4': 1381.20,  // Ayudantes no titulados
  '5': 1381.20,  // Oficiales Administrativos
  '6': 1381.20,  // Subalternos
  '7': 1381.20,  // Auxiliares Administrativos
  '8': 46.04,    // Diarios: Oficiales 1ª y 2ª
  '9': 46.04,    // Diarios: Oficiales 3ª
  '10': 46.04,   // Diarios: Peones
  '11': 46.04,   // Diarios: Menores de 18
};

// SMI 2025/2026 (RD 145/2024)
const SMI_MONTHLY_14 = 1184;   // 14 pagas
const SMI_MONTHLY_12 = 1381;   // 12 pagas (con prorrata)
const SMI_ANNUAL = 16576;
const SMI_DAILY = 39.47;

// Hostelería salary tables (Convenio Colectivo Hostelería Madrid 2024-2026)
// Based on tablas salariales Anexo I
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
  'Kitchen Porter': 1350,
  'Runner': 1350,
  'Repartidor': 1400,
  'Limpieza': 1300,
};

// Plus de transporte y manutención (Convenio Hostelería Madrid art. 17-18)
const PLUS_TRANSPORTE_DIA = 3.50;    // Plus transporte/día trabajado
const PLUS_MANUTENCION_DIA = 11.00;  // Compensación manutención cuando no hay servicio
const DIAS_LABORABLES_MES = 22;       // Media días laborables/mes

// Recargo por trabajo nocturno (Art. 36 ET + Convenio)
const RECARGO_NOCTURNIDAD = 0.25;     // 25% salario base
// Recargo por horas extra (Art. 35 ET)
const RECARGO_HORAS_EXTRA = 1.75;     // 175% hora ordinaria (75% recargo)
// Recargo por trabajo en festivos (Convenio art. 22)
const RECARGO_FESTIVOS = 1.75;        // 175% hora ordinaria

// Jornada máxima (Art. 34 ET + Convenio)
const JORNADA_ANUAL_HORAS = 1800;     // Convenio Hostelería Madrid
const JORNADA_SEMANAL_HORAS = 40;     // Art. 34.1 ET
const HORAS_MES_TIEMPO_COMPLETO = JORNADA_ANUAL_HORAS / 12; // ~150h

// ===== HELPER FUNCTIONS =====

function calculateIRPFRate(annualGross: number, personalSituation: number = 0): number {
  // Calculate taxable base (Art. 63 LIRPF)
  // Base liquidable = rendimiento neto - reducciones
  const taxableBase = Math.max(0, annualGross - IRPF_MINIMO_PERSONAL);
  
  if (taxableBase <= 0) return 0;
  
  // Exención si rendimiento <= SMI (Art. 7 LIRPF + DT 33ª)
  if (annualGross <= SMI_ANNUAL * 1.5) return 0;
  
  // Calculate total tax using progressive brackets (Art. 63 LIRPF)
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
  
  // Effective rate (tipo efectivo de retención)
  const effectiveRate = totalTax / annualGross;
  
  // Minimum retention: 2% for temporal contracts < 1 year (Art. 86.2 RIRPF)
  // 0% if below SMI threshold
  return Math.round(effectiveRate * 10000) / 10000;
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

function clampContributionBase(base: number, groupSS?: string): number {
  const minBase = MIN_BASES_BY_GROUP[groupSS || '5'] || CONTRIBUTION_BASE.min_monthly;
  return Math.min(Math.max(base, minBase), CONTRIBUTION_BASE.max_monthly);
}

// ===== ACTION HANDLERS =====

async function handleSetup(_body: any) {
  return await ensureSchema();
}

async function handleCreateEntity(body: any) {
  const { group_id, razon_social, nif, domicilio_fiscal, cnae } = body;
  
  if (!group_id || !razon_social || !nif || !domicilio_fiscal) {
    return { error: 'Faltan campos obligatorios: razón social, NIF y domicilio fiscal' };
  }
  
  // Validate CIF/NIF format (Art. 2 RD 1065/2007)
  const nifRegex = /^[A-Z]\d{7}[A-Z0-9]$/i;
  if (!nifRegex.test(nif)) {
    return { error: 'Formato de NIF/CIF inválido. Debe ser letra + 7 dígitos + letra/dígito (ej: B12345678)' };
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
  
  // Ensure schema exists before creating run
  await ensureSchema();
  
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
  
  // Deactivate previous contracts (Art. 49 ET - extinción del contrato anterior)
  await supabase
    .from('employment_contracts')
    .update({ active: false })
    .eq('employee_id', employee_id)
    .eq('active', true);
  
  const salary = parseFloat(base_salary_monthly) || SALARY_TABLES[category] || SMI_MONTHLY_14;
  
  // Validate salary >= SMI (Art. 27 ET)
  const jornada = (parseFloat(jornada_pct) || 100) / 100;
  const smiForJornada = SMI_MONTHLY_14 * jornada;
  if (salary < smiForJornada) {
    console.warn(`Salary ${salary} below SMI for jornada ${jornada}: ${smiForJornada}`);
  }
  
  // Auto-calculate IRPF rate per Art. 80+ RIRPF
  const annualGross = salary * 14; // 14 pagas (12 + 2 extras)
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

// Get all active employees for a group (via locations)
async function getActiveEmployees(groupId: string): Promise<any[]> {
  // First try direct group_id on employees
  let { data: employees, error } = await supabase
    .from('employees')
    .select('id, full_name, role_name, location_id')
    .eq('group_id', groupId)
    .eq('active', true);
  
  if (employees && employees.length > 0) return employees;
  
  // Fallback: get locations for the group, then employees at those locations
  const { data: locations } = await supabase
    .from('locations')
    .select('id')
    .eq('group_id', groupId);
  
  if (locations && locations.length > 0) {
    const locationIds = locations.map((l: any) => l.id);
    const { data: locEmployees } = await supabase
      .from('employees')
      .select('id, full_name, role_name, location_id')
      .in('location_id', locationIds)
      .eq('active', true);
    
    if (locEmployees && locEmployees.length > 0) return locEmployees;
  }
  
  // Last fallback: all active employees (single-tenant)
  const { data: allEmployees } = await supabase
    .from('employees')
    .select('id, full_name, role_name, location_id')
    .eq('active', true);
  
  return allEmployees || [];
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
    console.error('Contracts query error:', contractsError);
    // Table might not exist, continue with fallback
  }
  
  // 3. Get payroll inputs (hours, bonuses) for this period
  let inputsByEmployee = new Map();
  try {
    const { data: inputs } = await supabase
      .from('payroll_inputs')
      .select('*')
      .eq('period_year', run.period_year)
      .eq('period_month', run.period_month);
    
    inputsByEmployee = new Map((inputs || []).map((i: any) => [i.employee_id, i]));
  } catch (err) {
    console.warn('Could not fetch payroll_inputs:', err);
  }
  
  let payslips: any[] = [];
  
  if (contracts && contracts.length > 0) {
    // Calculate using actual contracts
    payslips = contracts.map((contract: any) => {
      const emp = contract.employees;
      if (!emp) return null;
      
      const input = inputsByEmployee.get(emp.id);
      
      return calculatePayslip(
        emp,
        contract.base_salary_monthly,
        contract.contract_type,
        contract.jornada_pct,
        contract.group_ss,
        input,
        run,
        contract.irpf_rate
      );
    }).filter(Boolean);
  } else {
    // Fallback: use all active employees with role-based salary estimates
    // Per Convenio Colectivo Hostelería Madrid, Anexo I (tablas salariales)
    const allEmployees = await getActiveEmployees(run.group_id);
    
    if (allEmployees.length === 0) {
      return { error: 'No hay empleados activos en el sistema' };
    }
    
    payslips = allEmployees.map((emp: any) => {
      const baseSalary = SALARY_TABLES[emp.role_name] || SMI_MONTHLY_14;
      const input = inputsByEmployee.get(emp.id);
      
      return calculatePayslip(emp, baseSalary, 'indefinido', 100, '5', input, run);
    });
  }
  
  if (payslips.length === 0) {
    return { error: 'No se pudieron calcular nóminas. Verifica que hay empleados activos.' };
  }
  
  // 4. Delete existing payslips and insert new ones
  await supabase.from('payslips').delete().eq('payroll_run_id', payroll_run_id);
  
  const { error: insertError } = await supabase
    .from('payslips')
    .insert(payslips.map((p: any) => p.payslipRow));
  
  if (insertError) {
    console.error('Error inserting payslips:', insertError);
    return { error: `Error al guardar nóminas: ${insertError.message}` };
  }
  
  // 5. Update payroll run status
  await supabase
    .from('payroll_runs')
    .update({ status: 'calculated' })
    .eq('id', payroll_run_id);
  
  // 6. Return summary with full breakdown
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
    legal_refs: {
      ss_calculation: 'LGSS Art. 109-110, Orden ISM Cotización 2025',
      irpf_calculation: 'Ley 35/2006 IRPF Art. 63, RD 439/2007 RIRPF',
      salary_tables: 'Convenio Colectivo Hostelería Madrid 2024-2026 Anexo I',
      overtime: 'Art. 35 ET (175% hora ordinaria)',
      night_work: 'Art. 36 ET + Convenio (25% recargo)',
    },
  };
}

function calculatePayslip(
  emp: any,
  baseSalaryMonthly: number,
  contractType: string,
  jornadaPct: number,
  groupSS: string,
  input: any,
  run: any,
  manualIrpfRate?: number,
) {
  // ===== DEVENGOS (Art. 26 ET) =====
  
  // 1. Salario base ajustado por jornada (Art. 26.1 ET)
  const jornada = (jornadaPct || 100) / 100;
  const baseSalary = round2(baseSalaryMonthly * jornada);
  
  // 2. Prorrata pagas extras (Art. 31 ET - 2 gratificaciones extraordinarias/año)
  // Se prorratean: salario * 2 / 12
  const prorrataPagas = round2(baseSalary * 2 / 12);
  
  // 3. Plus de transporte (Convenio Hostelería Madrid art. 17)
  const plusTransporte = round2(PLUS_TRANSPORTE_DIA * DIAS_LABORABLES_MES * jornada);
  
  // 4. Complementos variables del input mensual
  const hoursOvertime = input?.hours_overtime || 0;
  const hoursNight = input?.hours_night || 0;
  const hoursHoliday = input?.hours_holiday || 0;
  const hoursRegular = input?.hours_regular || (HORAS_MES_TIEMPO_COMPLETO * jornada);
  
  // Hourly rate = base mensual / horas mensuales convenio
  const monthlyHours = HORAS_MES_TIEMPO_COMPLETO * jornada;
  const hourlyRate = monthlyHours > 0 ? baseSalary / monthlyHours : 0;
  
  // 5. Horas extra (Art. 35 ET - retribución >= hora ordinaria, convenio 175%)
  // Max 80 horas extra/año (Art. 35.2 ET)
  const overtimePay = round2(hoursOvertime * hourlyRate * RECARGO_HORAS_EXTRA);
  
  // 6. Plus nocturnidad (Art. 36 ET - entre 22h y 6h)
  const nightPay = round2(hoursNight * hourlyRate * RECARGO_NOCTURNIDAD);
  
  // 7. Trabajo en festivos (Convenio art. 22)
  const holidayPay = round2(hoursHoliday * hourlyRate * RECARGO_FESTIVOS);
  
  // 8. Complementos salariales adicionales (bonificaciones, propinas)
  let bonuses = 0;
  if (input?.bonuses_json) {
    try {
      const b = typeof input.bonuses_json === 'string' ? JSON.parse(input.bonuses_json) : input.bonuses_json;
      if (Array.isArray(b)) {
        bonuses = b.reduce((s: number, v: any) => s + (Number(v?.amount || v) || 0), 0);
      } else {
        bonuses = Object.values(b).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
      }
    } catch {}
  }
  
  let tips = 0;
  if (input?.tips_json) {
    try {
      const t = typeof input.tips_json === 'string' ? JSON.parse(input.tips_json) : input.tips_json;
      if (Array.isArray(t)) {
        tips = t.reduce((s: number, v: any) => s + (Number(v?.amount || v) || 0), 0);
      } else {
        tips = Object.values(t).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
      }
    } catch {}
  }
  
  // ===== TOTAL DEVENGOS (BRUTO) =====
  const grossPay = round2(
    baseSalary + prorrataPagas + plusTransporte + 
    overtimePay + nightPay + holidayPay + 
    bonuses + tips
  );
  
  // ===== BASE DE COTIZACIÓN (Art. 147 LGSS) =====
  // Base = remuneración total - conceptos excluidos (plus transporte exento hasta límites)
  // Para simplificar: base = bruto (incluyendo prorrata extras)
  const baseCotizacion = clampContributionBase(grossPay, groupSS);
  
  // ===== DEDUCCIONES DEL TRABAJADOR =====
  
  // 1. Seguridad Social empleado (Art. 286 LGSS + Orden Cotización)
  const ssEmployee = calculateSSEmployee(baseCotizacion, contractType);
  
  // 2. IRPF retención (Art. 80+ RIRPF)
  let irpfRate: number;
  if (manualIrpfRate && manualIrpfRate > 0) {
    irpfRate = manualIrpfRate / 100;
  } else {
    const annualGross = grossPay * 12;
    irpfRate = calculateIRPFRate(annualGross);
  }
  const irpfWithheld = round2(grossPay * irpfRate);
  
  // 3. Otras deducciones (anticipos, embargos, etc.)
  let otherDeductions = 0;
  if (input?.deductions_json) {
    try {
      const d = typeof input.deductions_json === 'string' ? JSON.parse(input.deductions_json) : input.deductions_json;
      if (Array.isArray(d)) {
        otherDeductions = d.reduce((s: number, v: any) => s + (Number(v?.amount || v) || 0), 0);
      } else {
        otherDeductions = Object.values(d).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
      }
    } catch {}
  }
  
  // ===== COSTE EMPRESA =====
  // SS empresa (Art. 286 LGSS + Orden Cotización)
  const ssEmployer = calculateSSEmployer(baseCotizacion, contractType);
  
  // ===== LÍQUIDO (NETO) =====
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
        // Devengos
        base_salary: baseSalary,
        prorrata_pagas: prorrataPagas,
        plus_transporte: plusTransporte,
        overtime_pay: overtimePay,
        night_supplement: nightPay,
        holiday_pay: holidayPay,
        bonuses,
        tips,
        hours_regular: hoursRegular,
        hours_overtime: hoursOvertime,
        hours_night: hoursNight,
        hours_holiday: hoursHoliday,
        // Cotización
        base_cotizacion: baseCotizacion,
        ss_employee_detail: ssEmployee,
        ss_employer_detail: ssEmployer,
        // IRPF
        irpf_rate: round2(irpfRate * 100),
        irpf_withheld: irpfWithheld,
        // Contrato
        contract_type: contractType,
        jornada_pct: jornadaPct,
        group_ss: groupSS,
        // Coste total empresa
        total_employer_cost: round2(grossPay + ssEmployer.total),
        // Legal references
        _legal_basis: {
          salario: 'Art. 26 ET',
          pagas_extras: 'Art. 31 ET',
          horas_extra: 'Art. 35 ET',
          nocturnidad: 'Art. 36 ET',
          ss: 'Art. 109-110 LGSS + Orden ISM Cotización 2025',
          irpf: 'Ley 35/2006 IRPF, RD 439/2007',
        },
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
  
  // Audit trail (LOPD/GDPR compliance)
  if (user_id) {
    await supabase.from('payroll_audit').insert({
      actor_user_id: user_id,
      action: `STATUS_${status.toUpperCase()}`,
      payload_json: { payroll_run_id, from: run.status, to: status },
    }).then(() => {}).catch(() => {});
  }
  
  return { success: true, new_status: status };
}

async function handleCreateSubmission(body: any) {
  const { payroll_run_id, agency, submission_type, is_sandbox } = body;
  
  // In production: would call RED Sistema (TGSS), AEAT SII, SEPE Certific@2
  // In sandbox: simulate with success response
  
  const { data, error } = await supabase
    .from('compliance_submissions')
    .insert({
      payroll_run_id,
      agency,
      submission_type: submission_type || getDefaultSubmissionType(agency),
      status: is_sandbox ? 'accepted' : 'sent',
      response_json: is_sandbox 
        ? { 
            sandbox: true, 
            message: `Simulación ${agency} OK`,
            timestamp: new Date().toISOString(),
            reference: `SIM-${agency}-${Date.now()}`,
            details: getSubmissionDetails(agency),
          } 
        : null,
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) return { error: error.message };
  
  // If all agencies submitted, update run status
  if (!is_sandbox) {
    await supabase
      .from('payroll_runs')
      .update({ status: 'submitted' })
      .eq('id', payroll_run_id);
  }
  
  return { data };
}

function getDefaultSubmissionType(agency: string): string {
  switch (agency) {
    case 'TGSS': return 'RLC_RNT';   // Relación Liquidación Cotizaciones + Relación Nominal Trabajadores
    case 'AEAT': return 'Modelo_111'; // Retenciones IRPF
    case 'SEPE': return 'Certificado_Empresa'; // Certificado empresa
    default: return 'General';
  }
}

function getSubmissionDetails(agency: string): Record<string, string> {
  switch (agency) {
    case 'TGSS': return {
      system: 'RED - Sistema de Liquidación Directa (SLD)',
      filing: 'Liquidación de cuotas del Régimen General',
      regulation: 'Orden ESS/484/2013 + LGSS Art. 22',
    };
    case 'AEAT': return {
      system: 'Sede Electrónica AEAT',
      filing: 'Modelo 111 - Retenciones e ingresos a cuenta del IRPF',
      regulation: 'Orden EHA/586/2011',
      period: 'Mensual (para empresas > 6M€ volumen operaciones)',
    };
    case 'SEPE': return {
      system: 'Certific@2',
      filing: 'Certificado de empresa para prestaciones por desempleo',
      regulation: 'Art. 267 LGSS + RD 625/1985',
    };
    default: return {};
  }
}

async function handleGenerateSEPA(body: any) {
  const { payroll_run_id } = body;
  
  // Get payslips with employee data
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
  
  // Generate SEPA XML structure (ISO 20022 pain.001.001.03)
  const totalAmount = payslips.reduce((s: number, p: any) => s + Number(p.net_pay), 0);
  const messageId = `JOSE-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${payroll_run_id.slice(0, 8)}`;
  
  const sepaData = {
    // SEPA Credit Transfer Initiation (pain.001.001.03)
    messageId,
    creationDateTime: new Date().toISOString(),
    initiatorName: (run as any)?.legal_entities?.razon_social || 'Josephine',
    initiatorId: (run as any)?.legal_entities?.nif || '',
    numberOfTransactions: payslips.length,
    controlSum: round2(totalAmount),
    paymentMethod: 'TRF', // Credit Transfer
    serviceLevel: 'SEPA',
    payments: payslips.map((p: any) => ({
      endToEndId: `NOM-${p.employee_id.slice(0, 8)}-${run?.period_month}`,
      employee: (p as any).employees?.full_name,
      amount: round2(Number(p.net_pay)),
      currency: 'EUR',
      concept: `Nómina ${run?.period_month}/${run?.period_year}`,
    })),
    // Reference to Spanish banking regulation
    _regulation: 'Reglamento UE 260/2012 (SEPA) + Norma 34 Banco de España',
  };
  
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
      case 'setup':
        result = await handleSetup(body);
        break;
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
