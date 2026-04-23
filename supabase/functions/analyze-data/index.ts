// ============================================================
// VIZME V5 — Edge Function: analyze-data
// Modos: build_schema (este sprint). Otros vienen en sprints
// posteriores (refresh, regenerate_blueprint, etc.).
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2.100.1';
import { buildSchemaPrompt, SYSTEM_PROMPT_VERSION } from '../_shared/prompts/buildSchemaPrompt.ts';
import { callClaude, ClaudeError } from '../_shared/claudeClient.ts';
import { extractJsonFromText, validateBusinessSchemaPayload } from '../_shared/schemaValidator.ts';
import type { BusinessSchemaPayload, FileDigest } from '../_shared/types.ts';

declare const Deno: { env: { get: (k: string) => string | undefined }; serve: (h: (req: Request) => Response | Promise<Response>) => void };

interface BuildSchemaRequest {
  mode: 'build_schema';
  project_id: string;
  file_id?: string;       // referencia opcional; el parseo vive en el cliente
  digest: FileDigest;     // digest ya construido por el cliente (obligatorio)
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

  // 2. file_id es opcional (referencia). Si viene, validamos pertenencia pero
  // NO se usa para parsear — el parseo vive en el cliente.
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

  // 3. Validar que el cliente haya enviado un digest válido.
  // El parseo del XLSX/CSV vive en el cliente para evitar WORKER_RESOURCE_LIMIT.
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
  const digest = body.digest;

  // 4. Prompts + llamada a Opus 4.7
  const { system, user } = buildSchemaPrompt({
    digest,
    business_hint: body.business_hint,
    question: body.question,
  });

  let modelResp;
  try {
    modelResp = await callClaude({
      model: 'opus-4-7',
      system,
      messages: [{ role: 'user', content: user }],
      max_tokens: 16000,
      temperature: 0,
      cache_control: true,
    });
  } catch (err) {
    if (err instanceof ClaudeError) return errorResponse(502, err.message, { status: err.status });
    return errorResponse(500, 'Error inesperado llamando a Claude.', { detail: (err as Error).message });
  }

  // 5. Validar JSON
  let parsed: unknown;
  try {
    parsed = extractJsonFromText(modelResp.text);
  } catch (err) {
    return errorResponse(502, 'Opus devolvió texto sin JSON parseable.', {
      detail: (err as Error).message,
      raw_preview: modelResp.text.slice(0, 500),
    });
  }

  let validation = validateBusinessSchemaPayload(parsed);
  let payload: BusinessSchemaPayload | undefined = validation.payload;

  // 6. Si falla, 1 reintento pidiendo corrección
  if (!validation.ok) {
    const fixUser =
      'Tu respuesta anterior tuvo errores de validación:\n\n' +
      validation.errors.map((e) => `- ${e}`).join('\n') +
      '\n\nDevuelve EL MISMO objeto pero corregido. JSON estricto, sin markdown.';
    try {
      const retry = await callClaude({
        model: 'opus-4-7',
        system,
        messages: [
          { role: 'user', content: user },
          { role: 'assistant', content: modelResp.text },
          { role: 'user', content: fixUser },
        ],
        max_tokens: 16000,
        temperature: 0,
        cache_control: true,
      });
      const reparsed = extractJsonFromText(retry.text);
      validation = validateBusinessSchemaPayload(reparsed);
      payload = validation.payload;
      modelResp.tokens_input += retry.tokens_input;
      modelResp.tokens_output += retry.tokens_output;
      if (retry.tokens_cached_read) modelResp.tokens_cached_read = (modelResp.tokens_cached_read ?? 0) + retry.tokens_cached_read;
      if (retry.tokens_cached_write) modelResp.tokens_cached_write = (modelResp.tokens_cached_write ?? 0) + retry.tokens_cached_write;
    } catch (err) {
      return errorResponse(502, 'Falló el reintento de corrección.', { detail: (err as Error).message });
    }
  }

  if (!validation.ok || !payload) {
    return errorResponse(502, 'Schema inválido tras reintento.', { errors: validation.errors });
  }

  // 7. Determinar siguiente versión.
  // No hay is_active en business_schemas: la versión activa = max(version).
  const { data: existing } = await admin
    .from('business_schemas')
    .select('version')
    .eq('project_id', body.project_id)
    .order('version', { ascending: false })
    .limit(1);
  const nextVersion = (existing?.[0]?.version ?? 0) + 1;

  // 8. Persistir
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
      model_used: modelResp.model_used,
      tokens_input: modelResp.tokens_input,
      tokens_output: modelResp.tokens_output,
    })
    .select('id')
    .single();
  if (insErr || !inserted)
    return errorResponse(500, 'No se pudo guardar el schema.', { detail: insErr?.message });

  // 9. Marcar archivo como procesado (si el cliente pasó file_id).
  // files no tiene status/analyzed_at; usamos processed_at + structural_map.
  if (body.file_id) {
    await admin
      .from('files')
      .update({
        processed_at: new Date().toISOString(),
        structural_map: { digest_summary: digest.sheets_summary },
      })
      .eq('id', body.file_id);
  }

  return json(200, {
    schema_id: inserted.id,
    version: nextVersion,
    summary: {
      industry: payload.business_identity.industry,
      metrics_count: payload.metrics.length,
      entities_count: payload.entities.length,
      dimensions_count: payload.dimensions.length,
      extraction_rules_count: payload.extraction_rules.length,
      external_sources_count: payload.external_sources.length,
      needs_clarification: payload.needs_clarification ?? null,
    },
    usage: {
      model: modelResp.model_used,
      tokens_input: modelResp.tokens_input,
      tokens_output: modelResp.tokens_output,
      tokens_cached_read: modelResp.tokens_cached_read ?? 0,
      tokens_cached_write: modelResp.tokens_cached_write ?? 0,
      prompt_version: SYSTEM_PROMPT_VERSION,
    },
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
