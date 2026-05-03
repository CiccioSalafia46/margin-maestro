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
      ingredient_cost_state: {
        Row: {
          ingredient_id: string
          restaurant_id: string
          cost_source: string
          original_unit_cost: number | null
          recipe_quantity: number | null
          recipe_unit_cost: number | null
          calculation_status: string
          calculation_error: string | null
          last_calculated_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          ingredient_id: string
          restaurant_id: string
          cost_source?: string
          original_unit_cost?: number | null
          recipe_quantity?: number | null
          recipe_unit_cost?: number | null
          calculation_status?: string
          calculation_error?: string | null
          last_calculated_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          ingredient_id?: string
          restaurant_id?: string
          cost_source?: string
          original_unit_cost?: number | null
          recipe_quantity?: number | null
          recipe_unit_cost?: number | null
          calculation_status?: string
          calculation_error?: string | null
          last_calculated_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_cost_state_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: true
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_cost_state_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          id: string
          restaurant_id: string
          supplier_id: string | null
          name: string
          type: string
          total_cost: number | null
          original_quantity: number | null
          original_uom_code: string | null
          conversion_on: boolean
          recipe_uom_code: string | null
          adjustment: number
          density_g_per_ml: number | null
          manual_recipe_unit_cost: number | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          supplier_id?: string | null
          name: string
          type: string
          total_cost?: number | null
          original_quantity?: number | null
          original_uom_code?: string | null
          conversion_on?: boolean
          recipe_uom_code?: string | null
          adjustment?: number
          density_g_per_ml?: number | null
          manual_recipe_unit_cost?: number | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          supplier_id?: string | null
          name?: string
          type?: string
          total_cost?: number | null
          original_quantity?: number | null
          original_uom_code?: string | null
          conversion_on?: boolean
          recipe_uom_code?: string | null
          adjustment?: number
          density_g_per_ml?: number | null
          manual_recipe_unit_cost?: number | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_original_uom_code_fkey"
            columns: ["original_uom_code"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "ingredients_recipe_uom_code_fkey"
            columns: ["recipe_uom_code"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      recipe_lines: {
        Row: {
          id: string
          restaurant_id: string
          recipe_id: string
          ingredient_id: string
          quantity: number
          uom_code: string
          sort_order: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          recipe_id: string
          ingredient_id: string
          quantity: number
          uom_code: string
          sort_order?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          recipe_id?: string
          ingredient_id?: string
          quantity?: number
          uom_code?: string
          sort_order?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_lines_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_lines_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_lines_uom_code_fkey"
            columns: ["uom_code"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "recipe_lines_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          id: string
          restaurant_id: string
          name: string
          kind: string
          menu_category_id: string | null
          serving_quantity: number
          serving_uom_code: string
          menu_price: number | null
          linked_intermediate_ingredient_id: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          name: string
          kind: string
          menu_category_id?: string | null
          serving_quantity?: number
          serving_uom_code: string
          menu_price?: number | null
          linked_intermediate_ingredient_id?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          name?: string
          kind?: string
          menu_category_id?: string | null
          serving_quantity?: number
          serving_uom_code?: string
          menu_price?: number | null
          linked_intermediate_ingredient_id?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_menu_category_id_fkey"
            columns: ["menu_category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_serving_uom_code_fkey"
            columns: ["serving_uom_code"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "recipes_linked_intermediate_ingredient_id_fkey"
            columns: ["linked_intermediate_ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: { id: string; restaurant_id: string; alert_type: string; severity: string; status: string; title: string; message: string; recommended_action: string | null; entity_type: string | null; entity_id: string | null; batch_id: string | null; impact_cascade_run_id: string | null; impact_cascade_item_id: string | null; recipe_id: string | null; ingredient_id: string | null; payload: unknown; detected_at: string; acknowledged_at: string | null; acknowledged_by: string | null; resolved_at: string | null; resolved_by: string | null; dismissed_at: string | null; dismissed_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; restaurant_id: string; alert_type: string; severity?: string; status?: string; title: string; message: string; recommended_action?: string | null; entity_type?: string | null; entity_id?: string | null; batch_id?: string | null; impact_cascade_run_id?: string | null; impact_cascade_item_id?: string | null; recipe_id?: string | null; ingredient_id?: string | null; payload?: unknown; detected_at?: string; acknowledged_at?: string | null; acknowledged_by?: string | null; resolved_at?: string | null; resolved_by?: string | null; dismissed_at?: string | null; dismissed_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; restaurant_id?: string; alert_type?: string; severity?: string; status?: string; title?: string; message?: string; recommended_action?: string | null; entity_type?: string | null; entity_id?: string | null; batch_id?: string | null; impact_cascade_run_id?: string | null; impact_cascade_item_id?: string | null; recipe_id?: string | null; ingredient_id?: string | null; payload?: unknown; detected_at?: string; acknowledged_at?: string | null; acknowledged_by?: string | null; resolved_at?: string | null; resolved_by?: string | null; dismissed_at?: string | null; dismissed_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "alerts_restaurant_id_fkey"; columns: ["restaurant_id"]; isOneToOne: false; referencedRelation: "restaurants"; referencedColumns: ["id"] }]
      }
      impact_cascade_items: {
        Row: { id: string; restaurant_id: string; run_id: string; batch_id: string; dish_recipe_id: string | null; dish_name_at_time: string; category_name_at_time: string | null; affected_ingredient_ids: string[] | null; affected_ingredient_names: string[] | null; impact_paths: unknown; menu_price: number | null; target_gpm: number | null; old_cogs_per_serving: number | null; new_cogs_per_serving: number | null; cogs_delta_per_serving: number | null; old_gp: number | null; new_gp: number | null; gp_delta: number | null; old_gpm: number | null; new_gpm: number | null; gpm_delta: number | null; was_on_target: boolean | null; is_on_target: boolean | null; newly_below_target: boolean; suggested_menu_price: number | null; suggested_price_delta: number | null; calculation_status: string; issue_summary: string | null; created_at: string }
        Insert: { id?: string; restaurant_id: string; run_id: string; batch_id: string; dish_recipe_id?: string | null; dish_name_at_time: string; category_name_at_time?: string | null; affected_ingredient_ids?: string[] | null; affected_ingredient_names?: string[] | null; impact_paths?: unknown; menu_price?: number | null; target_gpm?: number | null; old_cogs_per_serving?: number | null; new_cogs_per_serving?: number | null; cogs_delta_per_serving?: number | null; old_gp?: number | null; new_gp?: number | null; gp_delta?: number | null; old_gpm?: number | null; new_gpm?: number | null; gpm_delta?: number | null; was_on_target?: boolean | null; is_on_target?: boolean | null; newly_below_target?: boolean; suggested_menu_price?: number | null; suggested_price_delta?: number | null; calculation_status?: string; issue_summary?: string | null; created_at?: string }
        Update: { [_ in never]: never }
        Relationships: [{ foreignKeyName: "impact_cascade_items_run_id_fkey"; columns: ["run_id"]; isOneToOne: false; referencedRelation: "impact_cascade_runs"; referencedColumns: ["id"] }]
      }
      impact_cascade_runs: {
        Row: { id: string; restaurant_id: string; batch_id: string; baseline_version: number; status: string; generated_by: string | null; generated_at: string; changed_ingredients_count: number; affected_dish_count: number; impact_item_count: number; newly_below_target_count: number; total_cogs_delta_per_serving: number | null; total_margin_delta_per_serving: number | null; note: string | null; error_message: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; restaurant_id: string; batch_id: string; baseline_version?: number; status?: string; generated_by?: string | null; generated_at?: string; changed_ingredients_count?: number; affected_dish_count?: number; impact_item_count?: number; newly_below_target_count?: number; total_cogs_delta_per_serving?: number | null; total_margin_delta_per_serving?: number | null; note?: string | null; error_message?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; restaurant_id?: string; batch_id?: string; baseline_version?: number; status?: string; generated_by?: string | null; generated_at?: string; changed_ingredients_count?: number; affected_dish_count?: number; impact_item_count?: number; newly_below_target_count?: number; total_cogs_delta_per_serving?: number | null; total_margin_delta_per_serving?: number | null; note?: string | null; error_message?: string | null; created_at?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "impact_cascade_runs_restaurant_id_fkey"; columns: ["restaurant_id"]; isOneToOne: false; referencedRelation: "restaurants"; referencedColumns: ["id"] }, { foreignKeyName: "impact_cascade_runs_batch_id_fkey"; columns: ["batch_id"]; isOneToOne: false; referencedRelation: "price_update_batches"; referencedColumns: ["id"] }]
      }
      ingredient_price_log: {
        Row: {
          id: string
          restaurant_id: string
          batch_id: string | null
          ingredient_id: string | null
          baseline_version: number
          ingredient_name_at_time: string
          supplier_name_at_time: string | null
          ingredient_type_at_time: string
          old_total_cost: number | null
          old_quantity: number | null
          old_uom_code: string | null
          old_unit_cost: number | null
          old_recipe_unit_cost: number | null
          new_total_cost: number | null
          new_quantity: number | null
          new_uom_code: string | null
          new_unit_cost: number | null
          new_recipe_unit_cost: number | null
          delta_recipe_unit_cost_amount: number | null
          delta_recipe_unit_cost_percent: number | null
          event_type: string
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          batch_id?: string | null
          ingredient_id?: string | null
          baseline_version?: number
          ingredient_name_at_time: string
          supplier_name_at_time?: string | null
          ingredient_type_at_time: string
          old_total_cost?: number | null
          old_quantity?: number | null
          old_uom_code?: string | null
          old_unit_cost?: number | null
          old_recipe_unit_cost?: number | null
          new_total_cost?: number | null
          new_quantity?: number | null
          new_uom_code?: string | null
          new_unit_cost?: number | null
          new_recipe_unit_cost?: number | null
          delta_recipe_unit_cost_amount?: number | null
          delta_recipe_unit_cost_percent?: number | null
          event_type: string
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          [_ in never]: never
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_price_log_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_snapshots: {
        Row: {
          id: string
          restaurant_id: string
          ingredient_id: string
          baseline_version: number
          ingredient_name_at_time: string
          supplier_name_at_time: string | null
          ingredient_type_at_time: string
          total_cost: number | null
          quantity: number | null
          uom_code: string | null
          unit_cost: number | null
          recipe_unit_cost: number | null
          calculation_status: string | null
          captured_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          ingredient_id: string
          baseline_version?: number
          ingredient_name_at_time: string
          supplier_name_at_time?: string | null
          ingredient_type_at_time: string
          total_cost?: number | null
          quantity?: number | null
          uom_code?: string | null
          unit_cost?: number | null
          recipe_unit_cost?: number | null
          calculation_status?: string | null
          captured_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          ingredient_id?: string
          baseline_version?: number
          ingredient_name_at_time?: string
          supplier_name_at_time?: string | null
          ingredient_type_at_time?: string
          total_cost?: number | null
          quantity?: number | null
          uom_code?: string | null
          unit_cost?: number | null
          recipe_unit_cost?: number | null
          calculation_status?: string | null
          captured_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_snapshots_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_snapshots_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      price_update_batches: {
        Row: {
          id: string
          restaurant_id: string
          created_by: string | null
          status: string
          source: string
          note: string | null
          baseline_version: number
          applied_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          created_by?: string | null
          status?: string
          source?: string
          note?: string | null
          baseline_version?: number
          applied_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          created_by?: string | null
          status?: string
          source?: string
          note?: string | null
          baseline_version?: number
          applied_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_update_batches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_invitations: {
        Row: { id: string; restaurant_id: string; email: string; role: string; status: string; invited_by: string | null; accepted_by: string | null; accepted_at: string | null; cancelled_at: string | null; expires_at: string | null; token: string; note: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; restaurant_id: string; email: string; role: string; status?: string; invited_by?: string | null; accepted_by?: string | null; accepted_at?: string | null; cancelled_at?: string | null; expires_at?: string | null; token?: string; note?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; restaurant_id?: string; email?: string; role?: string; status?: string; invited_by?: string | null; accepted_by?: string | null; accepted_at?: string | null; cancelled_at?: string | null; expires_at?: string | null; token?: string; note?: string | null; created_at?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "restaurant_invitations_restaurant_id_fkey"; columns: ["restaurant_id"]; isOneToOne: false; referencedRelation: "restaurants"; referencedColumns: ["id"] }]
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
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
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_members: {
        Row: {
          created_at: string
          restaurant_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          restaurant_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          restaurant_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          created_at: string
          currency_code: string
          gp_floor_amount: number | null
          gpm_drop_threshold_percent: number
          ingredient_spike_threshold_percent: number
          locale: string
          restaurant_id: string
          target_gpm: number
          tax_mode: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code?: string
          gp_floor_amount?: number | null
          gpm_drop_threshold_percent?: number
          ingredient_spike_threshold_percent?: number
          locale?: string
          restaurant_id: string
          target_gpm?: number
          tax_mode?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          gp_floor_amount?: number | null
          gpm_drop_threshold_percent?: number
          ingredient_spike_threshold_percent?: number
          locale?: string
          restaurant_id?: string
          target_gpm?: number
          tax_mode?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_conversions: {
        Row: {
          created_at: string
          factor: number
          from_unit_code: string
          id: string
          is_active: boolean
          requires_density: boolean
          to_unit_code: string
        }
        Insert: {
          created_at?: string
          factor: number
          from_unit_code: string
          id?: string
          is_active?: boolean
          requires_density?: boolean
          to_unit_code: string
        }
        Update: {
          created_at?: string
          factor?: number
          from_unit_code?: string
          id?: string
          is_active?: boolean
          requires_density?: boolean
          to_unit_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_conversions_from_unit_code_fkey"
            columns: ["from_unit_code"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "unit_conversions_to_unit_code_fkey"
            columns: ["to_unit_code"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      units: {
        Row: {
          base_unit_code: string | null
          code: string
          created_at: string
          family: string
          is_active: boolean
          label: string
          sort_order: number
          to_base_factor: number | null
        }
        Insert: {
          base_unit_code?: string | null
          code: string
          created_at?: string
          family: string
          is_active?: boolean
          label: string
          sort_order?: number
          to_base_factor?: number | null
        }
        Update: {
          base_unit_code?: string | null
          code?: string
          created_at?: string
          family?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          to_base_factor?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_restaurant_invitation: {
        Args: { p_token: string }
        Returns: unknown
      }
      create_restaurant_with_owner: {
        Args: { p_name: string }
        Returns: string
      }
      has_restaurant_role: {
        Args: { p_restaurant_id: string; p_roles: string[] }
        Returns: boolean
      }
      initialize_restaurant_reference_data: {
        Args: { p_restaurant_id: string }
        Returns: undefined
      }
      is_restaurant_member: {
        Args: { p_restaurant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
