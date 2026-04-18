import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload, X, FileSpreadsheet,
  CheckCircle2, Loader2, AlertCircle,
  Eye, EyeOff, ChevronDown, Layers,
  ShieldCheck, AlertTriangle, Info,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { parseFile } from '../../lib/fileParser';
import type { ParsedFile, SheetInfo, HealthIssue } from '../../lib/fileParser';
import { inferDataProfile } from '../../lib/inferDataProfile';
import type { DataProfile } from '../../lib/inferDataProfile';
import { useAuth } from '../../context/AuthContext';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type FileStatus = 'parsing' | 'ready' | 'uploading' | 'done' | 'error';

interface UploadItem {
  file: File;
  parsed?: ParsedFile;
  status: FileStatus;
  error?: string;
  dbId?: string;
  selectedSheet?: string;
}

const formatBytes = (b: number) =>
  b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

// ─────────────────────────────────────────────
// Health Badge
// ─────────────────────────────────────────────

const HealthBadge: React.FC<{ score: number }> = ({ score }) => {
  const { color, label, Icon } =
    score >= 80 ? { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: `Salud ${score}%`, Icon: ShieldCheck }
    : score >= 60 ? { color: 'text-vizme-orange bg-vizme-orange/5 border-vizme-orange/30', label: `Salud ${score}%`, Icon: AlertTriangle }
    : { color: 'text-vizme-red bg-vizme-red/5 border-vizme-red/30', label: `Salud ${score}%`, Icon: AlertCircle };

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold border px-2 py-0.5 rounded-full ${color}`}>
      <Icon size={10} />{label}
    </span>
  );
};

// ─────────────────────────────────────────────
// Health Report
// ─────────────────────────────────────────────

const HealthReport: React.FC<{ issues: HealthIssue[]; score: number }> = ({ issues, score }) => {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mt-3">
        <ShieldCheck size={13} />
        <span className="font-medium">Archivo sin problemas detectados — listo para análisis.</span>
      </div>
    );
  }

  const severityMeta: Record<string, { color: string; Icon: typeof AlertCircle }> = {
    error:   { color: 'text-vizme-red',    Icon: AlertCircle },
    warning: { color: 'text-vizme-orange', Icon: AlertTriangle },
    info:    { color: 'text-vizme-greyblue', Icon: Info },
  };

  return (
    <div className="mt-3 rounded-xl border border-vizme-navy/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-vizme-bg border-b border-vizme-navy/5">
        <p className="text-[10px] font-bold text-vizme-navy uppercase tracking-wide flex items-center gap-1.5">
          <Layers size={10} />Reporte de salud del archivo
        </p>
        <HealthBadge score={score} />
      </div>
      <div className="divide-y divide-vizme-navy/5">
        {issues.map((issue, i) => {
          const { color, Icon } = severityMeta[issue.severity] ?? severityMeta.info;
          return (
            <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
              <Icon size={13} className={`flex-shrink-0 mt-0.5 ${color}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${color}`}>{issue.detail}</p>
                {issue.autoFixable && (
                  <p className="text-[10px] text-vizme-greyblue mt-0.5">
                    Vizme puede normalizar esto automáticamente durante el análisis.
                  </p>
                )}
              </div>
              {issue.severity === 'error' && (
                <span className="text-[9px] font-bold uppercase text-vizme-red border border-vizme-red/30 bg-vizme-red/5 px-1.5 py-0.5 rounded-full flex-shrink-0">error</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Sheet Selector
// ─────────────────────────────────────────────

const SheetSelector: React.FC<{
  sheets: SheetInfo[];
  selected: string;
  onChange: (name: string) => void;
}> = ({ sheets, selected, onChange }) => {
  if (sheets.length <= 1) return null;
  return (
    <div className="mt-3">
      <label className="block text-[10px] font-semibold text-vizme-navy uppercase tracking-wide mb-1.5 flex items-center gap-1">
        <Layers size={10} />
        {sheets.length} hojas detectadas — selecciona cuál procesar
      </label>
      <div className="relative">
        <select
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-vizme-navy/10 bg-vizme-bg px-3 py-2 pr-8 text-xs text-vizme-navy focus:border-vizme-red focus:outline-none focus:ring-2 focus:ring-vizme-red/20 transition-all"
        >
          {sheets.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} {s.estimatedRows > 0 ? `— ~${s.estimatedRows.toLocaleString()} filas` : ''}
            </option>
          ))}
        </select>
        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-vizme-greyblue pointer-events-none" />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export interface UploadedResult {
  dataProfile: DataProfile;
  rows: Record<string, unknown>[];
}

interface FileDropzoneProps {
  onFileUploaded?: (result?: UploadedResult) => void;
  /** @deprecated use onFileUploaded */
  onUploaded?: (result?: UploadedResult) => void;
  projectId?: string;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ onFileUploaded, onUploaded, projectId }) => {
  const _onUploaded = onFileUploaded ?? onUploaded;
  const { user } = useAuth();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const updateItem = (file: File, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((it) => it.file === file ? { ...it, ...patch } : it));

  // ── Drop ─────────────────────────────────────

  const onDrop = useCallback(async (accepted: File[]) => {
    const newItems: UploadItem[] = accepted.map((f) => ({ file: f, status: 'parsing' }));
    setItems((prev) => [...prev, ...newItems]);

    for (const item of newItems) {
      try {
        const parsed = await parseFile(item.file);
        updateItem(item.file, { parsed, status: 'ready', selectedSheet: parsed.selectedSheet });
      } catch (err) {
        updateItem(item.file, { status: 'error', error: (err as Error).message });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSheetChange = async (item: UploadItem, sheetName: string) => {
    updateItem(item.file, { status: 'parsing', selectedSheet: sheetName });
    try {
      const parsed = await parseFile(item.file, sheetName);
      updateItem(item.file, { parsed, status: 'ready', selectedSheet: sheetName });
    } catch (err) {
      updateItem(item.file, { status: 'error', error: (err as Error).message });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/csv': ['.csv'],
    },
    maxSize: 50 * 1024 * 1024,
    onDropRejected: (rej) => alert(`Archivos rechazados: ${rej.map((r) => r.file.name).join(', ')}\nSolo .xlsx, .xls, .csv hasta 50 MB.`),
  });

  // ── Upload ────────────────────────────────────

  const handleUpload = async (item: UploadItem) => {
    if (!user || !item.parsed) return;
    updateItem(item.file, { status: 'uploading' });
    try {
      const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${user.id}/${Date.now()}_${safeName}`;

      const { error: storageError } = await supabase.storage.from('uploads').upload(storagePath, item.file);
      if (storageError) throw storageError;

      // Compute profile once for DB + callback
      const dataProfile = inferDataProfile(item.parsed.rows, item.parsed.headers);
      const rows = item.parsed.rows;

      // Try insert with data_profile column; fall back without it if column doesn't exist yet
      let insertId: string | undefined;
      const basePayload: Record<string, unknown> = {
        user_id: user.id,
        file_name: item.file.name,
        file_size: item.file.size,
        storage_path: storagePath,
        headers: item.parsed.headers,
        row_count: item.parsed.rowCount,
        preview: rows.slice(0, 500),
        status: 'ready',
        ...(projectId ? { project_id: projectId } : {}),
      };

      const { data: d1, error: e1 } = await supabase
        .from('uploads')
        .insert({ ...basePayload, data_profile: dataProfile })
        .select('id')
        .single();

      if (!e1) {
        insertId = d1.id;
      } else {
        // Column may not exist yet — retry without it
        const { data: d2, error: e2 } = await supabase
          .from('uploads')
          .insert(basePayload)
          .select('id')
          .single();
        if (e2) throw e2;
        insertId = d2.id;
      }

      updateItem(item.file, { status: 'done', dbId: insertId });
      _onUploaded?.({ dataProfile, rows });
    } catch (err) {
      updateItem(item.file, { status: 'error', error: (err as Error).message });
    }
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    if (previewId === idx) setPreviewId(null);
  };

  // ── Render ────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-vizme-red bg-vizme-red/5 scale-[1.01]'
            : 'border-vizme-navy/20 hover:border-vizme-red/40 bg-white'
        }`}
      >
        <input {...getInputProps()} />
        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-colors ${isDragActive ? 'bg-vizme-red/10 border border-vizme-red/30' : 'bg-vizme-bg border border-vizme-navy/10'}`}>
          <Upload size={22} className={isDragActive ? 'text-vizme-red' : 'text-vizme-greyblue'} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-vizme-navy">
            {isDragActive ? '¡Suelta aquí!' : 'Arrastra tu archivo aquí'}
          </p>
          <p className="text-xs text-vizme-greyblue mt-1">Excel (.xlsx, .xls) o CSV — máx. 50 MB</p>
        </div>
        <span className="text-xs font-medium text-vizme-red border border-vizme-red/30 bg-vizme-red/5 px-4 py-2 rounded-full">
          o haz clic para seleccionar
        </span>
      </div>

      {/* File list */}
      {items.map((item, idx) => (
        <div key={idx} className="bg-white rounded-2xl border border-vizme-navy/5 p-4 shadow-sm">

          {/* Header row */}
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-vizme-bg border border-vizme-navy/10 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet size={16} className="text-vizme-greyblue" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-vizme-navy truncate">{item.file.name}</p>
              <p className="text-xs text-vizme-greyblue mt-0.5">
                {formatBytes(item.file.size)}
                {item.parsed && <> · <strong className="text-vizme-navy">{item.parsed.rowCount.toLocaleString()}</strong> filas · <strong className="text-vizme-navy">{item.parsed.headers.length}</strong> cols</>}
                {(item.parsed?.sheets?.length ?? 0) > 1 && <> · <strong className="text-vizme-navy">{item.parsed!.sheets.length}</strong> hojas</>}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {(item.status === 'parsing' || item.status === 'uploading') && <Loader2 size={15} className="text-vizme-red animate-spin" />}
              {item.status === 'done' && <CheckCircle2 size={15} className="text-emerald-500" />}
              {item.status === 'error' && <AlertCircle size={15} className="text-vizme-red" />}

              {item.status === 'ready' && (
                <>
                  <button onClick={() => setPreviewId(previewId === idx ? null : idx)}
                    className="text-vizme-greyblue border border-vizme-navy/10 p-1.5 rounded-lg hover:border-vizme-navy/20 transition-colors">
                    {previewId === idx ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button onClick={() => handleUpload(item)}
                    className="text-xs font-semibold text-white bg-vizme-red px-3 py-1.5 rounded-lg hover:bg-vizme-orange transition-colors">
                    Subir
                  </button>
                </>
              )}
              {item.status === 'done' && (
                <button onClick={() => setPreviewId(previewId === idx ? null : idx)}
                  className="text-vizme-greyblue border border-vizme-navy/10 p-1.5 rounded-lg hover:border-vizme-navy/20 transition-colors">
                  {previewId === idx ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
              {item.status !== 'uploading' && item.status !== 'parsing' && (
                <button onClick={() => removeItem(idx)} className="text-vizme-greyblue hover:text-vizme-red transition-colors p-0.5">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {item.status === 'error' && item.error && (
            <p className="mt-2 text-xs text-vizme-red bg-vizme-red/5 rounded-lg px-3 py-2 border border-vizme-red/10">{item.error}</p>
          )}

          {/* Sheet selector */}
          {item.parsed && item.status !== 'error' && (
            <SheetSelector
              sheets={item.parsed.sheets}
              selected={item.selectedSheet ?? item.parsed.selectedSheet}
              onChange={(name) => handleSheetChange(item, name)}
            />
          )}

          {/* Column chips */}
          {item.parsed && item.status !== 'error' && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.parsed.headers.slice(0, 8).map((h) => (
                <span key={h} className="text-[10px] bg-vizme-bg text-vizme-greyblue border border-vizme-navy/5 px-2 py-0.5 rounded-full">{h}</span>
              ))}
              {item.parsed.headers.length > 8 && (
                <span className="text-[10px] text-vizme-greyblue">+{item.parsed.headers.length - 8} más</span>
              )}
            </div>
          )}

          {/* Health report */}
          {item.parsed && item.status !== 'error' && (
            <HealthReport issues={item.parsed.health.issues} score={item.parsed.health.score} />
          )}

          {/* Preview table */}
          {previewId === idx && item.parsed && (
            <div className="mt-4 rounded-xl border border-vizme-navy/5 overflow-hidden">
              <div className="px-3 py-2 bg-vizme-bg border-b border-vizme-navy/5">
                <p className="text-[10px] font-semibold text-vizme-navy uppercase tracking-wide">
                  Preview — hoja "{item.selectedSheet ?? item.parsed.selectedSheet}" · primeras {item.parsed.preview.length} filas
                </p>
              </div>
              <div className="overflow-x-auto max-h-56">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-vizme-navy/5">
                      {item.parsed.headers.map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-vizme-navy whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {item.parsed.preview.map((row, ri) => (
                      <tr key={ri} className="border-b border-vizme-navy/5 last:border-0 hover:bg-vizme-bg/50 transition-colors">
                        {item.parsed!.headers.map((h) => (
                          <td key={h} className="px-3 py-2 text-vizme-greyblue whitespace-nowrap max-w-[160px] truncate" title={String(row[h] ?? '')}>
                            {String(row[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FileDropzone;
