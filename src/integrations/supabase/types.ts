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
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_admin_or_ops: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "owner_admin" | "ops_manager" | "location_manager" | "viewer"
      payment_method: "card" | "cash" | "other"
      po_status: "draft" | "sent" | "received"
      pos_provider: "revo" | "glop" | "square" | "lightspeed" | "csv"
      pos_status: "connected" | "disconnected" | "error" | "syncing"
      ticket_channel: "dinein" | "takeaway" | "delivery" | "unknown"
      ticket_status: "open" | "closed"
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
      app_role: ["owner_admin", "ops_manager", "location_manager", "viewer"],
      payment_method: ["card", "cash", "other"],
      po_status: ["draft", "sent", "received"],
      pos_provider: ["revo", "glop", "square", "lightspeed", "csv"],
      pos_status: ["connected", "disconnected", "error", "syncing"],
      ticket_channel: ["dinein", "takeaway", "delivery", "unknown"],
      ticket_status: ["open", "closed"],
    },
  },
} as const
