-- ─────────────────────────────────────────────
-- Vizme — Supabase Migration 002: Uploads
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ─────────────────────────────────────────────

-- 1. Tabla de archivos subidos
create table if not exists public.uploads (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  file_name    text not null,
  file_size    bigint,
  storage_path text,
  headers      jsonb,
  row_count    integer,
  preview      jsonb,
  status       text default 'ready' check (status in ('pending', 'processing', 'ready', 'error')),
  created_at   timestamptz default timezone('utc', now()) not null
);

-- 2. RLS
alter table public.uploads enable row level security;

create policy "Usuarios gestionan sus propios uploads"
  on public.uploads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Índice
create index if not exists uploads_user_id_idx on public.uploads(user_id);

-- 4. Storage bucket (privado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads',
  'uploads',
  false,
  10485760, -- 10 MB
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv'
  ]
)
on conflict (id) do nothing;

-- 5. Storage policies
create policy "Usuarios suben a su propia carpeta"
  on storage.objects for insert
  with check (
    bucket_id = 'uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Usuarios leen sus propios archivos"
  on storage.objects for select
  using (
    bucket_id = 'uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Usuarios eliminan sus propios archivos"
  on storage.objects for delete
  using (
    bucket_id = 'uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
