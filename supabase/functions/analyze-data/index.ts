// deploy: 2026-04-04 — Vizme V3 · Opus · Production fix
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyzeRequest {
  mode: 'dashboard' | 'executive' | 'internal' | 'external' | 'predictions' | 'chat' | 'discovery' | 'weekly_summary' | 'transform_data';
  enrichedProfile?: unknown;
  dataProfile?: unknown;
  extractedData?: unknown;
  profileContext?: { company_name?: string | null; industry?: string | null } | null;
  projectId?: string;
  dashboardContext?: unknown;
  chatMessage?: string;
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
  reportData?: unknown;
  internalAnalysis?: unknown;
  externalAnalysis?: { dataProfile: unknown; industry: string };
  rawExtraction?: unknown;
  sample?: unknown;
  sheetCount?: number;
  sheetNames?: string[];
  notableRows?: unknown;
}

// ─── Models ───────────────────────────────────────────────────────────────────
// Opus for heavy analysis (dashboards, reports, predictions).
// Sonnet for fast responses (chat copilot).
// Fallback chain if a model is unavailable.

// Model IDs must match the Anthropic API — NOT the Claude Code internal names.
// Check https://docs.anthropic.com/en/docs/about-claude/models for current IDs.
const ANALYSIS_MODEL = 'claude-sonnet-4-20250514';
const CHAT_MODEL     = 'claude-sonnet-4-20250514';
const FALLBACK_MODEL = 'claude-3-5-sonnet-20241022';

// ─── Claude helper ────────────────────────────────────────────────────────────

