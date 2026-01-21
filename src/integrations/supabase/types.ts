export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      budgets_daily: {
        Row: {
          budget_cogs: number
          budget_labour: number
          budget_sales: number
          created_at: string
          date: string
          id: string
          location_id: string
        }
        Insert: {
          budget_cogs?: number
          budget_labour?: number
          budget_sales?: number
          created_at?: string
          date: string
          id?: string
          location_id: string
        }
        Update: {
          budget_cogs?: number
          budget_labour?: number
          budget_sales?: number
          created_at?: string
          date?: string
          id?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_daily_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_counts_daily: {
        Row: {
          cash_counted: number
          created_at: string
          date: string
          id: string
          location_id: string
          notes: string | null
        }
        Insert: {
          cash_counted?: number
          created_at?: string
          date: string
          id?: string
          location_id: string
          notes?: string | null
        }
        Update: {
          cash_counted?: number
          created_at?: string
          date?: string
          id?: string
          location_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_counts_daily_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      cogs_daily: {
        Row: {
          cogs_amount: number
          created_at: string
          date: string
          id: string
          location_id: string
        }
        Insert: {
          cogs_amount?: number
          created_at?: string
          date: string
          id?: string
          location_id: string
        }
        Update: {
          cogs_amount?: number
          created_at?: string
          date?: string
          id?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cogs_daily_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_submissions: {
        Row: {
          agency: Database["public"]["Enums"]["compliance_agency"]
          created_at: string
          id: string
          payload_file_url: string | null
          payroll_run_id: string
          response_json: Json | null
          status: Database["public"]["Enums"]["compliance_status"]
          submission_type: string
          submitted_at: string | null
        }
        Insert: {
          agency: Database["public"]["Enums"]["compliance_agency"]
          created_at?: string
          id?: string
          payload_file_url?: string | null
          payroll_run_id: string
          response_json?: Json | null
          status?: Database["public"]["Enums"]["compliance_status"]
          submission_type: string
          submitted_at?: string | null
        }
        Update: {
          agency?: Database["public"]["Enums"]["compliance_agency"]
          created_at?: string
          id?: string
          payload_file_url?: string | null
          payroll_run_id?: string
          response_json?: Json | null
          status?: Database["public"]["Enums"]["compliance_status"]
          submission_type?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_submissions_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_tokens: {
        Row: {
          created_at: string
          encrypted_blob: string
          expires_at: string | null
          id: string
          legal_entity_id: string
          provider: Database["public"]["Enums"]["token_provider"]
        }
        Insert: {
          created_at?: string
          encrypted_blob: string
          expires_at?: string | null
          id?: string
          legal_entity_id: string
          provider: Database["public"]["Enums"]["token_provider"]
        }
        Update: {
          created_at?: string
          encrypted_blob?: string
          expires_at?: string | null
          id?: string
          legal_entity_id?: string
          provider?: Database["public"]["Enums"]["token_provider"]
        }
        Relationships: [
          {
            foreignKeyName: "compliance_tokens_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      convenio_rules: {
        Row: {
          convenio_code: string
          created_at: string
          group_id: string
          id: string
          rule_json: Json
        }
        Insert: {
          convenio_code: string
          created_at?: string
          group_id: string
          id?: string
          rule_json?: Json
        }
        Update: {
          convenio_code?: string
          created_at?: string
          group_id?: string
          id?: string
          rule_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "convenio_rules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_legal: {
        Row: {
          created_at: string
          domicilio: string | null
          employee_id: string
          fecha_nacimiento: string | null
          iban: string | null
          id: string
          legal_entity_id: string
          nif: string | null
          nss: string | null
        }
        Insert: {
          created_at?: string
          domicilio?: string | null
          employee_id: string
          fecha_nacimiento?: string | null
          iban?: string | null
          id?: string
          legal_entity_id: string
          nif?: string | null
          nss?: string | null
        }
        Update: {
          created_at?: string
          domicilio?: string | null
          employee_id?: string
          fecha_nacimiento?: string | null
          iban?: string | null
          id?: string
          legal_entity_id?: string
          nif?: string | null
          nss?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_legal_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_legal_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean | null
          created_at: string
          external_id: string | null
          full_name: string
          hourly_cost: number | null
          id: string
          location_id: string
          role_name: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          external_id?: string | null
          full_name: string
          hourly_cost?: number | null
          id?: string
          location_id: string
          role_name?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string
          external_id?: string | null
          full_name?: string
          hourly_cost?: number | null
          id?: string
          location_id?: string
          role_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_contracts: {
        Row: {
          active: boolean
          base_salary_monthly: number
          category: string
          contract_type: string
          convenio_code: string | null
          created_at: string
          employee_id: string
          end_date: string | null
          extra_pays: Database["public"]["Enums"]["extra_pay_mode"]
          group_ss: string
          hourly_rate: number | null
          id: string
          irpf_mode: Database["public"]["Enums"]["irpf_mode"]
          irpf_rate: number | null
          jornada_pct: number
          legal_entity_id: string
          location_id: string | null
          start_date: string
        }
        Insert: {
          active?: boolean
          base_salary_monthly: number
          category: string
          contract_type: string
          convenio_code?: string | null
          created_at?: string
          employee_id: string
          end_date?: string | null
          extra_pays?: Database["public"]["Enums"]["extra_pay_mode"]
          group_ss: string
          hourly_rate?: number | null
          id?: string
          irpf_mode?: Database["public"]["Enums"]["irpf_mode"]
          irpf_rate?: number | null
          jornada_pct?: number
          legal_entity_id: string
          location_id?: string | null
          start_date: string
        }
        Update: {
          active?: boolean
          base_salary_monthly?: number
          category?: string
          contract_type?: string
          convenio_code?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string | null
          extra_pays?: Database["public"]["Enums"]["extra_pay_mode"]
          group_ss?: string
          hourly_rate?: number | null
          id?: string
          irpf_mode?: Database["public"]["Enums"]["irpf_mode"]
          irpf_rate?: number | null
          jornada_pct?: number
          legal_entity_id?: string
          location_id?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_contracts_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_contracts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_daily_metrics: {
        Row: {
          created_at: string
          date: string
          forecast_orders: number
          forecast_sales: number
          id: string
          location_id: string
          planned_labor_cost: number
          planned_labor_hours: number
        }
        Insert: {
          created_at?: string
          date: string
          forecast_orders?: number
          forecast_sales?: number
          id?: string
          location_id: string
          planned_labor_cost?: number
          planned_labor_hours?: number
        }
        Update: {
          created_at?: string
          date?: string
          forecast_orders?: number
          forecast_sales?: number
          id?: string
          location_id?: string
          planned_labor_cost?: number
          planned_labor_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "forecast_daily_metrics_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      forecasts: {
        Row: {
          created_at: string
          forecast_covers: number | null
          forecast_date: string
          forecast_sales: number | null
          hour: number
          id: string
          location_id: string
        }
        Insert: {
          created_at?: string
          forecast_covers?: number | null
          forecast_date: string
          forecast_sales?: number | null
          hour: number
          id?: string
          location_id: string
        }
        Update: {
          created_at?: string
          forecast_covers?: number | null
          forecast_date?: string
          forecast_sales?: number | null
          hour?: number
          id?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecasts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          category: string | null
          created_at: string
          current_stock: number | null
          group_id: string
          id: string
          last_cost: number | null
          name: string
          par_level: number | null
          unit: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          current_stock?: number | null
          group_id: string
          id?: string
          last_cost?: number | null
          name: string
          par_level?: number | null
          unit?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          current_stock?: number | null
          group_id?: string
          id?: string
          last_cost?: number | null
          name?: string
          par_level?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      labour_daily: {
        Row: {
          created_at: string
          date: string
          id: string
          labour_cost: number
          labour_hours: number
          location_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          labour_cost?: number
          labour_hours?: number
          location_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          labour_cost?: number
          labour_hours?: number
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labour_daily_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_entities: {
        Row: {
          cnae: string | null
          created_at: string
          domicilio_fiscal: string
          group_id: string
          id: string
          nif: string
          razon_social: string
        }
        Insert: {
          cnae?: string | null
          created_at?: string
          domicilio_fiscal: string
          group_id: string
          id?: string
          nif: string
          razon_social: string
        }
        Update: {
          cnae?: string | null
          created_at?: string
          domicilio_fiscal?: string
          group_id?: string
          id?: string
          nif?: string
          razon_social?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_entities_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      location_settings: {
        Row: {
          created_at: string
          default_cogs_percent: number | null
          id: string
          location_id: string
          target_col_percent: number | null
          target_gp_percent: number | null
        }
        Insert: {
          created_at?: string
          default_cogs_percent?: number | null
          id?: string
          location_id: string
          target_col_percent?: number | null
          target_gp_percent?: number | null
        }
        Update: {
          created_at?: string
          default_cogs_percent?: number | null
          id?: string
          location_id?: string
          target_col_percent?: number | null
          target_gp_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "location_settings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          city: string | null
          created_at: string
          currency: string | null
          group_id: string
          id: string
          name: string
          timezone: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          currency?: string | null
          group_id: string
          id?: string
          name: string
          timezone?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          currency?: string | null
          group_id?: string
          id?: string
          name?: string
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"] | null
          paid_at: string
          ticket_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          paid_at?: string
          ticket_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          paid_at?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_audit: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          group_id: string
          id: string
          payload_json: Json
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          group_id: string
          id?: string
          payload_json?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          group_id?: string
          id?: string
          payload_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "payroll_audit_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_concepts: {
        Row: {
          code: string
          cotizable_ss: boolean
          created_at: string
          group_id: string
          id: string
          is_default: boolean
          name: string
          taxable_irpf: boolean
          type: Database["public"]["Enums"]["concept_type"]
        }
        Insert: {
          code: string
          cotizable_ss?: boolean
          created_at?: string
          group_id: string
          id?: string
          is_default?: boolean
          name: string
          taxable_irpf?: boolean
          type: Database["public"]["Enums"]["concept_type"]
        }
        Update: {
          code?: string
          cotizable_ss?: boolean
          created_at?: string
          group_id?: string
          id?: string
          is_default?: boolean
          name?: string
          taxable_irpf?: boolean
          type?: Database["public"]["Enums"]["concept_type"]
        }
        Relationships: [
          {
            foreignKeyName: "payroll_concepts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_inputs: {
        Row: {
          bonuses_json: Json | null
          created_at: string
          deductions_json: Json | null
          employee_id: string
          hours_holiday: number
          hours_night: number
          hours_overtime: number
          hours_regular: number
          id: string
          location_id: string | null
          period_month: number
          period_year: number
          tips_json: Json | null
        }
        Insert: {
          bonuses_json?: Json | null
          created_at?: string
          deductions_json?: Json | null
          employee_id: string
          hours_holiday?: number
          hours_night?: number
          hours_overtime?: number
          hours_regular?: number
          id?: string
          location_id?: string | null
          period_month: number
          period_year: number
          tips_json?: Json | null
        }
        Update: {
          bonuses_json?: Json | null
          created_at?: string
          deductions_json?: Json | null
          employee_id?: string
          hours_holiday?: number
          hours_night?: number
          hours_overtime?: number
          hours_regular?: number
          id?: string
          location_id?: string | null
          period_month?: number
          period_year?: number
          tips_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_inputs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_inputs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          group_id: string
          id: string
          legal_entity_id: string
          period_month: number
          period_year: number
          status: Database["public"]["Enums"]["payroll_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          group_id: string
          id?: string
          legal_entity_id: string
          period_month: number
          period_year: number
          status?: Database["public"]["Enums"]["payroll_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          group_id?: string
          id?: string
          legal_entity_id?: string
          period_month?: number
          period_year?: number
          status?: Database["public"]["Enums"]["payroll_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_settings: {
        Row: {
          created_at: string
          group_id: string
          id: string
          setting_json: Json
          setting_type: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          setting_json?: Json
          setting_type: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          setting_json?: Json
          setting_type?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip_lines: {
        Row: {
          amount: number
          concept_code: string
          concept_name: string
          id: string
          payslip_id: string
          type: Database["public"]["Enums"]["concept_type"]
        }
        Insert: {
          amount: number
          concept_code: string
          concept_name: string
          id?: string
          payslip_id: string
          type: Database["public"]["Enums"]["concept_type"]
        }
        Update: {
          amount?: number
          concept_code?: string
          concept_name?: string
          id?: string
          payslip_id?: string
          type?: Database["public"]["Enums"]["concept_type"]
        }
        Relationships: [
          {
            foreignKeyName: "payslip_lines_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          employee_id: string
          employee_ss: number
          employer_ss: number
          generated_at: string
          gross_pay: number
          id: string
          irpf_withheld: number
          net_pay: number
          other_deductions: number
          payroll_run_id: string
          pdf_url: string | null
        }
        Insert: {
          employee_id: string
          employee_ss?: number
          employer_ss?: number
          generated_at?: string
          gross_pay?: number
          id?: string
          irpf_withheld?: number
          net_pay?: number
          other_deductions?: number
          payroll_run_id: string
          pdf_url?: string | null
        }
        Update: {
          employee_id?: string
          employee_ss?: number
          employer_ss?: number
          generated_at?: string
          gross_pay?: number
          id?: string
          irpf_withheld?: number
          net_pay?: number
          other_deductions?: number
          payroll_run_id?: string
          pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          module: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          module: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          module?: string
        }
        Relationships: []
      }
      planned_shifts: {
        Row: {
          created_at: string
          employee_id: string
          end_time: string
          id: string
          location_id: string
          planned_cost: number | null
          planned_hours: number
          role: string | null
          shift_date: string
          start_time: string
          status: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_time: string
          id?: string
          location_id: string
          planned_cost?: number | null
          planned_hours: number
          role?: string | null
          shift_date: string
          start_time: string
          status?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_time?: string
          id?: string
          location_id?: string
          planned_cost?: number | null
          planned_hours?: number
          role?: string | null
          shift_date?: string
          start_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_connections: {
        Row: {
          config_json: Json | null
          created_at: string
          id: string
          last_sync_at: string | null
          location_id: string
          provider: Database["public"]["Enums"]["pos_provider"]
          status: Database["public"]["Enums"]["pos_status"] | null
        }
        Insert: {
          config_json?: Json | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          location_id: string
          provider: Database["public"]["Enums"]["pos_provider"]
          status?: Database["public"]["Enums"]["pos_status"] | null
        }
        Update: {
          config_json?: Json | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          location_id?: string
          provider?: Database["public"]["Enums"]["pos_provider"]
          status?: Database["public"]["Enums"]["pos_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_connections_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_daily_finance: {
        Row: {
          comps_amount: number
          created_at: string
          date: string
          discounts_amount: number
          gross_sales: number
          id: string
          location_id: string
          net_sales: number
          orders_count: number
          payments_card: number
          payments_cash: number
          payments_other: number
          refunds_amount: number
          refunds_count: number
          voids_amount: number
        }
        Insert: {
          comps_amount?: number
          created_at?: string
          date: string
          discounts_amount?: number
          gross_sales?: number
          id?: string
          location_id: string
          net_sales?: number
          orders_count?: number
          payments_card?: number
          payments_cash?: number
          payments_other?: number
          refunds_amount?: number
          refunds_count?: number
          voids_amount?: number
        }
        Update: {
          comps_amount?: number
          created_at?: string
          date?: string
          discounts_amount?: number
          gross_sales?: number
          id?: string
          location_id?: string
          net_sales?: number
          orders_count?: number
          payments_card?: number
          payments_cash?: number
          payments_other?: number
          refunds_amount?: number
          refunds_count?: number
          voids_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_daily_finance_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_daily_metrics: {
        Row: {
          created_at: string
          date: string
          id: string
          labor_cost: number
          labor_hours: number
          location_id: string
          net_sales: number
          orders: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          labor_cost?: number
          labor_hours?: number
          location_id: string
          net_sales?: number
          orders?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          labor_cost?: number
          labor_hours?: number
          location_id?: string
          net_sales?: number
          orders?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_daily_metrics_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales_daily: {
        Row: {
          cogs: number
          created_at: string | null
          date: string
          id: string
          location_id: string
          net_sales: number
          product_id: string
          units_sold: number
        }
        Insert: {
          cogs?: number
          created_at?: string | null
          date: string
          id?: string
          location_id: string
          net_sales?: number
          product_id: string
          units_sold?: number
        }
        Update: {
          cogs?: number
          created_at?: string | null
          date?: string
          id?: string
          location_id?: string
          net_sales?: number
          product_id?: string
          units_sold?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_sales_daily_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_daily_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string | null
          group_id: string
          id: string
          is_active: boolean | null
          location_id: string | null
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          group_id: string
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          group_id?: string
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          group_id: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          group_id?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          group_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          id: string
          inventory_item_id: string
          purchase_order_id: string
          quantity: number
          unit_cost: number | null
        }
        Insert: {
          id?: string
          inventory_item_id: string
          purchase_order_id: string
          quantity: number
          unit_cost?: number | null
        }
        Update: {
          id?: string
          inventory_item_id?: string
          purchase_order_id?: string
          quantity?: number
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          group_id: string
          id: string
          location_id: string | null
          status: Database["public"]["Enums"]["po_status"] | null
          supplier_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          location_id?: string | null
          status?: Database["public"]["Enums"]["po_status"] | null
          supplier_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          location_id?: string | null
          status?: Database["public"]["Enums"]["po_status"] | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          id: string
          inventory_item_id: string
          quantity: number
          recipe_id: string
        }
        Insert: {
          id?: string
          inventory_item_id: string
          quantity: number
          recipe_id: string
        }
        Update: {
          id?: string
          inventory_item_id?: string
          quantity?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          group_id: string
          id: string
          menu_item_name: string
          selling_price: number | null
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          menu_item_name: string
          selling_price?: number | null
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          menu_item_name?: string
          selling_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          ai_draft: string | null
          ai_tone: string | null
          author_avatar_url: string | null
          author_name: string
          created_at: string
          external_id: string | null
          id: string
          is_verified: boolean | null
          language: string | null
          location_id: string
          platform: string
          rating: number
          response_date: string | null
          response_status: string | null
          response_text: string | null
          review_date: string
          review_text: string | null
          sentiment: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          ai_draft?: string | null
          ai_tone?: string | null
          author_avatar_url?: string | null
          author_name: string
          created_at?: string
          external_id?: string | null
          id?: string
          is_verified?: boolean | null
          language?: string | null
          location_id: string
          platform: string
          rating: number
          response_date?: string | null
          response_status?: string | null
          response_text?: string | null
          review_date: string
          review_text?: string | null
          sentiment?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          ai_draft?: string | null
          ai_tone?: string | null
          author_avatar_url?: string | null
          author_name?: string
          created_at?: string
          external_id?: string | null
          id?: string
          is_verified?: boolean | null
          language?: string | null
          location_id?: string
          platform?: string
          rating?: number
          response_date?: string | null
          response_status?: string | null
          response_text?: string | null
          review_date?: string
          review_text?: string | null
          sentiment?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
        }
        Relationships: []
      }
      social_security_accounts: {
        Row: {
          ccc: string
          created_at: string
          id: string
          legal_entity_id: string
          provincia: string | null
        }
        Insert: {
          ccc: string
          created_at?: string
          id?: string
          legal_entity_id: string
          provincia?: string | null
        }
        Update: {
          ccc?: string
          created_at?: string
          id?: string
          legal_entity_id?: string
          provincia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_security_accounts_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_lines: {
        Row: {
          batch_balance: number | null
          closing_qty: number | null
          deliveries_qty: number | null
          id: string
          inventory_item_id: string
          opening_qty: number | null
          sales_qty: number | null
          stock_count_id: string
          transfers_net_qty: number | null
          updated_at: string
          used_qty: number | null
          variance_qty: number | null
        }
        Insert: {
          batch_balance?: number | null
          closing_qty?: number | null
          deliveries_qty?: number | null
          id?: string
          inventory_item_id: string
          opening_qty?: number | null
          sales_qty?: number | null
          stock_count_id: string
          transfers_net_qty?: number | null
          updated_at?: string
          used_qty?: number | null
          variance_qty?: number | null
        }
        Update: {
          batch_balance?: number | null
          closing_qty?: number | null
          deliveries_qty?: number | null
          id?: string
          inventory_item_id?: string
          opening_qty?: number | null
          sales_qty?: number | null
          stock_count_id?: string
          transfers_net_qty?: number | null
          updated_at?: string
          used_qty?: number | null
          variance_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_lines_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_stock_count_id_fkey"
            columns: ["stock_count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          created_at: string
          end_date: string
          group_id: string
          id: string
          location_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          group_id: string
          id?: string
          location_id: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          group_id?: string
          id?: string
          location_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          email: string | null
          group_id: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          group_id: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          group_id?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_accounts: {
        Row: {
          aeat_delegacion: string | null
          created_at: string
          id: string
          legal_entity_id: string
        }
        Insert: {
          aeat_delegacion?: string | null
          created_at?: string
          id?: string
          legal_entity_id: string
        }
        Update: {
          aeat_delegacion?: string | null
          created_at?: string
          id?: string
          legal_entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_accounts_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_lines: {
        Row: {
          category_name: string | null
          comped: boolean | null
          created_at: string
          discount_line_total: number | null
          external_line_id: string | null
          gross_line_total: number | null
          id: string
          item_external_id: string | null
          item_name: string
          quantity: number | null
          tax_rate: number | null
          ticket_id: string
          unit_price: number | null
          voided: boolean | null
        }
        Insert: {
          category_name?: string | null
          comped?: boolean | null
          created_at?: string
          discount_line_total?: number | null
          external_line_id?: string | null
          gross_line_total?: number | null
          id?: string
          item_external_id?: string | null
          item_name: string
          quantity?: number | null
          tax_rate?: number | null
          ticket_id: string
          unit_price?: number | null
          voided?: boolean | null
        }
        Update: {
          category_name?: string | null
          comped?: boolean | null
          created_at?: string
          discount_line_total?: number | null
          external_line_id?: string | null
          gross_line_total?: number | null
          id?: string
          item_external_id?: string | null
          item_name?: string
          quantity?: number | null
          tax_rate?: number | null
          ticket_id?: string
          unit_price?: number | null
          voided?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_lines_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          channel: Database["public"]["Enums"]["ticket_channel"] | null
          closed_at: string | null
          covers: number | null
          created_at: string
          discount_total: number | null
          external_id: string | null
          gross_total: number | null
          id: string
          location_id: string
          net_total: number | null
          opened_at: string
          status: Database["public"]["Enums"]["ticket_status"] | null
          table_name: string | null
          tax_total: number | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["ticket_channel"] | null
          closed_at?: string | null
          covers?: number | null
          created_at?: string
          discount_total?: number | null
          external_id?: string | null
          gross_total?: number | null
          id?: string
          location_id: string
          net_total?: number | null
          opened_at?: string
          status?: Database["public"]["Enums"]["ticket_status"] | null
          table_name?: string | null
          tax_total?: number | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["ticket_channel"] | null
          closed_at?: string | null
          covers?: number | null
          created_at?: string
          discount_total?: number | null
          external_id?: string | null
          gross_total?: number | null
          id?: string
          location_id?: string
          net_total?: number | null
          opened_at?: string
          status?: Database["public"]["Enums"]["ticket_status"] | null
          table_name?: string | null
          tax_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved: boolean | null
          clock_in: string
          clock_out: string | null
          created_at: string
          employee_id: string
          id: string
          labor_cost: number | null
          location_id: string
          minutes: number | null
        }
        Insert: {
          approved?: boolean | null
          clock_in: string
          clock_out?: string | null
          created_at?: string
          employee_id: string
          id?: string
          labor_cost?: number | null
          location_id: string
          minutes?: number | null
        }
        Update: {
          approved?: boolean | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          labor_cost?: number | null
          location_id?: string
          minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_locations: {
        Row: {
          created_at: string
          id: string
          location_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          location_id: string | null
          role_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          location_id?: string | null
          role_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          location_id?: string | null
          role_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_events: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          location_id: string
          quantity: number
          reason: string | null
          waste_value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          location_id: string
          quantity: number
          reason?: string | null
          waste_value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          location_id?: string
          quantity?: number
          reason?: string | null
          waste_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "waste_events_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_location: { Args: { _location_id: string }; Returns: boolean }
      get_accessible_location_ids: { Args: never; Returns: string[] }
      get_labour_kpis: {
        Args: {
          date_from: string
          date_to: string
          selected_location_id?: string
        }
        Returns: Json
      }
      get_labour_locations_table: {
        Args: {
          date_from: string
          date_to: string
          selected_location_id?: string
        }
        Returns: {
          col_actual_pct: number
          col_delta_pct: number
          col_projected_pct: number
          hours_actual: number
          hours_projected: number
          is_summary: boolean
          labor_cost_actual: number
          labor_cost_projected: number
          location_id: string
          location_name: string
          oplh_actual: number
          oplh_delta_pct: number
          oplh_projected: number
          sales_actual: number
          sales_delta_pct: number
          sales_projected: number
          splh_actual: number
          splh_delta_pct: number
          splh_projected: number
        }[]
      }
      get_labour_timeseries: {
        Args: {
          date_from: string
          date_to: string
          selected_location_id?: string
        }
        Returns: {
          actual_col_pct: number
          actual_hours: number
          actual_labor_cost: number
          actual_oplh: number
          actual_orders: number
          actual_sales: number
          actual_splh: number
          date: string
          forecast_orders: number
          forecast_sales: number
          planned_col_pct: number
          planned_hours: number
          planned_labor_cost: number
          planned_oplh: number
          planned_splh: number
        }[]
      }
      get_top_products: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_location_id?: string
          p_order_by?: string
        }
        Returns: {
          badge_label: string
          category: string
          cogs: number
          gp: number
          gp_pct: number
          product_id: string
          product_name: string
          sales: number
          sales_share_pct: number
          units: number
        }[]
      }
      get_user_accessible_locations: {
        Args: { _user_id?: string }
        Returns: string[]
      }
      get_user_group_id: { Args: never; Returns: string }
      get_user_has_global_scope: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      get_user_permissions: {
        Args: { _location_id?: string; _user_id?: string }
        Returns: {
          module: string
          permission_key: string
        }[]
      }
      get_user_roles_with_scope: {
        Args: { _user_id?: string }
        Returns: {
          location_id: string
          location_name: string
          role_id: string
          role_name: string
        }[]
      }
      has_payroll_role: { Args: never; Returns: boolean }
      has_permission: {
        Args: {
          _location_id?: string
          _permission_key: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_admin_or_ops: { Args: never; Returns: boolean }
      is_owner: { Args: { _user_id?: string }; Returns: boolean }
      is_payroll_admin: { Args: never; Returns: boolean }
      seed_demo_labour_data: {
        Args: { p_days?: number; p_locations?: number }
        Returns: Json
      }
      seed_demo_products_and_sales: {
        Args: { p_group_id: string }
        Returns: undefined
      }
      seed_roles_and_permissions: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "owner_admin"
        | "ops_manager"
        | "location_manager"
        | "viewer"
        | "payroll_admin"
        | "payroll_operator"
      compliance_agency: "TGSS" | "AEAT" | "SEPE"
      compliance_status: "draft" | "signed" | "sent" | "accepted" | "rejected"
      concept_type: "earning" | "deduction"
      extra_pay_mode: "prorrateada" | "no_prorrateada"
      irpf_mode: "manual" | "tabla"
      payment_method: "card" | "cash" | "other"
      payroll_status:
        | "draft"
        | "validated"
        | "calculated"
        | "approved"
        | "submitted"
        | "paid"
      po_status: "draft" | "sent" | "received"
      pos_provider: "revo" | "glop" | "square" | "lightspeed" | "csv"
      pos_status: "connected" | "disconnected" | "error" | "syncing"
      ticket_channel: "dinein" | "takeaway" | "delivery" | "unknown"
      ticket_status: "open" | "closed"
      token_provider:
        | "certificate_p12"
        | "certificate_local_agent"
        | "oauth_provider"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "owner_admin",
        "ops_manager",
        "location_manager",
        "viewer",
        "payroll_admin",
        "payroll_operator",
      ],
      compliance_agency: ["TGSS", "AEAT", "SEPE"],
      compliance_status: ["draft", "signed", "sent", "accepted", "rejected"],
      concept_type: ["earning", "deduction"],
      extra_pay_mode: ["prorrateada", "no_prorrateada"],
      irpf_mode: ["manual", "tabla"],
      payment_method: ["card", "cash", "other"],
      payroll_status: [
        "draft",
        "validated",
        "calculated",
        "approved",
        "submitted",
        "paid",
      ],
      po_status: ["draft", "sent", "received"],
      pos_provider: ["revo", "glop", "square", "lightspeed", "csv"],
      pos_status: ["connected", "disconnected", "error", "syncing"],
      ticket_channel: ["dinein", "takeaway", "delivery", "unknown"],
      ticket_status: ["open", "closed"],
      token_provider: [
        "certificate_p12",
        "certificate_local_agent",
        "oauth_provider",
      ],
    },
  },
} as const
