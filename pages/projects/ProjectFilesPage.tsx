import { useCallback, useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import {
  UploadCloud,
  Loader2,
  Calendar,
  Database,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import IngestModal from '../../components/ingest/IngestModal';
import type { BusinessSchema } from '../../lib/v5types';
import type { ProjectOutletContext } from '../../components/layout/ProjectLayout';

interface FileRow {
  id: string;
  file_name: string;
  uploaded_at: string;
  file_size_bytes: number | null;
  processed_at: string | null;
  storage_path: string | null;
  rows_extracted?: number;
}

export default function ProjectFilesPage() {
  const { id } = useParams<{ id: string }>();
  const { project } = useOutletContext<ProjectOutletContext>();
  const [schema, setSchema] = useState<BusinessSchema | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteCandidate, setDeleteCandidate] = useState<FileRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: fileRows } = await supabase
      .from('files')
      .select('id, file_name, uploaded_at, file_size_bytes, processed_at, storage_path')
      .eq('project_id', id)
      .order('uploaded_at', { ascending: false });

    const { data: schemaRows } = await supabase
      .from('business_schemas')
      .select('*')
      .eq('project_id', id)
      .order('version', { ascending: false })
      .limit(1);

    const fileIds = (fileRows ?? []).map((f) => f.id);
    let countsByFile = new Map<string, number>();
    if (fileIds.length > 0) {
      const { data: counts } = await supabase
        .from('time_series_data')
        .select('source_file_id')
        .eq('project_id', id)
        .in('source_file_id', fileIds);
      for (const r of counts ?? []) {
        const k = r.source_file_id as string;
        countsByFile.set(k, (countsByFile.get(k) ?? 0) + 1);
      }
    }

    setFiles(
      ((fileRows ?? []) as FileRow[]).map((f) => ({
        ...f,
        rows_extracted: countsByFile.get(f.id) ?? 0,
      }))
    );
    setSchema((schemaRows?.[0] as unknown as BusinessSchema) ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll, reloadKey]);

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleDelete = async () => {
    if (!deleteCandidate || !id) return;
    setDeleting(true);
    try {
      // 1. Storage (best-effort; if it fails the row delete still proceeds)
      if (deleteCandidate.storage_path) {
        await supabase.storage
          .from('user-files')
          .remove([deleteCandidate.storage_path]);
      }

      // 2. Files row (cascade limpia time_series_data)
      const { error: delErr } = await supabase
        .from('files')
        .delete()
        .eq('id', deleteCandidate.id);
      if (delErr) throw new Error(delErr.message);

      // 3. Recalc métricas
      await supabase.functions.invoke('analyze-data', {
        body: { mode: 'recalculate_metrics', project_id: id },
      });

      setToast('Archivo eliminado y métricas actualizadas.');
      setDeleteCandidate(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setToast(`No pudimos eliminar: ${(err as Error).message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Header */}
      <header>
        <p className="label-eyebrow">Archivos</p>
        <h1 className="mt-2 font-display text-5xl font-light leading-[1.05] tracking-editorial text-vizme-navy lg:text-6xl text-balance">
          Tus datos
        </h1>
        <p className="mt-3 max-w-2xl text-vizme-greyblue text-pretty">
          Histórico de uploads de {project.name}. Cada archivo nutre tu dashboard.
        </p>
      </header>

      {/* CTA */}
      <section className="rounded-3xl border border-vizme-coral/30 bg-gradient-to-br from-vizme-coral/8 to-white p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-2xl font-light text-vizme-navy">
              Sube nueva data al proyecto
            </p>
            <p className="mt-1 text-sm text-vizme-greyblue">
              Excel o CSV. Aplicamos el schema existente para extraer cada métrica.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIngestOpen(true)}
            disabled={!schema}
            className="inline-flex items-center gap-2 rounded-full bg-vizme-coral px-5 py-2.5 text-sm font-medium text-white shadow-glow-coral transition-all hover:-translate-y-0.5 hover:bg-vizme-orange disabled:opacity-50"
          >
            <UploadCloud size={15} />
            Subir nuevo archivo
          </button>
        </div>
      </section>

      {/* Files history */}
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-3xl font-light tracking-editorial text-vizme-navy">
            Historial de archivos
          </h2>
          <span className="text-xs uppercase tracking-[0.14em] text-vizme-greyblue">
            {files.length} archivo{files.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-vizme-navy/8 bg-white/70 p-8 text-center">
            <Loader2 size={18} className="mx-auto animate-spin text-vizme-coral" />
            <p className="mt-2 text-sm text-vizme-greyblue">Cargando archivos…</p>
          </div>
        ) : files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-vizme-navy/15 bg-white/40 p-10 text-center">
            <p className="font-display text-xl font-light text-vizme-navy">
              Sin archivos todavía
            </p>
            <p className="mt-2 text-sm text-vizme-greyblue">
              Sube tu primer archivo arriba para comenzar.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-vizme-navy/8 bg-white/85 backdrop-blur">
              <table className="w-full text-sm">
                <thead className="bg-vizme-bg/40">
                  <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-vizme-greyblue">
                    <th className="px-5 py-3 font-medium">Archivo</th>
                    <th className="px-5 py-3 font-medium">Tamaño</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Filas extraídas</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-vizme-navy/5">
                  {files.map((f) => (
                    <tr key={f.id} className="transition-colors hover:bg-vizme-bg/40">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-vizme-navy/5 text-vizme-navy">
                            <Database size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-vizme-navy">
                              {f.file_name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-vizme-greyblue">
                        {f.file_size_bytes
                          ? `${(f.file_size_bytes / (1024 * 1024)).toFixed(2)} MB`
                          : '—'}
                      </td>
                      <td className="px-5 py-4 text-xs text-vizme-greyblue">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar size={11} />
                          {new Date(f.uploaded_at).toLocaleDateString('es-MX', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-vizme-navy">
                        {(f.rows_extracted ?? 0).toLocaleString('es-MX')}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={[
                            'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                            f.processed_at
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-vizme-coral/10 text-vizme-coral',
                          ].join(' ')}
                        >
                          {f.processed_at ? 'Procesado' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteCandidate(f)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-vizme-greyblue transition-colors hover:bg-rose-50 hover:text-rose-600"
                          title="Eliminar archivo"
                        >
                          <Trash2 size={13} />
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {files.length === 1 && (
              <p className="text-xs text-vizme-greyblue">
                Sube más archivos para enriquecer tu análisis. Cada nueva carga
                actualiza tu dashboard.
              </p>
            )}
          </>
        )}
      </section>

      {/* Ingest modal */}
      {schema && id && (
        <IngestModal
          open={ingestOpen}
          onClose={() => setIngestOpen(false)}
          projectId={id}
          schema={schema}
          onCompleted={() => setReloadKey((k) => k + 1)}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-vizme-navy/40 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteCandidate(null)}
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white p-7 shadow-editorial animate-scale-in">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-2xl font-light tracking-editorial text-vizme-navy">
                  ¿Eliminar este archivo?
                </h3>
                <p className="mt-2 text-sm text-vizme-greyblue text-pretty">
                  Vamos a borrar <span className="font-medium text-vizme-navy">{deleteCandidate.file_name}</span>{' '}
                  y los <span className="font-mono">{(deleteCandidate.rows_extracted ?? 0).toLocaleString('es-MX')}</span>{' '}
                  registros que extrajimos. Tu dashboard se actualizará automáticamente.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                disabled={deleting}
                className="rounded-full px-4 py-2 text-sm text-vizme-greyblue transition-colors hover:text-vizme-navy disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {deleting ? 'Eliminando…' : 'Eliminar permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-scale-in">
          <div className="flex items-start gap-3 rounded-2xl border border-vizme-navy/8 bg-white p-4 shadow-card">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
            <p className="flex-1 text-sm text-vizme-navy">{toast}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-vizme-greyblue hover:text-vizme-navy"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
