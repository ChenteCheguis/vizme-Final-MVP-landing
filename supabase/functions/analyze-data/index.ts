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
    headers: { 'content-type': 'application/json' },
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

Deno.serve(async (req) => {
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

  let body: BuildSchemaRequest;
  try {
    body = (await req.json()) as BuildSchemaRequest;
  } catch (_) {
    return errorResponse(400, 'Body inválido (JSON malformado).');
  }

  if (!body.mode) return errorResponse(400, 'Falta el campo "mode".');
  if (!body.project_id) return errorResponse(400, 'Falta project_id.');

  switch (body.mode) {
    case 'build_schema':
      return await handleBuildSchema(body, auth, supabaseUrl, serviceKey);
    default:
      return errorResponse(400, `Modo no soportado aún: ${(body as { mode: string }).mode}`);
  }
});
