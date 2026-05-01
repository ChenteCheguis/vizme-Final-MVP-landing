// ============================================================
// VIZME V5 — Edge Function: analyze-data
// Modos: build_schema (este sprint). Otros vienen en sprints
// posteriores (refresh, regenerate_blueprint, etc.).
//
// build_schema ahora delega en chunkingOrchestrator para decidir
// entre ruta 'simple' (1 call) o 'chunked' (3 calls + throttling)
// según el tamaño del digest — Sprint 2.5.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2.100.1';
import { orchestrateBuildSchema } from '../_shared/chunkingOrchestrator.ts';
import { callClaude } from '../_shared/claudeClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  DASHBOARD_BLUEPRINT_SYSTEM_PROMPT,
  buildDashboardBlueprintUserPrompt,
  type DataSummaryForPrompt,
} from '../_shared/prompts/buildDashboardBlueprintPrompt.ts';
import {
  validateDashboardBlueprint,
  countTotalWidgets,
} from '../_shared/dashboardBlueprintValidator.ts';
import {
  calculateAllMetrics,
  type MetricMeta,
  type TimeSeriesPoint as MCPoint,
} from '../_shared/metricCalculator.ts';
import {
  GENERATE_INSIGHTS_SYSTEM_PROMPT,
  buildGenerateInsightsUserPrompt,
} from '../_shared/prompts/generateInsightsPrompt.ts';
import type { FileDigest } from '../_shared/types.ts';

declare const Deno: { env: { get: (k: string) => string | undefined }; serve: (h: (req: Request) => Response | Promise<Response>) => void };

interface BuildSchemaRequest {
  mode: 'build_schema';
  project_id: string;
  file_id?: string;
  digest: FileDigest;
  business_hint?: string;
  question?: string;
}

interface IngestExtractionPayload {
  metric_id: string;
  metric_name: string;
  source_sheet: string | null;
  source_column: string | null;
  date_column: string | null;
  aggregation: string;
  confidence: 'high' | 'medium' | 'low';
  data_points: Array<{
    period_start: string;
    period_end?: string;
    value: number;
    dimension_values: Record<string, string>;
  }>;
}

interface IngestDataRequest {
  mode: 'ingest_data';
  project_id: string;
  file_id: string;
  extractions: IngestExtractionPayload[];
}

interface DetectAnomaliesRequest {
  mode: 'detect_anomalies';
  project_id: string;
  source_file_id?: string;
}

interface BuildDashboardBlueprintRequest {
  mode: 'build_dashboard_blueprint';
  project_id: string;
  schema_id: string;
}

interface RecalculateMetricsRequest {
  mode: 'recalculate_metrics';
  project_id: string;
}

interface GenerateInsightsRequest {
  mode: 'generate_insights';
  project_id: string;
  page_id: string;
}

type AnyRequest =
  | BuildSchemaRequest
  | IngestDataRequest
  | DetectAnomaliesRequest
  | BuildDashboardBlueprintRequest
  | RecalculateMetricsRequest
  | GenerateInsightsRequest;

function isValidDigest(d: unknown): d is FileDigest {
  if (!d || typeof d !== 'object') return false;
  const x = d as Partial<FileDigest>;
  return (
    typeof x.file_name === 'string' &&
    typeof x.file_type === 'string' &&
    typeof x.total_sheets === 'number' &&
    Array.isArray(x.sheets_summary) &&
    Array.isArray(x.sample_sheets) &&
    Array.isArray(x.notable_rows)
  );
}

interface AuthContext {
  user_id: string;
  jwt: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });

const errorResponse = (status: number, message: string, extra?: Record<string, unknown>) =>
  json(status, { error: message, ...extra });

async function verifyAuth(req: Request, supabaseUrl: string, anonKey: string): Promise<AuthContext> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Falta token de autorización.');
  }
  const jwt = authHeader.slice('Bearer '.length);
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Token inválido o expirado.');
  return { user_id: data.user.id, jwt };
}

