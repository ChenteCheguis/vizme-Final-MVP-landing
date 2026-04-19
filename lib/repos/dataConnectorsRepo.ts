// ============================================================
// VIZME V5 — dataConnectorsRepo
// Credenciales cifradas de conectores externos (Drive, Dropbox, etc.).
// ============================================================

import { supabase } from '../supabase';
import type { DataConnector, ConnectorType } from '../v5types';

export const dataConnectorsRepo = {
  async listByProject(projectId: string): Promise<DataConnector[]> {
    const { data, error } = await supabase
      .from('data_connectors')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as DataConnector[];
  },

  async getActive(projectId: string, type: ConnectorType): Promise<DataConnector | null> {
    const { data, error } = await supabase
      .from('data_connectors')
      .select('*')
      .eq('project_id', projectId)
      .eq('type', type)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    return (data as DataConnector | null) ?? null;
  },

  async create(
    input: Omit<DataConnector, 'id' | 'created_at' | 'last_sync_at' | 'is_active'>
  ): Promise<DataConnector> {
    const { data, error } = await supabase
      .from('data_connectors')
      .insert({ ...input, is_active: true })
      .select()
      .single();
    if (error) throw error;
    return data as DataConnector;
  },

  async touchLastSync(id: string): Promise<void> {
    const { error } = await supabase
      .from('data_connectors')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async disable(id: string): Promise<void> {
    const { error } = await supabase.from('data_connectors').update({ is_active: false }).eq('id', id);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('data_connectors').delete().eq('id', id);
    if (error) throw error;
  },
};
