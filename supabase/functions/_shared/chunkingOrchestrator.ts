// ============================================================
// VIZME V5 — Chunking Orchestrator
// Divide el build_schema en pasos pequeños para respetar el
// límite de 30k ITPM de Anthropic Tier 1 en Opus 4.7.
//
// Ruta 'simple': digest <= 25k tokens → 1 call monolítico.
// Ruta 'chunked': digest > 25k tokens → 3 calls + throttling.
//
// Throttling: 30s entre pasos cuando el budget acumulado
// arriesgaría exceder 30k - 3k margen en la próxima llamada.
// ============================================================

import { callClaude, ClaudeError } from './claudeClient.ts';
import {
  extractJsonFromText,
  validateBusinessSchemaPayload,
} from './schemaValidator.ts';
import { buildSchemaPrompt } from './prompts/buildSchemaPrompt.ts';
import { buildClassifyBusinessPrompt } from './prompts/classifyBusinessPrompt.ts';
import { buildExtractEntitiesMetricsPrompt } from './prompts/extractEntitiesMetricsPrompt.ts';
import { buildExtractionRulesPrompt } from './prompts/buildExtractionRulesPrompt.ts';
import type {
  BusinessSchemaPayload,
  FileDigest,
  NotableRow,
  BusinessSize,
} from './types.ts';
import type {
  ChunkingRoute,
  ClassificationOutput,
  EntitiesMetricsOutput,
  ExtractionRulesOutput,
  StepExecutionMeta,
  OrchestratorProgress,
} from './chunkingTypes.ts';

// ---------- Thresholds ----------
const CHUNKING_THRESHOLD_TOKENS = 25_000;
const TPM_LIMIT = 30_000;
const SAFETY_MARGIN = 3_000;
const THROTTLE_WAIT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [10_000, 30_000, 60_000];

// ---------- Valid enums (para validación por paso) ----------
const SIZE_VALUES: readonly BusinessSize[] = ['micro', 'small', 'medium', 'large'];
const ENTITY_TYPES = ['transactional', 'master', 'reference'] as const;
const FIELD_TYPES = ['string', 'number', 'date', 'boolean', 'enum'] as const;
const AGGREGATIONS = ['sum', 'avg', 'count', 'min', 'max', 'ratio'] as const;
const FORMATS = ['currency', 'number', 'percent', 'duration'] as const;
const DIRECTIONS = ['up', 'down'] as const;
const DIM_TYPES = ['time', 'category', 'geo'] as const;

// ---------- Helpers ----------
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}

function estimateDigestTokens(digest: FileDigest): number {
  return estimateTokensFromChars(JSON.stringify(digest).length);
}

export function chooseRoute(digest: FileDigest): ChunkingRoute {
  return estimateDigestTokens(digest) > CHUNKING_THRESHOLD_TOKENS
    ? 'chunked'
    : 'simple';
}

export function filterNotableRowsByFocus(
  notableRows: NotableRow[],
  focusAreas: string[]
): NotableRow[] {
  if (!focusAreas || focusAreas.length === 0) return notableRows;
  const loweredAreas = focusAreas.map((a) => a.toLowerCase());
  return notableRows.filter((row) => {
    const firstCell = String(row.content[0] ?? '').toLowerCase();
    const keyword = String(row.matched_keyword ?? '').toLowerCase();
    return loweredAreas.some(
      (area) => firstCell.includes(area) || keyword.includes(area)
    );
  });
}

// ---------- Per-step validators ----------
function isStringEnum<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v);
}

