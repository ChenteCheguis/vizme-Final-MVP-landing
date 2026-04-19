// ============================================================
// VIZME V5 — filesRepo
// Metadata de archivos subidos. El contenido vive en Supabase Storage.
// ============================================================

import { supabase } from '../supabase';
import type { FileRecord } from '../v5types';

export const filesRepo = {
  async listByProject(projectId: string): Promise<FileRecord[]> {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as FileRecord[];
  },

  async get(id: string): Promise<FileRecord | null> {
    const { data, error } = await supabase.from('files').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as FileRecord) ?? null;
  },

  async create(input: {
    project_id: string;
    user_id: string;
    storage_path: string;
    file_name: string;
    file_type: string;
    file_size: number;
  }): Promise<FileRecord> {
    const { data, error } = await supabase.from('files').insert(input).select().single();
    if (error) throw error;
    return data as FileRecord;
  },

  async updateStatus(
    id: string,
    status: FileRecord['status'],
    extra?: Partial<Pick<FileRecord, 'structural_map' | 'extracted_data' | 'error_message' | 'analyzed_at'>>
  ): Promise<FileRecord> {
    const { data, error } = await supabase
      .from('files')
      .update({ status, ...extra })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as FileRecord;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('files').delete().eq('id', id);
    if (error) throw error;
  },
};
