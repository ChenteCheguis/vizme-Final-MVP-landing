-- ─────────────────────────────────────────────
-- Vizme — Supabase Migration 001: Init
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ─────────────────────────────────────────────

-- 1. Tabla de perfiles (extiende auth.users)
create table if not exists public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  email         text,
  full_name     text,
  company_name  text,
  industry      text check (industry in ('empresa', 'influencer', 'artista')),
  onboarding_complete boolean default false,
  onboarding_data     jsonb,
  created_at    timestamptz default timezone('utc', now()) not null,
  updated_at    timestamptz default timezone('utc', now()) not null
);

-- 2. Row Level Security
alter table public.profiles enable row level security;

create policy "Usuarios pueden ver su propio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Usuarios pueden crear su propio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Usuarios pueden actualizar su propio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- 3. Trigger: crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop si ya existe para evitar errores al re-ejecutar
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 4. Índices útiles
create index if not exists profiles_industry_idx on public.profiles(industry);
