-- ─────────────────────────────────────────────
-- Vizme — Supabase Migration 003: Analysis fields
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ─────────────────────────────────────────────

alter table public.uploads
  add column if not exists analysis_result jsonb,
  add column if not exists analyzed_at     timestamptz;
