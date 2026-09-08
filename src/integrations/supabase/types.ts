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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      add_on_links: {
        Row: {
          add_on_id: string
          dish_id: string
          id: string
        }
        Insert: {
          add_on_id: string
          dish_id: string
          id?: string
        }
        Update: {
          add_on_id?: string
          dish_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "add_on_links_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "add_on_links_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      add_ons: {
        Row: {
          calculation_status: Database["public"]["Enums"]["calculation_status"]
          created_at: string
          expected_per_open_day: number
          expected_total: number | null
          gross_price: number
          id: string
          is_active: boolean
          menu_card_id: string
          name: string
          notes: string | null
          sales_input_mode: Database["public"]["Enums"]["sales_input_mode"]
          small_material_override_mode:
            | Database["public"]["Enums"]["small_material_mode"]
            | null
          small_material_override_value: number | null
          updated_at: string
        }
        Insert: {
          calculation_status?: Database["public"]["Enums"]["calculation_status"]
          created_at?: string
          expected_per_open_day?: number
          expected_total?: number | null
          gross_price?: number
          id?: string
          is_active?: boolean
          menu_card_id: string
          name: string
          notes?: string | null
          sales_input_mode?: Database["public"]["Enums"]["sales_input_mode"]
          small_material_override_mode?:
            | Database["public"]["Enums"]["small_material_mode"]
            | null
          small_material_override_value?: number | null
          updated_at?: string
        }
        Update: {
          calculation_status?: Database["public"]["Enums"]["calculation_status"]
          created_at?: string
          expected_per_open_day?: number
          expected_total?: number | null
          gross_price?: number
          id?: string
          is_active?: boolean
          menu_card_id?: string
          name?: string
          notes?: string | null
          sales_input_mode?: Database["public"]["Enums"]["sales_input_mode"]
          small_material_override_mode?:
            | Database["public"]["Enums"]["small_material_mode"]
            | null
          small_material_override_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "add_ons_menu_card_id_fkey"
            columns: ["menu_card_id"]
            isOneToOne: false
            referencedRelation: "menu_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      calculation_items: {
        Row: {
          add_on_id: string | null
          component_group: string
          created_at: string
          id: string
          ingredient_id: string
          net_quantity: number
          notes: string | null
          quantity_confirmed: boolean
          quantity_source: Database["public"]["Enums"]["quantity_source"]
          quantity_unit: Database["public"]["Enums"]["base_unit"]
          sort_order: number
          updated_at: string
          variant_id: string | null
          yield_percent: number
        }
        Insert: {
          add_on_id?: string | null
          component_group?: string
          created_at?: string
          id?: string
          ingredient_id: string
          net_quantity: number
          notes?: string | null
          quantity_confirmed?: boolean
          quantity_source?: Database["public"]["Enums"]["quantity_source"]
          quantity_unit: Database["public"]["Enums"]["base_unit"]
          sort_order?: number
          updated_at?: string
          variant_id?: string | null
          yield_percent?: number
        }
        Update: {
          add_on_id?: string | null
          component_group?: string
          created_at?: string
          id?: string
          ingredient_id?: string
          net_quantity?: number
          notes?: string | null
          quantity_confirmed?: boolean
          quantity_source?: Database["public"]["Enums"]["quantity_source"]
          quantity_unit?: Database["public"]["Enums"]["base_unit"]
          sort_order?: number
          updated_at?: string
          variant_id?: string | null
          yield_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "calculation_items_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: string
          is_food: boolean
          menu_card_id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_food?: boolean
          menu_card_id: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_food?: boolean
          menu_card_id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_menu_card_id_fkey"
            columns: ["menu_card_id"]
            isOneToOne: false
            referencedRelation: "menu_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          menu_card_id: string
          name: string
          notes: string | null
          sort_order: number
          source_type: Database["public"]["Enums"]["dish_source_type"]
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          menu_card_id: string
          name: string
          notes?: string | null
          sort_order?: number
          source_type?: Database["public"]["Enums"]["dish_source_type"]
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          menu_card_id?: string
          name?: string
          notes?: string | null
          sort_order?: number
          source_type?: Database["public"]["Enums"]["dish_source_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dishes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dishes_menu_card_id_fkey"
            columns: ["menu_card_id"]
            isOneToOne: false
            referencedRelation: "menu_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      excluded_days: {
        Row: {
          excluded_date: string
          id: string
          menu_card_id: string
          reason: string | null
        }
        Insert: {
          excluded_date: string
          id?: string
          menu_card_id: string
          reason?: string | null
        }
        Update: {
          excluded_date?: string
          id?: string
          menu_card_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "excluded_days_menu_card_id_fkey"
            columns: ["menu_card_id"]
            isOneToOne: false
            referencedRelation: "menu_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          content_type: string | null
          created_at: string
          created_by: string | null
          created_count: number | null
          error_message: string | null
          estimation_confirmed_at: string | null
          estimation_payload: Json | null
          extracted_payload: Json | null
          failed_count: number | null
          failed_stage: string | null
          file_size: number | null
          file_url: string
          id: string
          import_type: Database["public"]["Enums"]["import_type"]
          menu_card_id: string | null
          review_payload: Json | null
          row_count: number | null
          skipped_count: number | null
          source_kind: string
          source_name: string | null
          status: Database["public"]["Enums"]["import_job_status"]
          storage_path: string | null
          updated_at: string
          updated_count: number | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          created_count?: number | null
          error_message?: string | null
          estimation_confirmed_at?: string | null
          estimation_payload?: Json | null
          extracted_payload?: Json | null
          failed_count?: number | null
          failed_stage?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          import_type: Database["public"]["Enums"]["import_type"]
          menu_card_id?: string | null
          review_payload?: Json | null
          row_count?: number | null
          skipped_count?: number | null
          source_kind?: string
          source_name?: string | null
          status?: Database["public"]["Enums"]["import_job_status"]
          storage_path?: string | null
          updated_at?: string
          updated_count?: number | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          created_count?: number | null
          error_message?: string | null
          estimation_confirmed_at?: string | null
          estimation_payload?: Json | null
          extracted_payload?: Json | null
          failed_count?: number | null
          failed_stage?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          import_type?: Database["public"]["Enums"]["import_type"]
          menu_card_id?: string | null
          review_payload?: Json | null
          row_count?: number | null
          skipped_count?: number | null
          source_kind?: string
          source_name?: string | null
          status?: Database["public"]["Enums"]["import_job_status"]
          storage_path?: string | null
          updated_at?: string
          updated_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_menu_card_id_fkey"
            columns: ["menu_card_id"]
            isOneToOne: false
            referencedRelation: "menu_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          base_unit: Database["public"]["Enums"]["base_unit"]
          category: string
          created_at: string
          id: string
          is_active: boolean
          is_own_production: boolean
          name: string
          notes: string | null
          package_label: string | null
          package_price: number
          package_quantity: number
          package_unit: Database["public"]["Enums"]["package_unit"]
          price_date: string | null
          price_status: Database["public"]["Enums"]["price_status"]
          source_type: Database["public"]["Enums"]["ingredient_source_type"]
          supplier: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_unit: Database["public"]["Enums"]["base_unit"]
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_own_production?: boolean
          name: string
          notes?: string | null
          package_label?: string | null
          package_price: number
          package_quantity: number
          package_unit: Database["public"]["Enums"]["package_unit"]
          price_date?: string | null
          price_status?: Database["public"]["Enums"]["price_status"]
          source_type?: Database["public"]["Enums"]["ingredient_source_type"]
          supplier?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_unit?: Database["public"]["Enums"]["base_unit"]
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_own_production?: boolean
          name?: string
          notes?: string | null
          package_label?: string | null
          package_price?: number
          package_quantity?: number
          package_unit?: Database["public"]["Enums"]["package_unit"]
          price_date?: string | null
          price_status?: Database["public"]["Enums"]["price_status"]
          source_type?: Database["public"]["Enums"]["ingredient_source_type"]
          supplier?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_cards: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          import_status: Database["public"]["Enums"]["import_status"]
          is_active: boolean
          name: string
          opening_weekdays: number[]
          small_material_mode: Database["public"]["Enums"]["small_material_mode"]
          small_material_value: number
          source_file_url: string | null
          updated_at: string
          updated_by: string | null
          valid_from: string
          valid_to: string
          vat_rate: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          import_status?: Database["public"]["Enums"]["import_status"]
          is_active?: boolean
          name?: string
          opening_weekdays?: number[]
          small_material_mode?: Database["public"]["Enums"]["small_material_mode"]
          small_material_value?: number
          source_file_url?: string | null
          updated_at?: string
          updated_by?: string | null
          valid_from?: string
          valid_to?: string
          vat_rate?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          import_status?: Database["public"]["Enums"]["import_status"]
          is_active?: boolean
          name?: string
          opening_weekdays?: number[]
          small_material_mode?: Database["public"]["Enums"]["small_material_mode"]
          small_material_value?: number
          source_file_url?: string | null
          updated_at?: string
          updated_by?: string | null
          valid_from?: string
          valid_to?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_cards_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          is_admin: boolean
          must_change_password: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_active?: boolean
          is_admin?: boolean
          must_change_password?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          is_admin?: boolean
          must_change_password?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      variants: {
        Row: {
          calculation_status: Database["public"]["Enums"]["calculation_status"]
          created_at: string
          dish_id: string
          expected_per_open_day: number
          expected_total: number | null
          gross_price: number
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          notes: string | null
          sales_input_mode: Database["public"]["Enums"]["sales_input_mode"]
          small_material_override_mode:
            | Database["public"]["Enums"]["small_material_mode"]
            | null
          small_material_override_value: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          calculation_status?: Database["public"]["Enums"]["calculation_status"]
          created_at?: string
          dish_id: string
          expected_per_open_day?: number
          expected_total?: number | null
          gross_price?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          notes?: string | null
          sales_input_mode?: Database["public"]["Enums"]["sales_input_mode"]
          small_material_override_mode?:
            | Database["public"]["Enums"]["small_material_mode"]
            | null
          small_material_override_value?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          calculation_status?: Database["public"]["Enums"]["calculation_status"]
          created_at?: string
          dish_id?: string
          expected_per_open_day?: number
          expected_total?: number | null
          gross_price?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          notes?: string | null
          sales_input_mode?: Database["public"]["Enums"]["sales_input_mode"]
          small_material_override_mode?:
            | Database["public"]["Enums"]["small_material_mode"]
            | null
          small_material_override_value?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variants_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variants_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      import_estimation_payload: {
        Args: { _job_id: string; _payload: Json }
        Returns: Json
      }
      import_ingredient_rows: {
        Args: { _job_id: string; _payload: Json }
        Returns: Json
      }
      import_menu_payload: {
        Args: { _job_id: string; _payload: Json }
        Returns: Json
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      base_unit: "g" | "ml" | "piece"
      calculation_status: "estimated" | "partially_reviewed" | "reviewed"
      dish_source_type: "menu_import" | "manual"
      import_job_status:
        | "pending"
        | "processing"
        | "review"
        | "confirmed"
        | "failed"
      import_status: "draft" | "processing" | "review" | "confirmed" | "failed"
      import_type: "menu_document" | "ingredient_excel"
      ingredient_source_type: "ai_estimate" | "manual" | "excel_import"
      package_unit: "kg" | "g" | "l" | "ml" | "piece"
      price_status: "estimated" | "confirmed"
      quantity_source: "ai_estimate" | "manual"
      sales_input_mode: "per_open_day" | "total"
      small_material_mode: "percent" | "fixed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      base_unit: ["g", "ml", "piece"],
      calculation_status: ["estimated", "partially_reviewed", "reviewed"],
      dish_source_type: ["menu_import", "manual"],
      import_job_status: [
        "pending",
        "processing",
        "review",
        "confirmed",
        "failed",
      ],
      import_status: ["draft", "processing", "review", "confirmed", "failed"],
      import_type: ["menu_document", "ingredient_excel"],
      ingredient_source_type: ["ai_estimate", "manual", "excel_import"],
      package_unit: ["kg", "g", "l", "ml", "piece"],
      price_status: ["estimated", "confirmed"],
      quantity_source: ["ai_estimate", "manual"],
      sales_input_mode: ["per_open_day", "total"],
      small_material_mode: ["percent", "fixed"],
    },
  },
} as const