async function handleBuildSchema(
  body: BuildSchemaRequest,
  auth: AuthContext,
  supabaseUrl: string,
  serviceKey: string
): Promise<Response> {
  const admin = createClient(supabaseUrl, serviceKey);

  // 1. Validar pertenencia del proyecto
  const { data: project, error: projErr } = await admin
    .from('projects')
    .select('id, user_id')
    .eq('id', body.project_id)
    .maybeSingle();
  if (projErr) return errorResponse(500, 'Error consultando proyecto.', { detail: projErr.message });
  if (!project || project.user_id !== auth.user_id)
    return errorResponse(403, 'El proyecto no existe o no te pertenece.');

  // 2. file_id opcional — si viene, validar pertenencia. El parseo vive en el cliente.
  if (body.file_id) {
    const { data: file, error: fileErr } = await admin
      .from('files')
      .select('id, project_id')
      .eq('id', body.file_id)
      .maybeSingle();
    if (fileErr) return errorResponse(500, 'Error consultando archivo.', { detail: fileErr.message });
    if (!file || file.project_id !== body.project_id)
      return errorResponse(404, 'Archivo no encontrado en este proyecto.');
  }

  // 3. Validar digest enviado por el cliente
  if (!isValidDigest(body.digest)) {
    return errorResponse(
      400,
      'El cliente debe enviar un digest válido del archivo. Llama a buildFileDigest antes de invocar esta función.',
      {
        expected_shape: {
          file_name: 'string',
          file_type: 'xlsx | xls | csv',
          total_sheets: 'number',
          sheets_summary: 'array',
          sample_sheets: 'array',
          notable_rows: 'array',
        },
      }
    );
  }

  // 4. Delegar al orchestrator (decide ruta simple vs chunked)
  let orch;
  try {
    orch = await orchestrateBuildSchema({
      digest: body.digest,
      businessHint: body.business_hint,
      question: body.question,
    });
  } catch (err) {
    return errorResponse(502, 'El orchestrator falló construyendo el schema.', {
      detail: (err as Error).message,
    });
  }

  console.log(
    `[ORCH] route=${orch.route} steps=${orch.steps_executed.length} duration=${orch.total_duration_ms}ms`
  );
  orch.steps_executed.forEach((s) => {
    console.log(
      `[ORCH] step ${s.step_number} (${s.stage}): in=${s.tokens_input} out=${s.tokens_output} cache_r=${s.cache_read} cache_w=${s.cache_write} dur=${s.duration_ms}ms retries=${s.retried}`
    );
  });

  // 5. Determinar siguiente versión
  const { data: existing } = await admin
    .from('business_schemas')
    .select('version')
    .eq('project_id', body.project_id)
    .order('version', { ascending: false })
    .limit(1);
  const nextVersion = (existing?.[0]?.version ?? 0) + 1;

  // 6. Agregados de tokens
  const totalTokensInput = orch.steps_executed.reduce((a, s) => a + s.tokens_input, 0);
  const totalTokensOutput = orch.steps_executed.reduce((a, s) => a + s.tokens_output, 0);
  const totalCacheRead = orch.steps_executed.reduce((a, s) => a + s.cache_read, 0);
  const totalCacheWrite = orch.steps_executed.reduce((a, s) => a + s.cache_write, 0);

  // 7. Persistir (incluye metadata del chunking)
  const payload = orch.schema;
  const { data: inserted, error: insErr } = await admin
    .from('business_schemas')
    .insert({
      project_id: body.project_id,
      version: nextVersion,
      business_identity: payload.business_identity,
      entities: payload.entities,
      metrics: payload.metrics,
      dimensions: payload.dimensions,
      extraction_rules: payload.extraction_rules,
      external_sources: payload.external_sources,
      kpi_targets: null,
      model_used: 'claude-opus-4-7',
      tokens_input: totalTokensInput,
      tokens_output: totalTokensOutput,
      route: orch.route,
      steps_executed: orch.steps_executed,
      total_duration_ms: orch.total_duration_ms,
    })
    .select('id')
    .single();
  if (insErr || !inserted)
    return errorResponse(500, 'No se pudo guardar el schema.', { detail: insErr?.message });

  // 8. Marcar archivo como procesado
  if (body.file_id) {
    await admin
      .from('files')
      .update({
        processed_at: new Date().toISOString(),
        structural_map: { digest_summary: body.digest.sheets_summary },
      })
      .eq('id', body.file_id);
  }

  return json(200, {
    schema_id: inserted.id,
    version: nextVersion,
    route: orch.route,
    summary: {
      industry: payload.business_identity.industry,
      sub_industry: payload.business_identity.sub_industry ?? null,
      metrics_count: payload.metrics.length,
      entities_count: payload.entities.length,
      dimensions_count: payload.dimensions.length,
      extraction_rules_count: payload.extraction_rules.length,
      external_sources_count: payload.external_sources.length,
      needs_clarification: payload.needs_clarification ?? null,
    },
    usage: {
      model: 'claude-opus-4-7',
      tokens_input: totalTokensInput,
      tokens_output: totalTokensOutput,
      tokens_cached_read: totalCacheRead,
      tokens_cached_write: totalCacheWrite,
      total_duration_ms: orch.total_duration_ms,
    },
    steps_executed: orch.steps_executed,
    progress_events: orch.progress_events,
  });
}

