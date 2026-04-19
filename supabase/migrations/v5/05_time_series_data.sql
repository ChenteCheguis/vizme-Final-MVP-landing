-- ============================================================
-- VIZME V5 - Migration 05: time_series_data
-- Sprint 1 - DB Foundation
-- Accumulated history of all metrics across time. The "stock"
-- the client builds with each upload.
-- ============================================================

CREATE TABLE time_series_data (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid REFERENCES projects(id) ON DELETE CASCADE,
  metric_id        text NOT NULL,
  dimension_values jsonb,
  value            numeric,
  period_start     timestamptz NOT NULL,
  period_end       timestamptz,
  source_file_id   uuid REFERENCES files(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_tsd_project_metric_period
  ON time_series_data(project_id, metric_id, period_start DESC);

CREATE INDEX idx_tsd_source_file
  ON time_series_data(source_file_id);

ALTER TABLE time_series_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view time_series of own projects"
  ON time_series_data FOR SELECT USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users insert time_series in own projects"
  ON time_series_data FOR INSERT WITH CHECK (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users update own time_series"
  ON time_series_data FOR UPDATE USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users delete own time_series"
  ON time_series_data FOR DELETE USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));
