// ============================================================
// VIZME V5 — externalCacheRepo
// Cache agresivo de APIs externas (INEGI, Banxico, Google, etc.).
// ============================================================

import { supabase } from '../supabase';
import type { ExternalDataCache } from '../v5types';

export const externalCacheRepo = {
  async get(projectId: string, source: string, queryKey: string): Promise<ExternalDataCache | null> {
    const { data, error } = await supabase
      .from('external_data_cache')
      .select('*')
      .eq('project_id', projectId)
      .eq('source', source)
      .eq('query_key', queryKey)
      .maybeSingle();
    if (error) throw error;
    const row = data as ExternalDataCache | null;
    if (!row) return null;
    if (new Date(row.expires_at) < new Date()) return null;
    return row;
  },

  async upsert(input: Omit<ExternalDataCache, 'id' | 'fetched_at'>): Promise<ExternalDataCache> {
    const { data, error } = await supabase
      .from('external_data_cache')
      .upsert(
        { ...input, fetched_at: new Date().toISOString() },
        { onConflict: 'project_id,source,query_key' }
      )
      .select()
      .single();
    if (error) throw error;
    return data as ExternalDataCache;
  },

  async removeExpired(projectId: string): Promise<number> {
    const { data, error } = await supabase
      .from('external_data_cache')
      .delete()
      .eq('project_id', projectId)
      .lt('expires_at', new Date().toISOString())
      .select('id');
    if (error) throw error;
    return (data ?? []).length;
  },
};