function validateClassification(raw: unknown): ClassificationOutput {
  if (!raw || typeof raw !== 'object') throw new Error('Classification: no es objeto.');
  const o = raw as Record<string, unknown>;
  if (typeof o.industry !== 'string') throw new Error('Classification: industry inválido.');
  if (typeof o.business_model !== 'string') throw new Error('Classification: business_model inválido.');
  if (!isStringEnum(o.size, SIZE_VALUES)) throw new Error(`Classification: size inválido (esperado: ${SIZE_VALUES.join('|')}).`);
  if (typeof o.currency !== 'string') throw new Error('Classification: currency inválido.');
  if (typeof o.language !== 'string') throw new Error('Classification: language inválido.');
  if (!Array.isArray(o.focus_areas)) throw new Error('Classification: focus_areas debe ser array.');
  return {
    industry: o.industry,
    sub_industry: typeof o.sub_industry === 'string' ? o.sub_industry : null,
    business_model: o.business_model,
    size: o.size as BusinessSize,
    currency: o.currency,
    language: o.language,
    location: (o.location ?? null) as ClassificationOutput['location'],
    focus_areas: (o.focus_areas as unknown[]).map((a) => String(a)),
    confidence: typeof o.confidence === 'number' ? o.confidence : 0.5,
    reasoning: typeof o.reasoning === 'string' ? o.reasoning : '',
  };
}

function validateEntitiesMetrics(raw: unknown): EntitiesMetricsOutput {
  if (!raw || typeof raw !== 'object') throw new Error('EntitiesMetrics: no es objeto.');
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.entities)) throw new Error('EntitiesMetrics: entities debe ser array.');
  if (!Array.isArray(o.metrics)) throw new Error('EntitiesMetrics: metrics debe ser array.');
  if ((o.metrics as unknown[]).length < 1) throw new Error('EntitiesMetrics: al menos 1 metric.');
  if (!Array.isArray(o.dimensions)) throw new Error('EntitiesMetrics: dimensions debe ser array.');
  if (!Array.isArray(o.external_sources)) throw new Error('EntitiesMetrics: external_sources debe ser array.');

  (o.entities as unknown[]).forEach((e, i) => {
    const en = e as Record<string, unknown>;
    if (typeof en.id !== 'string') throw new Error(`entities[${i}].id inválido.`);
    if (typeof en.name !== 'string') throw new Error(`entities[${i}].name inválido.`);
    if (!isStringEnum(en.type, ENTITY_TYPES)) throw new Error(`entities[${i}].type inválido.`);
    if (!Array.isArray(en.fields)) throw new Error(`entities[${i}].fields debe ser array.`);
    (en.fields as unknown[]).forEach((f, j) => {
      const fi = f as Record<string, unknown>;
      if (typeof fi.name !== 'string') throw new Error(`entities[${i}].fields[${j}].name inválido.`);
      if (!isStringEnum(fi.type, FIELD_TYPES)) throw new Error(`entities[${i}].fields[${j}].type inválido.`);
    });
  });

  (o.metrics as unknown[]).forEach((m, i) => {
    const mi = m as Record<string, unknown>;
    if (typeof mi.id !== 'string') throw new Error(`metrics[${i}].id inválido.`);
    if (typeof mi.name !== 'string') throw new Error(`metrics[${i}].name inválido.`);
    if (typeof mi.formula !== 'string') throw new Error(`metrics[${i}].formula inválido.`);
    if (!isStringEnum(mi.aggregation, AGGREGATIONS)) throw new Error(`metrics[${i}].aggregation inválido.`);
    if (!isStringEnum(mi.format, FORMATS)) throw new Error(`metrics[${i}].format inválido.`);
    if (!isStringEnum(mi.good_direction, DIRECTIONS)) throw new Error(`metrics[${i}].good_direction inválido.`);
  });

  (o.dimensions as unknown[]).forEach((d, i) => {
    const di = d as Record<string, unknown>;
    if (typeof di.id !== 'string') throw new Error(`dimensions[${i}].id inválido.`);
    if (typeof di.name !== 'string') throw new Error(`dimensions[${i}].name inválido.`);
    if (!isStringEnum(di.type, DIM_TYPES)) throw new Error(`dimensions[${i}].type inválido.`);
  });

  return o as unknown as EntitiesMetricsOutput;
}

