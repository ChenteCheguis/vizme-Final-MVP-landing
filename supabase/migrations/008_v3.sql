-- ──────────────────────────────────────────────────────────────────────────────
-- Vizme Migration 008: V3 Schema
-- Run in Supabase Dashboard > SQL Editor
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Files table (replaces uploads for V3; uploads kept for backward compat)
CREATE TABLE IF NOT EXISTS public.files (
  id                    uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid          REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id            uuid          REFERENCES public.projects(id) ON DELETE SET NULL,
  file_name             text          NOT NULL,
  file_type             text          NOT NULL,        -- 'xlsx', 'csv', 'xls'
  file_size_bytes       integer,
  storage_path          text,                          -- Path in Supabase Storage
  sheet_names           text[],                        -- For multi-sheet Excel
  selected_sheet        text,
  parsed_data           jsonb,                         -- Full parsed rows (JSONB)
  data_profile          jsonb,                         -- DataProfile snapshot
  enriched_profile      jsonb,                         -- EnrichedProfile (cross-tabs, time series)
  row_count             integer,
  column_count          integer,
  quality_score         integer,                       -- 0-100
  detected_business_type text,                        -- 'ventas', 'inventario', etc.
  period_label          text,
  tags                  text[],
  dashboard_id          uuid,                          -- Associated dashboard (set after generation)
  is_active             boolean       DEFAULT true,
  created_at            timestamptz   DEFAULT now(),
  updated_at            timestamptz   DEFAULT now()
);

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own files" ON public.files;
CREATE POLICY "users own files" ON public.files FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_files_user ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_project ON public.files(project_id);

-- 2. Update dashboards table with V3 columns
ALTER TABLE public.dashboards
  ADD COLUMN IF NOT EXISTS file_id       uuid REFERENCES public.files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS charts_json   jsonb,       -- Array of ChartDefinition (V3)
  ADD COLUMN IF NOT EXISTS kpis_json     jsonb,       -- Array of KPIDefinition (V3)
  ADD COLUMN IF NOT EXISTS alerts_json   jsonb,       -- Array of AlertDefinition (V3)
  ADD COLUMN IF NOT EXISTS summary_json  jsonb,       -- ExecutiveSummary
  ADD COLUMN IF NOT EXISTS filters_json  jsonb,       -- Array of FilterDefinition
  ADD COLUMN IF NOT EXISTS health_score  jsonb,       -- HealthScore object
  ADD COLUMN IF NOT EXISTS ai_model_used text,
  ADD COLUMN IF NOT EXISTS is_favorite   boolean      DEFAULT false;

-- 3. Analysis history
CREATE TABLE IF NOT EXISTS public.analysis_history (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  dashboard_id  uuid        REFERENCES public.dashboards(id) ON DELETE CASCADE,
  file_id       uuid        REFERENCES public.files(id) ON DELETE SET NULL,
  mode          text        NOT NULL,           -- 'dashboard', 'executive', 'internal', 'external', 'predictions', 'chat'
  prompt_tokens integer,
  completion_tokens integer,
  result_json   jsonb,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own history" ON public.analysis_history;
CREATE POLICY "users own history" ON public.analysis_history FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON public.analysis_history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_dashboard ON public.analysis_history(dashboard_id);

-- 4. Auto-update updated_at on files
CREATE OR REPLACE FUNCTION update_files_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS files_updated_at ON public.files;
CREATE TRIGGER files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION update_files_updated_at();
