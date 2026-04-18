-- ============================================================
-- VIZME Migration 012: Structural Map + Extracted Data
-- Supports the new 4-phase parsing pipeline (Stage 1)
-- Run in: Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE public.files ADD COLUMN IF NOT EXISTS structural_map JSONB;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS extracted_data JSONB;
