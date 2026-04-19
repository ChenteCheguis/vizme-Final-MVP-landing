// ============================================================
// VIZME V5 — insightsRepo
// Insights generados por IA (weekly/monthly/alert/anomaly).
// ============================================================

import { supabase } from '../supabase';
import type { Insight, InsightType } from '../v5types';

export const insightsRepo = {
  async listByProject(
    projectId: string,
    opts?: { type?: InsightType; unreadOnly?: boolean; limit?: number }
  ): Promise<Insight[]> {
    let q = supabase
      .from('insights')
      .select('*')
      .eq('project_id', projectId)
      .order('generated_at', { ascending: false });

    if (opts?.type) q = q.eq('type', opts.type);
    if (opts?.unreadOnly) q = q.is('read_at', null);
    if (opts?.limit) q = q.limit(opts.limit);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Insight[];
  },

  async create(input: Omit<Insight, 'id' | 'generated_at' | 'read_at'>): Promise<Insight> {
    const { data, error } = await supabase.from('insights').insert(input).select().single();
    if (error) throw error;
    return data as Insight;
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('insights')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('insights').delete().eq('id', id);
    if (error) throw error;
  },
};
