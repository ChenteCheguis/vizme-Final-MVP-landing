// ============================================================
// VIZME V5 — filesRepo
// Metadata de archivos subidos. El contenido vive en Supabase Storage.
// La pertenencia al usuario se infiere vía projects.user_id (RLS lo aplica).
// ============================================================

import { supabase } from '../supabase';
import type { FileRecord, Json } from '../v5types';

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
    return (data ?? null) as FileRecord | null;
  },

  async create(input: {
    project_id: string;
    storage_path: string;
    file_name: string;
    mime_type?: string;
    file_size_bytes?: number;
  }): Promise<FileRecord> {
    const { data, error } = await supabase.from('files').insert(input).select().single();
    if (error) throw error;
    return data as FileRecord;
  },

  async markProcessed(
    id: string,
    extra?: { structural_map?: Json; extracted_data?: Json }
  ): Promise<FileRecord> {
    const { data, error } = await supabase
      .from('files')
      .update({ processed_at: new Date().toISOString(), ...extra })
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
