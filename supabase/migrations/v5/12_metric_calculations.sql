-- ============================================================
-- VIZME V5 - Migration 12: metric_calculations cache
-- Sprint 4 - Pre-computed metric values per (project, metric, period)
--
-- Avoids recomputing aggregations on every dashboard view.
-- Refreshed by Edge Function mode 'recalculate_metrics' after
-- ingest_data succeeds (manual trigger, not automatic).
-- ============================================================

CREATE TABLE IF NOT EXISTS metric_calculations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  metric_id      text NOT NULL,
  period         text NOT NULL,
  value          jsonb NOT NULL,
  calculated_at  timestamptz DEFAULT now(),
  UNIQUE (project_id, metric_id, period)
);

CREATE INDEX IF NOT EXISTS idx_metric_calc_project
  ON metric_calculations(project_id);

CREATE INDEX IF NOT EXISTS idx_metric_calc_period
  ON metric_calculations(project_id, period);

ALTER TABLE metric_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own metric calculations" ON metric_calculations
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users insert own metric calculations" ON metric_calculations
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users update own metric calculations" ON metric_calculations
  FOR UPDATE USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users delete own metric calculations" ON metric_calculations
  FOR DELETE USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );
