import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  FileType2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  TrendingDown,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { runIngestExtraction, type IngestRunResult } from '../../lib/ingestEngine';
import type { BusinessSchema } from '../../lib/v5types';

type Stage =
  | 'idle'
  | 'parsing'
  | 'parsed'
  | 'uploading'
  | 'inserting'
  | 'analyzing'
  | 'done'
  | 'error';

interface State {
  stage: Stage;
  file: File | null;
  ingest: IngestRunResult | null;
  insertedCount: number;
  anomalies: AnomalyResult[];
  error: string | null;
}

interface AnomalyResult {
  metric_name: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  explanation: string;
  data_snapshot?: { current?: number; expected_range?: [number, number]; deviation_pct?: number };
}

type Action =
  | { type: 'SELECT_FILE'; file: File }
  | { type: 'PARSE_DONE'; ingest: IngestRunResult }
  | { type: 'PARSE_ERROR'; message: string }
  | { type: 'START_UPLOAD' }
  | { type: 'INSERT_DONE'; count: number }
  | { type: 'START_ANALYSIS' }
  | { type: 'ANOMALIES_DONE'; anomalies: AnomalyResult[] }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' };

const initial: State = {
  stage: 'idle',
  file: null,
  ingest: null,
  insertedCount: 0,
  anomalies: [],
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SELECT_FILE':
      return { ...initial, file: action.file, stage: 'parsing' };
    case 'PARSE_DONE':
      return { ...state, ingest: action.ingest, stage: 'parsed' };
    case 'PARSE_ERROR':
      return { ...state, stage: 'error', error: action.message };
    case 'START_UPLOAD':
      return { ...state, stage: 'uploading', error: null };
    case 'INSERT_DONE':
      return { ...state, stage: 'analyzing', insertedCount: action.count };
    case 'START_ANALYSIS':
      return { ...state, stage: 'analyzing' };
    case 'ANOMALIES_DONE':
      return { ...state, stage: 'done', anomalies: action.anomalies };
    case 'ERROR':
      return { ...state, stage: 'error', error: action.message };
    case 'RESET':
      return initial;
    default:
      return state;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  schema: BusinessSchema;
  onCompleted?: () => void;
}

const HARD_LIMIT_BYTES = 50 * 1024 * 1024;

