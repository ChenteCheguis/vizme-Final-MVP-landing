-- ──────────────────────────────────────────────────────────────────────────────
-- Vizme Migration 009: Consolidate & Fix
-- Idempotent — safe to run multiple times
-- Run in Supabase Dashboard > SQL Editor
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Ensure profiles has all needed columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_context jsonb,
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'free';

-- 2. Ensure projects table exists with all columns
CREATE TABLE IF NOT EXISTS public.projects (
  id              uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid         REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name            text         NOT NULL,
  description     text,
  analysis_area   text,
  period          text,
  main_question   text,
  hypothesis      text,
  decision_to_make text,
  dashboard_focus text         DEFAULT 'criterio_ia',
  audience        text         DEFAULT 'dueno',
  needs_predictions boolean    DEFAULT false,
  location        text         DEFAULT 'México',
  seasonality     text,
  external_factors text[],
  status          text         DEFAULT 'active',
  created_at      timestamptz  DEFAULT now(),
  updated_at      timestamptz  DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own projects" ON public.projects;
CREATE POLICY "users own projects" ON public.projects FOR ALL USING (auth.uid() = user_id);

-- 3. Ensure files table exists
CREATE TABLE IF NOT EXISTS public.files (
  id                    uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid          REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id            uuid          REFERENCES public.projects(id) ON DELETE SET NULL,
  file_name             text          NOT NULL,
  file_type             text          NOT NULL,
  file_size_bytes       integer,
  storage_path          text,
  sheet_names           text[],
  selected_sheet        text,
  parsed_data           jsonb,
  data_profile          jsonb,
  enriched_profile      jsonb,
  row_count             integer,
  column_count          integer,
  quality_score         integer,
  detected_business_type text,
  period_label          text,
  tags                  text[],
  dashboard_id          uuid,
  is_active             boolean       DEFAULT true,
  created_at            timestamptz   DEFAULT now(),
  updated_at            timestamptz   DEFAULT now()
);

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own files" ON public.files;
CREATE POLICY "users own files" ON public.files FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_files_user ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_project ON public.files(project_id);

-- 4. Ensure dashboards has all V3 columns
-- (table created in earlier migrations, we just add missing columns)
ALTER TABLE public.dashboards
  ADD COLUMN IF NOT EXISTS project_id    uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_id       uuid REFERENCES public.files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS charts_json   jsonb,
  ADD COLUMN IF NOT EXISTS kpis_json     jsonb,
  ADD COLUMN IF NOT EXISTS alerts_json   jsonb,
  ADD COLUMN IF NOT EXISTS summary_json  jsonb,
  ADD COLUMN IF NOT EXISTS filters_json  jsonb,
  ADD COLUMN IF NOT EXISTS health_score  jsonb,
  ADD COLUMN IF NOT EXISTS ai_model_used text,
  ADD COLUMN IF NOT EXISTS is_favorite   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags          text[],
  ADD COLUMN IF NOT EXISTS description   text,
  ADD COLUMN IF NOT EXISTS period        text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS is_active     boolean DEFAULT false;

ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "users_own_dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Users manage own dashboards" ON public.dashboards;
CREATE POLICY "users own dashboards" ON public.dashboards FOR ALL USING (auth.uid() = user_id);

-- 5. Ensure analyses table
CREATE TABLE IF NOT EXISTS public.analyses (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id           uuid        REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id              uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chart_decisions      jsonb,
  kpi_decisions        jsonb,
  main_insight         jsonb,
  alerts               jsonb,
  executive_report     jsonb,
  health_score         integer,
  data_profile_snapshot jsonb,
  period_covered       text,
  created_at           timestamptz DEFAULT now()
);

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own analyses" ON public.analyses;
CREATE POLICY "users own analyses" ON public.analyses FOR ALL USING (auth.uid() = user_id);

-- 6. Ensure analysis_history table
CREATE TABLE IF NOT EXISTS public.analysis_history (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  dashboard_id  uuid        REFERENCES public.dashboards(id) ON DELETE CASCADE,
  file_id       uuid        REFERENCES public.files(id) ON DELETE SET NULL,
  mode          text        NOT NULL,
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

-- 7. Ensure recommendations table
CREATE TABLE IF NOT EXISTS public.recommendations (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id uuid        REFERENCES public.analyses(id) ON DELETE CASCADE NOT NULL,
  project_id  uuid        REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action      text        NOT NULL,
  impact      text,
  timeframe   text,
  priority    integer     DEFAULT 1,
  done        boolean     DEFAULT false,
  done_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own recommendations" ON public.recommendations;
CREATE POLICY "users own recommendations" ON public.recommendations FOR ALL USING (auth.uid() = user_id);

-- 8. Ensure progress_history table
CREATE TABLE IF NOT EXISTS public.progress_history (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id   uuid        REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  analysis_id  uuid        REFERENCES public.analyses(id) ON DELETE CASCADE NOT NULL,
  health_score integer,
  key_metrics  jsonb,
  recorded_at  timestamptz DEFAULT now()
);

ALTER TABLE public.progress_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own progress" ON public.progress_history;
CREATE POLICY "users own progress" ON public.progress_history FOR ALL USING (auth.uid() = user_id);

-- 9. Updated_at triggers
CREATE OR REPLACE FUNCTION update_files_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS files_updated_at ON public.files;
CREATE TRIGGER files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION update_files_updated_at();

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS dashboards_updated_at ON public.dashboards;
CREATE TRIGGER dashboards_updated_at
  BEFORE UPDATE ON public.dashboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 10. Storage bucket (idempotent — INSERT only if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads', 'uploads', false, 52428800,
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'application/csv']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (idempotent)
DROP POLICY IF EXISTS "Users upload own files" ON storage.objects;
CREATE POLICY "Users upload own files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users read own files" ON storage.objects;
CREATE POLICY "Users read own files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own files" ON storage.objects;
CREATE POLICY "Users delete own files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
