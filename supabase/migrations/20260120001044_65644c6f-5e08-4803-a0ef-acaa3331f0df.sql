-- =====================================================
-- PAYROLL MODULE - PART 1: ENUMS AND TABLES
-- =====================================================

-- 1. ADD NEW PAYROLL ROLES TO EXISTING ENUM
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'payroll_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'payroll_operator';

-- 2. CREATE NEW ENUMS FOR PAYROLL
CREATE TYPE public.extra_pay_mode AS ENUM ('prorrateada', 'no_prorrateada');
CREATE TYPE public.irpf_mode AS ENUM ('manual', 'tabla');
CREATE TYPE public.payroll_status AS ENUM ('draft', 'validated', 'calculated', 'approved', 'submitted', 'paid');
CREATE TYPE public.concept_type AS ENUM ('earning', 'deduction');
CREATE TYPE public.compliance_agency AS ENUM ('TGSS', 'AEAT', 'SEPE');
CREATE TYPE public.compliance_status AS ENUM ('draft', 'signed', 'sent', 'accepted', 'rejected');
CREATE TYPE public.token_provider AS ENUM ('certificate_p12', 'certificate_local_agent', 'oauth_provider');

-- 3. LEGAL ENTITIES TABLE
CREATE TABLE public.legal_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  razon_social TEXT NOT NULL,
  nif TEXT NOT NULL,
  domicilio_fiscal TEXT NOT NULL,
  cnae TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. SOCIAL SECURITY ACCOUNTS
CREATE TABLE public.social_security_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  ccc TEXT NOT NULL,
  provincia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TAX ACCOUNTS
CREATE TABLE public.tax_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  aeat_delegacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. EMPLOYEE LEGAL DATA
CREATE TABLE public.employee_legal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  legal_entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  nif TEXT,
  nss TEXT,
  iban TEXT,
  domicilio TEXT,
  fecha_nacimiento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, legal_entity_id)
);

-- 7. EMPLOYMENT CONTRACTS
CREATE TABLE public.employment_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  legal_entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  contract_type TEXT NOT NULL,
  jornada_pct NUMERIC NOT NULL DEFAULT 100,
  group_ss TEXT NOT NULL,
  category TEXT NOT NULL,
  convenio_code TEXT,
  base_salary_monthly NUMERIC NOT NULL,
  hourly_rate NUMERIC,
  extra_pays public.extra_pay_mode NOT NULL DEFAULT 'no_prorrateada',
  irpf_mode public.irpf_mode NOT NULL DEFAULT 'manual',
  irpf_rate NUMERIC,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. PAYROLL CONCEPTS
CREATE TABLE public.payroll_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type public.concept_type NOT NULL,
  taxable_irpf BOOLEAN NOT NULL DEFAULT true,
  cotizable_ss BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, code)
);

-- 9. CONVENIO RULES
CREATE TABLE public.convenio_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  convenio_code TEXT NOT NULL,
  rule_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, convenio_code)
);

-- 10. PAYROLL INPUTS
CREATE TABLE public.payroll_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  hours_regular NUMERIC NOT NULL DEFAULT 0,
  hours_night NUMERIC NOT NULL DEFAULT 0,
  hours_holiday NUMERIC NOT NULL DEFAULT 0,
  hours_overtime NUMERIC NOT NULL DEFAULT 0,
  bonuses_json JSONB DEFAULT '[]',
  deductions_json JSONB DEFAULT '[]',
  tips_json JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, period_year, period_month)
);

-- 11. PAYROLL RUNS
CREATE TABLE public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  legal_entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status public.payroll_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  UNIQUE(legal_entity_id, period_year, period_month)
);

-- 12. PAYSLIPS
CREATE TABLE public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  gross_pay NUMERIC NOT NULL DEFAULT 0,
  employee_ss NUMERIC NOT NULL DEFAULT 0,
  employer_ss NUMERIC NOT NULL DEFAULT 0,
  irpf_withheld NUMERIC NOT NULL DEFAULT 0,
  other_deductions NUMERIC NOT NULL DEFAULT 0,
  net_pay NUMERIC NOT NULL DEFAULT 0,
  pdf_url TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payroll_run_id, employee_id)
);

-- 13. PAYSLIP LINES
CREATE TABLE public.payslip_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  concept_code TEXT NOT NULL,
  concept_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type public.concept_type NOT NULL
);

-- 14. COMPLIANCE SUBMISSIONS
CREATE TABLE public.compliance_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  agency public.compliance_agency NOT NULL,
  submission_type TEXT NOT NULL,
  payload_file_url TEXT,
  response_json JSONB,
  status public.compliance_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. COMPLIANCE TOKENS
CREATE TABLE public.compliance_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  provider public.token_provider NOT NULL,
  encrypted_blob BYTEA NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. PAYROLL AUDIT LOG
CREATE TABLE public.payroll_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. PAYROLL SETTINGS
CREATE TABLE public.payroll_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  setting_type TEXT NOT NULL,
  setting_json JSONB NOT NULL DEFAULT '{}',
  valid_from DATE NOT NULL,
  valid_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES
CREATE INDEX idx_legal_entities_group ON public.legal_entities(group_id);
CREATE INDEX idx_employee_legal_employee ON public.employee_legal(employee_id);
CREATE INDEX idx_contracts_employee ON public.employment_contracts(employee_id);
CREATE INDEX idx_contracts_active ON public.employment_contracts(active) WHERE active = true;
CREATE INDEX idx_payroll_inputs_period ON public.payroll_inputs(period_year, period_month);
CREATE INDEX idx_payroll_runs_period ON public.payroll_runs(period_year, period_month);
CREATE INDEX idx_payroll_runs_status ON public.payroll_runs(status);
CREATE INDEX idx_payslips_run ON public.payslips(payroll_run_id);
CREATE INDEX idx_payslip_lines_payslip ON public.payslip_lines(payslip_id);
CREATE INDEX idx_compliance_submissions_run ON public.compliance_submissions(payroll_run_id);
CREATE INDEX idx_payroll_audit_created ON public.payroll_audit(created_at DESC);

-- Enable RLS on all tables
ALTER TABLE public.legal_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_security_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_legal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convenio_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;