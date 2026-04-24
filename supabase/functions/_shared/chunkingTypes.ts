// ============================================================
// VIZME V5 — Tipos específicos del chunking orchestrator
// Extraídos a un módulo aparte para evitar ciclos de import
// entre prompts y orchestrator.
// ============================================================

import type {
  Entity,
  Metric,
  Dimension,
  ExternalSource,
  ExtractionRule,
  BusinessSize,
} from './types.ts';

export type ChunkingRoute = 'simple' | 'chunked';

export interface ClassificationOutput {
  industry: string;
  sub_industry: string | null;
  business_model: string;
  size: BusinessSize;
  currency: string;
  language: string;
  location: { country: string; state?: string | null; city?: string | null } | null;
  focus_areas: string[];
  confidence: number;
  reasoning: string;
}

export interface EntitiesMetricsOutput {
  entities: Entity[];
  metrics: Metric[];
  dimensions: Dimension[];
  external_sources: ExternalSource[];
}

export interface ExtractionRulesOutput {
  extraction_rules: ExtractionRule[];
}

export interface StepExecutionMeta {
  step_number: number;
  stage: string;
  tokens_input: number;
  tokens_output: number;
  cache_read: number;
  cache_write: number;
  duration_ms: number;
  retried: number;
}

export interface OrchestratorProgress {
  step: number;
  total_steps: number;
  stage: string;
  human_message: string;
  tokens_used_so_far: number;
  tokens_remaining_in_tpm: number;
}