async function handleIngestData(
  body: IngestDataRequest,
  auth: AuthContext,
  supabaseUrl: string,
  serviceKey: string
): Promise<Response> {
  const admin = createClient(supabaseUrl, serviceKey);

  // Ownership checks
  const { data: project, error: projErr } = await admin
    .from('projects')
    .select('id, user_id')
    .eq('id', body.project_id)
    .maybeSingle();
  if (projErr) return errorResponse(500, 'Error consultando proyecto.', { detail: projErr.message });
  if (!project || project.user_id !== auth.user_id)
    return errorResponse(403, 'El proyecto no existe o no te pertenece.');

  const { data: file, error: fileErr } = await admin
    .from('files')
    .select('id, project_id')
    .eq('id', body.file_id)
    .maybeSingle();
  if (fileErr) return errorResponse(500, 'Error consultando archivo.', { detail: fileErr.message });
  if (!file || file.project_id !== body.project_id)
    return errorResponse(404, 'Archivo no encontrado en este proyecto.');

  if (!Array.isArray(body.extractions) || body.extractions.length === 0)
    return errorResponse(400, 'No vino ninguna extracción que persistir.');

  // Flatten extractions → rows
  const rows: Array<Record<string, unknown>> = [];
  for (const ex of body.extractions) {
    if (!Array.isArray(ex.data_points)) continue;
    for (const p of ex.data_points) {
      if (typeof p.value !== 'number' || !Number.isFinite(p.value)) continue;
      if (!p.period_start || typeof p.period_start !== 'string') continue;
      rows.push({
        project_id: body.project_id,
        metric_id: ex.metric_id,
        dimension_values: p.dimension_values ?? {},
        value: p.value,
        period_start: p.period_start,
        period_end: p.period_end ?? null,
        source_file_id: body.file_id,
      });
    }
  }

  if (rows.length === 0)
    return errorResponse(400, 'Las extracciones no contienen ningún dato numérico utilizable.');

  // Bulk insert (chunk of 500)
  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500);
    const { error: insErr, count } = await admin.from('time_series_data').insert(slice, { count: 'exact' });
    if (insErr) {
      errors.push(insErr.message);
    } else {
      inserted += count ?? slice.length;
    }
  }

  // Mark file as processed
  await admin
    .from('files')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', body.file_id);

  return json(200, {
    inserted,
    failed: rows.length - inserted,
    errors: errors.length > 0 ? errors : undefined,
    metrics_count: body.extractions.length,
    needs_recalculation: inserted > 0,
  });
}

