// ============================================================
// VIZME V5 — Tipos compartidos para Edge Functions (Deno)
// Se mantienen sincronizados con lib/v5types.ts y lib/fileDigest.ts
// pero viven aquí porque Supabase Edge Functions sólo empaquetan
// el subárbol supabase/functions/.
// ============================================================

// ---------- File digest ----------

export type SheetKind = 'semanal' | 'mensual' | 'anual' | 'inventario' | 'resumen' | 'desconocido';

export interface HeaderCandidate {
  row_index: number;
  cells: Array<string | number | null>;
}

export interface SheetSummary {
  name: string;
  kind: SheetKind;
  rows_total: number;
  cols_total: number;
  header_candidates: HeaderCandidate[];
}

export interface SampleSheet {
  name: string;
  kind: SheetKind;
  rows: Array<Array<string | number | null>>;
}

export interface NotableRow {
  sheet_name: string;
  row_index: number;
  content: Array<string | number | null>;
  matched_keyword: string;
}

export interface FileDigest {
  file_name: string;
  file_type: 'xlsx' | 'xls' | 'csv';
  total_sheets: number;
  total_rows_approx: number;
  sheets_summary: SheetSummary[];
  sample_sheets: SampleSheet[];
  notable_rows: NotableRow[];
}

// ---------- Business Schema (output esperado de Opus) ----------

export type BusinessSize = 'micro' | 'small' | 'medium' | 'large';

export interface BusinessIdentity {
  industry: string;
  sub_industry?: string;
  business_model: string;
  size: BusinessSize;
  location?: { country: string; state?: string; city?: string };
  language: string;
  currency: string;
}

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum';
  required?: boolean;
  enum_values?: string[];
}

export interface Entity {
  id: string;
  name: string;
  type: 'transactional' | 'master' | 'reference';
  fields: SchemaField[];
}

export interface Metric {
  id: string;
  name: string;
  description: string;
  formula: string;
  unit: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'ratio';
  format: 'currency' | 'number' | 'percent' | 'duration';
  good_direction: 'up' | 'down';
  expected_range?: { min: number; max: number };
}

export interface Dimension {
  id: string;
  name: string;
  type: 'time' | 'category' | 'geo';
  hierarchy?: string[];
}

export interface ExtractionRule {
  source_pattern: string;
  target_entity: string;
  field_mappings: Record<string, string>;
  location?: {
    sheet_match: string;
    label_match?: string;
    column_offset?: number;
    row_offset?: number;
  };
  validations?: Array<{ field: string; rule: string }>;
}

export type ExternalSourceType =
  | 'google_places'
  | 'inegi'
  | 'denue'
  | 'banxico'
  | 'google_trends'
  | 'openweather'
  | 'sat_dof';

export interface ExternalSource {
  type: ExternalSourceType;
  query_template: string;
  refresh_interval_days: number;
  enabled: boolean;
}

export interface BusinessSchemaPayload {
  business_identity: BusinessIdentity;
  entities: Entity[];
  metrics: Metric[];
  dimensions: Dimension[];
  extraction_rules: ExtractionRule[];
  external_sources: ExternalSource[];
  needs_clarification?: string[];
}

// ---------- Claude client ----------

export type ClaudeModelAlias = 'opus-4-7' | 'sonnet-4-6' | 'haiku-4-5';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeCallArgs {
  model: ClaudeModelAlias;
  system: string;
  messages: ClaudeMessage[];
  max_tokens?: number;
  temperature?: number;
  cache_control?: boolean;
}

export interface ClaudeCallResult {
  text: string;
  tokens_input: number;
  tokens_output: number;
  tokens_cached_read?: number;
  tokens_cached_write?: number;
  model_used: string;
}
