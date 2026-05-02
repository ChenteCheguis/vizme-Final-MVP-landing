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
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      business_schemas: {
        Row: {
          business_identity: Json
          created_at: string | null
          dimensions: Json
          entities: Json
          external_sources: Json
          extraction_rules: Json
          id: string
          kpi_targets: Json | null
          metrics: Json
          model_used: string
          project_id: string | null
          route: string | null
          steps_executed: Json | null
          tokens_input: number | null
          tokens_output: number | null
          total_duration_ms: number | null
          updated_at: string | null
          version: number
        }
        Insert: {
          business_identity: Json
          created_at?: string | null
          dimensions: Json
          entities: Json
          external_sources: Json
          extraction_rules: Json
          id?: string
          kpi_targets?: Json | null
          metrics: Json
          model_used: string
          project_id?: string | null
          route?: string | null
          steps_executed?: Json | null
          tokens_input?: number | null
          tokens_output?: number | null
          total_duration_ms?: number | null
          updated_at?: string | null
          version?: number
        }
        Update: {
          business_identity?: Json
          created_at?: string | null
          dimensions?: Json
          entities?: Json
          external_sources?: Json
          extraction_rules?: Json
          id?: string
          kpi_targets?: Json | null
          metrics?: Json
          model_used?: string
          project_id?: string | null
          route?: string | null
          steps_executed?: Json | null
          tokens_input?: number | null
          tokens_output?: number | null
          total_duration_ms?: number | null
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_schemas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_blueprints: {
        Row: {
          blocks: Json
          created_at: string | null
          generation_duration_ms: number | null
          health_details: Json | null
          health_status: string | null
          id: string
          is_active: boolean | null
          last_calculated_at: string | null
          layout: Json
          layout_strategy: string | null
          model_used: string
          opus_reasoning: string | null
          pages: Json
          project_id: string | null
          regenerated_reason: string | null
          schema_id: string | null
          sophistication_level: string | null
          tokens_input: number | null
          tokens_output: number | null
          total_widgets: number | null
          updated_at: string | null
          version: number
        }
        Insert: {
          blocks: Json
          created_at?: string | null
          generation_duration_ms?: number | null
          health_details?: Json | null
          health_status?: string | null
          id?: string
          is_active?: boolean | null
          last_calculated_at?: string | null
          layout: Json
          layout_strategy?: string | null
          model_used?: string
          opus_reasoning?: string | null
          pages?: Json
          project_id?: string | null
          regenerated_reason?: string | null
          schema_id?: string | null
          sophistication_level?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          total_widgets?: number | null
          updated_at?: string | null
          version?: number
        }
        Update: {
          blocks?: Json
          created_at?: string | null
          generation_duration_ms?: number | null
          health_details?: Json | null
          health_status?: string | null
          id?: string
          is_active?: boolean | null
          last_calculated_at?: string | null
          layout?: Json
          layout_strategy?: string | null
          model_used?: string
          opus_reasoning?: string | null
          pages?: Json
          project_id?: string | null
          regenerated_reason?: string | null
          schema_id?: string | null
          sophistication_level?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          total_widgets?: number | null
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_blueprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_blueprints_schema_id_fkey"
            columns: ["schema_id"]
            isOneToOne: false
            referencedRelation: "business_schemas"
            referencedColumns: ["id"]
          },
        ]
      }
      data_connectors: {
        Row: {
          config: Json | null
          created_at: string | null
          credentials: Json
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          project_id: string | null
          type: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          credentials: Json
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          project_id?: string | null
          type: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          credentials?: Json
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          project_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_connectors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      external_data_cache: {
        Row: {
          expires_at: string
          fetched_at: string | null
          id: string
          project_id: string | null
          query_key: string
          query_params: Json | null
          response: Json
          source: string
        }
        Insert: {
          expires_at: string
          fetched_at?: string | null
          id?: string
          project_id?: string | null
          query_key: string
          query_params?: Json | null
          response: Json
          source: string
        }
        Update: {
          expires_at?: string
          fetched_at?: string | null
          id?: string
          project_id?: string | null
          query_key?: string
          query_params?: Json | null
          response?: Json
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_data_cache_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          extracted_data: Json | null
          file_name: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          processed_at: string | null
          project_id: string | null
          storage_path: string
          structural_map: Json | null
          uploaded_at: string | null
        }
        Insert: {
          extracted_data?: Json | null
          file_name: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          processed_at?: string | null
          project_id?: string | null
          storage_path: string
          structural_map?: Json | null
          uploaded_at?: string | null
        }
        Update: {
          extracted_data?: Json | null
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          processed_at?: string | null
          project_id?: string | null
          storage_path?: string
          structural_map?: Json | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          content: string
          data_snapshot: Json | null
          generated_at: string | null
          id: string
          model_used: string | null
          priority: number | null
          project_id: string | null
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          content: string
          data_snapshot?: Json | null
          generated_at?: string | null
          id?: string
          model_used?: string | null
          priority?: number | null
          project_id?: string | null
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          content?: string
          data_snapshot?: Json | null
          generated_at?: string | null
          id?: string
          model_used?: string | null
          priority?: number | null
          project_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_calculations: {
        Row: {
          calculated_at: string | null
          id: string
          metric_id: string
          period: string
          project_id: string
          value: Json
        }
        Insert: {
          calculated_at?: string | null
          id?: string
          metric_id: string
          period: string
          project_id: string
          value: Json
        }
        Update: {
          calculated_at?: string | null
          id?: string
          metric_id?: string
          period?: string
          project_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "metric_calculations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          subscription_id: string | null
          tier: string
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          subscription_id?: string | null
          tier?: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          subscription_id?: string | null
          tier?: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          question: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          question?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          question?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      schema_evolution_log: {
        Row: {
          change_type: string
          changed_at: string | null
          description: string | null
          id: string
          new_version: number
          old_version: number
          project_id: string | null
          triggered_by: string | null
        }
        Insert: {
          change_type: string
          changed_at?: string | null
          description?: string | null
          id?: string
          new_version: number
          old_version: number
          project_id?: string | null
          triggered_by?: string | null
        }
        Update: {
          change_type?: string
          changed_at?: string | null
          description?: string | null
          id?: string
          new_version?: number
          old_version?: number
          project_id?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schema_evolution_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schema_evolution_log_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      time_series_data: {
        Row: {
          created_at: string | null
          dimension_values: Json | null
          id: string
          metric_id: string
          period_end: string | null
          period_start: string
          project_id: string | null
          source_file_id: string | null
          value: number | null
        }
        Insert: {
          created_at?: string | null
          dimension_values?: Json | null
          id?: string
          metric_id: string
          period_end?: string | null
          period_start: string
          project_id?: string | null
          source_file_id?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string | null
          dimension_values?: Json | null
          id?: string
          metric_id?: string
          period_end?: string | null
          period_start?: string
          project_id?: string | null
          source_file_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_series_data_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_series_data_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
