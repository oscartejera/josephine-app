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
      announcements: {
        Row: {
          author_id: string | null
          body: string | null
          created_at: string
          id: string
          location_id: string | null
          org_id: string
          pinned: boolean
          title: string
          type: string
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          org_id: string
          pinned?: boolean
          title: string
          type?: string
        }
        Update: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          org_id?: string
          pinned?: boolean
          title?: string
          type?: string
        }
        Relationships: []
      }
      budget_audit: {
        Row: {
          action: string
          budget_day_id: string | null
          budget_version_id: string
          created_at: string
          created_by: string | null
          diff: Json
          id: string
          org_id: string
        }
        Insert: {
          action: string
          budget_day_id?: string | null
          budget_version_id: string
          created_at?: string
          created_by?: string | null
          diff?: Json
          id?: string
          org_id: string
        }
        Update: {
          action?: string
          budget_day_id?: string | null
          budget_version_id?: string
          created_at?: string
          created_by?: string | null
          diff?: Json
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_audit_budget_day_id_fkey"
            columns: ["budget_day_id"]
            isOneToOne: false
            referencedRelation: "budget_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_audit_budget_version_id_fkey"
            columns: ["budget_version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_audit_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_audit_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_day_profiles: {
        Row: {
          budget_day_id: string
          profile_id: string
        }
        Insert: {
          budget_day_id: string
          profile_id: string
        }
        Update: {
          budget_day_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_day_profiles_budget_day_id_fkey"
            columns: ["budget_day_id"]
            isOneToOne: false
            referencedRelation: "budget_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_day_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "budget_hourly_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_days: {
        Row: {
          budget_version_id: string
          channel_id: string | null
          day: string
          event_name: string | null
          id: string
          is_event: boolean
          is_holiday: boolean
          location_id: string | null
          notes: string | null
          org_id: string
        }
        Insert: {
          budget_version_id: string
          channel_id?: string | null
          day: string
          event_name?: string | null
          id?: string
          is_event?: boolean
          is_holiday?: boolean
          location_id?: string | null
          notes?: string | null
          org_id: string
        }
        Update: {
          budget_version_id?: string
          channel_id?: string | null
          day?: string
          event_name?: string | null
          id?: string
          is_event?: boolean
          is_holiday?: boolean
          location_id?: string | null
          notes?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_days_budget_version_id_fkey"
            columns: ["budget_version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_days_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_days_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_days_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_days_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_drivers: {
        Row: {
          budget_day_id: string
          mix_bev_pct: number | null
          mix_food_pct: number | null
          target_avg_check: number | null
          target_cogs_pct: number | null
          target_comps_pct: number | null
          target_covers: number | null
          target_discounts_pct: number | null
          target_hourly_rate: number | null
          target_labour_hours: number | null
          target_overtime_hours: number | null
          target_refunds_pct: number | null
          target_shrink_pct: number | null
          target_waste_pct: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          budget_day_id: string
          mix_bev_pct?: number | null
          mix_food_pct?: number | null
          target_avg_check?: number | null
          target_cogs_pct?: number | null
          target_comps_pct?: number | null
          target_covers?: number | null
          target_discounts_pct?: number | null
          target_hourly_rate?: number | null
          target_labour_hours?: number | null
          target_overtime_hours?: number | null
          target_refunds_pct?: number | null
          target_shrink_pct?: number | null
          target_waste_pct?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          budget_day_id?: string
          mix_bev_pct?: number | null
          mix_food_pct?: number | null
          target_avg_check?: number | null
          target_cogs_pct?: number | null
          target_comps_pct?: number | null
          target_covers?: number | null
          target_discounts_pct?: number | null
          target_hourly_rate?: number | null
          target_labour_hours?: number | null
          target_overtime_hours?: number | null
          target_refunds_pct?: number | null
          target_shrink_pct?: number | null
          target_waste_pct?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_drivers_budget_day_id_fkey"
            columns: ["budget_day_id"]
            isOneToOne: true
            referencedRelation: "budget_days"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_hourly_profile_points: {
        Row: {
          hour_of_day: number
          pct_of_day: number
          profile_id: string
        }
        Insert: {
          hour_of_day: number
          pct_of_day: number
          profile_id: string
        }
        Update: {
          hour_of_day?: number
          pct_of_day?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_hourly_profile_points_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "budget_hourly_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_hourly_profiles: {
        Row: {
          channel_id: string | null
          created_at: string
          day_of_week: number | null
          id: string
          location_id: string | null
          name: string
          org_id: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          day_of_week?: number | null
          id?: string
          location_id?: string | null
          name: string
          org_id: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          day_of_week?: number | null
          id?: string
          location_id?: string | null
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_hourly_profiles_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_hourly_profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_hourly_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_hourly_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_metrics: {
        Row: {
          budget_day_id: string
          layer: Database["public"]["Enums"]["budget_layer"]
          metric: Database["public"]["Enums"]["budget_metric"]
          source: string
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          budget_day_id: string
          layer?: Database["public"]["Enums"]["budget_layer"]
          metric: Database["public"]["Enums"]["budget_metric"]
          source?: string
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Update: {
          budget_day_id?: string
          layer?: Database["public"]["Enums"]["budget_layer"]
          metric?: Database["public"]["Enums"]["budget_metric"]
          source?: string
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_metrics_budget_day_id_fkey"
            columns: ["budget_day_id"]
            isOneToOne: false
            referencedRelation: "budget_days"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_versions: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          frozen_at: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          published_at: string | null
          scope: Database["public"]["Enums"]["budget_scope"]
          start_date: string
          status: Database["public"]["Enums"]["budget_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          frozen_at?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          published_at?: string | null
          scope?: Database["public"]["Enums"]["budget_scope"]
          start_date: string
          status?: Database["public"]["Enums"]["budget_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          frozen_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          published_at?: string | null
          scope?: Database["public"]["Enums"]["budget_scope"]
          start_date?: string
          status?: Database["public"]["Enums"]["budget_status"]
        }
        Relationships: [
          {
            foreignKeyName: "budget_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets_daily: {
        Row: {
          budget_cogs: number | null
          budget_labour: number | null
          budget_sales: number | null
          created_at: string
          date: string
          id: string
          location_id: string
        }
        Insert: {
          budget_cogs?: number | null
          budget_labour?: number | null
          budget_sales?: number | null
          created_at?: string
          date: string
          id?: string
          location_id: string
        }
        Update: {
          budget_cogs?: number | null
          budget_labour?: number | null
          budget_sales?: number | null
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
          cash_counted: number | null
          created_at: string
          date: string
          id: string
          location_id: string
          notes: string | null
        }
        Insert: {
          cash_counted?: number | null
          created_at?: string
          date: string
          id?: string
          location_id: string
          notes?: string | null
        }
        Update: {
          cash_counted?: number | null
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
      cdm_items: {
        Row: {
          category: string | null
          external_id: string | null
          id: string
          integration_account_id: string | null
          is_active: boolean
          metadata: Json
          name: string
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"] | null
        }
        Insert: {
          category?: string | null
          external_id?: string | null
          id?: string
          integration_account_id?: string | null
          is_active?: boolean
          metadata?: Json
          name: string
          org_id: string
          provider?: Database["public"]["Enums"]["integration_provider"] | null
        }
        Update: {
          category?: string | null
          external_id?: string | null
          id?: string
          integration_account_id?: string | null
          is_active?: boolean
          metadata?: Json
          name?: string
          org_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"] | null
        }
        Relationships: [
          {
            foreignKeyName: "cdm_items_integration_account_id_fkey"
            columns: ["integration_account_id"]
            isOneToOne: false
            referencedRelation: "integration_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cdm_order_lines: {
        Row: {
          discount: number
          gross: number
          id: string
          integration_account_id: string | null
          item_id: string | null
          metadata: Json
          name: string
          net: number
          order_id: string
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"] | null
          qty: number
          tax: number
        }
        Insert: {
          discount?: number
          gross?: number
          id?: string
          integration_account_id?: string | null
          item_id?: string | null
          metadata?: Json
          name: string
          net?: number
          order_id: string
          org_id: string
          provider?: Database["public"]["Enums"]["integration_provider"] | null
          qty?: number
          tax?: number
        }
        Update: {
          discount?: number
          gross?: number
          id?: string
          integration_account_id?: string | null
          item_id?: string | null
          metadata?: Json
          name?: string
          net?: number
          order_id?: string
          org_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"] | null
          qty?: number
          tax?: number
        }
        Relationships: [
          {
            foreignKeyName: "cdm_order_lines_integration_account_id_fkey"
            columns: ["integration_account_id"]
            isOneToOne: false
            referencedRelation: "integration_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "cdm_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "cdm_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_order_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_order_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cdm_orders: {
        Row: {
          closed_at: string | null
          comps: number
          discounts: number
          external_id: string | null
          gross_sales: number | null
          id: string
          integration_account_id: string | null
          location_id: string | null
          metadata: Json
          net_sales: number
          opened_at: string | null
          org_id: string
          payments_total: number
          provider: Database["public"]["Enums"]["integration_provider"] | null
          refunds: number
          tax: number
          tips: number
          voids: number
        }
        Insert: {
          closed_at?: string | null
          comps?: number
          discounts?: number
          external_id?: string | null
          gross_sales?: number | null
          id?: string
          integration_account_id?: string | null
          location_id?: string | null
          metadata?: Json
          net_sales?: number
          opened_at?: string | null
          org_id: string
          payments_total?: number
          provider?: Database["public"]["Enums"]["integration_provider"] | null
          refunds?: number
          tax?: number
          tips?: number
          voids?: number
        }
        Update: {
          closed_at?: string | null
          comps?: number
          discounts?: number
          external_id?: string | null
          gross_sales?: number | null
          id?: string
          integration_account_id?: string | null
          location_id?: string | null
          metadata?: Json
          net_sales?: number
          opened_at?: string | null
          org_id?: string
          payments_total?: number
          provider?: Database["public"]["Enums"]["integration_provider"] | null
          refunds?: number
          tax?: number
          tips?: number
          voids?: number
        }
        Relationships: [
          {
            foreignKeyName: "cdm_orders_integration_account_id_fkey"
            columns: ["integration_account_id"]
            isOneToOne: false
            referencedRelation: "integration_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cdm_payments: {
        Row: {
          amount: number
          id: string
          integration_account_id: string | null
          metadata: Json
          method: string
          order_id: string
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"] | null
        }
        Insert: {
          amount?: number
          id?: string
          integration_account_id?: string | null
          metadata?: Json
          method: string
          order_id: string
          org_id: string
          provider?: Database["public"]["Enums"]["integration_provider"] | null
        }
        Update: {
          amount?: number
          id?: string
          integration_account_id?: string | null
          metadata?: Json
          method?: string
          order_id?: string
          org_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"] | null
        }
        Relationships: [
          {
            foreignKeyName: "cdm_payments_integration_account_id_fkey"
            columns: ["integration_account_id"]
            isOneToOne: false
            referencedRelation: "integration_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "cdm_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_submissions: {
        Row: {
          created_at: string
          id: string
          payroll_run_id: string
          status: string | null
          submission_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          payroll_run_id: string
          status?: string | null
          submission_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          payroll_run_id?: string
          status?: string | null
          submission_type?: string | null
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
      daily_sales: {
        Row: {
          comps: number
          day: string
          discounts: number
          gross_sales: number
          location_id: string
          net_sales: number
          orders_count: number
          org_id: string
          payments_total: number
          refunds: number
          tax: number
          tips: number
          updated_at: string
          voids: number
        }
        Insert: {
          comps?: number
          day: string
          discounts?: number
          gross_sales?: number
          location_id: string
          net_sales?: number
          orders_count?: number
          org_id: string
          payments_total?: number
          refunds?: number
          tax?: number
          tips?: number
          updated_at?: string
          voids?: number
        }
        Update: {
          comps?: number
          day?: string
          discounts?: number
          gross_sales?: number
          location_id?: string
          net_sales?: number
          orders_count?: number
          org_id?: string
          payments_total?: number
          refunds?: number
          tax?: number
          tips?: number
          updated_at?: string
          voids?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          id: string
          name: string
          org_id: string
        }
        Insert: {
          id?: string
          name: string
          org_id: string
        }
        Update: {
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_availability: {
        Row: {
          created_at: string
          day_of_week: number
          employee_id: string
          end_time: string
          id: string
          is_available: boolean
          location_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          employee_id: string
          end_time: string
          id?: string
          is_available?: boolean
          location_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          employee_id?: string
          end_time?: string
          id?: string
          is_available?: boolean
          location_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_availability_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_availability_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_legal: {
        Row: {
          created_at: string
          employee_id: string
          iban: string | null
          id: string
          legal_entity_id: string | null
          nif: string | null
          nss: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          iban?: string | null
          id?: string
          legal_entity_id?: string | null
          nif?: string | null
          nss?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          iban?: string | null
          id?: string
          legal_entity_id?: string | null
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
      employee_locations: {
        Row: {
          created_at: string
          employee_id: string
          is_primary: boolean
          location_id: string
          primary_role_id: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          is_primary?: boolean
          location_id: string
          primary_role_id?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          is_primary?: boolean
          location_id?: string
          primary_role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_locations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_locations_primary_role_id_fkey"
            columns: ["primary_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean | null
          created_at: string
          email: string | null
          full_name: string
          hourly_cost: number | null
          id: string
          location_id: string | null
          org_id: string
          phone: string | null
          profile_user_id: string | null
          role_name: string | null
          status: Database["public"]["Enums"]["employment_status"]
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          email?: string | null
          full_name: string
          hourly_cost?: number | null
          id?: string
          location_id?: string | null
          org_id: string
          phone?: string | null
          profile_user_id?: string | null
          role_name?: string | null
          status?: Database["public"]["Enums"]["employment_status"]
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string
          email?: string | null
          full_name?: string
          hourly_cost?: number | null
          id?: string
          location_id?: string | null
          org_id?: string
          phone?: string | null
          profile_user_id?: string | null
          role_name?: string | null
          status?: Database["public"]["Enums"]["employment_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_user_id_fkey"
            columns: ["profile_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      employment_contracts: {
        Row: {
          active: boolean | null
          base_salary_monthly: number | null
          contract_type: string | null
          created_at: string
          employee_id: string
          hourly_rate: number | null
          id: string
          irpf_rate: number | null
          jornada_pct: number | null
          legal_entity_id: string | null
        }
        Insert: {
          active?: boolean | null
          base_salary_monthly?: number | null
          contract_type?: string | null
          created_at?: string
          employee_id: string
          hourly_rate?: number | null
          id?: string
          irpf_rate?: number | null
          jornada_pct?: number | null
          legal_entity_id?: string | null
        }
        Update: {
          active?: boolean | null
          base_salary_monthly?: number | null
          contract_type?: string | null
          created_at?: string
          employee_id?: string
          hourly_rate?: number | null
          id?: string
          irpf_rate?: number | null
          jornada_pct?: number | null
          legal_entity_id?: string | null
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
        ]
      }
      event_processing_errors: {
        Row: {
          created_at: string
          entity: string | null
          error: string
          external_id: string | null
          id: string
          org_id: string
          payload: Json | null
          provider: Database["public"]["Enums"]["integration_provider"]
          raw_event_id: string | null
        }
        Insert: {
          created_at?: string
          entity?: string | null
          error: string
          external_id?: string | null
          id?: string
          org_id: string
          payload?: Json | null
          provider: Database["public"]["Enums"]["integration_provider"]
          raw_event_id?: string | null
        }
        Update: {
          created_at?: string
          entity?: string | null
          error?: string
          external_id?: string | null
          id?: string
          org_id?: string
          payload?: Json | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          raw_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_processing_errors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_processing_errors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_processing_errors_raw_event_id_fkey"
            columns: ["raw_event_id"]
            isOneToOne: false
            referencedRelation: "raw_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_replay_jobs: {
        Row: {
          attempts: number
          created_at: string
          finished_at: string | null
          id: string
          last_error: string | null
          max_attempts: number
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          raw_event_id: string
          run_after: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          raw_event_id: string
          run_after?: string
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          org_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          raw_event_id?: string
          run_after?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_replay_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_replay_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_replay_jobs_raw_event_id_fkey"
            columns: ["raw_event_id"]
            isOneToOne: false
            referencedRelation: "raw_events"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_daily_metrics: {
        Row: {
          created_at: string
          date: string
          forecast_orders: number | null
          forecast_sales: number | null
          id: string
          location_id: string
          planned_labor_cost: number | null
          planned_labor_hours: number | null
        }
        Insert: {
          created_at?: string
          date: string
          forecast_orders?: number | null
          forecast_sales?: number | null
          id?: string
          location_id: string
          planned_labor_cost?: number | null
          planned_labor_hours?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          forecast_orders?: number | null
          forecast_sales?: number | null
          id?: string
          location_id?: string
          planned_labor_cost?: number | null
          planned_labor_hours?: number | null
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
      forecast_points: {
        Row: {
          day: string
          forecast_run_id: string
          location_id: string
          org_id: string
          yhat: number
          yhat_lower: number | null
          yhat_upper: number | null
        }
        Insert: {
          day: string
          forecast_run_id: string
          location_id: string
          org_id: string
          yhat: number
          yhat_lower?: number | null
          yhat_upper?: number | null
        }
        Update: {
          day?: string
          forecast_run_id?: string
          location_id?: string
          org_id?: string
          yhat?: number
          yhat_lower?: number | null
          yhat_upper?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forecast_points_forecast_run_id_fkey"
            columns: ["forecast_run_id"]
            isOneToOne: false
            referencedRelation: "forecast_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_runs: {
        Row: {
          created_by: string | null
          error: string | null
          finished_at: string | null
          horizon_days: number
          id: string
          location_id: string
          metric: string
          org_id: string
          requested_at: string
          started_at: string | null
          status: string
          train_end: string
          train_start: string
        }
        Insert: {
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          horizon_days?: number
          id?: string
          location_id: string
          metric: string
          org_id: string
          requested_at?: string
          started_at?: string | null
          status?: string
          train_end: string
          train_start: string
        }
        Update: {
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          horizon_days?: number
          id?: string
          location_id?: string
          metric?: string
          org_id?: string
          requested_at?: string
          started_at?: string | null
          status?: string
          train_end?: string
          train_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_runs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          external_account_id: string | null
          id: string
          integration_id: string
          metadata: Json
          org_id: string | null
          provider: Database["public"]["Enums"]["integration_provider"] | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          external_account_id?: string | null
          id?: string
          integration_id: string
          metadata?: Json
          org_id?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"] | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          external_account_id?: string | null
          id?: string
          integration_id?: string
          metadata?: Json
          org_id?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"] | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_accounts_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_secrets: {
        Row: {
          access_token: string | null
          integration_account_id: string
          refresh_token: string | null
          rotated_at: string
          token_expires_at: string | null
        }
        Insert: {
          access_token?: string | null
          integration_account_id: string
          refresh_token?: string | null
          rotated_at?: string
          token_expires_at?: string | null
        }
        Update: {
          access_token?: string | null
          integration_account_id?: string
          refresh_token?: string | null
          rotated_at?: string
          token_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_secrets_integration_account_id_fkey"
            columns: ["integration_account_id"]
            isOneToOne: true
            referencedRelation: "integration_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_runs: {
        Row: {
          created_at: string
          cursor: Json | null
          error: string | null
          finished_at: string | null
          id: string
          integration_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["sync_status"]
        }
        Insert: {
          created_at?: string
          cursor?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          integration_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_status"]
        }
        Update: {
          created_at?: string
          cursor?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          integration_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_status"]
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_runs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          metadata: Json
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json
          org_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_item_location: {
        Row: {
          item_id: string
          location_id: string
          on_hand: number
          reorder_point: number
          safety_stock: number
          updated_at: string
        }
        Insert: {
          item_id: string
          location_id: string
          on_hand?: number
          reorder_point?: number
          safety_stock?: number
          updated_at?: string
        }
        Update: {
          item_id?: string
          location_id?: string
          on_hand?: number
          reorder_point?: number
          safety_stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_location_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_location_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          base_unit: string
          category_id: string | null
          created_at: string
          current_stock: number | null
          group_id: string | null
          id: string
          is_active: boolean
          last_cost: number | null
          main_supplier_id: string | null
          metadata: Json
          name: string
          order_unit: string
          org_id: string
          pack_size: number | null
          par_level: number | null
          price: number
          type: Database["public"]["Enums"]["item_type"]
          unit: string | null
          vat_rate: number
        }
        Insert: {
          base_unit?: string
          category_id?: string | null
          created_at?: string
          current_stock?: number | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          last_cost?: number | null
          main_supplier_id?: string | null
          metadata?: Json
          name: string
          order_unit: string
          org_id: string
          pack_size?: number | null
          par_level?: number | null
          price?: number
          type?: Database["public"]["Enums"]["item_type"]
          unit?: string | null
          vat_rate?: number
        }
        Update: {
          base_unit?: string
          category_id?: string | null
          created_at?: string
          current_stock?: number | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          last_cost?: number | null
          main_supplier_id?: string | null
          metadata?: Json
          name?: string
          order_unit?: string
          org_id?: string
          pack_size?: number | null
          par_level?: number | null
          price?: number
          type?: Database["public"]["Enums"]["item_type"]
          unit?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_main_supplier_id_fkey"
            columns: ["main_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          created_at: string
          finished_at: string | null
          heartbeat_at: string | null
          id: string
          job_type: Database["public"]["Enums"]["job_type"]
          last_error: string | null
          lease_seconds: number
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          org_id: string
          payload: Json
          priority: number
          provider: Database["public"]["Enums"]["integration_provider"] | null
          run_after: string
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          job_type: Database["public"]["Enums"]["job_type"]
          last_error?: string | null
          lease_seconds?: number
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          org_id: string
          payload?: Json
          priority?: number
          provider?: Database["public"]["Enums"]["integration_provider"] | null
          run_after?: string
          status?: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          last_error?: string | null
          lease_seconds?: number
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          org_id?: string
          payload?: Json
          priority?: number
          provider?: Database["public"]["Enums"]["integration_provider"] | null
          run_after?: string
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      labour_daily: {
        Row: {
          created_at: string
          date: string
          id: string
          labour_cost: number | null
          labour_hours: number | null
          location_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          labour_cost?: number | null
          labour_hours?: number | null
          location_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          labour_cost?: number | null
          labour_hours?: number | null
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
          domicilio_fiscal: string | null
          group_id: string
          id: string
          nif: string | null
          razon_social: string
        }
        Insert: {
          cnae?: string | null
          created_at?: string
          domicilio_fiscal?: string | null
          group_id: string
          id?: string
          nif?: string | null
          razon_social?: string
        }
        Update: {
          cnae?: string | null
          created_at?: string
          domicilio_fiscal?: string | null
          group_id?: string
          id?: string
          nif?: string | null
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
          {
            foreignKeyName: "legal_entities_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      location_memberships: {
        Row: {
          created_at: string
          location_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          location_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          location_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_memberships_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_settings: {
        Row: {
          closing_time: string | null
          created_at: string
          currency: string | null
          default_cogs_percent: number | null
          default_hourly_cost: number | null
          location_id: string
          opening_time: string | null
          splh_goal: number | null
          target_col_pct: number | null
          target_col_percent: number | null
          target_gp_pct: number | null
          target_gp_percent: number | null
          timezone: string | null
        }
        Insert: {
          closing_time?: string | null
          created_at?: string
          currency?: string | null
          default_cogs_percent?: number | null
          default_hourly_cost?: number | null
          location_id: string
          opening_time?: string | null
          splh_goal?: number | null
          target_col_pct?: number | null
          target_col_percent?: number | null
          target_gp_pct?: number | null
          target_gp_percent?: number | null
          timezone?: string | null
        }
        Update: {
          closing_time?: string | null
          created_at?: string
          currency?: string | null
          default_cogs_percent?: number | null
          default_hourly_cost?: number | null
          location_id?: string
          opening_time?: string | null
          splh_goal?: number | null
          target_col_pct?: number | null
          target_col_percent?: number | null
          target_gp_pct?: number | null
          target_gp_percent?: number | null
          timezone?: string | null
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
          active: boolean
          address: string | null
          city: string | null
          created_at: string
          group_id: string | null
          id: string
          name: string
          org_id: string
          timezone: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          name: string
          org_id: string
          timezone?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          name?: string
          org_id?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      low_stock_alerts: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          item_id: string
          location_id: string
          on_hand: number
          org_id: string
          reorder_point: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          item_id: string
          location_id: string
          on_hand: number
          org_id: string
          reorder_point: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          item_id?: string
          location_id?: string
          on_hand?: number
          org_id?: string
          reorder_point?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "low_stock_alerts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "low_stock_alerts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "low_stock_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "low_stock_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_members: {
        Row: {
          created_at: string
          email: string | null
          group_id: string
          id: string
          lifetime_points: number | null
          name: string
          notes: string | null
          phone: string | null
          points_balance: number | null
          tier: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          group_id: string
          id?: string
          lifetime_points?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          points_balance?: number | null
          tier?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          group_id?: string
          id?: string
          lifetime_points?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          points_balance?: number | null
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          created_at: string
          current_redemptions: number | null
          description: string | null
          group_id: string
          id: string
          is_active: boolean | null
          max_redemptions: number | null
          name: string
          points_cost: number
          product_id: string | null
          reward_type: string | null
          valid_from: string | null
          valid_until: string | null
          value: number | null
        }
        Insert: {
          created_at?: string
          current_redemptions?: number | null
          description?: string | null
          group_id: string
          id?: string
          is_active?: boolean | null
          max_redemptions?: number | null
          name?: string
          points_cost?: number
          product_id?: string | null
          reward_type?: string | null
          valid_from?: string | null
          valid_until?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string
          current_redemptions?: number | null
          description?: string | null
          group_id?: string
          id?: string
          is_active?: boolean | null
          max_redemptions?: number | null
          name?: string
          points_cost?: number
          product_id?: string | null
          reward_type?: string | null
          valid_from?: string | null
          valid_until?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_settings: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_enabled: boolean | null
          points_per_euro: number | null
          tier_rules: Json | null
          updated_at: string
          welcome_bonus: number | null
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_enabled?: boolean | null
          points_per_euro?: number | null
          tier_rules?: Json | null
          updated_at?: string
          welcome_bonus?: number | null
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_enabled?: boolean | null
          points_per_euro?: number | null
          tier_rules?: Json | null
          updated_at?: string
          welcome_bonus?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location_id: string | null
          member_id: string
          points: number
          ticket_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location_id?: string | null
          member_id: string
          points?: number
          ticket_id?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location_id?: string | null
          member_id?: string
          points?: number
          ticket_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "loyalty_members"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_mappings: {
        Row: {
          cdm_item_id: string
          menu_item_id: string
          org_id: string
        }
        Insert: {
          cdm_item_id: string
          menu_item_id: string
          org_id: string
        }
        Update: {
          cdm_item_id?: string
          menu_item_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_mappings_cdm_item_id_fkey"
            columns: ["cdm_item_id"]
            isOneToOne: false
            referencedRelation: "cdm_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_mappings_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_mappings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_mappings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          code_verifier: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          redirect_uri: string | null
          state: string
          used_at: string | null
        }
        Insert: {
          code_verifier?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          redirect_uri?: string | null
          state: string
          used_at?: string | null
        }
        Update: {
          code_verifier?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          org_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          redirect_uri?: string | null
          state?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_states_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_memberships: {
        Row: {
          created_at: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          data_source_mode: Database["public"]["Enums"]["data_source_mode"]
          demo_fallback_after_hours: number
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          data_source_mode?: Database["public"]["Enums"]["data_source_mode"]
          demo_fallback_after_hours?: number
          org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          data_source_mode?: Database["public"]["Enums"]["data_source_mode"]
          demo_fallback_after_hours?: number
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          name?: string
        }
        Relationships: []
      }
      payroll_inputs: {
        Row: {
          bonuses_json: Json | null
          created_at: string
          deductions_json: Json | null
          employee_id: string
          hours_holiday: number | null
          hours_night: number | null
          hours_overtime: number | null
          hours_regular: number | null
          id: string
          period_month: number
          period_year: number
        }
        Insert: {
          bonuses_json?: Json | null
          created_at?: string
          deductions_json?: Json | null
          employee_id: string
          hours_holiday?: number | null
          hours_night?: number | null
          hours_overtime?: number | null
          hours_regular?: number | null
          id?: string
          period_month: number
          period_year: number
        }
        Update: {
          bonuses_json?: Json | null
          created_at?: string
          deductions_json?: Json | null
          employee_id?: string
          hours_holiday?: number | null
          hours_night?: number | null
          hours_overtime?: number | null
          hours_regular?: number | null
          id?: string
          period_month?: number
          period_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_inputs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_location_settings: {
        Row: {
          accident_rate_employer: number | null
          contingencias_comunes_employee: number | null
          contingencias_comunes_employer: number | null
          created_at: string
          desempleo_employee: number | null
          desempleo_employer_indefinido: number | null
          desempleo_employer_temporal: number | null
          fogasa_employer: number | null
          formacion_employee: number | null
          formacion_employer: number | null
          irpf_employee: number | null
          location_id: string
          mei_employee: number | null
          mei_employer: number | null
          payments_per_year: number | null
        }
        Insert: {
          accident_rate_employer?: number | null
          contingencias_comunes_employee?: number | null
          contingencias_comunes_employer?: number | null
          created_at?: string
          desempleo_employee?: number | null
          desempleo_employer_indefinido?: number | null
          desempleo_employer_temporal?: number | null
          fogasa_employer?: number | null
          formacion_employee?: number | null
          formacion_employer?: number | null
          irpf_employee?: number | null
          location_id: string
          mei_employee?: number | null
          mei_employer?: number | null
          payments_per_year?: number | null
        }
        Update: {
          accident_rate_employer?: number | null
          contingencias_comunes_employee?: number | null
          contingencias_comunes_employer?: number | null
          created_at?: string
          desempleo_employee?: number | null
          desempleo_employer_indefinido?: number | null
          desempleo_employer_temporal?: number | null
          fogasa_employer?: number | null
          formacion_employee?: number | null
          formacion_employer?: number | null
          irpf_employee?: number | null
          location_id?: string
          mei_employee?: number | null
          mei_employer?: number | null
          payments_per_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_location_settings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
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
          legal_entity_id: string | null
          period_month: number
          period_year: number
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          group_id: string
          id?: string
          legal_entity_id?: string | null
          period_month: number
          period_year: number
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          group_id?: string
          id?: string
          legal_entity_id?: string | null
          period_month?: number
          period_year?: number
          status?: string
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
            foreignKeyName: "payroll_runs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "orgs"
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
      payslip_lines: {
        Row: {
          amount: number
          concept_code: string
          description: string | null
          id: string
          payslip_id: string
          type: string
        }
        Insert: {
          amount?: number
          concept_code: string
          description?: string | null
          id?: string
          payslip_id: string
          type?: string
        }
        Update: {
          amount?: number
          concept_code?: string
          description?: string | null
          id?: string
          payslip_id?: string
          type?: string
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
          created_at: string
          employee_id: string
          employee_ss: number
          employer_ss: number
          gross_pay: number
          id: string
          irpf_withheld: number
          net_pay: number
          other_deductions: number
          payroll_run_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          employee_ss?: number
          employer_ss?: number
          gross_pay?: number
          id?: string
          irpf_withheld?: number
          net_pay?: number
          other_deductions?: number
          payroll_run_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          employee_ss?: number
          employer_ss?: number
          gross_pay?: number
          id?: string
          irpf_withheld?: number
          net_pay?: number
          other_deductions?: number
          payroll_run_id?: string
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
      planned_shifts: {
        Row: {
          created_at: string
          employee_id: string
          end_time: string | null
          id: string
          location_id: string
          planned_cost: number | null
          planned_hours: number | null
          role: string | null
          shift_date: string
          start_time: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_time?: string | null
          id?: string
          location_id: string
          planned_cost?: number | null
          planned_hours?: number | null
          role?: string | null
          shift_date: string
          start_time?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_time?: string | null
          id?: string
          location_id?: string
          planned_cost?: number | null
          planned_hours?: number | null
          role?: string | null
          shift_date?: string
          start_time?: string | null
          status?: string | null
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
      pos_daily_finance: {
        Row: {
          comps_amount: number | null
          created_at: string
          data_source: string | null
          date: string
          discounts_amount: number | null
          gross_sales: number | null
          id: string
          location_id: string
          net_sales: number | null
          orders_count: number | null
          payments_card: number | null
          payments_cash: number | null
          payments_other: number | null
          refunds_amount: number | null
          refunds_count: number | null
          voids_amount: number | null
        }
        Insert: {
          comps_amount?: number | null
          created_at?: string
          data_source?: string | null
          date: string
          discounts_amount?: number | null
          gross_sales?: number | null
          id?: string
          location_id: string
          net_sales?: number | null
          orders_count?: number | null
          payments_card?: number | null
          payments_cash?: number | null
          payments_other?: number | null
          refunds_amount?: number | null
          refunds_count?: number | null
          voids_amount?: number | null
        }
        Update: {
          comps_amount?: number | null
          created_at?: string
          data_source?: string | null
          date?: string
          discounts_amount?: number | null
          gross_sales?: number | null
          id?: string
          location_id?: string
          net_sales?: number | null
          orders_count?: number | null
          payments_card?: number | null
          payments_cash?: number | null
          payments_other?: number | null
          refunds_amount?: number | null
          refunds_count?: number | null
          voids_amount?: number | null
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
          labor_cost: number | null
          labor_hours: number | null
          location_id: string
          net_sales: number | null
          orders: number | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          labor_cost?: number | null
          labor_hours?: number | null
          location_id: string
          net_sales?: number | null
          orders?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          labor_cost?: number | null
          labor_hours?: number | null
          location_id?: string
          net_sales?: number | null
          orders?: number | null
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
      pos_floor_maps: {
        Row: {
          config_json: Json | null
          created_at: string
          id: string
          is_active: boolean | null
          location_id: string
          name: string
        }
        Insert: {
          config_json?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          location_id: string
          name?: string
        }
        Update: {
          config_json?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          location_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_floor_maps_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_tables: {
        Row: {
          created_at: string
          floor_map_id: string
          height: number | null
          id: string
          position_x: number | null
          position_y: number | null
          seats: number | null
          shape: string | null
          status: string | null
          table_number: number
          width: number | null
        }
        Insert: {
          created_at?: string
          floor_map_id: string
          height?: number | null
          id?: string
          position_x?: number | null
          position_y?: number | null
          seats?: number | null
          shape?: string | null
          status?: string | null
          table_number?: number
          width?: number | null
        }
        Update: {
          created_at?: string
          floor_map_id?: string
          height?: number | null
          id?: string
          position_x?: number | null
          position_y?: number | null
          seats?: number | null
          shape?: string | null
          status?: string | null
          table_number?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_tables_floor_map_id_fkey"
            columns: ["floor_map_id"]
            isOneToOne: false
            referencedRelation: "pos_floor_maps"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_recommendations: {
        Row: {
          item_id: string
          projected_days_of_cover: number | null
          recommended_qty_packs: number
          run_id: string
          why: string | null
        }
        Insert: {
          item_id: string
          projected_days_of_cover?: number | null
          recommended_qty_packs: number
          run_id: string
          why?: string | null
        }
        Update: {
          item_id?: string
          projected_days_of_cover?: number | null
          recommended_qty_packs?: number
          run_id?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procurement_recommendations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_recommendations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "procurement_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_runs: {
        Row: {
          created_at: string
          created_by: string | null
          horizon_days: number
          id: string
          include_safety_stock: boolean
          location_id: string
          org_id: string
          rationale: Json
          round_to_packs: boolean
          supplier_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          horizon_days?: number
          id?: string
          include_safety_stock?: boolean
          location_id: string
          org_id: string
          rationale?: Json
          round_to_packs?: boolean
          supplier_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          horizon_days?: number
          id?: string
          include_safety_stock?: boolean
          location_id?: string
          org_id?: string
          rationale?: Json
          round_to_packs?: boolean
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procurement_runs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_runs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          cost_price: number | null
          created_at: string
          group_id: string | null
          id: string
          is_active: boolean | null
          kds_destination: string | null
          location_id: string | null
          name: string
          price: number | null
          target_prep_time: number | null
        }
        Insert: {
          category?: string | null
          cost_price?: number | null
          created_at?: string
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          kds_destination?: string | null
          location_id?: string | null
          name: string
          price?: number | null
          target_prep_time?: number | null
        }
        Update: {
          category?: string | null
          cost_price?: number | null
          created_at?: string
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          kds_destination?: string | null
          location_id?: string | null
          name?: string
          price?: number | null
          target_prep_time?: number | null
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
            foreignKeyName: "products_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "orgs"
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
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          group_id: string | null
          id: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          group_id?: string | null
          id?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          group_id?: string | null
          id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      provider_location_map: {
        Row: {
          created_at: string
          location_id: string
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          provider_location_id: string
        }
        Insert: {
          created_at?: string
          location_id: string
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          provider_location_id: string
        }
        Update: {
          created_at?: string
          location_id?: string
          org_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          provider_location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_location_map_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_location_map_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_location_map_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          id: string
          inventory_item_id: string | null
          item_id: string
          line_value: number
          pack_price: number
          purchase_order_id: string
          qty_packs: number
          quantity: number | null
          unit_price: number | null
        }
        Insert: {
          id?: string
          inventory_item_id?: string | null
          item_id: string
          line_value?: number
          pack_price?: number
          purchase_order_id: string
          qty_packs?: number
          quantity?: number | null
          unit_price?: number | null
        }
        Update: {
          id?: string
          inventory_item_id?: string | null
          item_id?: string
          line_value?: number
          pack_price?: number
          purchase_order_id?: string
          qty_packs?: number
          quantity?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
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
          created_by: string | null
          delivery_date: string | null
          id: string
          location_id: string
          min_order_value: number | null
          notes: string | null
          order_date: string
          org_id: string
          status: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          total_value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_date?: string | null
          id?: string
          location_id: string
          min_order_value?: number | null
          notes?: string | null
          order_date?: string
          org_id: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          total_value?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_date?: string | null
          id?: string
          location_id?: string
          min_order_value?: number | null
          notes?: string | null
          order_date?: string
          org_id?: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id?: string
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
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
      raw_events: {
        Row: {
          attempts: number
          event_type: string
          external_event_id: string | null
          id: string
          org_id: string
          payload: Json
          payload_hash: string | null
          processed_at: string | null
          processing_error: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          received_at: string
          signature_valid: boolean | null
          status: string
        }
        Insert: {
          attempts?: number
          event_type: string
          external_event_id?: string | null
          id?: string
          org_id: string
          payload: Json
          payload_hash?: string | null
          processed_at?: string | null
          processing_error?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          received_at?: string
          signature_valid?: boolean | null
          status?: string
        }
        Update: {
          attempts?: number
          event_type?: string
          external_event_id?: string | null
          id?: string
          org_id?: string
          payload?: Json
          payload_hash?: string | null
          processed_at?: string | null
          processing_error?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          received_at?: string
          signature_valid?: boolean | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          inventory_item_id: string
          menu_item_id: string
          qty_base_units: number
          qty_gross: number | null
          qty_net: number | null
          sort_order: number | null
          sub_recipe_id: string | null
          unit: string | null
          yield_pct: number | null
        }
        Insert: {
          inventory_item_id: string
          menu_item_id: string
          qty_base_units: number
          qty_gross?: number | null
          qty_net?: number | null
          sort_order?: number | null
          sub_recipe_id?: string | null
          unit?: string | null
          yield_pct?: number | null
        }
        Update: {
          inventory_item_id?: string
          menu_item_id?: string
          qty_base_units?: number
          qty_gross?: number | null
          qty_net?: number | null
          sort_order?: number | null
          sub_recipe_id?: string | null
          unit?: string | null
          yield_pct?: number | null
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
            foreignKeyName: "recipe_ingredients_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_sub_recipe_id_fkey"
            columns: ["sub_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_sub_recipe_id_fkey"
            columns: ["sub_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          category: string | null
          created_at: string
          group_id: string
          id: string
          is_sub_recipe: boolean | null
          menu_item_name: string
          notes: string | null
          selling_price: number | null
          yield_qty: number | null
          yield_unit: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          group_id: string
          id?: string
          is_sub_recipe?: boolean | null
          menu_item_name: string
          notes?: string | null
          selling_price?: number | null
          yield_qty?: number | null
          yield_unit?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          group_id?: string
          id?: string
          is_sub_recipe?: boolean | null
          menu_item_name?: string
          notes?: string | null
          selling_price?: number | null
          yield_qty?: number | null
          yield_unit?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          created_at: string
          id: string
          location_id: string
          org_id: string
          platform: string
          rating: number
          review_date: string
          review_text: string | null
          reviewer_name: string | null
          sentiment: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          org_id: string
          platform?: string
          rating: number
          review_date?: string
          review_text?: string | null
          reviewer_name?: string | null
          sentiment?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          org_id?: string
          platform?: string
          rating?: number
          review_date?: string
          review_text?: string | null
          reviewer_name?: string | null
          sentiment?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          department_id: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          department_id?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          department_id?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_channels: {
        Row: {
          id: string
          name: string
          org_id: string
        }
        Insert: {
          id?: string
          name: string
          org_id: string
        }
        Update: {
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_channels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_channels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          org_id: string
          status: Database["public"]["Enums"]["shift_status"]
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          org_id: string
          status?: Database["public"]["Enums"]["shift_status"]
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          org_id?: string
          status?: Database["public"]["Enums"]["shift_status"]
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          employee_id: string
          shift_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          employee_id: string
          shift_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          employee_id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swaps: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          from_employee_id: string
          id: string
          location_id: string
          manager_note: string | null
          requested_at: string
          shift_id: string
          status: Database["public"]["Enums"]["swap_status"]
          to_employee_id: string | null
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          from_employee_id: string
          id?: string
          location_id: string
          manager_note?: string | null
          requested_at?: string
          shift_id: string
          status?: Database["public"]["Enums"]["swap_status"]
          to_employee_id?: string | null
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          from_employee_id?: string
          id?: string
          location_id?: string
          manager_note?: string | null
          requested_at?: string
          shift_id?: string
          status?: Database["public"]["Enums"]["swap_status"]
          to_employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_swaps_from_employee_id_fkey"
            columns: ["from_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          end_at: string
          id: string
          location_id: string
          notes: string | null
          required_headcount: number
          role_id: string | null
          schedule_id: string
          start_at: string
        }
        Insert: {
          end_at: string
          id?: string
          location_id: string
          notes?: string | null
          required_headcount?: number
          role_id?: string | null
          schedule_id: string
          start_at: string
        }
        Update: {
          end_at?: string
          id?: string
          location_id?: string
          notes?: string | null
          required_headcount?: number
          role_id?: string | null
          schedule_id?: string
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      staging_square_catalog_items: {
        Row: {
          error: string | null
          id: string
          integration_account_id: string
          merged_at: string | null
          object_type: string
          org_id: string
          payload: Json
          received_at: string
          square_catalog_id: string
          status: Database["public"]["Enums"]["staging_status"]
          version: number | null
        }
        Insert: {
          error?: string | null
          id?: string
          integration_account_id: string
          merged_at?: string | null
          object_type: string
          org_id: string
          payload: Json
          received_at?: string
          square_catalog_id: string
          status?: Database["public"]["Enums"]["staging_status"]
          version?: number | null
        }
        Update: {
          error?: string | null
          id?: string
          integration_account_id?: string
          merged_at?: string | null
          object_type?: string
          org_id?: string
          payload?: Json
          received_at?: string
          square_catalog_id?: string
          status?: Database["public"]["Enums"]["staging_status"]
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staging_square_catalog_items_integration_account_id_fkey"
            columns: ["integration_account_id"]
            isOneToOne: false
            referencedRelation: "integration_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staging_square_catalog_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staging_square_catalog_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      staging_square_orders: {
        Row: {
          error: string | null
          id: string
          integration_account_id: string
          merged_at: string | null
          org_id: string
          payload: Json
          received_at: string
          square_location_id: string | null
          square_order_id: string
          square_updated_at: string | null
          status: Database["public"]["Enums"]["staging_status"]
        }
        Insert: {
          error?: string | null
          id?: string
          integration_account_id: string
          merged_at?: string | null
          org_id: string
          payload: Json
          received_at?: string
          square_location_id?: string | null
          square_order_id: string
          square_updated_at?: string | null
          status?: Database["public"]["Enums"]["staging_status"]
        }
        Update: {
          error?: string | null
          id?: string
          integration_account_id?: string
          merged_at?: string | null
          org_id?: string
          payload?: Json
          received_at?: string
          square_location_id?: string | null
          square_order_id?: string
          square_updated_at?: string | null
          status?: Database["public"]["Enums"]["staging_status"]
        }
        Relationships: [
          {
            foreignKeyName: "staging_square_orders_integration_account_id_fkey"
            columns: ["integration_account_id"]
            isOneToOne: false
            referencedRelation: "integration_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staging_square_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staging_square_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      staging_square_payments: {
        Row: {
          error: string | null
          id: string
          integration_account_id: string
          merged_at: string | null
          org_id: string
          payload: Json
          received_at: string
          square_created_at: string | null
          square_location_id: string | null
          square_order_id: string | null
          square_payment_id: string
          status: Database["public"]["Enums"]["staging_status"]
        }
        Insert: {
          error?: string | null
          id?: string
          integration_account_id: string
          merged_at?: string | null
          org_id: string
          payload: Json
          received_at?: string
          square_created_at?: string | null
          square_location_id?: string | null
          square_order_id?: string | null
          square_payment_id: string
          status?: Database["public"]["Enums"]["staging_status"]
        }
        Update: {
          error?: string | null
          id?: string
          integration_account_id?: string
          merged_at?: string | null
          org_id?: string
          payload?: Json
          received_at?: string
          square_created_at?: string | null
          square_location_id?: string | null
          square_order_id?: string | null
          square_payment_id?: string
          status?: Database["public"]["Enums"]["staging_status"]
        }
        Relationships: [
          {
            foreignKeyName: "staging_square_payments_integration_account_id_fkey"
            columns: ["integration_account_id"]
            isOneToOne: false
            referencedRelation: "integration_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staging_square_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staging_square_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
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
            foreignKeyName: "stock_count_lines_stock_count_id_fkey"
            columns: ["stock_count_id"]
            isOneToOne: false
            referencedRelation: "mart_stock_count_headers"
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
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          location_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          org_id: string
          qty_delta: number
          reason: string | null
          source_ref: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          location_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          org_id: string
          qty_delta: number
          reason?: string | null
          source_ref?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          location_id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          org_id?: string
          qty_delta?: number
          reason?: string | null
          source_ref?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          cutoff_time: string | null
          delivers_days: number[]
          email: string | null
          group_id: string | null
          id: string
          integration_type: string | null
          is_template: boolean | null
          metadata: Json
          min_order_value: number | null
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          cutoff_time?: string | null
          delivers_days?: number[]
          email?: string | null
          group_id?: string | null
          id?: string
          integration_type?: string | null
          is_template?: boolean | null
          metadata?: Json
          min_order_value?: number | null
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          cutoff_time?: string | null
          delivers_days?: number[]
          email?: string | null
          group_id?: string | null
          id?: string
          integration_type?: string | null
          is_template?: boolean | null
          metadata?: Json
          min_order_value?: number | null
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          channel: string | null
          closed_at: string | null
          covers: number | null
          created_at: string
          discount_total: number | null
          external_id: string | null
          gross_total: number | null
          id: string
          location_id: string
          net_total: number | null
          opened_at: string | null
          status: string | null
          table_name: string | null
          tax_total: number | null
        }
        Insert: {
          channel?: string | null
          closed_at?: string | null
          covers?: number | null
          created_at?: string
          discount_total?: number | null
          external_id?: string | null
          gross_total?: number | null
          id?: string
          location_id: string
          net_total?: number | null
          opened_at?: string | null
          status?: string | null
          table_name?: string | null
          tax_total?: number | null
        }
        Update: {
          channel?: string | null
          closed_at?: string | null
          covers?: number | null
          created_at?: string
          discount_total?: number | null
          external_id?: string | null
          gross_total?: number | null
          id?: string
          location_id?: string
          net_total?: number | null
          opened_at?: string | null
          status?: string | null
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
      time_entries: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          clock_in: string
          clock_out: string | null
          created_at: string
          employee_id: string
          id: string
          location_id: string
          org_id: string
          source: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          clock_in: string
          clock_out?: string | null
          created_at?: string
          employee_id: string
          id?: string
          location_id: string
          org_id: string
          source?: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          location_id?: string
          org_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved: boolean | null
          clock_in: string | null
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
          clock_in?: string | null
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
          clock_in?: string | null
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          role_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          role_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
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
          inventory_item_id: string | null
          location_id: string
          quantity: number
          reason: string | null
          waste_value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          location_id: string
          quantity?: number
          reason?: string | null
          waste_value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
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
      budget_daily_unified: {
        Row: {
          budget_cogs: number | null
          budget_cogs_pct: number | null
          budget_col_pct: number | null
          budget_labour: number | null
          budget_margin_pct: number | null
          budget_profit: number | null
          budget_sales: number | null
          day: string | null
          location_id: string | null
          org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_days_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_days_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_days_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cogs_daily: {
        Row: {
          cogs_amount: number | null
          date: string | null
          location_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_daily_unified: {
        Row: {
          data_source: string | null
          day: string | null
          forecast_avg_check: number | null
          forecast_orders: number | null
          forecast_sales: number | null
          forecast_sales_lower: number | null
          forecast_sales_upper: number | null
          location_id: string | null
          org_id: string | null
          planned_labor_cost: number | null
          planned_labor_hours: number | null
        }
        Relationships: []
      }
      groups: {
        Row: {
          id: string | null
          name: string | null
        }
        Insert: {
          id?: string | null
          name?: string | null
        }
        Update: {
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
      labour_daily_unified: {
        Row: {
          actual_cost: number | null
          actual_hours: number | null
          cost_variance: number | null
          day: string | null
          hours_variance: number | null
          hours_variance_pct: number | null
          location_id: string | null
          org_id: string | null
          scheduled_cost: number | null
          scheduled_headcount: number | null
          scheduled_hours: number | null
        }
        Relationships: []
      }
      mart_kpi_daily: {
        Row: {
          avg_check: number | null
          cogs: number | null
          cogs_source: string | null
          col_percent: number | null
          covers: number | null
          date: string | null
          gp_percent: number | null
          labour_cost: number | null
          labour_hours: number | null
          labour_source: string | null
          location_id: string | null
          net_sales: number | null
          orders_count: number | null
          org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      mart_kpi_daily_mv: {
        Row: {
          avg_check: number | null
          cogs: number | null
          cogs_source: string | null
          col_percent: number | null
          covers: number | null
          date: string | null
          gp_percent: number | null
          labour_cost: number | null
          labour_hours: number | null
          labour_source: string | null
          location_id: string | null
          net_sales: number | null
          orders_count: number | null
          org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      mart_sales_category_daily: {
        Row: {
          category: string | null
          cogs: number | null
          cogs_source: string | null
          date: string | null
          location_id: string | null
          net_sales: number | null
          org_id: string | null
          product_id: string | null
          product_name: string | null
          units_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cdm_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      mart_sales_category_daily_mv: {
        Row: {
          category: string | null
          cogs: number | null
          cogs_source: string | null
          date: string | null
          location_id: string | null
          net_sales: number | null
          org_id: string | null
          product_id: string | null
          product_name: string | null
          units_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cdm_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      mart_stock_count_headers: {
        Row: {
          created_at: string | null
          end_date: string | null
          group_id: string | null
          id: string | null
          line_count: number | null
          location_id: string | null
          location_name: string | null
          start_date: string | null
          status: string | null
          total_variance_qty: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      mart_stock_count_lines_enriched: {
        Row: {
          batch_balance: number | null
          closing_qty: number | null
          count_status: string | null
          deliveries_qty: number | null
          end_date: string | null
          group_id: string | null
          id: string | null
          inventory_item_id: string | null
          item_name: string | null
          location_id: string | null
          opening_qty: number | null
          sales_qty: number | null
          start_date: string | null
          stock_count_id: string | null
          transfers_net_qty: number | null
          unit: string | null
          unit_cost: number | null
          used_qty: number | null
          variance_qty: number | null
          variance_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_lines_stock_count_id_fkey"
            columns: ["stock_count_id"]
            isOneToOne: false
            referencedRelation: "mart_stock_count_headers"
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
      mv_sales_daily: {
        Row: {
          day: string | null
          discounts: number | null
          gross_sales: number | null
          location_id: string | null
          net_sales: number | null
          orders_count: number | null
          org_id: string | null
          tax: number | null
          tips: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cdm_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_sales_hourly: {
        Row: {
          discounts: number | null
          gross_sales: number | null
          hour_ts: string | null
          location_id: string | null
          net_sales: number | null
          orders_count: number | null
          org_id: string | null
          tax: number | null
          tips: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cdm_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales_daily_unified: {
        Row: {
          cogs: number | null
          data_source: string | null
          day: string | null
          gross_profit: number | null
          location_id: string | null
          margin_pct: number | null
          net_sales: number | null
          org_id: string | null
          product_category: string | null
          product_id: string | null
          product_name: string | null
          units_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cdm_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales_daily_unified_mv: {
        Row: {
          cogs: number | null
          data_source: string | null
          day: string | null
          gross_profit: number | null
          location_id: string | null
          margin_pct: number | null
          net_sales: number | null
          org_id: string | null
          product_category: string | null
          product_id: string | null
          product_name: string | null
          units_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cdm_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_summary: {
        Row: {
          category: string | null
          created_at: string | null
          food_cost: number | null
          food_cost_pct: number | null
          group_id: string | null
          id: string | null
          ingredient_count: number | null
          is_sub_recipe: boolean | null
          menu_item_name: string | null
          selling_price: number | null
          yield_qty: number | null
          yield_unit: string | null
        }
        Relationships: []
      }
      sales_daily_unified: {
        Row: {
          avg_check: number | null
          comps_amount: number | null
          data_source: string | null
          date: string | null
          discounts_amount: number | null
          gross_sales: number | null
          labor_cost: number | null
          labor_hours: number | null
          location_id: string | null
          net_sales: number | null
          orders_count: number | null
          org_id: string | null
          payments_card: number | null
          payments_cash: number | null
          payments_other: number | null
          refunds_amount: number | null
          refunds_count: number | null
          voids_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_hourly_unified: {
        Row: {
          avg_check: number | null
          covers: number | null
          data_source: string | null
          day: string | null
          discounts: number | null
          gross_sales: number | null
          hour_bucket: string | null
          hour_of_day: number | null
          location_id: string | null
          net_sales: number | null
          orders_count: number | null
          org_id: string | null
          refunds: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cdm_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_hourly_unified_mv: {
        Row: {
          avg_check: number | null
          covers: number | null
          data_source: string | null
          day: string | null
          discounts: number | null
          gross_sales: number | null
          hour_bucket: string | null
          hour_of_day: number | null
          location_id: string | null
          net_sales: number | null
          orders_count: number | null
          org_id: string | null
          refunds: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cdm_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      v_actuals_daily_cogs_estimate: {
        Row: {
          cogs_est: number | null
          day: string | null
          location_id: string | null
          org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cdm_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      v_actuals_daily_labour: {
        Row: {
          day: string | null
          labour_hours: number | null
          location_id: string | null
          org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      v_actuals_daily_sales: {
        Row: {
          comps: number | null
          day: string | null
          discounts: number | null
          location_id: string | null
          org_id: string | null
          refunds: number | null
          sales_net: number | null
          tips: number | null
          voids: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cdm_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      v_actuals_sales_hourly: {
        Row: {
          day: string | null
          hour_of_day: number | null
          location_id: string | null
          org_id: string | null
          sales_net_hour: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cdm_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdm_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      v_budget_metric_final: {
        Row: {
          channel_id: string | null
          day: string | null
          location_id: string | null
          metric: Database["public"]["Enums"]["budget_metric"] | null
          org_id: string | null
          value_final: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_days_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_days_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_days_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_days_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      v_budget_sales_hourly: {
        Row: {
          budget_sales_net_hour: number | null
          day: string | null
          hour_of_day: number | null
          location_id: string | null
          org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_days_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_days_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_days_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      v_budget_vs_actual_daily: {
        Row: {
          a_cogs_est: number | null
          a_gp_value_est: number | null
          b_cogs: number | null
          b_gp_value: number | null
          b_labour_hours: number | null
          b_sales_net: number | null
          day: string | null
          labour_hours: number | null
          location_id: string | null
          org_id: string | null
          sales_net: number | null
          var_cogs_est: number | null
          var_labour_hours: number | null
          var_sales_net: number | null
        }
        Relationships: []
      }
      v_budget_vs_actual_hourly: {
        Row: {
          budget_sales_net_hour: number | null
          day: string | null
          hour_of_day: number | null
          location_id: string | null
          org_id: string | null
          sales_net_hour: number | null
          var_sales_net_hour: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_loyalty_points: {
        Args: {
          p_description?: string
          p_location_id?: string
          p_member_id: string
          p_points: number
          p_ticket_id?: string
          p_type?: string
        }
        Returns: Json
      }
      assert_hourly_profile_sums_to_one: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      assert_hourly_profile_valid: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      audit_data_coherence: {
        Args: { p_location_ids: string[]; p_org_id: string }
        Returns: Json
      }
      bootstrap_demo: { Args: never; Returns: Json }
      bootstrap_demo_operational: { Args: { p_org_id: string }; Returns: Json }
      claim_next_job: {
        Args: {
          p_provider?: Database["public"]["Enums"]["integration_provider"]
        }
        Returns: {
          attempts: number
          created_at: string
          finished_at: string | null
          heartbeat_at: string | null
          id: string
          job_type: Database["public"]["Enums"]["job_type"]
          last_error: string | null
          lease_seconds: number
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          org_id: string
          payload: Json
          priority: number
          provider: Database["public"]["Enums"]["integration_provider"] | null
          run_after: string
          status: Database["public"]["Enums"]["job_status"]
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_budget_version_with_days: {
        Args: {
          p_channel_ids?: string[]
          p_end: string
          p_location_ids?: string[]
          p_name: string
          p_org_id: string
          p_start: string
        }
        Returns: string
      }
      create_oauth_state: {
        Args: {
          p_org_id: string
          p_provider: Database["public"]["Enums"]["integration_provider"]
          p_redirect_uri: string
        }
        Returns: Json
      }
      deduct_recipe_from_inventory: {
        Args: { p_location_id: string; p_qty?: number; p_recipe_id: string }
        Returns: undefined
      }
      enqueue_event_replay: {
        Args: { p_raw_event_id: string }
        Returns: string
      }
      enqueue_square_sync: {
        Args: { p_org_id: string; p_reason?: string }
        Returns: string
      }
      get_forecast_items_mix_unified: {
        Args: {
          p_from: string
          p_horizon_days?: number
          p_limit?: number
          p_location_ids: string[]
          p_org_id: string
          p_to: string
        }
        Returns: Json
      }
      get_instant_pnl_unified: {
        Args: {
          p_from: string
          p_location_ids: string[]
          p_org_id: string
          p_to: string
        }
        Returns: Json
      }
      get_labor_plan_unified: {
        Args: {
          p_from: string
          p_location_ids: string[]
          p_org_id: string
          p_to: string
        }
        Returns: Json
      }
      get_labour_kpis: {
        Args: {
          date_from: string
          date_to: string
          p_data_source?: string
          selected_location_id?: string
        }
        Returns: Json
      }
      get_labour_locations_table: {
        Args: {
          date_from: string
          date_to: string
          p_data_source?: string
          selected_location_id?: string
        }
        Returns: Json
      }
      get_labour_timeseries: {
        Args: {
          date_from: string
          date_to: string
          p_data_source?: string
          selected_location_id?: string
        }
        Returns: Json
      }
      get_recipe_food_cost: { Args: { p_recipe_id: string }; Returns: number }
      get_sales_timeseries_unified: {
        Args: {
          p_from: string
          p_location_ids: string[]
          p_org_id: string
          p_to: string
        }
        Returns: Json
      }
      get_top_products_unified: {
        Args: {
          p_from: string
          p_limit?: number
          p_location_ids: string[]
          p_org_id: string
          p_to: string
        }
        Returns: Json
      }
      get_user_accessible_locations: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_has_global_scope: {
        Args: { _user_id: string }
        Returns: boolean
      }
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          module: string
          permission_key: string
        }[]
      }
      get_user_roles_with_scope: {
        Args: { _user_id: string }
        Returns: {
          location_id: string
          location_name: string
          role_id: string
          role_name: string
        }[]
      }
      hourly_profile_pct_sum: {
        Args: { p_profile_id: string }
        Returns: number
      }
      is_location_member: {
        Args: { p_location_id: string; p_user_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      job_heartbeat: {
        Args: { p_job_id: string; p_locked_by?: string }
        Returns: undefined
      }
      location_role_of: {
        Args: { p_location_id: string; p_user_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      map_square_location: {
        Args: { p_org_id: string; p_square_location_id: string }
        Returns: string
      }
      menu_engineering_summary: {
        Args: {
          p_data_source?: string
          p_date_from: string
          p_date_to: string
          p_location_id?: string
        }
        Returns: Json
      }
      merge_square_all: {
        Args: { p_limit_each?: number; p_org_id: string }
        Returns: Json
      }
      merge_square_catalog_to_cdm: {
        Args: { p_limit?: number; p_org_id: string }
        Returns: number
      }
      merge_square_orders_to_cdm: {
        Args: { p_limit?: number; p_org_id: string }
        Returns: number
      }
      merge_square_payments_to_cdm: {
        Args: { p_limit?: number; p_org_id: string }
        Returns: number
      }
      org_role_of: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      payload_hash_hex: { Args: { input: string }; Returns: string }
      recalc_budget_day: {
        Args: { p_budget_day_id: string }
        Returns: undefined
      }
      recalc_budget_version: {
        Args: { p_budget_version_id: string }
        Returns: number
      }
      redeem_loyalty_reward: {
        Args: {
          p_location_id?: string
          p_member_id: string
          p_reward_id: string
        }
        Returns: Json
      }
      refresh_all_mvs: { Args: { p_triggered_by?: string }; Returns: Json }
      refresh_mv_sales_hourly: {
        Args: {
          p_from: string
          p_location_id: string
          p_org_id: string
          p_to: string
        }
        Returns: undefined
      }
      refresh_sales_rollups: {
        Args: { p_concurrently?: boolean }
        Returns: undefined
      }
      request_forecast: {
        Args: {
          p_horizon_days?: number
          p_location_id: string
          p_train_days?: number
        }
        Returns: string
      }
      requeue_stale_jobs: { Args: { p_limit?: number }; Returns: number }
      resolve_data_source: { Args: { p_org_id: string }; Returns: Json }
      rpc_data_health: { Args: { p_org_id: string }; Returns: Json }
      rpc_reconciliation_summary: {
        Args: {
          p_from: string
          p_location_ids: string[]
          p_org_id: string
          p_status?: string
          p_to: string
        }
        Returns: Json
      }
      upsert_budget_metric: {
        Args: {
          p_budget_day_id: string
          p_layer: Database["public"]["Enums"]["budget_layer"]
          p_metric: Database["public"]["Enums"]["budget_metric"]
          p_source: string
          p_value: number
        }
        Returns: undefined
      }
    }
    Enums: {
      budget_layer: "base" | "override" | "final"
      budget_metric:
        | "sales_gross"
        | "sales_net"
        | "covers"
        | "tickets"
        | "discounts"
        | "comps"
        | "voids"
        | "refunds"
        | "tips"
        | "cogs"
        | "cogs_food"
        | "cogs_bev"
        | "waste"
        | "shrinkage"
        | "labour_cost"
        | "labour_hours"
        | "labour_overtime_hours"
        | "gp_value"
        | "gp_pct"
      budget_scope: "location" | "org"
      budget_status: "draft" | "published" | "frozen" | "archived"
      data_source_mode: "auto" | "manual_demo" | "manual_pos"
      employment_status: "active" | "inactive" | "terminated"
      integration_provider:
        | "square"
        | "lightspeed"
        | "oracle_simphony"
        | "toast"
      item_type: "food" | "beverage" | "other"
      job_status: "queued" | "running" | "succeeded" | "failed" | "dead"
      job_type:
        | "square_sync_pull"
        | "square_webhook_process"
        | "rebuild_aggregates"
      org_role: "owner" | "manager" | "staff"
      purchase_order_status:
        | "draft"
        | "sent"
        | "confirmed"
        | "delivered"
        | "cancelled"
      shift_status: "draft" | "published" | "cancelled"
      staging_status: "new" | "merged" | "failed"
      stock_movement_type:
        | "count"
        | "purchase"
        | "waste"
        | "transfer_in"
        | "transfer_out"
        | "sale_estimate"
        | "adjustment"
      swap_status: "requested" | "approved" | "rejected" | "cancelled"
      sync_status: "queued" | "running" | "success" | "failed"
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
      budget_layer: ["base", "override", "final"],
      budget_metric: [
        "sales_gross",
        "sales_net",
        "covers",
        "tickets",
        "discounts",
        "comps",
        "voids",
        "refunds",
        "tips",
        "cogs",
        "cogs_food",
        "cogs_bev",
        "waste",
        "shrinkage",
        "labour_cost",
        "labour_hours",
        "labour_overtime_hours",
        "gp_value",
        "gp_pct",
      ],
      budget_scope: ["location", "org"],
      budget_status: ["draft", "published", "frozen", "archived"],
      data_source_mode: ["auto", "manual_demo", "manual_pos"],
      employment_status: ["active", "inactive", "terminated"],
      integration_provider: [
        "square",
        "lightspeed",
        "oracle_simphony",
        "toast",
      ],
      item_type: ["food", "beverage", "other"],
      job_status: ["queued", "running", "succeeded", "failed", "dead"],
      job_type: [
        "square_sync_pull",
        "square_webhook_process",
        "rebuild_aggregates",
      ],
      org_role: ["owner", "manager", "staff"],
      purchase_order_status: [
        "draft",
        "sent",
        "confirmed",
        "delivered",
        "cancelled",
      ],
      shift_status: ["draft", "published", "cancelled"],
      staging_status: ["new", "merged", "failed"],
      stock_movement_type: [
        "count",
        "purchase",
        "waste",
        "transfer_in",
        "transfer_out",
        "sale_estimate",
        "adjustment",
      ],
      swap_status: ["requested", "approved", "rejected", "cancelled"],
      sync_status: ["queued", "running", "success", "failed"],
    },
  },
} as const
