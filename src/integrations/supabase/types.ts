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
      demo_seeds: {
        Row: {
          created_at: string
          key: string
          removed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          key: string
          removed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          key?: string
          removed_at?: string | null
          updated_at?: string
        }
        Relationships: []
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
      event_assumption_values: {
        Row: {
          created_at: string
          event_id: string
          id: string
          key: string
          label: string
          origin: Database["public"]["Enums"]["assumption_origin"]
          source_assumption_id: string | null
          unit: Database["public"]["Enums"]["assumption_unit"]
          updated_at: string
          value: number | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          key: string
          label: string
          origin?: Database["public"]["Enums"]["assumption_origin"]
          source_assumption_id?: string | null
          unit: Database["public"]["Enums"]["assumption_unit"]
          updated_at?: string
          value?: number | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          key?: string
          label?: string
          origin?: Database["public"]["Enums"]["assumption_origin"]
          source_assumption_id?: string | null
          unit?: Database["public"]["Enums"]["assumption_unit"]
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_assumption_values_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_assumption_values_source_assumption_id_fkey"
            columns: ["source_assumption_id"]
            isOneToOne: false
            referencedRelation: "event_assumptions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_assumptions: {
        Row: {
          created_at: string
          description: string | null
          event_type: Database["public"]["Enums"]["event_type"] | null
          id: string
          is_active: boolean
          key: string
          label: string
          unit: Database["public"]["Enums"]["assumption_unit"]
          updated_at: string
          updated_by: string | null
          valid_from: string
          value: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type?: Database["public"]["Enums"]["event_type"] | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          unit: Database["public"]["Enums"]["assumption_unit"]
          updated_at?: string
          updated_by?: string | null
          valid_from?: string
          value: number
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: Database["public"]["Enums"]["event_type"] | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          unit?: Database["public"]["Enums"]["assumption_unit"]
          updated_at?: string
          updated_by?: string | null
          valid_from?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_assumptions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_execution_approvals: {
        Row: {
          approved_at: string
          approved_by: string | null
          basis_fingerprint: string
          basis_snapshot: Json
          created_at: string
          event_id: string
          id: string
          note: string | null
          superseded_at: string | null
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          basis_fingerprint: string
          basis_snapshot: Json
          created_at?: string
          event_id: string
          id?: string
          note?: string | null
          superseded_at?: string | null
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          basis_fingerprint?: string
          basis_snapshot?: Json
          created_at?: string
          event_id?: string
          id?: string
          note?: string | null
          superseded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_execution_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_execution_approvals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_handover_attempts: {
        Row: {
          approval_fingerprint: string
          approval_id: string
          approved_at: string
          attempt_count: number
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          event_id: string
          handover_id: string | null
          id: string
          idempotency_key: string
          initiated_by: string | null
          operation: Database["public"]["Enums"]["handover_operation"]
          payload: Json
          receipt: Json | null
          sent_at: string | null
          state: Database["public"]["Enums"]["handover_attempt_state"]
          target_event_deleted: boolean
          target_event_id: string | null
          target_url: string | null
          updated_at: string
        }
        Insert: {
          approval_fingerprint: string
          approval_id: string
          approved_at: string
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          event_id: string
          handover_id?: string | null
          id?: string
          idempotency_key: string
          initiated_by?: string | null
          operation: Database["public"]["Enums"]["handover_operation"]
          payload: Json
          receipt?: Json | null
          sent_at?: string | null
          state?: Database["public"]["Enums"]["handover_attempt_state"]
          target_event_deleted?: boolean
          target_event_id?: string | null
          target_url?: string | null
          updated_at?: string
        }
        Update: {
          approval_fingerprint?: string
          approval_id?: string
          approved_at?: string
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          event_id?: string
          handover_id?: string | null
          id?: string
          idempotency_key?: string
          initiated_by?: string | null
          operation?: Database["public"]["Enums"]["handover_operation"]
          payload?: Json
          receipt?: Json | null
          sent_at?: string | null
          state?: Database["public"]["Enums"]["handover_attempt_state"]
          target_event_deleted?: boolean
          target_event_id?: string | null
          target_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_handover_attempts_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "event_execution_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_handover_attempts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_handover_attempts_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_idea_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          idea_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          idea_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          idea_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_idea_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_idea_notes_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "event_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      event_ideas: {
        Row: {
          calc_approved_at: string | null
          calc_approved_by: string | null
          created_at: string
          created_by: string | null
          desired_date: string | null
          desired_period: string | null
          event_type: Database["public"]["Enums"]["event_type"] | null
          expected_guests: number | null
          id: string
          notes: string | null
          owner_name: string | null
          partner: string | null
          stage: Database["public"]["Enums"]["event_idea_stage"]
          summary: string
          target_audience: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          calc_approved_at?: string | null
          calc_approved_by?: string | null
          created_at?: string
          created_by?: string | null
          desired_date?: string | null
          desired_period?: string | null
          event_type?: Database["public"]["Enums"]["event_type"] | null
          expected_guests?: number | null
          id?: string
          notes?: string | null
          owner_name?: string | null
          partner?: string | null
          stage?: Database["public"]["Enums"]["event_idea_stage"]
          summary: string
          target_audience?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          calc_approved_at?: string | null
          calc_approved_by?: string | null
          created_at?: string
          created_by?: string | null
          desired_date?: string | null
          desired_period?: string | null
          event_type?: Database["public"]["Enums"]["event_type"] | null
          expected_guests?: number | null
          id?: string
          notes?: string | null
          owner_name?: string | null
          partner?: string | null
          stage?: Database["public"]["Enums"]["event_idea_stage"]
          summary?: string
          target_audience?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_ideas_calc_approved_by_fkey"
            columns: ["calc_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_ideas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_ideas_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_lines: {
        Row: {
          actual_quantity: number | null
          actual_unit_amount: number | null
          assumption_key: string | null
          calc_mode: Database["public"]["Enums"]["event_line_calc_mode"]
          category: string
          created_at: string
          event_id: string
          id: string
          is_required: boolean
          kind: Database["public"]["Enums"]["event_line_kind"]
          name: string
          notes: string | null
          origin: Database["public"]["Enums"]["assumption_origin"] | null
          planned_quantity: number | null
          planned_unit_amount: number | null
          sort_order: number
          updated_at: string
          value_status: Database["public"]["Enums"]["event_value_status"]
          variance_note: string | null
        }
        Insert: {
          actual_quantity?: number | null
          actual_unit_amount?: number | null
          assumption_key?: string | null
          calc_mode?: Database["public"]["Enums"]["event_line_calc_mode"]
          category: string
          created_at?: string
          event_id: string
          id?: string
          is_required?: boolean
          kind: Database["public"]["Enums"]["event_line_kind"]
          name: string
          notes?: string | null
          origin?: Database["public"]["Enums"]["assumption_origin"] | null
          planned_quantity?: number | null
          planned_unit_amount?: number | null
          sort_order?: number
          updated_at?: string
          value_status?: Database["public"]["Enums"]["event_value_status"]
          variance_note?: string | null
        }
        Update: {
          actual_quantity?: number | null
          actual_unit_amount?: number | null
          assumption_key?: string | null
          calc_mode?: Database["public"]["Enums"]["event_line_calc_mode"]
          category?: string
          created_at?: string
          event_id?: string
          id?: string
          is_required?: boolean
          kind?: Database["public"]["Enums"]["event_line_kind"]
          name?: string
          notes?: string | null
          origin?: Database["public"]["Enums"]["assumption_origin"] | null
          planned_quantity?: number | null
          planned_unit_amount?: number | null
          sort_order?: number
          updated_at?: string
          value_status?: Database["public"]["Enums"]["event_value_status"]
          variance_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_lines_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_menu_links: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          menu_id: string
          snapshot: Json
          snapshot_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          menu_id: string
          snapshot: Json
          snapshot_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          menu_id?: string
          snapshot?: Json
          snapshot_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_menu_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_menu_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_menu_links_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      event_menu_variants: {
        Row: {
          actual_guests: number | null
          created_at: string
          event_id: string
          id: string
          menu_variant_id: string
          planned_guests: number | null
          updated_at: string
        }
        Insert: {
          actual_guests?: number | null
          created_at?: string
          event_id: string
          id?: string
          menu_variant_id: string
          planned_guests?: number | null
          updated_at?: string
        }
        Update: {
          actual_guests?: number | null
          created_at?: string
          event_id?: string
          id?: string
          menu_variant_id?: string
          planned_guests?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_menu_variants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_menu_variants_menu_variant_id_fkey"
            columns: ["menu_variant_id"]
            isOneToOne: false
            referencedRelation: "menu_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          actual_free_guests: number | null
          actual_paying_guests: number | null
          created_at: string
          created_by: string | null
          demo_key: string | null
          event_date: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          handover_ref: string | null
          handover_state: Database["public"]["Enums"]["event_handover_state"]
          handover_url: string | null
          id: string
          idea_id: string | null
          is_demo: boolean
          name: string
          notes: string | null
          planned_free_guests: number | null
          planned_paying_guests: number | null
          source_key: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actual_free_guests?: number | null
          actual_paying_guests?: number | null
          created_at?: string
          created_by?: string | null
          demo_key?: string | null
          event_date?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          handover_ref?: string | null
          handover_state?: Database["public"]["Enums"]["event_handover_state"]
          handover_url?: string | null
          id?: string
          idea_id?: string | null
          is_demo?: boolean
          name: string
          notes?: string | null
          planned_free_guests?: number | null
          planned_paying_guests?: number | null
          source_key?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actual_free_guests?: number | null
          actual_paying_guests?: number | null
          created_at?: string
          created_by?: string | null
          demo_key?: string | null
          event_date?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          handover_ref?: string | null
          handover_state?: Database["public"]["Enums"]["event_handover_state"]
          handover_url?: string | null
          id?: string
          idea_id?: string | null
          is_demo?: boolean
          name?: string
          notes?: string | null
          planned_free_guests?: number | null
          planned_paying_guests?: number | null
          source_key?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "event_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      menu_positions: {
        Row: {
          course: string
          created_at: string
          id: string
          menu_variant_id: string
          notes: string | null
          quantity_per_guest: number
          sort_order: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          course?: string
          created_at?: string
          id?: string
          menu_variant_id: string
          notes?: string | null
          quantity_per_guest?: number
          sort_order?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          course?: string
          created_at?: string
          id?: string
          menu_variant_id?: string
          notes?: string | null
          quantity_per_guest?: number
          sort_order?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_positions_menu_variant_id_fkey"
            columns: ["menu_variant_id"]
            isOneToOne: false
            referencedRelation: "menu_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_positions_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_variants: {
        Row: {
          created_at: string
          expected_guests: number | null
          id: string
          is_default: boolean
          menu_id: string
          name: string
          notes: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_guests?: number | null
          id?: string
          is_default?: boolean
          menu_id: string
          name: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_guests?: number | null
          id?: string
          is_default?: boolean
          menu_id?: string
          name?: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_variants_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          created_by: string | null
          demo_key: string | null
          gross_price_per_person: number | null
          id: string
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["menu_status"]
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
          vat_rate: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          demo_key?: string | null
          gross_price_per_person?: number | null
          id?: string
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["menu_status"]
          updated_at?: string
          updated_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
          vat_rate?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          demo_key?: string | null
          gross_price_per_person?: number | null
          id?: string
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["menu_status"]
          updated_at?: string
          updated_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "menus_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menus_updated_by_fkey"
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
      approve_event_execution: {
        Args: { _event_id: string; _note?: string }
        Returns: string
      }
      create_event_from_idea: {
        Args: { _approve?: boolean; _idea_id: string }
        Returns: string
      }
      event_basis_fingerprint: { Args: { _event_id: string }; Returns: string }
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
      assumption_origin: "global_default" | "manual_override"
      assumption_unit:
        | "chf_per_hour"
        | "chf_per_guest"
        | "chf_fixed"
        | "percent"
      base_unit: "g" | "ml" | "piece"
      calculation_status: "estimated" | "partially_reviewed" | "reviewed"
      dish_source_type: "menu_import" | "manual"
      event_handover_state: "not_ready" | "ready" | "handed_over"
      event_idea_stage:
        | "new"
        | "in_discussion"
        | "approved_for_calculation"
        | "deferred"
        | "rejected"
      event_line_calc_mode: "fixed" | "per_guest"
      event_line_kind:
        | "revenue"
        | "variable_cost"
        | "personnel_cost"
        | "fixed_cost"
        | "informational"
      event_status:
        | "draft"
        | "precalculated"
        | "released"
        | "executed"
        | "postcalculated"
        | "archived"
      event_type: "beer_dine" | "banquet" | "lounge" | "other"
      event_value_status: "open" | "assumption" | "confirmed" | "effective"
      handover_attempt_state:
        | "ready"
        | "sending"
        | "unknown"
        | "failed"
        | "succeeded"
      handover_operation: "create" | "link"
      import_job_status:
        | "pending"
        | "processing"
        | "review"
        | "confirmed"
        | "failed"
      import_status: "draft" | "processing" | "review" | "confirmed" | "failed"
      import_type: "menu_document" | "ingredient_excel"
      ingredient_source_type: "ai_estimate" | "manual" | "excel_import"
      menu_status: "draft" | "partially_reviewed" | "reviewed" | "archived"
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
      assumption_origin: ["global_default", "manual_override"],
      assumption_unit: [
        "chf_per_hour",
        "chf_per_guest",
        "chf_fixed",
        "percent",
      ],
      base_unit: ["g", "ml", "piece"],
      calculation_status: ["estimated", "partially_reviewed", "reviewed"],
      dish_source_type: ["menu_import", "manual"],
      event_handover_state: ["not_ready", "ready", "handed_over"],
      event_idea_stage: [
        "new",
        "in_discussion",
        "approved_for_calculation",
        "deferred",
        "rejected",
      ],
      event_line_calc_mode: ["fixed", "per_guest"],
      event_line_kind: [
        "revenue",
        "variable_cost",
        "personnel_cost",
        "fixed_cost",
        "informational",
      ],
      event_status: [
        "draft",
        "precalculated",
        "released",
        "executed",
        "postcalculated",
        "archived",
      ],
      event_type: ["beer_dine", "banquet", "lounge", "other"],
      event_value_status: ["open", "assumption", "confirmed", "effective"],
      handover_attempt_state: [
        "ready",
        "sending",
        "unknown",
        "failed",
        "succeeded",
      ],
      handover_operation: ["create", "link"],
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
      menu_status: ["draft", "partially_reviewed", "reviewed", "archived"],
      package_unit: ["kg", "g", "l", "ml", "piece"],
      price_status: ["estimated", "confirmed"],
      quantity_source: ["ai_estimate", "manual"],
      sales_input_mode: ["per_open_day", "total"],
      small_material_mode: ["percent", "fixed"],
    },
  },
} as const
