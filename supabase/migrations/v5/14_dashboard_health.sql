-- ============================================================
-- VIZME V5 - Migration 14: dashboard health score
-- Sprint 4.2 - Tolerant UX for partial extractions
--
-- Adds 3 columns to dashboard_blueprints so the UI can render
-- a tolerant dashboard even when ingest extracted only some of
-- the metrics. The health state is recomputed after every
-- recalculate_metrics run by the analyze-data edge function.
--
--   complete  → 100% of metrics have ≥1 data point in last window
--   partial   → 50–99% extracted (yellow banner, dashboard still useful)
--   limited   → 1–49% extracted (orange banner, suggest re-upload)
--   no_data   → 0 metrics extracted (red banner + ghost dashboard)
--
-- health_details is a JSONB blob with:
--   { extracted: int, total: int, percent: number,
--     missing_metric_ids: string[], reasons: string[] }
-- ============================================================

ALTER TABLE dashboard_blueprints
  ADD COLUMN IF NOT EXISTS health_status      text
    CHECK (health_status IN ('complete', 'partial', 'limited', 'no_data')),
  ADD COLUMN IF NOT EXISTS health_details     jsonb       DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_calculated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_db_health_status
  ON dashboard_blueprints(health_status);
