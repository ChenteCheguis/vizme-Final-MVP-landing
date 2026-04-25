import { useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { ArrowLeft, ArrowRight, FileSpreadsheet, FileType2, Loader2, UploadCloud, X, Layers, Database, Cpu } from 'lucide-react';
import { buildFileDigest, type FileDigest } from '../../lib/fileDigest';

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
  parsing,
  parseError,
  onSelectFile,
  onParseSuccess,
  onParseError,
  onClear,
  onBack,
  onAnalyze,
  isUploading,
}: Props) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      const f = accepted[0];
      if (!f) return;
      if (f.size > HARD_LIMIT_BYTES) {
        onParseError(
          'Este archivo es demasiado grande para nuestro plan actual. Planes Enterprise soportan archivos sin límite — escríbenos.'
        );
        return;
      }
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

  // Parse file as soon as it lands
  useEffect(() => {
    if (!file || digest || parsing || parseError) return;
    let cancelled = false;
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        if (cancelled) return;
        const result = buildFileDigest({ buffer: buf, file_name: file.name });
        if (cancelled) return;
        onParseSuccess(result);
      } catch (err) {
        if (cancelled) return;
        onParseError((err as Error).message ?? 'No pudimos leer este archivo. Verifica que no esté corrupto.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, digest, parsing, parseError, onParseSuccess, onParseError]);

  const tokenEstimate = digest ? estimateDigestTokens(digest) : 0;
  const fileSizeMb = file ? (file.size / (1024 * 1024)).toFixed(2) : null;
  const tooLargeForFreemium = file && file.size > MAX_FILE_BYTES;

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
            <FilePreview file={file} sizeMb={fileSizeMb!} onClear={onClear} disabled={isUploading} />

            {tooLargeForFreemium && (
              <div className="rounded-2xl border border-vizme-coral/30 bg-vizme-coral/8 px-4 py-3 text-sm text-vizme-coral">
                Este archivo supera 25 MB. Funciona, pero el plan Pro/Enterprise de Vizme está hecho
                para archivos así — escríbenos para activarlo.
              </div>
            )}

            <ParsingProgress parsing={parsing} digest={digest} error={parseError} />

            {digest && !parseError && (
              <DigestStats digest={digest} estTokens={tokenEstimate} />
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={isUploading}
            className="inline-flex items-center gap-2 text-sm font-medium text-vizme-greyblue transition-colors hover:text-vizme-navy disabled:opacity-50"
          >
            <ArrowLeft size={16} />
            Atrás
          </button>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={!digest || parsing || isUploading || !!parseError}
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

function ParsingProgress({
  parsing,
  digest,
  error,
}: {
  parsing: boolean;
  digest: FileDigest | null;
  error: string | null;
}) {
  if (error) {
    return (
      <div className="rounded-2xl border border-vizme-coral/30 bg-vizme-coral/8 px-4 py-3 text-sm text-vizme-coral">
        {error}
      </div>
    );
  }
  if (parsing) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-vizme-navy/8 bg-white/80 px-4 py-3 text-sm text-vizme-navy">
        <Loader2 size={16} className="animate-spin text-vizme-coral" />
        Leyendo y resumiendo tu archivo…
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
