// ============================================================
// VIZME V5 — timeSeriesRepo
// Stock histórico de métricas. Crece con cada upload.
// ============================================================

import { supabase } from '../supabase';
import type { TimeSeriesPoint } from '../v5types';

export const timeSeriesRepo = {
  async listByMetric(
    projectId: string,
    metricId: string,
    opts?: { from?: string; to?: string; limit?: number }
  ): Promise<TimeSeriesPoint[]> {
    let q = supabase
      .from('time_series_data')
      .select('*')
      .eq('project_id', projectId)
      .eq('metric_id', metricId)
      .order('period_start', { ascending: true });

    if (opts?.from) q = q.gte('period_start', opts.from);
    if (opts?.to) q = q.lte('period_start', opts.to);
    if (opts?.limit) q = q.limit(opts.limit);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as TimeSeriesPoint[];
  },

  async bulkInsert(points: Array<Omit<TimeSeriesPoint, 'id' | 'created_at'>>): Promise<TimeSeriesPoint[]> {
    if (points.length === 0) return [];
    const { data, error } = await supabase.from('time_series_data').insert(points).select();
    if (error) throw error;
    return (data ?? []) as TimeSeriesPoint[];
  },

  async removeByFile(sourceFileId: string): Promise<void> {
    const { error } = await supabase.from('time_series_data').delete().eq('source_file_id', sourceFileId);
    if (error) throw error;
  },
};