function validateExtractionRules(raw: unknown): ExtractionRulesOutput {
  if (!raw || typeof raw !== 'object') throw new Error('ExtractionRules: no es objeto.');
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.extraction_rules)) throw new Error('ExtractionRules: extraction_rules debe ser array.');
  const rules = o.extraction_rules as unknown[];
  if (rules.length < 1) throw new Error('ExtractionRules: al menos 1 regla.');
  rules.forEach((r, i) => {
    const ri = r as Record<string, unknown>;
    if (typeof ri.source_pattern !== 'string') throw new Error(`rules[${i}].source_pattern inválido.`);
    if (typeof ri.target_entity !== 'string') throw new Error(`rules[${i}].target_entity inválido.`);
    if (!ri.field_mappings || typeof ri.field_mappings !== 'object')
      throw new Error(`rules[${i}].field_mappings inválido.`);
  });
  return { extraction_rules: o.extraction_rules as ExtractionRulesOutput['extraction_rules'] };
}

// ---------- Core call-with-retry ----------
interface StepCallResult {
  text: string;
  tokens_input: number;
  tokens_output: number;
  cache_read: number;
  cache_write: number;
  retried: number;
  duration_ms: number;
}

async function callStepWithRetry(params: {
  stepName: string;
  system: string;
  user: string;
  maxTokens: number;
  cacheControl: boolean;
}): Promise<StepCallResult> {
  const t0 = Date.now();
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await callClaude({
        model: 'opus-4-7',
        system: params.system,
        messages: [{ role: 'user', content: params.user }],
        max_tokens: params.maxTokens,
        cache_control: params.cacheControl,
      });
      return {
        text: result.text,
        tokens_input: result.tokens_input,
        tokens_output: result.tokens_output,
        cache_read: result.tokens_cached_read ?? 0,
        cache_write: result.tokens_cached_write ?? 0,
        retried: attempt,
        duration_ms: Date.now() - t0,
      };
    } catch (err) {
      const isClaudeErr = err instanceof ClaudeError;
      const isRetriable = isClaudeErr && (err as ClaudeError).retryable;
      if (!isRetriable || attempt === MAX_RETRIES) throw err;
      const wait = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
      console.log(
        `[RETRY ${attempt + 1}/${MAX_RETRIES}] ${params.stepName}: ${(err as Error).message.slice(0, 120)} — esperando ${wait}ms`
      );
      await sleep(wait);
    }
  }
  throw new Error('callStepWithRetry: unreachable');
}

async function throttleIfNeeded(
  stepName: string,
  tokensSoFar: number,
  nextCallEstimated: number
): Promise<void> {
  if (tokensSoFar + nextCallEstimated > TPM_LIMIT - SAFETY_MARGIN) {
    console.log(
      `[THROTTLE] Antes de ${stepName}: usado=${tokensSoFar}, próximo≈${nextCallEstimated}, esperando ${THROTTLE_WAIT_MS / 1000}s para renovar TPM.`
    );
    await sleep(THROTTLE_WAIT_MS);
  }
}

// ---------- Consolidator ----------
export function consolidateChunkedOutputs(
  step1: ClassificationOutput,
  step2: EntitiesMetricsOutput,
  step3: ExtractionRulesOutput
): BusinessSchemaPayload {
  const location = step1.location
    ? {
        country: step1.location.country,
        ...(step1.location.state ? { state: step1.location.state } : {}),
        ...(step1.location.city ? { city: step1.location.city } : {}),
      }
    : undefined;

  return {
    business_identity: {
      industry: step1.industry,
      sub_industry: step1.sub_industry ?? undefined,
      business_model: step1.business_model,
      size: step1.size,
      language: step1.language,
      currency: step1.currency,
      ...(location ? { location } : {}),
    },
    entities: step2.entities,
    metrics: step2.metrics,
    dimensions: step2.dimensions,
    extraction_rules: step3.extraction_rules,
    external_sources: step2.external_sources,
    needs_clarification: step1.confidence < 0.6
      ? [`Confianza baja en clasificación inicial (${step1.confidence}). Razonamiento: ${step1.reasoning}`]
      : undefined,
  };
}

// ---------- Public orchestrator ----------
export interface OrchestratorParams {
  digest: FileDigest;
  businessHint?: string;
  question?: string;
  onProgress?: (p: OrchestratorProgress) => void;
}

export interface OrchestratorResult {
  route: ChunkingRoute;
  schema: BusinessSchemaPayload;
  steps_executed: StepExecutionMeta[];
  total_duration_ms: number;
  progress_events: OrchestratorProgress[];
}