async function handleDetectAnomalies(
  body: DetectAnomaliesRequest,
  auth: AuthContext,
  supabaseUrl: string,
  serviceKey: string
): Promise<Response> {
  const admin = createClient(supabaseUrl, serviceKey);

  // Ownership
  const { data: project, error: projErr } = await admin
    .from('projects')
    .select('id, user_id, name')
    .eq('id', body.project_id)
    .maybeSingle();
  if (projErr) return errorResponse(500, 'Error consultando proyecto.', { detail: projErr.message });
  if (!project || project.user_id !== auth.user_id)
    return errorResponse(403, 'El proyecto no existe o no te pertenece.');

  // Get latest schema for metric metadata
  const { data: schemas, error: sErr } = await admin
    .from('business_schemas')
    .select('metrics, business_identity')
    .eq('project_id', body.project_id)
    .order('version', { ascending: false })
    .limit(1);
  if (sErr) return errorResponse(500, 'No pudimos leer el schema.', { detail: sErr.message });
  const schema = schemas?.[0];
  if (!schema) return errorResponse(400, 'Este proyecto no tiene schema todavía.');

  // Get last N=200 time-series points for context (recent + historical)
  const { data: tsPoints, error: tsErr } = await admin
    .from('time_series_data')
    .select('metric_id, value, period_start, source_file_id')
    .eq('project_id', body.project_id)
    .order('period_start', { ascending: false })
    .limit(200);
  if (tsErr) return errorResponse(500, 'No pudimos leer el historial de datos.', { detail: tsErr.message });
  if (!tsPoints || tsPoints.length === 0)
    return json(200, { anomalies: [], message: 'Aún no hay suficiente histórico para detectar anomalías.' });

  // Group by metric, separate latest-file vs historic
  const byMetric = new Map<string, Array<{ value: number; period_start: string; is_latest: boolean }>>();
  for (const p of tsPoints) {
    if (!byMetric.has(p.metric_id)) byMetric.set(p.metric_id, []);
    byMetric.get(p.metric_id)!.push({
      value: Number(p.value),
      period_start: p.period_start,
      is_latest: body.source_file_id ? p.source_file_id === body.source_file_id : false,
    });
  }

  // Build compact context for Haiku
  const metricsMap = new Map<string, { name: string; unit: string; good_direction: string; format: string }>();
  for (const m of (schema.metrics as Array<{ id: string; name: string; unit: string; good_direction: string; format: string }> | null) ?? []) {
    metricsMap.set(m.id, { name: m.name, unit: m.unit, good_direction: m.good_direction, format: m.format });
  }

  const contextLines: string[] = [];
  byMetric.forEach((points, metricId) => {
    const meta = metricsMap.get(metricId);
    if (!meta) return;
    const sorted = [...points].sort((a, b) => a.period_start.localeCompare(b.period_start));
    contextLines.push(
      `Metric: ${meta.name} (${meta.unit}, mejor=${meta.good_direction}) — series:\n` +
        sorted
          .slice(-12)
          .map((p) => `  ${p.period_start}: ${p.value.toFixed(2)}${p.is_latest ? ' [NUEVO]' : ''}`)
          .join('\n')
    );
  });

  const industry = (schema.business_identity as { industry?: string })?.industry ?? 'desconocida';

  const systemPrompt = `Eres un analista de datos senior detectando anomalías en métricas de negocio.
Industria del negocio: ${industry}.

Vas a recibir series temporales por métrica. Algunos puntos están marcados como [NUEVO] — son los que acaban de subirse.

Tu trabajo:
1. Comparar los puntos [NUEVO] contra el patrón histórico de cada métrica (estacionalidad, tendencia, varianza típica).
2. Identificar anomalías reales: caídas/subidas fuera del rango habitual, cambios de tendencia, outliers.
3. Ignorar variaciones normales — sólo reporta lo que un dueño de negocio querría saber.

Devuelve JSON estricto, en español mexicano, con la forma:
{
  "anomalies": [
    {
      "metric_name": "string",
      "severity": "low" | "medium" | "high",
      "title": "string corta de máx 80 chars",
      "explanation": "1-2 oraciones explicando qué pasó y contra qué se compara",
      "data_snapshot": { "current": number, "expected_range": [number, number], "deviation_pct": number }
    }
  ]
}

Si no hay anomalías significativas, devuelve { "anomalies": [] }.`;

  const userPrompt = contextLines.join('\n\n') || 'No hay datos suficientes.';

  let claudeResp;
  try {
    claudeResp = await callClaude({
      model: 'haiku-4-5',
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 2048,
      temperature: 0,
    });
  } catch (err) {
    return errorResponse(502, 'Haiku falló analizando anomalías.', { detail: (err as Error).message });
  }

  // Parse JSON response (Haiku may wrap in ```json fences)
  let parsed: { anomalies: Array<{ metric_name: string; severity: 'low' | 'medium' | 'high'; title: string; explanation: string; data_snapshot?: unknown }> };
  try {
    const cleaned = claudeResp.text.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
    parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.anomalies)) throw new Error('Sin campo anomalies');
  } catch (err) {
    return errorResponse(502, 'Haiku devolvió formato inválido.', {
      detail: (err as Error).message,
      raw: claudeResp.text.slice(0, 300),
    });
  }

  // Persist as insights
  const inserts = parsed.anomalies.map((a) => ({
    project_id: body.project_id,
    type: 'anomaly' as const,
    title: a.title,
    content: a.explanation,
    data_snapshot: a.data_snapshot ?? null,
    model_used: 'haiku-4-5',
    priority: a.severity === 'high' ? 3 : a.severity === 'medium' ? 2 : 1,
  }));

  let insightIds: string[] = [];
  if (inserts.length > 0) {
    const { data: rows, error: insErr } = await admin
      .from('insights')
      .insert(inserts)
      .select('id');
    if (insErr) {
      return errorResponse(500, 'No pudimos guardar las anomalías detectadas.', { detail: insErr.message });
    }
    insightIds = (rows ?? []).map((r: { id: string }) => r.id);
  }

  return json(200, {
    anomalies: parsed.anomalies,
    insight_ids: insightIds,
    usage: {
      model: 'haiku-4-5',
      tokens_input: claudeResp.tokens_input,
      tokens_output: claudeResp.tokens_output,
    },
  });
}

