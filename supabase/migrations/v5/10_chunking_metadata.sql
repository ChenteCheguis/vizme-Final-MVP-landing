-- ============================================================
-- VIZME V5 - Migration 10: chunking metadata
-- Sprint 2.5 - Chunking Engine
-- Añade columnas para rastrear si el schema se construyó con
-- ruta simple (1 call) o chunked (3 calls + throttling), qué
-- pasos ejecutó y cuánto tardó el flujo completo.
-- ============================================================

ALTER TABLE business_schemas
  ADD COLUMN IF NOT EXISTS route TEXT DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS steps_executed JSONB,
  ADD COLUMN IF NOT EXISTS total_duration_ms INTEGER;

COMMENT ON COLUMN business_schemas.route IS
  'Ruta del orchestrator: simple (1 call monolítico) o chunked (3 calls + throttling).';

COMMENT ON COLUMN business_schemas.steps_executed IS
  'Array de {step_number, stage, tokens_input, tokens_output, cache_read, cache_write, duration_ms, retried}.';

COMMENT ON COLUMN business_schemas.total_duration_ms IS
  'Duración total del orchestrator en milisegundos (incluye throttling entre pasos en ruta chunked).';
