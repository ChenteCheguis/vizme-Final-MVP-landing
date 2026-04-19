-- ============================================================
-- VIZME V5 - Migration 03: business_schemas
-- Sprint 1 - DB Foundation
-- The Business Schema is the central asset: the conceptual
-- model of the client business generated once by Opus 4.7.
-- ============================================================

CREATE TABLE business_schemas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid REFERENCES projects(id) ON DELETE CASCADE,
  version           int NOT NULL DEFAULT 1,
  business_identity jsonb NOT NULL,
  entities          jsonb NOT NULL,
  metrics           jsonb NOT NULL,
  dimensions        jsonb NOT NULL,
  extraction_rules  jsonb NOT NULL,
  external_sources  jsonb NOT NULL,
  kpi_targets       jsonb,
  model_used        text NOT NULL,
  tokens_input      int,
  tokens_output     int,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(project_id, version)
);

CREATE INDEX idx_bs_project ON business_schemas(project_id);

ALTER TABLE business_schemas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view schemas of own projects"
  ON business_schemas FOR SELECT USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users create schemas in own projects"
  ON business_schemas FOR INSERT WITH CHECK (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users update own schemas"
  ON business_schemas FOR UPDATE USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users delete own schemas"
  ON business_schemas FOR DELETE USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));
