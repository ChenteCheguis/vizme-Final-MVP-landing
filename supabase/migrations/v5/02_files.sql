-- ============================================================
-- VIZME V5 - Migration 02: files
-- Sprint 1 - DB Foundation
-- ============================================================

CREATE TABLE files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  file_name       text NOT NULL,
  file_size_bytes bigint,
  mime_type       text,
  storage_path    text NOT NULL,
  structural_map  jsonb,
  extracted_data  jsonb,
  uploaded_at     timestamptz DEFAULT now(),
  processed_at    timestamptz
);

CREATE INDEX idx_files_project ON files(project_id);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view files of own projects"
  ON files FOR SELECT USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users upload files to own projects"
  ON files FOR INSERT WITH CHECK (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users update own files"
  ON files FOR UPDATE USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users delete own files"
  ON files FOR DELETE USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));
