-- ============================================================
-- VIZME V5 - Migration 13: insights v2 (Sprint 4)
--
-- Sonnet 4.6 produces narrative insights tied to a dashboard
-- page (opportunity / risk / trend / anomaly). We expand the
-- CHECK constraint and add `page_id` (which page the insight
-- belongs to) and `metric_references` (which metrics the user
-- can drill into from the insight card).
-- ============================================================

ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS page_id            text,
  ADD COLUMN IF NOT EXISTS metric_references  jsonb DEFAULT '[]'::jsonb;

ALTER TABLE insights
  DROP CONSTRAINT IF EXISTS insights_type_check;

ALTER TABLE insights
  ADD CONSTRAINT insights_type_check
  CHECK (type IN ('weekly','monthly','alert','anomaly','opportunity','risk','trend'));

CREATE INDEX IF NOT EXISTS idx_insights_project_page
  ON insights(project_id, page_id);