async function callClaudeRaw(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  timeoutMs = 120_000,
): Promise<string> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const e = await res.text();
      console.error(`Claude API error [${model}] ${res.status}:`, e.slice(0, 500));
      throw new Error(`Claude API ${res.status}: ${e.slice(0, 300)}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  } finally {
    clearTimeout(tid);
  }
}

// Model fallback chain — tries primary, then each fallback in order
const MODEL_FALLBACKS = [
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-haiku-20240307',
];

async function callClaude(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  timeoutMs = 120_000,
): Promise<string> {
  const modelsToTry = [model, ...MODEL_FALLBACKS.filter(m => m !== model)];

  for (let i = 0; i < modelsToTry.length; i++) {
    try {
      return await callClaudeRaw(apiKey, modelsToTry[i], systemPrompt, userPrompt, maxTokens, timeoutMs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      const isModelError = msg.includes('404') || msg.includes('403') || msg.includes('not_found') || msg.includes('model') || msg.includes('not_available');
      // If it's a model availability error and we have more fallbacks, try next
      if (isModelError && i < modelsToTry.length - 1) {
        console.warn(`Model ${modelsToTry[i]} failed (${msg.slice(0, 100)}), trying ${modelsToTry[i + 1]}`);
        continue;
      }
      throw err;
    }
  }
  throw new Error('All models failed');
}

function parseJSON(raw: string): Record<string, unknown> {
  const clean = raw.replace(/^```json?\s*/im, '').replace(/\s*```\s*$/im, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* fall through */ }
    }
    return {};
  }
}

async function callClaudeJSON(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  requiredField?: string,
): Promise<Record<string, unknown>> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt = attempt > 1
      ? `${userPrompt}\n\n⚠️ IMPORTANTE: Responde ÚNICAMENTE con JSON válido. Sin texto, sin markdown.`
      : userPrompt;

    const raw = await callClaude(apiKey, model, systemPrompt, prompt, maxTokens);
    const result = parseJSON(raw);

    if (!requiredField || result[requiredField] !== undefined) return result;
  }
  return {};
}

// ─── Trim enriched profile to stay within Claude's context ──────────────────

function trimProfile(profile: any): any {
  if (!profile || typeof profile !== 'object') return profile;
  const p = { ...profile };

  // Limit crossTabs to top 5 per tab, top 10 rows each
  if (Array.isArray(p.crossTabs)) {
    p.crossTabs = p.crossTabs.slice(0, 5).map((ct: any) => ({
      ...ct,
      data: Array.isArray(ct.data) ? ct.data.slice(0, 10) : ct.data,
    }));
  }

  // Limit timeSeries to top 3, 24 points each
  if (Array.isArray(p.timeSeries)) {
    p.timeSeries = p.timeSeries.slice(0, 3).map((ts: any) => ({
      ...ts,
      data: Array.isArray(ts.data) ? ts.data.slice(0, 24) : ts.data,
    }));
  }

  // Limit column details sample values
  if (Array.isArray(p.columnDetails)) {
    p.columnDetails = p.columnDetails.slice(0, 20).map((col: any) => ({
      ...col,
      sampleValues: Array.isArray(col.sampleValues) ? col.sampleValues.slice(0, 5) : col.sampleValues,
      topValues: Array.isArray(col.topValues) ? col.topValues.slice(0, 8) : col.topValues,
    }));
  }

  // Limit correlations
  if (Array.isArray(p.correlations)) {
    p.correlations = p.correlations.slice(0, 10);
  }

  // Limit key_metrics_summary (from extracted pipeline)
  if (Array.isArray(p.key_metrics_summary)) {
    p.key_metrics_summary = p.key_metrics_summary.slice(0, 10);
  }

  // Limit columnNames lists
  if (Array.isArray(p.numericColumns)) p.numericColumns = p.numericColumns.slice(0, 30);
  if (Array.isArray(p.categoryColumns)) p.categoryColumns = p.categoryColumns.slice(0, 20);
  if (Array.isArray(p.columnNames)) p.columnNames = p.columnNames.slice(0, 40);

  return p;
}

// ─── Trim extracted data (clean table from Claude) for prompt inclusion ───────

function trimExtracted(raw: any): any {
  // New format: extracted_data is an array of row objects (the clean table)
  if (Array.isArray(raw)) return raw.slice(0, 100);
  // Legacy: if it's an object with a data array
  if (raw && typeof raw === 'object' && Array.isArray(raw.data)) {
    return { ...raw, data: raw.data.slice(0, 100) };
  }
  return raw;
}

// ─── Build extracted data section for analysis prompts ────────────────────────

function buildExtractedSection(body: AnalyzeRequest): string {
  const ext = body.extractedData as any;
  if (!ext) return '';

  // New format: { columns, data, understanding }
  const data = Array.isArray(ext) ? ext : ext?.data;
  const columns = ext?.columns;
  const understanding = ext?.understanding;

  if (!data || !Array.isArray(data) || data.length === 0) return '';

  const colDesc = Array.isArray(columns)
    ? columns.map((c: any) => `${c.name} (${c.type}): ${c.description ?? ''}`).join('\n')
    : Object.keys(data[0] ?? {}).join(', ');

  const trimmedData = data.slice(0, 100);

  return `\n\nDATOS DEL NEGOCIO (extraídos y limpiados del archivo del cliente — úsalos como fuente PRINCIPAL):
${understanding ? `Contexto: ${understanding}\n` : ''}Columnas:
${colDesc}

DATOS (${data.length} registros${data.length > 100 ? ', mostrando primeros 100' : ''}):
${JSON.stringify(trimmedData)}`;
}

// ─── Mexican industry benchmarks ─────────────────────────────────────────────

const BENCHMARKS: Record<string, string> = {
  'Retail/Tienda':            'Margen bruto 25-45%. Rotación inventario 6-12x/año. Ticket prom $350-800 MXN.',
  'Restaurante/Food':         'Food cost 28-35%. Labor cost 25-35%. Ticket prom $180-400 MXN. Ocupación >70%.',
  'Construcción/Materiales':  'Margen bruto 18-30%. Cartera vencida <12%. Rotación capital 3-5x/año.',
  'Salud/Farmacia':           'Margen medicamentos 25-40%. Rotación inventario 8-15x/año.',
  'Tech/Software (B2B)':      'MRR growth 5-15%/mes. Churn mensual <3%. LTV:CAC >3:1.',
  'Distribución/Logística':   'Costo entrega $80-150 MXN. Fill rate >95%. Pedidos a tiempo >90%.',
  'Servicios Profesionales':  'Utilización billable 65-80%. Margen neto 15-25%. Retención >80%.',
  'E-commerce':               'Conversión 1-4%. CAC $150-600 MXN. AOV $600-1,500 MXN. ROAS >3x.',
  'Manufactura':              'OEE 65-85%. Desperdicio <5%. Horas extras <10%.',
  'Educación/Capacitación':   'Retención alumnos >70%. NPS >45. Tasa terminación >65%.',
  'Hospitalidad/Hotel':       'Ocupación >60%. Costo/habitación 35-50% ingreso.',
  'Servicios Financieros':    'Mora <5%. Margen intermediación >4%. Retención >85%.',
};

// ─── System prompts ───────────────────────────────────────────────────────────

const DASHBOARD_SYSTEM = `Eres Vizme AI — analista de datos para PyMEs mexicanas. Conviertes datasets en inteligencia de negocio.

Tu audiencia: dueños de negocio en México que NO son analistas. Necesitan claridad, no tecnicismos.

REGLAS:
1. INSIGHTS NO OBVIOS — no "ventas son altas" sino "la región norte genera 47% del ingreso con solo 3 clientes"
2. PREGUNTAS REALES — "¿Por qué bajaron mis márgenes?" no "Gráfica de márgenes"
3. DATOS PRE-PROCESADOS — el campo "data" DEBE tener los datos listos para recharts usando crossTabs y timeSeries del perfil
4. NUNCA inventes datos — usa SOLO los números del perfil enriquecido
5. Gráficas: rankings→bar_horizontal, temporal→area/line, composición→donut, correlación→scatter, 2 categorías→bar_grouped
6. KPIs INTELIGENTES con formato: "$284,500" o "4,218" o "87%"
7. Máximo 4 alertas, solo las que requieren acción inmediata

JSON EXACTO:
{
  "kpis": [{ "id": "kpi_1", "label": "string", "value": "string formateado", "rawValue": number, "format": "currency|number|percentage", "delta": { "value": "+18%", "direction": "up|down|neutral", "context": "vs mes anterior" }, "icon": "DollarSign|TrendingUp|Users|Package|ShoppingCart|BarChart2|Zap|Target", "priority": 1 }],
  "charts": [{ "id": "chart_1", "type": "bar_horizontal|bar_vertical|bar_grouped|bar_stacked|line|area|donut|scatter|treemap|funnel|waterfall|radar|gauge", "title": "string", "subtitle": "string", "question": "string", "insight": "string", "insightType": "action|opportunity|risk|trend|info", "data": [{"name":"x","value":0}], "xKey": "name", "yKey": "value", "groupKey": null, "sizeKey": null, "gridSpan": 6, "priority": 1 }],
  "alerts": [{ "id": "alert_1", "type": "danger|warning|success|info", "title": "string", "message": "string", "action": "string", "priority": 1 }],
  "executiveSummary": { "headline": "string", "topInsights": ["string"], "mainRisk": "string", "mainOpportunity": "string", "recommendedAction": "string" },
  "healthScore": { "overall": 7.4, "dimensions": [{ "name": "string", "score": 8, "color": "green|yellow|red", "insight": "string" }], "improvementPlan": [{ "action": "string", "impact": "string", "effort": "low|medium|high" }], "trend": "improving|stable|declining" },
  "dataQuality": { "overallScore": 85, "issues": ["string"], "suggestions": ["string"] },
  "suggestedFilters": [{ "id": "f_1", "label": "string", "columnKey": "string", "type": "select|multiselect|daterange|range", "options": ["string"] }]
}

RESPONDE ÚNICAMENTE CON EL JSON.`;

const EXECUTIVE_SYSTEM = `Eres Vizme AI generando un reporte ejecutivo para una PyME mexicana.
Retorna JSON:
{ "titulo": "string", "resumen": "2-3 párrafos", "fortalezas": ["string"], "debilidades": ["string"], "oportunidades": ["string"], "riesgos": ["string"], "acciones": [{ "accion": "string", "plazo": "esta semana|este mes|este trimestre", "impacto": "string" }], "kpiClave": "string", "score": 72 }
Responde ÚNICAMENTE con el JSON.`;

const INTERNAL_SYSTEM = `Eres Vizme AI realizando análisis interno de una PyME mexicana.
Retorna JSON:
{ "health_score": 68, "health_justification": "string", "kpis_negocio": [{ "nombre": "string", "valor": "string", "benchmark": "string", "status": "bueno|alerta|critico", "tendencia": "subiendo|bajando|estable" }], "segmentacion": { "dimension": "string", "segmentos": [{ "nombre": "string", "descripcion": "string", "porcentaje": 45, "valor": "$180,000" }] }, "anomalias": [{ "descripcion": "string", "severidad": "alta|media|baja", "accion": "string" }], "fortalezas_operativas": ["string"], "areas_criticas": ["string"], "plan_accion": [{ "accion": "string", "impacto": "string", "plazo": "inmediato|1 mes|trimestre", "responsable": "string" }] }
Responde ÚNICAMENTE con el JSON.`;

const EXTERNAL_SYSTEM = `Eres Vizme AI realizando análisis externo para una PyME mexicana.
Retorna JSON:
{ "posicionamiento": { "nivel": "lider|competitivo|rezagado|emergente", "descripcion": "string" }, "benchmarks": [{ "metrica": "string", "tu_valor": "string", "rango_mercado": "string", "status": "arriba|dentro|abajo", "interpretacion": "string" }], "tendencias_sector": [{ "tendencia": "string", "impacto": "positivo|negativo|neutro", "relevancia": "alta|media|baja" }], "oportunidades_mercado": ["string"], "amenazas_externas": ["string"], "estrategia_recomendada": "string" }
Responde ÚNICAMENTE con el JSON.`;

const PREDICTIONS_SYSTEM = `Eres Vizme AI analizando pipeline BI y generando proyecciones para una PyME mexicana.
Retorna JSON:
{ "analisis_disponibles": [{ "nombre": "string", "descripcion": "string", "disponible": true, "insight": "string" }], "analisis_bloqueados": [{ "nombre": "string", "columna_necesaria": "string", "desbloquea": "string", "esfuerzo": "bajo|medio|alto" }], "proyecciones": [{ "metrica": "string", "valor_actual": "string", "proyeccion_30d": "string", "proyeccion_90d": "string", "confianza": "alta|media|baja", "metodologia": "string" }], "madurez_analitica": { "nivel_actual": "basico|intermedio|avanzado|experto", "descripcion": "string", "siguiente_paso": "string" }, "recomendaciones_datos": ["string"] }
Responde ÚNICAMENTE con el JSON.`;

const DISCOVERY_SYSTEM = `Eres Vizme AI — narrador de datos para PyMEs mexicanas.
Tu trabajo: convertir un dataset crudo en una narrativa clara, amigable y accionable.
Habla en español mexicano natural, como un asesor de confianza.

REGLAS:
1. NO uses tecnicismos — habla como le explicarías a un dueño de negocio
2. Destaca lo INTERESANTE y SORPRENDENTE, no lo obvio
3. Incluye números concretos del dataset
4. Cierra con una pregunta que despierte curiosidad sobre los datos
5. Máximo 4-5 párrafos cortos

JSON:
{
  "narrativa": "string — la historia de los datos en 4-5 párrafos",
  "hallazgos_clave": ["string", "string", "string"],
  "dato_sorpresa": "string — el insight más inesperado",
  "pregunta_gancho": "string — pregunta que motiva a explorar más",
  "health_score_inicial": 0-100,
  "health_justification": "string — por qué ese score"
}
RESPONDE ÚNICAMENTE CON EL JSON.`;

const WEEKLY_SUMMARY_SYSTEM = `Eres Vizme AI generando un resumen semanal para el dueño de una PyME mexicana.
El resumen se enviará por email, así que debe ser breve, directo y motivador.
Español mexicano natural.

REGLAS:
1. Máximo 3 bullets de cambios importantes
2. Un dato positivo que motive (streak, mejora, etc.)
3. Una acción concreta para la siguiente semana
4. Tono: profesional pero cálido, como un buen asesor

JSON:
{
  "asunto_email": "string — subject line del email, max 60 chars",
  "saludo": "string — saludo personalizado con nombre",
  "cambios_semana": ["string", "string", "string"],
  "dato_positivo": "string",
  "accion_siguiente": "string",
  "health_score": 0-100,
  "health_trend": "up|down|stable",
  "streak_mensaje": "string — mensaje motivador sobre racha de semanas"
}
RESPONDE ÚNICAMENTE CON EL JSON.`;

const TRANSFORM_DATA_SYSTEM = `Eres un analista de datos experto. Recibes una muestra de un archivo Excel de una PyME mexicana y tu trabajo es entender qué datos contiene y transformarlos en una tabla limpia lista para análisis.

REGLAS:
1. Responde SOLO con JSON válido, sin markdown, sin texto antes o después.
2. El campo "data" DEBE ser un array de objetos planos (cada objeto = un registro/fila).
3. Normaliza nombres de columnas: snake_case, sin espacios, sin caracteres especiales, en español.
4. Si hay múltiples hojas con la misma estructura (ej: una por semana), COMBÍNALAS en una sola tabla agregando una columna "periodo" o "hoja_origen".
5. Si hay filas de totales/subtotales, EXCLÚYELAS del array "data" — ponlas en "summary_rows".
6. Detecta y limpia: fechas inconsistentes, números como texto, celdas vacías, headers en filas intermedias.
7. NO inventes datos. Solo transforma lo que ves.
8. El campo "metrics_for_weekly_entry" define qué campos debería llenar el usuario cada semana para alimentar su dashboard — SOLO incluye métricas que realmente estén en los datos.

RESPONDE CON ESTE JSON EXACTO:
{
  "understanding": "Descripción de 2-3 frases: qué tipo de archivo es, qué datos contiene, cómo está organizado",
  "columns": [
    {
      "name": "nombre_columna",
      "original_name": "Nombre Original en el Excel",
      "type": "number | currency | percentage | text | date | category",
      "description": "Qué representa esta columna"
    }
  ],
  "data": [
    { "columna_1": "valor", "columna_2": 123 }
  ],
  "summary_rows": [
    { "label": "Total ventas", "value": 50000, "type": "sum" }
  ],
  "sheet_pattern": "single_table | one_per_period | one_per_entity | multi_section",
  "period_column": "nombre de la columna que contiene el periodo, o null",
  "metrics_for_weekly_entry": [
    {
      "field_name": "nombre_campo",
      "label": "Etiqueta para el usuario",
      "type": "number | currency | percentage",
      "description": "Qué debe ingresar el usuario",
      "example_value": "1234.56"
    }
  ],
  "warnings": ["Advertencia si algo no se pudo interpretar"]
}`;

const CHAT_SYSTEM = `Eres Vizme AI — copiloto de datos de un dueño de PyME mexicana.
Directo, amigable, experto. Español mexicano natural. Máximo 3-4 bullets o 2 párrafos.
Siempre referencia datos concretos. Si no puedes responder con los datos disponibles, dilo.
JSON:
{ "message": "string", "bullets": ["string"], "miniChart": { "type": "bar_horizontal|line|donut", "title": "string", "data": [{"name":"x","value":0}], "xKey": "name", "yKey": "value" }, "suggestedQuestions": ["string","string","string"] }
bullets y miniChart opcionales. suggestedQuestions siempre.
RESPONDE ÚNICAMENTE CON EL JSON.`;

// ─── Project + company context ────────────────────────────────────────────────

async function getFullContext(
  supabaseClient: ReturnType<typeof createClient>,
  projectId: string,
  authHeader: string | null,
): Promise<string> {
  // Get user from the auth token passed in the request
  let userId: string | null = null;
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data } = await userClient.auth.getUser(token);
    userId = data?.user?.id ?? null;
  }

  const [projectRes, profileRes] = await Promise.all([
    supabaseClient
      .from('projects')
      .select('name,analysis_area,main_question,hypothesis,decision_to_make,audience,needs_predictions,location,seasonality,external_factors')
      .eq('id', projectId)
      .maybeSingle(),
    userId
      ? supabaseClient
          .from('profiles')
          .select('company_name,industry,company_context,onboarding_data')
          .eq('id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const p = projectRes.data;
  const prof = profileRes.data;
  const ctx = (prof?.company_context ?? prof?.onboarding_data ?? {}) as Record<string, unknown>;

  const lines: string[] = ['═══ CONTEXTO DEL NEGOCIO ═══'];
  if (prof?.company_name) lines.push(`Empresa: ${prof.company_name}`);
  if (prof?.industry || ctx?.industryDetail) lines.push(`Industria: ${ctx?.industryDetail ?? prof?.industry}`);
  if (ctx?.companySize) lines.push(`Tamaño: ${ctx.companySize}`);
  if (ctx?.monthlyRevenue) lines.push(`Facturación mensual aprox: ${ctx.monthlyRevenue}`);
  if (ctx?.mainChallenge) lines.push(`Reto principal: ${ctx.mainChallenge}`);

  if (p) {
    lines.push('', '═══ CONTEXTO DEL PROYECTO ═══');
    lines.push(`Nombre: ${p.name}`);
    if (p.analysis_area) lines.push(`Área de análisis: ${p.analysis_area}`);
    if (p.main_question) lines.push(`Pregunta principal: ${p.main_question}`);
    if (p.hypothesis) lines.push(`Hipótesis: ${p.hypothesis}`);
    if (p.decision_to_make) lines.push(`Decisión a tomar: ${p.decision_to_make}`);
    if (p.audience) lines.push(`Audiencia: ${p.audience}`);
    if (p.location) lines.push(`Ubicación: ${p.location}`);
  }

  return lines.join('\n');
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const ok = (data: unknown) => new Response(
    JSON.stringify({ success: true, ...data as Record<string, unknown> }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );

  const fail = (message: string, status = 400) => new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return fail('ANTHROPIC_API_KEY no configurado', 500);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseKey);
    // Prefer x-user-token (sent by invokeFunction to bypass JWT verification)
    // Fall back to authorization header for backwards compatibility
    const userToken = req.headers.get('x-user-token');
    const authHeader = userToken ? `Bearer ${userToken}` : req.headers.get('authorization');

    let body: AnalyzeRequest;
    try {
      body = await req.json();
    } catch {
      return fail('Body JSON inválido');
    }

    let mode = body.mode;
    console.log(`[analyze-data] mode=${mode ?? 'auto'}, hasEnriched=${!!body.enrichedProfile}, hasExtracted=${!!body.extractedData}, hasRaw=${!!body.rawExtraction}`);
    if (!mode) {
      if (body.chatMessage) mode = 'chat';
      else if (body.reportData) mode = 'executive';
      else if (body.internalAnalysis) mode = 'internal';
      else if (body.externalAnalysis) mode = 'external';
      else mode = 'dashboard';
    }

    // Context (best-effort, non-fatal)
    let projectCtx = '';
    if (body.projectId) {
      try { projectCtx = await getFullContext(sb, body.projectId, authHeader); }
      catch (e) { console.error('getFullContext error (non-fatal):', e); }
    }

    // ── dashboard ─────────────────────────────────────────────────────────────
    if (mode === 'dashboard') {
      const rawProfile = body.enrichedProfile ?? body.dataProfile;
      if (!rawProfile) return fail('enrichedProfile requerido para modo dashboard');

      const profile = trimProfile(rawProfile);
      const industry = (body.profileContext as any)?.industry ?? 'empresa';
      const companyName = (body.profileContext as any)?.company_name ?? 'esta empresa';
      const benchmark = BENCHMARKS[industry] ?? BENCHMARKS['Servicios Profesionales'] ?? '';

      const extractedSection = buildExtractedSection(body);

      const prompt = `Analiza este dataset y genera el dashboard.

EMPRESA: ${companyName}
INDUSTRIA: ${industry}
BENCHMARKS: ${benchmark}

${projectCtx}

PERFIL ENRIQUECIDO:
${JSON.stringify(profile)}${extractedSection}`;

      const result = await callClaudeJSON(apiKey, ANALYSIS_MODEL, DASHBOARD_SYSTEM, prompt, 8000, 'charts');
      if (!result.charts) return fail('Claude no generó un dashboard válido. Intenta de nuevo.');

      return ok({ dashboard: result });
    }

    // ── executive ─────────────────────────────────────────────────────────────
    if (mode === 'executive') {
      const ctx = (body.reportData as any) ?? body.dashboardContext ?? body.enrichedProfile;
      if (!ctx) return fail('Se necesita reportData o dashboardContext');
      const extractedSection = buildExtractedSection(body);
      const prompt = `Genera el reporte ejecutivo.\n\n${projectCtx}\n\nDATOS:\n${JSON.stringify(trimProfile(ctx))}${extractedSection}`;
      const result = await callClaudeJSON(apiKey, ANALYSIS_MODEL, EXECUTIVE_SYSTEM, prompt, 4000, 'resumen');
      return ok({ report: result });
    }

    // ── internal ──────────────────────────────────────────────────────────────
    if (mode === 'internal') {
      const ctx = (body.internalAnalysis as any) ?? body.dashboardContext ?? {};
      const profile = trimProfile(body.enrichedProfile ?? body.dataProfile ?? ctx);
      const extractedSection = buildExtractedSection(body);
      const prompt = `Análisis interno.\n\n${projectCtx}\n\nDATOS:\n${JSON.stringify(profile)}${extractedSection}`;
      const result = await callClaudeJSON(apiKey, ANALYSIS_MODEL, INTERNAL_SYSTEM, prompt, 4000, 'kpis_negocio');
      return ok({ internalAnalysis: result });
    }

    // ── external ──────────────────────────────────────────────────────────────
    if (mode === 'external') {
      const extCtx = (body.externalAnalysis as any) ?? {};
      const industry = extCtx.industry ?? (body.profileContext as any)?.industry ?? 'empresa';
      const benchmark = BENCHMARKS[industry] ?? BENCHMARKS['Servicios Profesionales'] ?? '';
      const profile = trimProfile(extCtx.dataProfile ?? body.enrichedProfile ?? body.dataProfile ?? {});
      const extractedSection = buildExtractedSection(body);
      const prompt = `Análisis externo.\n\nINDUSTRIA: ${industry}\nBENCHMARKS: ${benchmark}\n\n${projectCtx}\n\nDATOS:\n${JSON.stringify(profile)}${extractedSection}`;
      const result = await callClaudeJSON(apiKey, ANALYSIS_MODEL, EXTERNAL_SYSTEM, prompt, 4000, 'benchmarks');
      return ok({ externalAnalysis: result });
    }

    // ── predictions ───────────────────────────────────────────────────────────
    if (mode === 'predictions') {
      const profile = trimProfile(body.enrichedProfile ?? body.dataProfile ?? {});
      const extractedSection = buildExtractedSection(body);
      const prompt = `Pipeline BI.\n\n${projectCtx}\n\nPERFIL:\n${JSON.stringify(profile)}${extractedSection}`;
      const result = await callClaudeJSON(apiKey, ANALYSIS_MODEL, PREDICTIONS_SYSTEM, prompt, 4000, 'proyecciones');
      return ok({ predictions: result });
    }

    // ── transform_data (Claude parses & cleans the raw file) ─────────────────
    if (mode === 'transform_data') {
      const sample = body.sample as any;
      if (!sample) return fail('sample requerido para transform_data');

      const sheetCount = body.sheetCount ?? 1;
      const sheetNames = (body.sheetNames ?? []).slice(0, 30);
      const notableRows = body.notableRows ?? [];
      const industry = (body.profileContext as any)?.industry ?? 'empresa';
      const mainQuestion = (body as any).mainQuestion ?? '';
      const analysisArea = (body as any).analysisArea ?? '';

      const prompt = `CONTEXTO:
- Industria: ${industry}
- Pregunta del cliente: ${mainQuestion || '(no especificada)'}
- Área de análisis: ${analysisArea || '(no especificada)'}
- El archivo tiene ${sheetCount} hojas. Nombres: ${sheetNames.join(', ')}

${projectCtx}

MUESTRA DEL ARCHIVO:
${JSON.stringify(sample)}

FILAS QUE CONTIENEN TOTALES O SUBTOTALES:
${JSON.stringify(notableRows)}`;

      const result = await callClaudeJSON(apiKey, CHAT_MODEL, TRANSFORM_DATA_SYSTEM, prompt, 16000, 'understanding');
      if (!result.understanding) return fail('No se pudo transformar los datos del archivo');

      return ok({ transformed: result });
    }

    // ── discovery (narrated) ────────────────────────────────────────────────
    if (mode === 'discovery') {
      const profile = trimProfile(body.enrichedProfile ?? body.dataProfile ?? {});
      if (!profile || Object.keys(profile).length === 0) return fail('Se necesita enrichedProfile para discovery');
      const industry = (body.profileContext as any)?.industry ?? 'empresa';
      const companyName = (body.profileContext as any)?.company_name ?? 'tu negocio';
      const prompt = `Narra los hallazgos de este dataset.\n\nEMPRESA: ${companyName}\nINDUSTRIA: ${industry}\n\n${projectCtx}\n\nPERFIL DE DATOS:\n${JSON.stringify(profile)}`;
      const result = await callClaudeJSON(apiKey, CHAT_MODEL, DISCOVERY_SYSTEM, prompt, 1500, 'narrativa');
      return ok({ discovery: result });
    }

    // ── weekly_summary ───────────────────────────────────────────────────────
    if (mode === 'weekly_summary') {
      const profile = trimProfile(body.enrichedProfile ?? body.dataProfile ?? {});
      const companyName = (body.profileContext as any)?.company_name ?? 'tu negocio';
      const userName = (body as any).userName ?? '';
      const streak = (body as any).streakWeeks ?? 0;
      const prompt = `Genera resumen semanal.\n\nUSUARIO: ${userName}\nEMPRESA: ${companyName}\nRACHA: ${streak} semanas consecutivas\n\n${projectCtx}\n\nDATOS ACTUALES:\n${JSON.stringify(profile)}`;
      const result = await callClaudeJSON(apiKey, CHAT_MODEL, WEEKLY_SUMMARY_SYSTEM, prompt, 800, 'asunto_email');
      return ok({ weeklySummary: result });
    }

    // ── chat ──────────────────────────────────────────────────────────────────
    if (mode === 'chat') {
      const message = (body.chatMessage ?? '').trim();
      if (!message) return fail('chatMessage vacío');

      const history = (body.chatHistory ?? []).slice(-10);
      const dashCtx = body.dashboardContext as Record<string, unknown> | null;
      const ctxParts: string[] = [];

      if (projectCtx) ctxParts.push(projectCtx);
      if (dashCtx?.kpiSummary) ctxParts.push(`\nKPIs: ${dashCtx.kpiSummary}`);
      if (dashCtx?.chartInsights) ctxParts.push(`\nInsights:\n${dashCtx.chartInsights}`);
      if (dashCtx?.executiveSummary) {
        const es = dashCtx.executiveSummary as any;
        ctxParts.push(`\nResumen: ${es.headline ?? ''}`);
      }
      if (dashCtx?.dataColumns) ctxParts.push(`\nColumnas: ${dashCtx.dataColumns}`);

      const messages = [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: `${ctxParts.join('\n')}\n\nPREGUNTA: ${message}` },
      ];

      const raw = await callClaude(apiKey, CHAT_MODEL, CHAT_SYSTEM, JSON.stringify(messages), 2000);
      let chatResult = parseJSON(raw);
      if (!chatResult.message) chatResult = { message: raw, suggestedQuestions: [] };

      return ok({ chat: chatResult });
    }

    return fail(`Modo desconocido: ${mode}`);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    const stack = err instanceof Error ? err.stack : '';
    console.error('Edge function error:', message, stack);

    // Provide user-friendly messages for common errors
    if (message.includes('API 401') || message.includes('invalid x-api-key'))
      return fail('La API key de Anthropic es inválida. Verifica ANTHROPIC_API_KEY en Supabase.', 500);
    if (message.includes('API 429'))
      return fail('Límite de la API alcanzado. Espera unos segundos e intenta de nuevo.', 429);
    if (message.includes('API 529') || message.includes('overloaded'))
      return fail('Claude está sobrecargado. Intenta de nuevo en unos segundos.', 503);
    if (message.includes('abort'))
      return fail('El análisis tardó demasiado. Intenta con un archivo más pequeño.', 504);

    return fail(message, 500);
  }
});
