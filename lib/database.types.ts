// ============================================================
// VIZME V5 — Supabase Database types
// Regenerate with:
//   supabase gen types typescript --linked > lib/database.types.ts
// Manually maintained until migrations are applied to remote.
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          tier: 'freemium' | 'pro' | 'enterprise';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          tier?: 'freemium' | 'pro' | 'enterprise';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          tier?: 'freemium' | 'pro' | 'enterprise';
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      files: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          storage_path: string;
          file_name: string;
          file_type: string;
          file_size: number;
          status: string;
          structural_map: Json | null;
          extracted_data: Json | null;
          error_message: string | null;
          uploaded_at: string;
          analyzed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          storage_path: string;
          file_name: string;
          file_type: string;
          file_size: number;
          status?: string;
          structural_map?: Json | null;
          extracted_data?: Json | null;
          error_message?: string | null;
          uploaded_at?: string;
          analyzed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['files']['Insert']>;
      };
      business_schemas: {
        Row: {
          id: string;
          project_id: string;
          version: number;
          business_identity: Json;
          entities: Json;
          metrics: Json;
          dimensions: Json;
          extraction_rules: Json;
          external_sources: Json;
          created_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          project_id: string;
          version: number;
          business_identity: Json;
          entities: Json;
          metrics: Json;
          dimensions: Json;
          extraction_rules: Json;
          external_sources: Json;
          created_at?: string;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['business_schemas']['Insert']>;
      };
      dashboard_blueprints: {
        Row: {
          id: string;
          project_id: string;
          schema_id: string;
          version: number;
          layout: Json;
          blocks: Json;
          is_active: boolean;
          regenerated_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          schema_id: string;
          version?: number;
          layout: Json;
          blocks: Json;
          is_active?: boolean;
          regenerated_reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['dashboard_blueprints']['Insert']>;
      };
      time_series_data: {
        Row: {
          id: string;
          project_id: string;
          metric_id: string;
          dimension_values: Json | null;
          value: number | null;
          period_start: string;
          period_end: string | null;
          source_file_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          metric_id: string;
          dimension_values?: Json | null;
          value?: number | null;
          period_start: string;
          period_end?: string | null;
          source_file_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['time_series_data']['Insert']>;
      };
      insights: {
        Row: {
          id: string;
          project_id: string;
          type: 'weekly' | 'monthly' | 'alert' | 'anomaly';
          title: string;
          content: string;
          data_snapshot: Json | null;
          model_used: string | null;
          generated_at: string;
          read_at: string | null;
          priority: number;
        };
        Insert: {
          id?: string;
          project_id: string;
          type: 'weekly' | 'monthly' | 'alert' | 'anomaly';
          title: string;
          content: string;
          data_snapshot?: Json | null;
          model_used?: string | null;
          generated_at?: string;
          read_at?: string | null;
          priority?: number;
        };
        Update: Partial<Database['public']['Tables']['insights']['Insert']>;
      };
      external_data_cache: {
        Row: {
          id: string;
          project_id: string;
          source: string;
          query_key: string;
          query_params: Json | null;
          response: Json;
          fetched_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          source: string;
          query_key: string;
          query_params?: Json | null;
          response: Json;
          fetched_at?: string;
          expires_at: string;
        };
        Update: Partial<Database['public']['Tables']['external_data_cache']['Insert']>;
      };
      schema_evolution_log: {
        Row: {
          id: string;
          project_id: string;
          old_version: number;
          new_version: number;
          change_type: string;
          description: string | null;
          triggered_by: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          old_version: number;
          new_version: number;
          change_type: string;
          description?: string | null;
          triggered_by?: string | null;
          changed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['schema_evolution_log']['Insert']>;
      };
      data_connectors: {
        Row: {
          id: string;
          project_id: string;
          type: 'google_drive' | 'dropbox' | 'onedrive' | 'google_sheets' | 'gmail' | 'whatsapp';
          credentials: Json;
          config: Json | null;
          is_active: boolean;
          last_sync_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          type: 'google_drive' | 'dropbox' | 'onedrive' | 'google_sheets' | 'gmail' | 'whatsapp';
          credentials: Json;
          config?: Json | null;
          is_active?: boolean;
          last_sync_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['data_connectors']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