async function runSimpleRoute(params: OrchestratorParams): Promise<OrchestratorResult> {
  const t0 = Date.now();
  const events: OrchestratorProgress[] = [];
  const emit = (p: OrchestratorProgress) => {
    events.push(p);
    params.onProgress?.(p);
  };

  emit({
    step: 1,
    total_steps: 1,
    stage: 'analyzing',
    human_message: 'Analizando tu archivo...',
    tokens_used_so_far: 0,
    tokens_remaining_in_tpm: TPM_LIMIT,
  });

  const { system, user } = buildSchemaPrompt({
    digest: params.digest,
    business_hint: params.businessHint,
    question: params.question,
  });

  const call1 = await callStepWithRetry({
    stepName: 'simple',
    system,
    user,
    maxTokens: 16_000,
    cacheControl: true,
  });

  let parsed: unknown;
  try {
    parsed = extractJsonFromText(call1.text);
  } catch (err) {
    throw new Error(`Simple route: JSON inválido de Opus. ${(err as Error).message}`);
  }

  let validation = validateBusinessSchemaPayload(parsed);
  const stepsExecuted: StepExecutionMeta[] = [
    {
      step_number: 1,
      stage: 'analyzing',
      tokens_input: call1.tokens_input,
      tokens_output: call1.tokens_output,
      cache_read: call1.cache_read,
      cache_write: call1.cache_write,
      duration_ms: call1.duration_ms,
      retried: call1.retried,
    },
  ];

  if (!validation.ok) {
    const fixUser =
      'Tu respuesta anterior tuvo errores de validación:\n\n' +
      validation.errors.map((e) => `- ${e}`).join('\n') +
      '\n\nDevuelve EL MISMO objeto pero corregido. JSON estricto, sin markdown.';
    const retryCall = await callClaude({
      model: 'opus-4-7',
      system,
      messages: [
        { role: 'user', content: user },
        { role: 'assistant', content: call1.text },
        { role: 'user', content: fixUser },
      ],
      max_tokens: 16_000,
      cache_control: true,
    });
    const reparsed = extractJsonFromText(retryCall.text);
    validation = validateBusinessSchemaPayload(reparsed);
    stepsExecuted.push({
      step_number: 2,
      stage: 'validation_retry',
      tokens_input: retryCall.tokens_input,
      tokens_output: retryCall.tokens_output,
      cache_read: retryCall.tokens_cached_read ?? 0,
      cache_write: retryCall.tokens_cached_write ?? 0,
      duration_ms: 0,
      retried: 0,
    });
    if (!validation.ok || !validation.payload) {
      throw new Error('Simple route: schema inválido tras reintento. ' + validation.errors.join('; '));
    }
  }

  return {
    route: 'simple',
    schema: validation.payload!,
    steps_executed: stepsExecuted,
    total_duration_ms: Date.now() - t0,
    progress_events: events,
  };
}

