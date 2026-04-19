-- ============================================================
-- VIZME V5 - Migration 08: schema_evolution_log + data_connectors
-- Sprint 1 - DB Foundation
-- ============================================================

-- SCHEMA_EVOLUTION_LOG: audit trail of business_schema version changes
CREATE TABLE schema_evolution_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid REFERENCES projects(id) ON DELETE CASCADE,
  old_version  int NOT NULL,
  new_version  int NOT NULL,
  change_type  text NOT NULL,
  description  text,
  triggered_by uuid REFERENCES files(id) ON DELETE SET NULL,
  changed_at   timestamptz DEFAULT now()
);

ALTER TABLE schema_evolution_log ENABLE ROW LEVEL SECURITY;

-- Read-only for users; writes happen via service role from Edge Functions.
CREATE POLICY "Users view evolution of own projects"
  ON schema_evolution_log FOR SELECT USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

-- DATA_CONNECTORS: third-party connector credentials (Drive, Dropbox, etc.)
CREATE TABLE data_connectors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid REFERENCES projects(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('google_drive','dropbox','onedrive','google_sheets','gmail','whatsapp')),
  credentials  jsonb NOT NULL,
  config       jsonb,
  is_active    boolean DEFAULT true,
  last_sync_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_dc_project_active
  ON data_connectors(project_id, is_active);

ALTER TABLE data_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view connectors of own projects"
  ON data_connectors FOR SELECT USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users create connectors in own projects"
  ON data_connectors FOR INSERT WITH CHECK (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users update own connectors"
  ON data_connectors FOR UPDATE USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users delete own connectors"
  ON data_connectors FOR DELETE USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));
