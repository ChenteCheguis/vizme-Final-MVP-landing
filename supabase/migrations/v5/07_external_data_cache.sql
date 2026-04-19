-- ============================================================
-- VIZME V5 - Migration 07: external_data_cache
-- Sprint 1 - DB Foundation
-- Aggressive cache for external API responses (Google Places,
-- INEGI, DENUE, Banxico, Google Trends, OpenWeather, SAT/DOF).
-- Keeps costs bounded and respects upstream rate limits.
-- ============================================================

CREATE TABLE external_data_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid REFERENCES projects(id) ON DELETE CASCADE,
  source       text NOT NULL,
  query_key    text NOT NULL,
  query_params jsonb,
  response     jsonb NOT NULL,
  fetched_at   timestamptz DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  UNIQUE(project_id, source, query_key)
);

CREATE INDEX idx_edc_expires ON external_data_cache(expires_at);

ALTER TABLE external_data_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view cache of own projects"
  ON external_data_cache FOR SELECT USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users insert cache in own projects"
  ON external_data_cache FOR INSERT WITH CHECK (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users update own cache"
  ON external_data_cache FOR UPDATE USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users delete own cache"
  ON external_data_cache FOR DELETE USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));
