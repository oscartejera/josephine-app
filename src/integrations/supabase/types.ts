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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      get_user_group_id: { Args: never; Returns: string }
      has_payroll_role: { Args: never; Returns: boolean }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_admin_or_ops: { Args: never; Returns: boolean }
      is_payroll_admin: { Args: never; Returns: boolean }
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
