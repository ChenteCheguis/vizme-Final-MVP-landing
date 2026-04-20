// ============================================================
// VIZME V5 — businessSchemasRepo
// Versionado lineal: el schema activo es siempre el de mayor version.
// La tabla NO tiene columna is_active (eso vive sólo en
// dashboard_blueprints/data_connectors).
// ============================================================

import { supabase } from '../supabase';
import type { BusinessSchema } from '../v5types';

export const businessSchemasRepo = {
  async getLatestVersion(projectId: string): Promise<BusinessSchema | null> {
    const { data, error } = await supabase
      .from('business_schemas')
      .select('*')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as BusinessSchema | null) ?? null;
  },

  async listVersions(projectId: string): Promise<BusinessSchema[]> {
    const { data, error } = await supabase
      .from('business_schemas')
      .select('*')
      .eq('project_id', projectId)
      .order('version', { ascending: false });
    if (error) throw error;
    return (data ?? []) as BusinessSchema[];
  },

  async createNewVersion(
    input: Omit<BusinessSchema, 'id' | 'version' | 'created_at' | 'updated_at'>
  ): Promise<BusinessSchema> {
    const { data: prev } = await supabase
      .from('business_schemas')
      .select('version')
      .eq('project_id', input.project_id)
      .order('version', { ascending: false })
      .limit(1);
    const nextVersion = ((prev?.[0]?.version as number | undefined) ?? 0) + 1;

    const { data, error } = await supabase
      .from('business_schemas')
      .insert({ ...input, version: nextVersion })
      .select()
      .single();
    if (error) throw error;
    return data as BusinessSchema;
  },
};
