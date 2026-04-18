-- ─────────────────────────────────────────────
-- Vizme — Migration 004: Projects System
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ─────────────────────────────────────────────

-- Company context in profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_context jsonb;

-- ─── Projects ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id              uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid         REFERENCES auth.users NOT NULL,
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

-- ─── Extend uploads ────────────────────────────────────────────────────────
ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS project_id   uuid REFERENCES public.projects,
  ADD COLUMN IF NOT EXISTS period_label text,
  ADD COLUMN IF NOT EXISTS data_profile jsonb;

-- ─── Analyses ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analyses (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id           uuid        REFERENCES public.projects NOT NULL,
  user_id              uuid        REFERENCES auth.users NOT NULL,
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

-- ─── Dashboards (Supabase-backed, replaces localStorage) ───────────────────
CREATE TABLE IF NOT EXISTS public.dashboards (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      uuid        REFERENCES public.projects NOT NULL,
  user_id         uuid        REFERENCES auth.users NOT NULL,
  name            text        NOT NULL,
  description     text,
  tags            text[],
  chart_decisions jsonb,
  kpi_decisions   jsonb,
  main_insight    jsonb,
  alerts          jsonb,
  period          text        DEFAULT 'all',
  is_active       boolean     DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ─── Recommendations tracking ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recommendations (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id uuid        REFERENCES public.analyses NOT NULL,
  project_id  uuid        REFERENCES public.projects NOT NULL,
  user_id     uuid        REFERENCES auth.users NOT NULL,
  action      text        NOT NULL,
  impact      text,
  timeframe   text,
  priority    integer     DEFAULT 1,
  done        boolean     DEFAULT false,
  done_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- ─── Progress history ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.progress_history (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id   uuid        REFERENCES public.projects NOT NULL,
  user_id      uuid        REFERENCES auth.users NOT NULL,
  analysis_id  uuid        REFERENCES public.analyses NOT NULL,
  health_score integer,
  key_metrics  jsonb,
  recorded_at  timestamptz DEFAULT now()
);

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects'         AND policyname='users own projects')         THEN CREATE POLICY "users own projects"         ON public.projects         FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analyses'         AND policyname='users own analyses')         THEN CREATE POLICY "users own analyses"         ON public.analyses         FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dashboards'       AND policyname='users own dashboards')       THEN CREATE POLICY "users own dashboards"       ON public.dashboards       FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recommendations'  AND policyname='users own recommendations')  THEN CREATE POLICY "users own recommendations"  ON public.recommendations  FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='progress_history' AND policyname='users own progress')         THEN CREATE POLICY "users own progress"         ON public.progress_history FOR ALL USING (auth.uid() = user_id); END IF;
END $$;
