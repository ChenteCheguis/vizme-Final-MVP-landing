-- ============================================================
-- VIZME V5 - Migration 11: dashboard_blueprints v2 expansion
-- Sprint 4 - Multi-page foundation
--
-- Extends the existing dashboard_blueprints table with the
-- multi-page model: Opus 4.7 decides how many pages a project
-- needs (simple/medium/complex), and stores the full structure
-- in `pages`. We keep `layout` + `blocks` for backward compat
-- but new code reads from `pages`.
-- ============================================================

ALTER TABLE dashboard_blueprints
  ADD COLUMN IF NOT EXISTS pages                  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS layout_strategy        text,
  ADD COLUMN IF NOT EXISTS opus_reasoning         text,
  ADD COLUMN IF NOT EXISTS sophistication_level   text
    CHECK (sophistication_level IN ('simple', 'medium', 'complex')),
  ADD COLUMN IF NOT EXISTS total_widgets          integer     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS model_used             text        NOT NULL DEFAULT 'claude-opus-4-7',
  ADD COLUMN IF NOT EXISTS tokens_input           integer,
  ADD COLUMN IF NOT EXISTS tokens_output          integer,
  ADD COLUMN IF NOT EXISTS generation_duration_ms integer,
  ADD COLUMN IF NOT EXISTS updated_at             timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_db_sophistication
  ON dashboard_blueprints(sophistication_level);
