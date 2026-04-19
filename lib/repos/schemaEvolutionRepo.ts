// ============================================================
// VIZME V5 — schemaEvolutionRepo
// Audit trail de cambios en business_schema. Solo lectura en UI.
// ============================================================

import { supabase } from '../supabase';
import type { SchemaEvolutionLog } from '../v5types';

export const schemaEvolutionRepo = {
  async listByProject(projectId: string, limit = 50): Promise<SchemaEvolutionLog[]> {
    const { data, error } = await supabase
      .from('schema_evolution_log')
      .select('*')
      .eq('project_id', projectId)
      .order('changed_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as SchemaEvolutionLog[];
  },
};
