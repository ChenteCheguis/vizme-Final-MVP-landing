-- ============================================================
-- VIZME Migration 011: Spec Consolidation
-- Idempotent — safe to run on fresh or existing databases
-- Run in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── 1. PROFILES ─────────────────────────────────────────────
-- Fix the industry CHECK constraint (was too restrictive, caused silent upsert failures)
-- Step A: Drop ALL check constraints on the industry column
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_industry_check;

-- Step B: Add all columns profiles needs (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_name     TEXT,
  ADD COLUMN IF NOT EXISTS industry         TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_data  JSONB,
  ADD COLUMN IF NOT EXISTS company_context  JSONB,
  ADD COLUMN IF NOT EXISTS tier             TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS business_address TEXT,
  ADD COLUMN IF NOT EXISTS business_lat     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS business_lng     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS streak_weeks     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_data_update TIMESTAMPTZ;

-- Step C: Re-add a more permissive industry constraint (allows NULL)
DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_industry_check
    CHECK (industry IS NULL OR industry IN ('empresa', 'influencer', 'artista'));
EXCEPTION WHEN duplicate_object THEN
  -- constraint already exists with this name — skip
  NULL;
END $$;

-- RLS (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios pueden crear su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios pueden ver su propio perfil"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Usuarios pueden crear su propio perfil"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuarios pueden actualizar su propio perfil"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── 2. PROJECTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID         REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name             TEXT         NOT NULL,
  description      TEXT,
  analysis_area    TEXT,
  period           TEXT,
  main_question    TEXT,
  hypothesis       TEXT,
  decision_to_make TEXT,
  dashboard_focus  TEXT         DEFAULT 'criterio_ia',
  audience         TEXT         DEFAULT 'dueno',
  needs_predictions BOOLEAN    DEFAULT FALSE,
  location         TEXT         DEFAULT 'México',
  seasonality      TEXT,
  external_factors TEXT[],
  status           TEXT         DEFAULT 'active',
  health_score_current  INTEGER,
  health_score_previous INTEGER,
  health_score_trend    TEXT CHECK (health_score_trend IS NULL OR health_score_trend IN ('up', 'down', 'stable')),
  created_at       TIMESTAMPTZ  DEFAULT now(),
  updated_at       TIMESTAMPTZ  DEFAULT now()
);

-- Add columns that may be missing from earlier migrations
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS health_score_current  INTEGER,
  ADD COLUMN IF NOT EXISTS health_score_previous INTEGER,
  ADD COLUMN IF NOT EXISTS health_score_trend    TEXT;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own projects" ON public.projects;
CREATE POLICY "users own projects" ON public.projects FOR ALL USING (auth.uid() = user_id);


-- ─── 3. FILES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.files (
  id                     UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                UUID          REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id             UUID          REFERENCES public.projects(id) ON DELETE SET NULL,
  file_name              TEXT          NOT NULL,
  file_type              TEXT          NOT NULL,
  file_size_bytes        INTEGER,
  storage_path           TEXT,
  sheet_names            TEXT[],
  selected_sheet         TEXT,
  parsed_data            JSONB,
  data_profile           JSONB,
  enriched_profile       JSONB,
  row_count              INTEGER,
  column_count           INTEGER,
  quality_score          INTEGER,
  detected_business_type TEXT,
  period_label           TEXT,
  tags                   TEXT[],
  dashboard_id           UUID,
  discovery_result       JSONB,
  is_active              BOOLEAN       DEFAULT TRUE,
  created_at             TIMESTAMPTZ   DEFAULT now(),
  updated_at             TIMESTAMPTZ   DEFAULT now()
);

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS discovery_result JSONB;

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own files" ON public.files;
CREATE POLICY "users own files" ON public.files FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_files_user ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_project ON public.files(project_id);


-- ─── 4. DASHBOARDS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dashboards (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id    UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  file_id       UUID        REFERENCES public.files(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL DEFAULT 'Dashboard',
  charts_json   JSONB,
  kpis_json     JSONB,
  alerts_json   JSONB,
  summary_json  JSONB,
  filters_json  JSONB,
  health_score  JSONB,
  ai_model_used TEXT,
  is_favorite   BOOLEAN     DEFAULT FALSE,
  tags          TEXT[],
  description   TEXT,
  period        TEXT        DEFAULT 'all',
  is_active     BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Add any missing columns
ALTER TABLE public.dashboards
  ADD COLUMN IF NOT EXISTS project_id    UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_id       UUID REFERENCES public.files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS charts_json   JSONB,
  ADD COLUMN IF NOT EXISTS kpis_json     JSONB,
  ADD COLUMN IF NOT EXISTS alerts_json   JSONB,
  ADD COLUMN IF NOT EXISTS summary_json  JSONB,
  ADD COLUMN IF NOT EXISTS filters_json  JSONB,
  ADD COLUMN IF NOT EXISTS health_score  JSONB,
  ADD COLUMN IF NOT EXISTS ai_model_used TEXT,
  ADD COLUMN IF NOT EXISTS is_favorite   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tags          TEXT[],
  ADD COLUMN IF NOT EXISTS description   TEXT,
  ADD COLUMN IF NOT EXISTS period        TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN DEFAULT TRUE;

ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "users_own_dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Users manage own dashboards" ON public.dashboards;
CREATE POLICY "users own dashboards" ON public.dashboards FOR ALL USING (auth.uid() = user_id);


-- ─── 5. ANALYSIS_HISTORY ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analysis_history (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  dashboard_id      UUID        REFERENCES public.dashboards(id) ON DELETE CASCADE,
  file_id           UUID        REFERENCES public.files(id) ON DELETE SET NULL,
  mode              TEXT        NOT NULL,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  result_json       JSONB,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own history" ON public.analysis_history;
CREATE POLICY "users own history" ON public.analysis_history FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON public.analysis_history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_dashboard ON public.analysis_history(dashboard_id);


-- ─── 6. WEEKLY_ENTRIES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_entries (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID         NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_id      UUID         REFERENCES public.files(id) ON DELETE SET NULL,
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_label TEXT         NOT NULL,
  entry_data   JSONB        NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "weekly_entries_user" ON public.weekly_entries;
CREATE POLICY "weekly_entries_user" ON public.weekly_entries FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_entries_project ON public.weekly_entries(project_id, created_at DESC);


-- ─── 7. COMPETITORS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.competitors (
  id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID            NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  place_id       TEXT,
  name           TEXT            NOT NULL,
  rating         NUMERIC(2,1),
  review_count   INTEGER         DEFAULT 0,
  address        TEXT,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  hours          JSONB,
  reviews_sample JSONB,
  phone          TEXT,
  website        TEXT,
  types          TEXT[],
  last_updated   TIMESTAMPTZ     NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ     NOT NULL DEFAULT now()
);

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "competitors_user" ON public.competitors;
CREATE POLICY "competitors_user" ON public.competitors FOR ALL
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_competitors_project ON public.competitors(project_id);


-- ─── 8. SHARED_LINKS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_links (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID         NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  token        UUID         NOT NULL DEFAULT gen_random_uuid(),
  created_by   UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ,
  views_count  INTEGER      NOT NULL DEFAULT 0,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shared_links_owner" ON public.shared_links;
CREATE POLICY "shared_links_owner" ON public.shared_links FOR ALL USING (auth.uid() = created_by);
-- Public read policy for shared links (anyone with token can view)
DROP POLICY IF EXISTS "shared_links_public_read" ON public.shared_links;
CREATE POLICY "shared_links_public_read" ON public.shared_links FOR SELECT USING (is_active = TRUE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_links_token ON public.shared_links(token);


-- ─── 9. NOTIFICATIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID         REFERENCES public.projects(id) ON DELETE CASCADE,
  type       TEXT         NOT NULL CHECK (type IN ('weekly', 'monthly', 'alert', 'competitor', 'streak')),
  title      TEXT         NOT NULL,
  content    JSONB        NOT NULL DEFAULT '{}',
  sent_at    TIMESTAMPTZ,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_user" ON public.notifications;
CREATE POLICY "notifications_user" ON public.notifications FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);


-- ─── 10. UPDATED_AT TRIGGERS ────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS files_updated_at ON public.files;
CREATE TRIGGER files_updated_at BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS dashboards_updated_at ON public.dashboards;
CREATE TRIGGER dashboards_updated_at BEFORE UPDATE ON public.dashboards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS projects_updated_at ON public.projects;
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ─── 11. STORAGE BUCKET ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads', 'uploads', false, 52428800,
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv'
  ]
) ON CONFLICT (id) DO NOTHING;

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