async function runChunkedRoute(params: OrchestratorParams): Promise<OrchestratorResult> {
  const t0 = Date.now();
  const events: OrchestratorProgress[] = [];
  const stepsExecuted: StepExecutionMeta[] = [];
  let tokensSoFar = 0;

  const emit = (p: OrchestratorProgress) => {
    events.push(p);
    params.onProgress?.(p);
  };

  // ===== PASO 1 — Clasificación =====
  emit({
    step: 1,
    total_steps: 3,
    stage: 'classifying',
    human_message: 'Entendiendo qué tipo de negocio tienes...',
    tokens_used_so_far: tokensSoFar,
    tokens_remaining_in_tpm: TPM_LIMIT - tokensSoFar,
  });

  const p1 = buildClassifyBusinessPrompt({
    digest: params.digest,
    business_hint: params.businessHint,
    question: params.question,
  });
  const call1 = await callStepWithRetry({
    stepName: 'step1_classify',
    system: p1.system,
    user: p1.user,
    maxTokens: 1500,
    cacheControl: true,
  });
  tokensSoFar += call1.tokens_input;
  const parsed1 = extractJsonFromText(call1.text);
  const classification = validateClassification(parsed1);
  stepsExecuted.push({
    step_number: 1,
    stage: 'classifying',
    tokens_input: call1.tokens_input,
    tokens_output: call1.tokens_output,
    cache_read: call1.cache_read,
    cache_write: call1.cache_write,
    duration_ms: call1.duration_ms,
    retried: call1.retried,
  });

  // Throttle antes del paso 2
  await throttleIfNeeded('step2_entities', tokensSoFar, 18_000);

  // ===== PASO 2 — Entidades / Métricas / Dimensiones / External sources =====
  emit({
    step: 2,
    total_steps: 3,
    stage: 'extracting_entities',
    human_message: 'Descubriendo tus métricas clave y estructura de datos...',
    tokens_used_so_far: tokensSoFar,
    tokens_remaining_in_tpm: TPM_LIMIT - tokensSoFar,
  });

  const filteredRows = filterNotableRowsByFocus(
    params.digest.notable_rows,
    classification.focus_areas
  );
  const p2 = buildExtractEntitiesMetricsPrompt({
    classification,
    notable_rows_filtered: filteredRows,
    business_hint: params.businessHint,
    question: params.question,
  });
  const call2 = await callStepWithRetry({
    stepName: 'step2_entities',
    system: p2.system,
    user: p2.user,
    maxTokens: 4000,
    cacheControl: true,
  });
  tokensSoFar += call2.tokens_input;
  const parsed2 = extractJsonFromText(call2.text);
  const entitiesMetrics = validateEntitiesMetrics(parsed2);
  stepsExecuted.push({
    step_number: 2,
    stage: 'extracting_entities',
    tokens_input: call2.tokens_input,
    tokens_output: call2.tokens_output,
    cache_read: call2.cache_read,
    cache_write: call2.cache_write,
    duration_ms: call2.duration_ms,
    retried: call2.retried,
  });

  // Throttle antes del paso 3
  await throttleIfNeeded('step3_rules', tokensSoFar, 14_000);

  // ===== PASO 3 — Extraction rules =====
  emit({
    step: 3,
    total_steps: 3,
    stage: 'building_rules',
    human_message: 'Generando reglas de análisis automático para tus datos...',
    tokens_used_so_far: tokensSoFar,
    tokens_remaining_in_tpm: TPM_LIMIT - tokensSoFar,
  });

  const p3 = buildExtractionRulesPrompt({
    entities_metrics: entitiesMetrics,
    sample_sheets: params.digest.sample_sheets,
    business_hint: params.businessHint,
  });
  const call3 = await callStepWithRetry({
    stepName: 'step3_rules',
    system: p3.system,
    user: p3.user,
    maxTokens: 4000,
    cacheControl: true,
  });
  tokensSoFar += call3.tokens_input;
  const parsed3 = extractJsonFromText(call3.text);
  const rulesOutput = validateExtractionRules(parsed3);
  stepsExecuted.push({
    step_number: 3,
    stage: 'building_rules',
    tokens_input: call3.tokens_input,
    tokens_output: call3.tokens_output,
    cache_read: call3.cache_read,
    cache_write: call3.cache_write,
    duration_ms: call3.duration_ms,
    retried: call3.retried,
  });

  // ===== Consolidación =====
  const consolidated = consolidateChunkedOutputs(classification, entitiesMetrics, rulesOutput);
  const finalValidation = validateBusinessSchemaPayload(consolidated);
  if (!finalValidation.ok || !finalValidation.payload) {
    throw new Error(
      'Chunked route: schema consolidado inválido. ' + finalValidation.errors.join('; ')
    );
  }

  return {
    route: 'chunked',
    schema: finalValidation.payload,
    steps_executed: stepsExecuted,
    total_duration_ms: Date.now() - t0,
    progress_events: events,
  };
}

export async function orchestrateBuildSchema(
  params: OrchestratorParams
): Promise<OrchestratorResult> {
  const route = chooseRoute(params.digest);
  if (route === 'simple') return runSimpleRoute(params);
  return runChunkedRoute(params);
}
