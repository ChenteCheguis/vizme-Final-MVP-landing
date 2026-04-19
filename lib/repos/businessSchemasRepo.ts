// ============================================================
// VIZME V5 — businessSchemasRepo
// Schema del negocio: versionado, un único is_active por project_id.
// ============================================================

import { supabase } from '../supabase';
import type { BusinessSchema } from '../v5types';

export const businessSchemasRepo = {
  async getActive(projectId: string): Promise<BusinessSchema | null> {
    const { data, error } = await supabase
      .from('business_schemas')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
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

  async createNewVersion(input: Omit<BusinessSchema, 'id' | 'created_at' | 'is_active'>): Promise<BusinessSchema> {
    await supabase
      .from('business_schemas')
      .update({ is_active: false })
      .eq('project_id', input.project_id)
      .eq('is_active', true);

    const { data, error } = await supabase
      .from('business_schemas')
      .insert({ ...input, is_active: true })
      .select()
      .single();
    if (error) throw error;
    return data as BusinessSchema;
  },

  async setActive(id: string, projectId: string): Promise<void> {
    await supabase.from('business_schemas').update({ is_active: false }).eq('project_id', projectId);
    const { error } = await supabase.from('business_schemas').update({ is_active: true }).eq('id', id);
    if (error) throw error;
  },
};
