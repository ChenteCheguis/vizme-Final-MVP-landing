import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  ArrowLeft,
  ArrowRight,
  FileSpreadsheet,
  FileType2,
  Loader2,
  UploadCloud,
  X,
  Layers,
  Database,
  Cpu,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  buildFileDigest,
  type FileDigest,
  type DigestProgressEvent,
} from '../../lib/fileDigest';

interface Props {
  file: File | null;
  digest: FileDigest | null;
  parsing: boolean;
  parseError: string | null;
  onSelectFile: (file: File) => void;
  onParseSuccess: (digest: FileDigest) => void;
  onParseError: (message: string) => void;
  onClear: () => void;
  onBack: () => void;
  onAnalyze: () => void;
  isUploading: boolean;
}

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB
const HARD_LIMIT_BYTES = 50 * 1024 * 1024; // 50MB hard ceiling

export default function Step3Upload({
  file,
  digest,
  parsing: _parsingFromParent,
  parseError,
  onSelectFile,
  onParseSuccess,
  onParseError,
  onClear,
  onBack,
  onAnalyze,
  isUploading,
}: Props) {
  // Local progress state, fed by buildFileDigest's onProgress callback.
  // We keep it local so the parent's reducer doesn't re-render the whole wizard
  // on every batch update.
  const [progress, setProgress] = useState<DigestProgressEvent | null>(null);
  // Token used to drop progress events from a previous parse (e.g. user dropped
  // a new file while the old one was still streaming). Ref-based so updates
  // don't trigger renders.
  const parseTokenRef = useRef(0);

  const onDrop = useCallback(
    (accepted: File[]) => {
      const f = accepted[0];
      if (!f) return;
      console.log('[VIZME] Step3 — file dropped:', {
        name: f.name,
        size_bytes: f.size,
        size_mb: (f.size / (1024 * 1024)).toFixed(2),
        type: f.type,
        timestamp: new Date().toISOString(),
      });
      if (f.size > HARD_LIMIT_BYTES) {
        onParseError(
          'Este archivo es demasiado grande para nuestro plan actual. Planes Enterprise soportan archivos sin límite — escríbenos.'
        );
        return;
      }
      setProgress(null);
      onSelectFile(f);
    },
    [onSelectFile, onParseError]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
  });

  // Parse file as soon as it lands.
  // GUARD: only the absence of a digest or a real error stops us — NOT the
  // parsing flag (that was the Sprint 3 silent-failure bug — the parent
  // dispatched START_PARSING_FILE which set parsing=true synchronously, so
  // the effect's guard returned early and the parse never started).
  useEffect(() => {
    if (!file || digest || parseError) return;

    const myToken = ++parseTokenRef.current;
    let cancelled = false;
    const startedAt = performance.now();

    console.log('[VIZME] Step3 — buildFileDigest START', {
      file_name: file.name,
      size_bytes: file.size,
      token: myToken,
    });

    (async () => {
      try {
        const buf = await file.arrayBuffer();
        if (cancelled || parseTokenRef.current !== myToken) return;

        const result = await buildFileDigest({
          buffer: buf,
          file_name: file.name,
          onProgress: (event) => {
            if (cancelled || parseTokenRef.current !== myToken) return;
            console.log('[fileDigest] progress', {
              stage: event.stage,
              percent: event.percent,
              message: event.message,
              detail: event.detail,
            });
            setProgress(event);
          },
        });

        if (cancelled || parseTokenRef.current !== myToken) return;

        const duration = performance.now() - startedAt;
        console.log('[VIZME] Step3 — buildFileDigest SUCCESS', {
          duration_ms: Math.round(duration),
          total_sheets: result.total_sheets,
          total_rows: result.total_rows_approx,
          sample_sheets: result.sample_sheets.length,
          notable_rows: result.notable_rows.length,
          digest_size_chars: JSON.stringify(result).length,
        });

        onParseSuccess(result);
      } catch (err) {
        if (cancelled || parseTokenRef.current !== myToken) return;
        const duration = performance.now() - startedAt;
        const message = (err as Error).message ?? 'No pudimos leer este archivo. Verifica que no esté corrupto.';
        console.error('[VIZME] Step3 — buildFileDigest FAILED', {
          duration_ms: Math.round(duration),
          error: message,
          stack: (err as Error).stack,
        });
        onParseError(message);
      }
    })();

    return () => {
      cancelled = true;
    };
    // We deliberately omit onParseSuccess/onParseError from deps — they're
    // stable references from the reducer dispatch. Including them caused the
    // effect to re-fire mid-parse on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, digest, parseError]);

  // Reset progress when file is cleared
  useEffect(() => {
    if (!file) setProgress(null);
  }, [file]);

  const tokenEstimate = digest ? estimateDigestTokens(digest) : 0;
  const fileSizeMb = file ? (file.size / (1024 * 1024)).toFixed(2) : null;
  const tooLargeForFreemium = file && file.size > MAX_FILE_BYTES;

  const isCurrentlyParsing = !!file && !digest && !parseError;

  return (
    <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
      <div className="space-y-8 animate-slide-right">
        <div className="space-y-3">
          <p className="label-eyebrow">Paso 03 — Sube tu data</p>
          <h1 className="font-display text-4xl font-light leading-tight tracking-editorial text-vizme-navy lg:text-5xl">
            Suelta tu archivo. Nosotros lo entendemos.
          </h1>
          <p className="max-w-lg text-vizme-greyblue text-pretty">
            Aceptamos Excel y CSV. Procesamos el archivo en tu navegador antes de subirlo —
            tu data nunca viaja sin que sepamos qué tiene.
          </p>
        </div>

        {!file ? (
          <div
            {...getRootProps()}
            className={[
              'group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed bg-white/60 p-10 transition-all duration-300 backdrop-blur',
              isDragReject
                ? 'border-vizme-coral/70 bg-vizme-coral/5'
                : isDragActive
                ? 'border-vizme-coral bg-vizme-coral/5 shadow-glow-coral'
                : 'border-vizme-greyblue/35 hover:border-vizme-coral hover:bg-white/85',
            ].join(' ')}
          >
            <input {...getInputProps()} />
            <div className="grain" />
            <div className="relative flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-vizme-coral/15 blur-2xl group-hover:bg-vizme-coral/25 transition" />
                <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-vizme-navy text-white shadow-card">
                  <UploadCloud size={26} />
                </div>
              </div>
              <p className="font-display text-2xl font-light text-vizme-navy">
                {isDragActive ? 'Suelta aquí' : 'Arrastra tu archivo o haz click'}
              </p>
              <p className="mt-2 text-sm text-vizme-greyblue">
                Soportamos <span className="font-mono text-vizme-navy">.xlsx</span>,{' '}
                <span className="font-mono text-vizme-navy">.xls</span>,{' '}
                <span className="font-mono text-vizme-navy">.csv</span> — hasta 25 MB
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 animate-fade-in">
            <FilePreview file={file} sizeMb={fileSizeMb!} onClear={onClear} disabled={isUploading || isCurrentlyParsing} />

            {tooLargeForFreemium && (
              <div className="rounded-2xl border border-vizme-coral/30 bg-vizme-coral/8 px-4 py-3 text-sm text-vizme-coral">
                Este archivo supera 25 MB. Funciona, pero el plan Pro/Enterprise de Vizme está hecho
                para archivos así — escríbenos para activarlo.
              </div>
            )}

            <ParseStatus
              parsing={isCurrentlyParsing}
              progress={progress}
              digest={digest}
              error={parseError}
              onRetry={onClear}
            />

            {digest && !parseError && <DigestStats digest={digest} estTokens={tokenEstimate} />}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={isUploading || isCurrentlyParsing}
            className="inline-flex items-center gap-2 text-sm font-medium text-vizme-greyblue transition-colors hover:text-vizme-navy disabled:opacity-50"
          >
            <ArrowLeft size={16} />
            Atrás
          </button>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={!digest || isCurrentlyParsing || isUploading || !!parseError}
            className="group inline-flex items-center gap-2 rounded-full bg-vizme-coral px-7 py-3 font-medium text-white shadow-glow-coral transition-all duration-200 hover:-translate-y-0.5 hover:bg-vizme-orange disabled:cursor-not-allowed disabled:bg-vizme-greyblue/35 disabled:shadow-none disabled:translate-y-0"
          >
            {isUploading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Analizar mi data
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right — what we'll do */}
      <aside className="relative animate-slide-up lg:pt-16">
        <div className="sticky top-8 space-y-5 rounded-2xl border border-vizme-navy/8 bg-white/85 p-6 shadow-soft backdrop-blur">
          <p className="label-eyebrow">Lo que pasa cuando le des click</p>
          <ol className="space-y-4 text-sm">
            {[
              { icon: <UploadCloud size={14} />, label: 'Subimos tu archivo cifrado a tu storage privado.' },
              { icon: <Cpu size={14} />, label: 'La IA lee la estructura, no tu información cruda.' },
              { icon: <Database size={14} />, label: 'Construye un schema único para tu negocio.' },
            ].map((it, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-vizme-navy/8 text-vizme-navy">
                  {it.icon}
                </span>
                <span className="leading-relaxed text-vizme-navy/85">{it.label}</span>
              </li>
            ))}
          </ol>
          <div className="rounded-xl border border-vizme-coral/15 bg-vizme-coral/5 p-3 text-xs leading-relaxed text-vizme-navy/85">
            <strong className="font-medium text-vizme-coral">Tip:</strong> mientras más datos
            históricos incluyas, mejor entiende los patrones de tu negocio.
          </div>
        </div>
      </aside>
    </div>
  );
}

function FilePreview({
  file,
  sizeMb,
  onClear,
  disabled,
}: {
  file: File;
  sizeMb: string;
  onClear: () => void;
  disabled?: boolean;
}) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const Icon = ext === 'csv' ? FileType2 : FileSpreadsheet;
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-vizme-navy/10 bg-white p-4 shadow-soft">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-vizme-navy/5 text-vizme-navy">
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-vizme-navy">{file.name}</p>
        <p className="text-xs text-vizme-greyblue">
          {sizeMb} MB · <span className="font-mono uppercase">{ext}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        disabled={disabled}
        className="grid h-9 w-9 place-items-center rounded-full text-vizme-greyblue transition-colors hover:bg-vizme-coral/10 hover:text-vizme-coral disabled:opacity-50"
        aria-label="Quitar archivo"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function ParseStatus({
  parsing,
  progress,
  digest,
  error,
  onRetry,
}: {
  parsing: boolean;
  progress: DigestProgressEvent | null;
  digest: FileDigest | null;
  error: string | null;
  onRetry: () => void;
}) {
  // Real error from parse: actionable card
  if (error) {
    return (
      <div className="rounded-2xl border border-vizme-coral/30 bg-vizme-coral/8 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-vizme-coral text-white">
            <AlertTriangle size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-vizme-coral">
              No pudimos procesar tu archivo
            </p>
            <p className="mt-1 text-sm leading-relaxed text-vizme-navy">{error}</p>
            <p className="mt-2 text-xs leading-relaxed text-vizme-greyblue">
              Causas comunes: archivo dañado, formato inusual, o supera el plan actual.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-vizme-coral hover:underline"
            >
              <RefreshCw size={12} />
              Subir otro archivo
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (parsing) {
    const percent = progress?.percent ?? 0;
    const message = progress?.message ?? 'Leyendo encabezados del archivo…';
    return (
      <div className="space-y-2.5 rounded-2xl border border-vizme-navy/8 bg-white/85 px-4 py-4 backdrop-blur">
        <div className="flex items-center gap-3 text-sm text-vizme-navy">
          <Loader2 size={16} className="animate-spin text-vizme-coral shrink-0" />
          <span className="min-w-0 flex-1 truncate">{message}</span>
          <span className="font-mono text-xs text-vizme-greyblue tabular-nums">
            {Math.round(percent)}%
          </span>
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-vizme-navy/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-vizme-coral via-vizme-orange to-vizme-coral bg-[length:200%_100%] animate-shimmer transition-all duration-300"
            style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
          />
        </div>
        {progress?.detail?.processed !== undefined && progress?.detail?.total !== undefined && (
          <p className="text-[11px] text-vizme-greyblue">
            {(progress.detail.processed as number).toLocaleString('es-MX')} de{' '}
            {(progress.detail.total as number).toLocaleString('es-MX')} filas
          </p>
        )}
      </div>
    );
  }

  if (digest) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-700">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-white text-[11px]">
          ✓
        </span>
        Listo para analizar
      </div>
    );
  }

  return null;
}

function DigestStats({ digest, estTokens }: { digest: FileDigest; estTokens: number }) {
  const items = [
    { label: 'Hojas detectadas', value: digest.total_sheets, icon: <Layers size={14} /> },
    { label: 'Filas notables', value: digest.notable_rows.length, icon: <Database size={14} /> },
    {
      label: 'Tokens estimados',
      value: estTokens >= 1000 ? `~${(estTokens / 1000).toFixed(1)}k` : `${estTokens}`,
      icon: <Cpu size={14} />,
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-2xl border border-vizme-navy/8 bg-white/85 p-3 backdrop-blur"
        >
          <div className="flex items-center gap-1.5 text-vizme-greyblue">
            {it.icon}
            <span className="text-[10px] uppercase tracking-[0.14em]">{it.label}</span>
          </div>
          <p className="mt-1 font-display text-xl text-vizme-navy">{it.value}</p>
        </div>
      ))}
    </div>
  );
}

function estimateDigestTokens(digest: FileDigest): number {
  // Rough heuristic — 1 token ≈ 4 chars of JSON
  try {
    return Math.ceil(JSON.stringify(digest).length / 4);
  } catch {
    return 0;
  }
}
