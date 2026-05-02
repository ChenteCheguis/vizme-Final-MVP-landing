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

  // ── Paso 1: ingest_data ───────────────────────────────
  onProgress?.('ingesting', STAGE_MESSAGES.ingesting);
  let extractions;
  try {
    const buffer = await file.arrayBuffer();
    const ingestResult = runIngestExtraction({
      buffer,
      fileName: file.name,
      schema,
    });
    extractions = ingestResult.extractions;
    if (
      !extractions ||
      extractions.length === 0 ||
      ingestResult.summary.total_data_points === 0
    ) {
      return {
        success: false,
        failedStep: 'ingesting',
        error:
          'No pudimos extraer datos de tu archivo. Revisa que las columnas coincidan con tu schema.',
      };
    }
  } catch (err) {
    return {
      success: false,
      failedStep: 'ingesting',
      error: `No pudimos leer tu archivo. ${(err as Error).message}`,
    };
  }

  const ingestResp = await invokeAnalyzeData<{ inserted: number }>({
    mode: 'ingest_data',
    project_id: projectId,
    file_id: fileId,
    extractions,
  });
  if (ingestResp.error) {
    return { success: false, failedStep: 'ingesting', error: ingestResp.error };
  }
  insertedRows = ingestResp.data?.inserted ?? 0;
  if (insertedRows === 0) {
    return {
      success: false,
      failedStep: 'ingesting',
      error: 'Tu archivo no produjo datos numéricos utilizables.',
    };
  }

  // ── Paso 2: recalculate_metrics ───────────────────────
  onProgress?.('calculating', STAGE_MESSAGES.calculating);
  const calcResp = await invokeAnalyzeData<{ metrics_calculated: number }>({
    mode: 'recalculate_metrics',
    project_id: projectId,
  });
  if (calcResp.error) {
    return { success: false, failedStep: 'calculating', error: calcResp.error };
  }
  metricsCalculated = calcResp.data?.metrics_calculated ?? 0;

  // ── Paso 3: build_dashboard_blueprint ─────────────────
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
