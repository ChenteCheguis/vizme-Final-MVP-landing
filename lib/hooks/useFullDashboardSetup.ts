// ============================================================
// VIZME V5 — Full Dashboard Setup orchestrator (Sprint 4.1)
//
// Encadena los pasos post-schema en orden:
//   1. ingest_data    (corre runIngestExtraction localmente
//                      y envía las extractions al edge function)
//   2. recalculate_metrics
//   3. build_dashboard_blueprint
//   4. generate_insights × N páginas (paralelo)
//
// Sin timeouts arbitrarios. Cada paso reporta progreso al UI
// vía onProgress. Si un paso falla, regresa { success:false,
// failedStep }. Insights es no-bloqueante: si falla 1+ páginas
// el dashboard sigue siendo usable.
// ============================================================

import { supabase } from '../supabase';
import { runIngestExtraction } from '../ingestEngine';
import type { BusinessSchema } from '../v5types';

export type SetupStage =
  | 'ingesting'
  | 'calculating'
  | 'designing'
  | 'writing_insights'
  | 'done'
  | 'error';

export interface FullSetupOptions {
  projectId: string;
  fileId: string;
  schemaId: string;
  file: File;
  schema: BusinessSchema;
  onProgress?: (stage: SetupStage, message: string) => void;
}

export interface FullSetupResult {
  success: boolean;
  blueprintId?: string;
  failedStep?: SetupStage;
  error?: string;
  // Sprint 4.2 — non-blocking failures (we continued anyway)
  warnings?: Array<{ stage: SetupStage; message: string }>;
  stats?: {
    insertedRows: number;
    metricsCalculated: number;
    pagesGenerated: number;
    insightsGenerated: number;
    insightsFailed: number;
    durationMs: number;
  };
}

interface BlueprintPage {
  id: string;
  [key: string]: unknown;
}

const STAGE_MESSAGES: Record<Exclude<SetupStage, 'done' | 'error'>, string> = {
  ingesting: 'Procesando tu archivo histórico…',
  calculating: 'Calculando tus métricas reales…',
  designing: 'Diseñando tu dashboard personalizado…',
  writing_insights: 'Escribiendo insights para ti…',
};

async function invokeAnalyzeData<T = Record<string, unknown>>(
  body: Record<string, unknown>
): Promise<{ data?: T; error?: string }> {
  const { data, error } = await supabase.functions.invoke('analyze-data', { body });
  if (error) {
    const detail =
      (data as { error?: string } | null)?.error ??
      error.message ??
      'Error desconocido en el análisis.';
    return { error: detail };
  }
  return { data: data as T };
}

export async function runFullDashboardSetup(
  options: FullSetupOptions
): Promise<FullSetupResult> {
  const { projectId, fileId, schemaId, file, schema, onProgress } = options;
  const t0 = Date.now();

  let insertedRows = 0;
  let metricsCalculated = 0;
  const warnings: Array<{ stage: SetupStage; message: string }> = [];

  // ── Paso 1: ingest_data (TOLERANTE) ───────────────────
  // Sprint 4.2: even if extraction yields 0 rows, we continue —
  // the dashboard will render with health=no_data and the user
  // can retry from the banner.
  onProgress?.('ingesting', STAGE_MESSAGES.ingesting);
  let extractions: Awaited<ReturnType<typeof runIngestExtraction>>['extractions'] = [];
  try {
    const buffer = await file.arrayBuffer();
    const ingestResult = runIngestExtraction({
      buffer,
      fileName: file.name,
      schema,
    });
    extractions = ingestResult.extractions;
    if (!extractions || extractions.length === 0 || ingestResult.summary.total_data_points === 0) {
      warnings.push({
        stage: 'ingesting',
        message:
          'No pudimos extraer datos de tu archivo. El dashboard se construirá vacío y podrás reintentar.',
      });
    }
  } catch (err) {
    warnings.push({
      stage: 'ingesting',
      message: `No pudimos leer tu archivo: ${(err as Error).message}`,
    });
  }

  if (extractions.length > 0) {
    const ingestResp = await invokeAnalyzeData<{ inserted: number }>({
      mode: 'ingest_data',
      project_id: projectId,
      file_id: fileId,
      extractions,
    });
    if (ingestResp.error) {
      warnings.push({ stage: 'ingesting', message: ingestResp.error });
    } else {
      insertedRows = ingestResp.data?.inserted ?? 0;
    }
  }

  // ── Paso 2: recalculate_metrics (TOLERANTE) ──────────
  onProgress?.('calculating', STAGE_MESSAGES.calculating);
  const calcResp = await invokeAnalyzeData<{ metrics_calculated: number }>({
    mode: 'recalculate_metrics',
    project_id: projectId,
  });
  if (calcResp.error) {
    warnings.push({ stage: 'calculating', message: calcResp.error });
  } else {
    metricsCalculated = calcResp.data?.metrics_calculated ?? 0;
  }

  // ── Paso 3: build_dashboard_blueprint (HARD FAIL) ────
  // Sin blueprint no hay nada que renderizar. Este es el ÚNICO
  // paso que detiene el flujo (además del schema, que se hace
  // antes de invocar este hook).
  onProgress?.('designing', STAGE_MESSAGES.designing);
  const blueprintResp = await invokeAnalyzeData<{
    blueprint_id: string;
    pages: BlueprintPage[];
  }>({
    mode: 'build_dashboard_blueprint',
    project_id: projectId,
    schema_id: schemaId,
  });
  if (blueprintResp.error) {
    return {
      success: false,
      failedStep: 'designing',
      error: blueprintResp.error,
      warnings,
    };
  }
  const blueprintId = blueprintResp.data?.blueprint_id;
  const pages = blueprintResp.data?.pages ?? [];

  // ── Paso 4: generate_insights por página (paralelo) ───
  onProgress?.('writing_insights', STAGE_MESSAGES.writing_insights);
  let insightsGenerated = 0;
  let insightsFailed = 0;

  if (pages.length > 0) {
    const insightResults = await Promise.all(
      pages.map((page) =>
        invokeAnalyzeData<{ insights_created: number }>({
          mode: 'generate_insights',
          project_id: projectId,
          page_id: page.id,
        })
      )
    );
    for (const r of insightResults) {
      if (r.error) {
        insightsFailed += 1;
      } else {
        insightsGenerated += r.data?.insights_created ?? 0;
      }
    }
  }

  onProgress?.('done', 'Tu dashboard está listo');
  return {
    success: true,
    blueprintId,
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: {
      insertedRows,
      metricsCalculated,
      pagesGenerated: pages.length,
      insightsGenerated,
      insightsFailed,
      durationMs: Date.now() - t0,
    },
  };
}
