// ============================================================
// VIZME V5 — Retry Extraction hook (Sprint 4.2)
//
// Re-runs ingest + recalculate_metrics on the most recent file
// for a project. Health is auto-refreshed by analyze-data after
// recalculate_metrics. Does NOT re-run schema (schema is the
// expensive Opus call, and we trust its output).
//
// Used by the dashboard health banner "Reintentar extracción"
// button when ingest produced partial / no data.
// ============================================================

import { useCallback, useState } from 'react';
import { supabase } from '../supabase';
import { runIngestExtraction } from '../ingestEngine';
import type { BusinessSchema } from '../v5types';

export type RetryStage = 'idle' | 'loading_file' | 'extracting' | 'ingesting' | 'recalculating' | 'done' | 'error';

export interface RetryExtractionResult {
  success: boolean;
  insertedRows?: number;
  metricsCalculated?: number;
  healthStatus?: string;
  error?: string;
}

export interface UseRetryExtraction {
  retry: () => Promise<RetryExtractionResult>;
  stage: RetryStage;
  busy: boolean;
  lastError: string | null;
}

export function useRetryExtraction(projectId: string | undefined): UseRetryExtraction {
  const [stage, setStage] = useState<RetryStage>('idle');
  const [lastError, setLastError] = useState<string | null>(null);

  const retry = useCallback(async (): Promise<RetryExtractionResult> => {
    if (!projectId) {
      const err = 'Falta projectId.';
      setLastError(err);
      return { success: false, error: err };
    }

    setLastError(null);

    try {
      // 1. Most recent file
      setStage('loading_file');
      const { data: files, error: fErr } = await supabase
        .from('files')
        .select('id, file_name, storage_path')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false })
        .limit(1);
      if (fErr) throw new Error(`No pudimos leer tus archivos. ${fErr.message}`);
      const file = files?.[0];
      if (!file?.storage_path) {
        throw new Error('No hay archivo para reextraer. Sube uno primero.');
      }

      // 2. Schema
      const { data: schemas, error: sErr } = await supabase
        .from('business_schemas')
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1);
      if (sErr) throw new Error(`No pudimos leer el schema. ${sErr.message}`);
      const schema = (schemas?.[0] as unknown as BusinessSchema) ?? null;
      if (!schema) throw new Error('Este proyecto no tiene schema.');

      // 3. Download file
      const { data: blob, error: dlErr } = await supabase.storage
        .from('user-files')
        .download(file.storage_path);
      if (dlErr || !blob) throw new Error(`No pudimos descargar el archivo. ${dlErr?.message ?? ''}`);
      const buffer = await blob.arrayBuffer();

      // 4. Re-extract locally
      setStage('extracting');
      const ingestResult = runIngestExtraction({
        buffer,
        fileName: file.file_name ?? 'archivo',
        schema,
      });

      // 5. ingest_data (overwrites time_series for this file)
      setStage('ingesting');
      const { data: ingData, error: ingErr } = await supabase.functions.invoke('analyze-data', {
        body: {
          mode: 'ingest_data',
          project_id: projectId,
          file_id: file.id,
          extractions: ingestResult.extractions,
        },
      });
      if (ingErr) throw new Error(`Falló la inserción. ${ingErr.message}`);
      const insertedRows = (ingData as { inserted?: number } | null)?.inserted ?? 0;

      // 6. recalculate_metrics (auto-triggers refresh_health)
      setStage('recalculating');
      const { data: calcData, error: calcErr } = await supabase.functions.invoke('analyze-data', {
        body: { mode: 'recalculate_metrics', project_id: projectId },
      });
      if (calcErr) throw new Error(`Falló el recálculo. ${calcErr.message}`);
      const calc = calcData as { metrics_calculated?: number; health_status?: string } | null;

      setStage('done');
      return {
        success: true,
        insertedRows,
        metricsCalculated: calc?.metrics_calculated ?? 0,
        healthStatus: calc?.health_status,
      };
    } catch (err) {
      const message = (err as Error).message ?? 'Error reintentando extracción.';
      setLastError(message);
      setStage('error');
      return { success: false, error: message };
    }
  }, [projectId]);

  return {
    retry,
    stage,
    busy: stage !== 'idle' && stage !== 'done' && stage !== 'error',
    lastError,
  };
}
