-- ============================================================
-- VIZME V5 — Migration 15: count_source_rows on time_series_data
-- Sprint 4.3 — Metric calculation correctness
--
-- Without this column, period-level aggregations are broken:
--   - count(period) returns # of TS rows (days), not # of source rows
--   - avg(period) returns mean-of-daily-means, not weighted avg
--
-- DEFAULT 1 keeps existing rows working (treated as 1-row-per-point).
-- ============================================================

ALTER TABLE time_series_data
  ADD COLUMN IF NOT EXISTS count_source_rows integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN time_series_data.count_source_rows IS
  'Number of source-file rows that were aggregated to produce value.
   Required for correct period-level count (sum of dailies) and avg
   (weighted by source-row counts).';