export default function IngestModal({ open, onClose, projectId, schema, onCompleted }: Props) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initial);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset on open/close
  useEffect(() => {
    if (!open) dispatch({ type: 'RESET' });
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.stage !== 'uploading' && state.stage !== 'inserting' && state.stage !== 'analyzing') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, state.stage, onClose]);

  // Parse file as soon as it lands
  useEffect(() => {
    if (state.stage !== 'parsing' || !state.file) return;
    let cancelled = false;
    (async () => {
      try {
        const buf = await state.file!.arrayBuffer();
        if (cancelled) return;
        const result = runIngestExtraction({ buffer: buf, fileName: state.file!.name, schema });
        if (cancelled) return;
        dispatch({ type: 'PARSE_DONE', ingest: result });
      } catch (err) {
        if (cancelled) return;
        dispatch({ type: 'PARSE_ERROR', message: (err as Error).message ?? 'No pudimos leer este archivo.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.stage, state.file, schema]);

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    if (f.size > HARD_LIMIT_BYTES) {
      dispatch({ type: 'ERROR', message: 'Archivo demasiado grande para el plan actual.' });
      return;
    }
    dispatch({ type: 'SELECT_FILE', file: f });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    disabled: state.stage !== 'idle' && state.stage !== 'error',
  });

  const handleConfirm = async () => {
    if (!state.file || !state.ingest || !user) return;
    try {
      dispatch({ type: 'START_UPLOAD' });

      // 1. Upload file
      const storagePath = `${user.id}/${Date.now()}_${state.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const buf = await state.file.arrayBuffer();
      const { error: upErr } = await supabase.storage
        .from('user-files')
        .upload(storagePath, buf, {
          contentType: state.file.type || 'application/octet-stream',
          upsert: false,
        });
      if (upErr) throw new Error(`No pudimos subir el archivo. ${upErr.message}`);

      // 2. Files row
      const { data: fileRow, error: fileErr } = await supabase
        .from('files')
        .insert({
          project_id: projectId,
          file_name: state.file.name,
          file_size_bytes: state.file.size,
          mime_type: state.file.type || null,
          storage_path: storagePath,
        })
        .select('id')
        .single();
      if (fileErr || !fileRow) throw new Error('No pudimos registrar el archivo.');

      // 3. Ingest data via Edge Function
      const { data: ingData, error: ingErr } = await supabase.functions.invoke('analyze-data', {
        body: {
          mode: 'ingest_data',
          project_id: projectId,
          file_id: fileRow.id,
          extractions: state.ingest.extractions,
        },
      });
      if (ingErr) throw new Error(`Falló la inserción de datos. ${ingErr.message ?? ''}`);
      dispatch({ type: 'INSERT_DONE', count: ingData?.inserted ?? 0 });

      // 4. Detect anomalies via Edge Function
      const { data: anomData, error: anomErr } = await supabase.functions.invoke('analyze-data', {
        body: {
          mode: 'detect_anomalies',
          project_id: projectId,
          source_file_id: fileRow.id,
        },
      });
      if (anomErr) {
        // Non-fatal — show insertion success but skip anomalies
        dispatch({ type: 'ANOMALIES_DONE', anomalies: [] });
        return;
      }
      dispatch({ type: 'ANOMALIES_DONE', anomalies: (anomData?.anomalies as AnomalyResult[]) ?? [] });
      onCompleted?.();
    } catch (err) {
      dispatch({ type: 'ERROR', message: (err as Error).message });
    }
  };

  if (!open) return null;

  const isBusy = state.stage === 'uploading' || state.stage === 'inserting' || state.stage === 'analyzing';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-vizme-navy/40 backdrop-blur-sm"
        onClick={() => !isBusy && onClose()}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-editorial animate-scale-in"
      >
        {/* Decorative wash */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-vizme-coral/10 blur-3xl" />
        <div className="grain" />

        <div className="relative">
          {/* Header */}
          <header className="flex items-start justify-between gap-4 border-b border-vizme-navy/5 px-7 py-5">
            <div>
              <p className="label-eyebrow">Ingesta recurrente</p>
              <h2 className="mt-1 font-display text-2xl font-light tracking-editorial text-vizme-navy">
                Sube datos nuevos
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="grid h-9 w-9 place-items-center rounded-full text-vizme-greyblue transition-colors hover:bg-vizme-coral/10 hover:text-vizme-coral disabled:opacity-40"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </header>

          <div className="px-7 py-6">
            {state.stage === 'idle' && (
              <DropZone
                getRootProps={getRootProps}
                getInputProps={getInputProps}
                isDragActive={isDragActive}
              />
            )}

            {state.stage === 'parsing' && (
              <CenteredLoader label="Leyendo y mapeando contra tu schema…" />
            )}

            {state.stage === 'parsed' && state.ingest && state.file && (
              <ExtractionPreview
                fileName={state.file.name}
                ingest={state.ingest}
                onCancel={() => dispatch({ type: 'RESET' })}
                onConfirm={handleConfirm}
              />
            )}

            {state.stage === 'uploading' && <CenteredLoader label="Subiendo archivo a tu storage…" />}
            {state.stage === 'inserting' && <CenteredLoader label="Insertando puntos en tu serie histórica…" />}
            {state.stage === 'analyzing' && (
              <CenteredLoader label="Haiku está buscando anomalías contra tu histórico…" subtle="Esto toma 5-15 segundos." />
            )}

            {state.stage === 'done' && (
              <DoneView
                insertedCount={state.insertedCount}
                anomalies={state.anomalies}
                onDone={onClose}
              />
            )}

            {state.stage === 'error' && (
              <ErrorView
                message={state.error ?? 'Algo falló.'}
                onRetry={() => dispatch({ type: 'RESET' })}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DropZone({
  getRootProps,
  getInputProps,
  isDragActive,
}: {
  getRootProps: () => Record<string, unknown>;
  getInputProps: () => Record<string, unknown>;
  isDragActive: boolean;
}) {
  return (
    <div
      {...getRootProps()}
      className={[
        'group cursor-pointer rounded-2xl border-2 border-dashed bg-white p-10 text-center transition-all',
        isDragActive
          ? 'border-vizme-coral bg-vizme-coral/5 shadow-glow-coral'
          : 'border-vizme-greyblue/30 hover:border-vizme-coral hover:bg-vizme-coral/5',
      ].join(' ')}
    >
      <input {...getInputProps()} />
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-vizme-navy text-white shadow-card">
        <UploadCloud size={22} />
      </div>
      <p className="mt-4 font-display text-xl font-light text-vizme-navy">
        {isDragActive ? 'Suelta aquí' : 'Arrastra tu archivo o haz click'}
      </p>
      <p className="mt-1.5 text-sm text-vizme-greyblue">
        Excel o CSV — usaremos tu schema existente para extraer los datos
      </p>
    </div>
  );
}

function CenteredLoader({ label, subtle }: { label: string; subtle?: string }) {
  return (
    <div className="grid place-items-center py-10 text-center">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full bg-vizme-coral/15 blur-2xl animate-breathe" />
        <div className="relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-vizme-coral to-vizme-orange">
          <Loader2 size={22} className="animate-spin text-white" />
        </div>
      </div>
      <p className="mt-5 font-display text-lg font-light text-vizme-navy">{label}</p>
      {subtle && <p className="mt-1.5 text-xs text-vizme-greyblue">{subtle}</p>}
    </div>
  );
}

function ExtractionPreview({
  fileName,
  ingest,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  ingest: IngestRunResult;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const Icon = ext === 'csv' ? FileType2 : FileSpreadsheet;
  const ready = ingest.summary.metrics_extracted > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-2xl border border-vizme-navy/10 bg-vizme-bg/40 p-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-vizme-navy/5 text-vizme-navy">
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-vizme-navy">{fileName}</p>
          <p className="text-xs text-vizme-greyblue">
            {ingest.summary.total_data_points} puntos · {ingest.summary.metrics_extracted} métricas detectadas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Métricas" value={ingest.summary.metrics_extracted} />
        <Stat label="Puntos" value={ingest.summary.total_data_points} />
        <Stat label="Granularidad" value={grainLabel(ingest.summary.inferred_grain)} />
      </div>

      {ingest.summary.period_range && (
        <p className="text-xs text-vizme-greyblue">
          Rango detectado:{' '}
          <span className="font-mono text-vizme-navy">
            {ingest.summary.period_range.start} → {ingest.summary.period_range.end}
          </span>
        </p>
      )}

      {ingest.extractions.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-2xl border border-vizme-navy/8 bg-white">
          <ul className="divide-y divide-vizme-navy/5">
            {ingest.extractions.slice(0, 8).map((ex) => (
              <li key={ex.metric_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-vizme-navy">{ex.metric_name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-vizme-greyblue">
                    {ex.data_points.length} pts · {ex.source_column ?? 'sin match'}
                  </p>
                </div>
                <ConfidenceBadge confidence={ex.confidence} hasData={ex.data_points.length > 0} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {!ready && (
        <div className="flex items-start gap-2.5 rounded-xl border border-vizme-coral/30 bg-vizme-coral/8 p-3 text-sm text-vizme-coral">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>
            No detectamos métricas mappeables en este archivo. Verifica que las columnas tengan
            nombres similares a las del archivo original.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-vizme-greyblue hover:text-vizme-navy"
        >
          Cambiar archivo
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!ready}
          className="group inline-flex items-center gap-2 rounded-full bg-vizme-coral px-6 py-2.5 font-medium text-white shadow-glow-coral transition-all hover:-translate-y-0.5 hover:bg-vizme-orange disabled:cursor-not-allowed disabled:bg-vizme-greyblue/35 disabled:shadow-none"
        >
          Confirmar y subir
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function DoneView({
  insertedCount,
  anomalies,
  onDone,
}: {
  insertedCount: number;
  anomalies: AnomalyResult[];
  onDone: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-emerald-50/60 border-l-4 border-emerald-500 p-4 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
          <CheckCircle2 size={16} />
        </span>
        <div>
          <p className="font-medium text-vizme-navy">Datos insertados con éxito</p>
          <p className="text-sm text-vizme-greyblue">
            {insertedCount} puntos agregados a tu serie histórica.
          </p>
        </div>
      </div>

      {anomalies.length === 0 ? (
        <div className="rounded-2xl border border-vizme-navy/8 bg-white p-5 text-center">
          <Sparkles size={20} className="mx-auto text-vizme-coral" />
          <p className="mt-2 font-display text-lg font-light text-vizme-navy">
            Todo dentro de lo esperado
          </p>
          <p className="text-sm text-vizme-greyblue">
            Tus datos nuevos siguen el patrón habitual. Ningún punto fuera de rango.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="label-eyebrow">{anomalies.length} anomalía{anomalies.length === 1 ? '' : 's'} detectada{anomalies.length === 1 ? '' : 's'}</p>
          {anomalies.map((a, i) => (
            <AnomalyCard key={i} anomaly={a} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onDone}
        className="w-full rounded-full bg-vizme-navy px-6 py-3 font-medium text-white shadow-soft transition-all hover:-translate-y-0.5"
      >
        Cerrar
      </button>
    </div>
  );
}

function AnomalyCard({ anomaly }: { anomaly: AnomalyResult }) {
  const tone = anomaly.severity === 'high'
    ? 'border-vizme-coral bg-vizme-coral/8 text-vizme-coral'
    : anomaly.severity === 'medium'
    ? 'border-amber-500 bg-amber-50/70 text-amber-700'
    : 'border-vizme-navy/15 bg-white text-vizme-navy';

  const trend = anomaly.data_snapshot?.deviation_pct
    ? anomaly.data_snapshot.deviation_pct < 0
      ? <TrendingDown size={15} />
      : <TrendingUp size={15} />
    : <Sparkles size={15} />;

  return (
    <div className={`rounded-2xl border-l-4 p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{trend}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">
            {anomaly.metric_name}
          </p>
          <p className="mt-1 font-medium text-vizme-navy">{anomaly.title}</p>
          <p className="mt-1 text-sm text-vizme-greyblue">{anomaly.explanation}</p>
        </div>
      </div>
    </div>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid place-items-center py-8 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-vizme-coral/10 text-vizme-coral">
        <AlertCircle size={22} />
      </div>
      <p className="mt-4 font-medium text-vizme-navy">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-full bg-vizme-coral px-6 py-2.5 text-white shadow-glow-coral hover:-translate-y-0.5 transition"
      >
        Intentar otra vez
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-vizme-navy/8 bg-white p-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.14em] text-vizme-greyblue">{label}</p>
      <p className="mt-1 font-display text-xl text-vizme-navy">{value}</p>
    </div>
  );
}

function ConfidenceBadge({ confidence, hasData }: { confidence: 'high' | 'medium' | 'low'; hasData: boolean }) {
  if (!hasData) {
    return (
      <span className="rounded-full bg-vizme-navy/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-vizme-greyblue">
        Sin match
      </span>
    );
  }
  const tone =
    confidence === 'high'
      ? 'bg-emerald-50 text-emerald-700'
      : confidence === 'medium'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-vizme-navy/5 text-vizme-greyblue';
  const label = confidence === 'high' ? 'Alta' : confidence === 'medium' ? 'Media' : 'Baja';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${tone}`}>
      {label}
    </span>
  );
}

function grainLabel(g: 'day' | 'week' | 'month' | null): string {
  if (g === 'day') return 'Diario';
  if (g === 'week') return 'Semanal';
  if (g === 'month') return 'Mensual';
  return '—';
}
