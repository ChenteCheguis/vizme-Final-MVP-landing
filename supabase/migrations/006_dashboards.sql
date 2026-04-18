-- ── Migration 006: Dashboards table + processing columns ──────────────────
-- Run in Supabase SQL Editor

-- 1. Add processing columns to uploads
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS data_profile       jsonb;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS chart_engine_result jsonb;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS processing_status  text NOT NULL DEFAULT 'pending';
--   processing_status values: 'pending' | 'processing' | 'done' | 'error'

-- 2. Dashboards table (replaces localStorage)
CREATE TABLE IF NOT EXISTS dashboards (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  text        NOT NULL DEFAULT 'Mi Dashboard',
  description           text        NOT NULL DEFAULT '',
  upload_ids            text[]      NOT NULL DEFAULT '{}',
  selected_chart_ids    text[]      NOT NULL DEFAULT '{}',
  selected_kpi_ids      text[]      NOT NULL DEFAULT '{}',
  chart_engine_snapshot jsonb       NOT NULL DEFAULT '{}',
  raw_data_snapshot     jsonb,          -- stores up to 500 rows for offline render
  data_profile_snapshot jsonb,
  is_active             boolean     NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboards_user_id    ON dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_is_active  ON dashboards(user_id, is_active);

ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dashboards"
  ON dashboards FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS dashboards_updated_at ON dashboards;
CREATE TRIGGER dashboards_updated_at
  BEFORE UPDATE ON dashboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
