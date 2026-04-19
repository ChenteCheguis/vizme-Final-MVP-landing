// ============================================================
// VIZME V5 — projectsRepo
// CRUD sobre tabla `projects`. RLS asegura user_id = auth.uid().
// ============================================================

import { supabase } from '../supabase';
import type { Project } from '../v5types';

export const projectsRepo = {
  async list(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Project[];
  },

  async get(id: string): Promise<Project | null> {
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as Project) ?? null;
  },

  async create(input: { name: string; description?: string }): Promise<Project> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('No hay sesión activa');
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: user.user.id, name: input.name, description: input.description ?? null })
      .select()
      .single();
    if (error) throw error;
    return data as Project;
  },

  async update(id: string, patch: Partial<Pick<Project, 'name' | 'description'>>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Project;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  },
};