async function handleBuildDashboardBlueprint(
  body: BuildDashboardBlueprintRequest,
  auth: AuthContext,
  supabaseUrl: string,
  serviceKey: string
): Promise<Response> {
  const admin = createClient(supabaseUrl, serviceKey);
  const t0 = Date.now();

  // 1. Ownership
  const { data: project, error: projErr } = await admin
    .from('projects')
    .select('id, user_id')
    .eq('id', body.project_id)
    .maybeSingle();
  if (projErr) return errorResponse(500, 'Error consultando proyecto.', { detail: projErr.message });
  if (!project || project.user_id !== auth.user_id)
    return errorResponse(403, 'El proyecto no existe o no te pertenece.');

  // 2. Cargar schema
  const { data: schema, error: sErr } = await admin
    .from('business_schemas')
    .select('id, business_identity, entities, metrics, dimensions')
    .eq('id', body.schema_id)
    .eq('project_id', body.project_id)
    .maybeSingle();
  if (sErr) return errorResponse(500, 'Error leyendo el schema.', { detail: sErr.message });
  if (!schema) return errorResponse(404, 'Schema no encontrado en este proyecto.');

  const metrics = (schema.metrics ?? []) as Array<{ id: string; name: string }>;
  const dimensions = (schema.dimensions ?? []) as Array<{ id: string; name: string }>;
  const knownMetricIds = new Set(metrics.map((m) => m.id));
  const knownDimensionIds = new Set(dimensions.map((d) => d.id));

  // 3. data_summary desde time_series_data
  const { data: tsRows, error: tsErr } = await admin
    .from('time_series_data')
    .select('metric_id, period_start, dimension_values')
    .eq('project_id', body.project_id);
  if (tsErr) return errorResponse(500, 'Error leyendo histórico.', { detail: tsErr.message });

  const allRows = tsRows ?? [];
  const dates = allRows.map((r) => r.period_start).filter(Boolean) as string[];
  dates.sort();
  const uniqueDates = new Set(dates);
  const metricsWithData = new Set<string>();
  const dimsObserved = new Set<string>();
  for (const r of allRows) {
    if (r.metric_id) metricsWithData.add(r.metric_id);
    const dv = (r.dimension_values ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(dv)) dimsObserved.add(k);
  }

  const dataSummary: DataSummaryForPrompt = {
    total_rows: allRows.length,
    date_range: { start: dates[0] ?? null, end: dates[dates.length - 1] ?? null },
    metrics_with_data: Array.from(metricsWithData),
    dimensions_available: Array.from(dimsObserved),
    has_daily_data: uniqueDates.size >= 14,
    unique_dates: uniqueDates.size,
  };

  // 4. Llamar a Opus
  let claudeResp;
  try {
    claudeResp = await callClaude({
      model: 'opus-4-7',
      system: DASHBOARD_BLUEPRINT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildDashboardBlueprintUserPrompt({
            businessSchema: {
              business_identity: (schema.business_identity ?? {}) as Record<string, unknown>,
              entities: (schema.entities ?? []) as Array<Record<string, unknown>>,
              metrics: metrics as unknown as Array<Record<string, unknown>>,
              dimensions: dimensions as unknown as Array<Record<string, unknown>>,
            },
            dataSummary,
          }),
        },
      ],
      max_tokens: 8000,
      cache_control: true,
    });
  } catch (err) {
    return errorResponse(502, 'Opus falló diseñando el blueprint.', { detail: (err as Error).message });
  }

  // 5. Parsear JSON (puede venir con fences ```json)
  let parsed: Record<string, unknown>;
  try {
    const cleaned = claudeResp.text
      .replace(/^[\s\S]*?(\{)/, '$1')
      .replace(/```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return errorResponse(502, 'Opus devolvió un blueprint que no es JSON válido.', {
      detail: (err as Error).message,
      raw: claudeResp.text.slice(0, 500),
    });
  }

  // 6. Validar estructura
  const validation = validateDashboardBlueprint(parsed, knownMetricIds, knownDimensionIds);
  if (!validation.valid) {
    return errorResponse(502, 'El blueprint generado tiene errores estructurales.', {
      validation_errors: validation.errors.slice(0, 20),
    });
  }

  const totalWidgets = countTotalWidgets(parsed as Parameters<typeof countTotalWidgets>[0]);
  const duration = Date.now() - t0;

  // 7. Marcar previos como inactivos
  await admin
    .from('dashboard_blueprints')
    .update({ is_active: false })
    .eq('project_id', body.project_id)
    .eq('is_active', true);

  // 8. Determinar siguiente versión
  const { data: existing } = await admin
    .from('dashboard_blueprints')
    .select('version')
    .eq('project_id', body.project_id)
    .order('version', { ascending: false })
    .limit(1);
  const nextVersion = (existing?.[0]?.version ?? 0) + 1;

  // 9. Insertar
  const insertRow = {
    project_id: body.project_id,
    schema_id: body.schema_id,
    version: nextVersion,
    is_active: true,
    blocks: [],
    layout: { cols: 12, row_height: 8, margin: [8, 8] },
    pages: parsed.pages ?? [],
    layout_strategy: (parsed.layout_strategy as string) ?? null,
    opus_reasoning: (parsed.opus_reasoning as string) ?? null,
    sophistication_level: (parsed.sophistication_level as string) ?? null,
    total_widgets: totalWidgets,
    model_used: 'claude-opus-4-7',
    tokens_input: claudeResp.tokens_input,
    tokens_output: claudeResp.tokens_output,
    generation_duration_ms: duration,
  };

  const { data: inserted, error: insErr } = await admin
    .from('dashboard_blueprints')
    .insert(insertRow)
    .select('id')
    .single();
  if (insErr || !inserted)
    return errorResponse(500, 'No se pudo guardar el blueprint.', { detail: insErr?.message });

  return json(200, {
    blueprint_id: inserted.id,
    version: nextVersion,
    sophistication_level: parsed.sophistication_level,
    total_pages: Array.isArray(parsed.pages) ? parsed.pages.length : 0,
    total_widgets: totalWidgets,
    layout_strategy: parsed.layout_strategy,
    opus_reasoning: parsed.opus_reasoning,
    pages: parsed.pages,
    usage: {
      model: 'claude-opus-4-7',
      tokens_input: claudeResp.tokens_input,
      tokens_output: claudeResp.tokens_output,
      tokens_cached_read: claudeResp.tokens_cached_read ?? 0,
      tokens_cached_write: claudeResp.tokens_cached_write ?? 0,
      duration_ms: duration,
    },
  });
}

async function handleRecalculateMetrics(
  body: RecalculateMetricsRequest,
  auth: AuthContext,
  supabaseUrl: string,
  serviceKey: string
): Promise<Response> {
  const admin = createClient(supabaseUrl, serviceKey);
  const t0 = Date.now();

  const { data: project, error: projErr } = await admin
    .from('projects')
    .select('id, user_id')
    .eq('id', body.project_id)
    .maybeSingle();
  if (projErr) return errorResponse(500, 'Error consultando proyecto.', { detail: projErr.message });
  if (!project || project.user_id !== auth.user_id)
    return errorResponse(403, 'El proyecto no existe o no te pertenece.');

  // Schema activo (último por version)
  const { data: schemas, error: sErr } = await admin
    .from('business_schemas')
    .select('metrics')
    .eq('project_id', body.project_id)
    .order('version', { ascending: false })
    .limit(1);
  if (sErr) return errorResponse(500, 'No pudimos leer el schema.', { detail: sErr.message });
  const schema = schemas?.[0];
  if (!schema) return errorResponse(400, 'Este proyecto no tiene schema todavía.');

  const metrics = ((schema.metrics ?? []) as Array<MetricMeta>).filter((m) => !!m.id);
  if (metrics.length === 0)
    return json(200, { metrics_calculated: 0, duration_ms: 0, message: 'Schema sin métricas.' });

  // Time series points
  const { data: tsRows, error: tsErr } = await admin
    .from('time_series_data')
    .select('metric_id, value, period_start, dimension_values')
    .eq('project_id', body.project_id);
  if (tsErr) return errorResponse(500, 'Error leyendo histórico.', { detail: tsErr.message });

  const points: MCPoint[] = (tsRows ?? []).map((r) => ({
    metric_id: r.metric_id as string,
    value: Number(r.value),
    period_start: r.period_start as string,
    dimension_values: (r.dimension_values ?? null) as Record<string, unknown> | null,
  }));

  // Reference date = max(period_start) (preferimos la fecha más reciente
  // observada en los datos; si pasamos Date.now() y los datos son de 2023,
  // todos los períodos relativos quedarían vacíos).
  let refDateMs = Date.now();
  if (points.length > 0) {
    const maxIso = points
      .map((p) => p.period_start)
      .filter(Boolean)
      .sort()
      .at(-1);
    if (maxIso) {
      const t = new Date(maxIso).getTime();
      if (Number.isFinite(t)) refDateMs = t;
    }
  }

  const calculated = calculateAllMetrics({ metrics, points, refDateMs });

  // UPSERT por (project_id, metric_id, period)
  const rows = calculated.map((c) => ({
    project_id: body.project_id,
    metric_id: c.metric_id,
    period: c.period,
    value: c.value as unknown as Record<string, unknown>,
    calculated_at: new Date().toISOString(),
  }));

  // upsert in chunks of 100 (avoid huge single payload)
  const chunkSize = 100;
  let written = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const { error: upErr, count } = await admin
      .from('metric_calculations')
      .upsert(slice, { onConflict: 'project_id,metric_id,period', count: 'exact' });
    if (upErr)
      return errorResponse(500, 'Error guardando metric_calculations.', { detail: upErr.message });
    written += count ?? slice.length;
  }

  return json(200, {
    metrics_calculated: metrics.length,
    rows_upserted: written,
    duration_ms: Date.now() - t0,
    needs_recalculation: false,
  });
}

async function handleGenerateInsights(
  body: GenerateInsightsRequest,
  auth: AuthContext,
  supabaseUrl: string,
  serviceKey: string
): Promise<Response> {
  const admin = createClient(supabaseUrl, serviceKey);
  const t0 = Date.now();

  if (!body.page_id || typeof body.page_id !== 'string')
    return errorResponse(400, 'Falta page_id.');

  // 1. Ownership
  const { data: project, error: projErr } = await admin
    .from('projects')
    .select('id, user_id')
    .eq('id', body.project_id)
    .maybeSingle();
  if (projErr) return errorResponse(500, 'Error consultando proyecto.', { detail: projErr.message });
  if (!project || project.user_id !== auth.user_id)
    return errorResponse(403, 'El proyecto no existe o no te pertenece.');

  // 2. Schema activo (último por version)
  const { data: schemas, error: sErr } = await admin
    .from('business_schemas')
    .select('business_identity, metrics')
    .eq('project_id', body.project_id)
    .order('version', { ascending: false })
    .limit(1);
  if (sErr) return errorResponse(500, 'No pudimos leer el schema.', { detail: sErr.message });
  const schema = schemas?.[0];
  if (!schema) return errorResponse(400, 'Este proyecto no tiene schema todavía.');

  const businessIdentity = (schema.business_identity ?? {}) as Record<string, unknown>;
  const metrics = (schema.metrics ?? []) as Array<{ id: string; name: string }>;
  const metricNameById = new Map(metrics.map((m) => [m.id, m.name]));
  const knownMetricIds = new Set(metrics.map((m) => m.id));

  // 3. Blueprint activo (último por version)
  const { data: blueprints, error: bpErr } = await admin
    .from('dashboard_blueprints')
    .select('pages')
    .eq('project_id', body.project_id)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1);
  if (bpErr) return errorResponse(500, 'No pudimos leer el blueprint.', { detail: bpErr.message });
  const blueprint = blueprints?.[0];
  if (!blueprint) return errorResponse(400, 'No hay blueprint activo. Genera uno primero.');

  const pages = (blueprint.pages ?? []) as Array<Record<string, unknown>>;
  const page = pages.find((p) => p && p.id === body.page_id);
  if (!page) return errorResponse(404, `Página '${body.page_id}' no encontrada en el blueprint.`);

  // 4. Recolectar metric_ids referenciados en la página
  const referencedMetricIds = new Set<string>();
  const sections = (page.sections ?? []) as Array<Record<string, unknown>>;
  for (const s of sections) {
    const widgets = (s.widgets ?? []) as Array<Record<string, unknown>>;
    for (const w of widgets) {
      const ids = (w.metric_ids ?? []) as unknown;
      if (Array.isArray(ids)) {
        for (const id of ids) if (typeof id === 'string') referencedMetricIds.add(id);
      }
    }
  }
  if (referencedMetricIds.size === 0) {
    return json(200, {
      insights_created: 0,
      page_id: body.page_id,
      message: 'La página no referencia métricas.',
    });
  }

  // 5. Cargar metric_calculations (last_month base + all_time para tendencia)
  const periods = ['last_month', 'all_time'];
  const { data: calcs, error: cErr } = await admin
    .from('metric_calculations')
    .select('metric_id, period, value')
    .eq('project_id', body.project_id)
    .in('metric_id', Array.from(referencedMetricIds))
    .in('period', periods);
  if (cErr) return errorResponse(500, 'No pudimos leer cálculos.', { detail: cErr.message });

  if (!calcs || calcs.length === 0) {
    return json(200, {
      insights_created: 0,
      page_id: body.page_id,
      message: 'No hay cálculos guardados. Corre recalculate_metrics primero.',
    });
  }

  // 6. Build metrics_summary para Sonnet
  const metrics_summary = calcs.map((c) => {
    const v = (c.value ?? {}) as {
      value?: number | null;
      change_percent?: number | null;
      change_direction?: 'up' | 'down' | 'neutral' | null;
      breakdown_by_dimension?: Record<string, Array<{ key: string; value: number }>>;
    };
    let topDim: string | undefined;
    let topVals: Array<{ key: string; value: number }> | undefined;
    let bestSize = 0;
    const bd = v.breakdown_by_dimension ?? {};
    for (const [dim, arr] of Object.entries(bd)) {
      if (Array.isArray(arr) && arr.length > bestSize) {
        bestSize = arr.length;
        topDim = dim;
        topVals = arr.slice(0, 5);
      }
    }
    const mid = c.metric_id as string;
    return {
      metric_id: mid,
      metric_name: metricNameById.get(mid) ?? mid,
      period: c.period as string,
      value: v.value ?? null,
      change_percent: v.change_percent ?? null,
      change_direction: v.change_direction ?? null,
      top_breakdown_dim: topDim,
      top_breakdown_values: topVals,
    };
  });

  // 7. Llamar a Sonnet 4.6 (acepta temperature)
  let claudeResp;
  try {
    claudeResp = await callClaude({
      model: 'sonnet-4-6',
      system: GENERATE_INSIGHTS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildGenerateInsightsUserPrompt({
            business_identity: businessIdentity,
            page_title: (page.title as string) ?? body.page_id,
            page_audience: (page.audience as string) ?? 'dueño',
            page_description: (page.description as string) ?? '',
            metrics_summary,
          }),
        },
      ],
      max_tokens: 4000,
      temperature: 0.3,
    });
  } catch (err) {
    return errorResponse(502, 'Sonnet falló generando insights.', {
      detail: (err as Error).message,
    });
  }

  // 8. Parsear JSON (puede venir con fences ```json)
  let parsed: { insights?: Array<Record<string, unknown>> };
  try {
    const cleaned = claudeResp.text
      .replace(/^[\s\S]*?(\{)/, '$1')
      .replace(/```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return errorResponse(502, 'Sonnet devolvió insights no parseables.', {
      detail: (err as Error).message,
      raw: claudeResp.text.slice(0, 500),
    });
  }

  const insightArr = Array.isArray(parsed.insights) ? parsed.insights : [];
  const duration = Date.now() - t0;

  if (insightArr.length === 0) {
    return json(200, {
      insights_created: 0,
      page_id: body.page_id,
      duration_ms: duration,
      usage: {
        model: 'claude-sonnet-4-6',
        tokens_input: claudeResp.tokens_input,
        tokens_output: claudeResp.tokens_output,
      },
      message: 'Sonnet no encontró insights útiles para esta página.',
    });
  }

  // 9. Validar + persistir
  const VALID_TYPES = new Set(['opportunity', 'risk', 'trend', 'anomaly']);
  const rows = insightArr
    .filter((i) => i && typeof i === 'object')
    .map((i) => {
      const type =
        typeof i.type === 'string' && VALID_TYPES.has(i.type) ? (i.type as string) : 'trend';
      const title = typeof i.title === 'string' ? i.title.slice(0, 200) : 'Insight';
      const content = typeof i.narrative === 'string' ? i.narrative : '';
      const refs = Array.isArray(i.metric_references)
        ? (i.metric_references as unknown[]).filter(
            (r): r is string => typeof r === 'string' && knownMetricIds.has(r)
          )
        : [];
      const priority =
        typeof i.priority === 'number' && i.priority >= 1 && i.priority <= 5
          ? Math.round(i.priority)
          : 3;
      return {
        project_id: body.project_id,
        type,
        title,
        content,
        page_id: body.page_id,
        metric_references: refs as unknown as Record<string, unknown>,
        priority,
        model_used: 'claude-sonnet-4-6',
      };
    })
    .filter((r) => r.content.length > 0);

  if (rows.length === 0) {
    return json(200, {
      insights_created: 0,
      page_id: body.page_id,
      duration_ms: duration,
      message: 'Insights filtrados por validación, ninguno sobrevivió.',
    });
  }

  const { data: inserted, error: insErr } = await admin
    .from('insights')
    .insert(rows)
    .select('id, type, title, priority, page_id, metric_references, content');
  if (insErr) return errorResponse(500, 'Error guardando insights.', { detail: insErr.message });

  return json(200, {
    insights_created: inserted?.length ?? 0,
    page_id: body.page_id,
    insights: inserted ?? [],
    duration_ms: duration,
    usage: {
      model: 'claude-sonnet-4-6',
      tokens_input: claudeResp.tokens_input,
      tokens_output: claudeResp.tokens_output,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return errorResponse(405, 'Método no permitido. Usa POST.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey)
    return errorResponse(500, 'Edge Function mal configurada (faltan env vars Supabase).');

  let auth: AuthContext;
  try {
    auth = await verifyAuth(req, supabaseUrl, anonKey);
  } catch (err) {
    return errorResponse(401, (err as Error).message);
  }

  let body: AnyRequest;
  try {
    body = (await req.json()) as AnyRequest;
  } catch (_) {
    return errorResponse(400, 'Body inválido (JSON malformado).');
  }

  if (!body.mode) return errorResponse(400, 'Falta el campo "mode".');
  if (!body.project_id) return errorResponse(400, 'Falta project_id.');

  switch (body.mode) {
    case 'build_schema':
      return await handleBuildSchema(body, auth, supabaseUrl, serviceKey);
    case 'ingest_data':
      return await handleIngestData(body, auth, supabaseUrl, serviceKey);
    case 'detect_anomalies':
      return await handleDetectAnomalies(body, auth, supabaseUrl, serviceKey);
    case 'build_dashboard_blueprint':
      return await handleBuildDashboardBlueprint(body, auth, supabaseUrl, serviceKey);
    case 'recalculate_metrics':
      return await handleRecalculateMetrics(body, auth, supabaseUrl, serviceKey);
    case 'generate_insights':
      return await handleGenerateInsights(body, auth, supabaseUrl, serviceKey);
    default:
      return errorResponse(400, `Modo no soportado aún: ${(body as { mode: string }).mode}`);
  }
});
