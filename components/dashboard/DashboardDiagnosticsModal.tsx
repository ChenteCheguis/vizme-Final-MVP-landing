// ============================================================
// VIZME V5 — Dashboard Diagnostics Modal (Sprint 4.2)
//
// Cuando health=no_data o el usuario clickea "Ver detalles" en
// banner partial/limited, mostramos un modal con:
//   - Listado de métricas faltantes
//   - Razones técnicas (warnings del ingestEngine)
//   - Acciones sugeridas (subir nuevo archivo, reintentar)
// ============================================================

import { X, FileX, Lightbulb, RefreshCw, UploadCloud, Loader2 } from 'lucide-react';
import type { DashboardHealth } from '../../lib/dashboardHealth';

export interface DashboardDiagnosticsModalProps {
  open: boolean;
  onClose: () => void;
  health: Pick<DashboardHealth, 'status' | 'details'>;
  onRetry?: () => void;
  onUpload?: () => void;
  retrying?: boolean;
}

export default function DashboardDiagnosticsModal({
  open,
  onClose,
  health,
  onRetry,
  onUpload,
  retrying,
}: DashboardDiagnosticsModalProps) {
  if (!open) return null;

  const { details, status } = health;
  const missing = details.missing_metric_names ?? [];
  const reasons = details.reasons ?? [];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-vizme-navy/40 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-vizme-greyblue transition-all hover:bg-vizme-bg hover:text-vizme-navy"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        <header className="mb-6">
          <p className="label-eyebrow">Diagnóstico</p>
          <h2 className="mt-1 font-display text-3xl font-light tracking-editorial text-vizme-navy">
            ¿Por qué tu dashboard no está completo?
          </h2>
          <p className="mt-2 text-sm text-vizme-greyblue text-pretty">
            Analizamos tu archivo y solo pudimos extraer{' '}
            <strong className="text-vizme-navy">
              {details.extracted} de {details.total} métricas
            </strong>{' '}
            ({details.percent}%).
          </p>
        </header>

        {/* Métricas faltantes */}
        {missing.length > 0 && (
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <FileX size={16} className="text-rose-500" />
              <h3 className="font-display text-base font-medium text-vizme-navy">
                Métricas que no encontramos
              </h3>
            </div>
            <ul className="space-y-1.5">
              {missing.map((name) => (
                <li
                  key={name}
                  className="rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2 text-sm text-rose-900"
                >
                  {name}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Razones técnicas */}
        {reasons.length > 0 && (
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb size={16} className="text-amber-500" />
              <h3 className="font-display text-base font-medium text-vizme-navy">
                Razones técnicas
              </h3>
            </div>
            <ul className="space-y-1.5">
              {reasons.map((r, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-amber-100 bg-amber-50/40 px-3 py-2 text-sm text-amber-900"
                >
                  {r}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Acciones sugeridas */}
        <section className="rounded-2xl border border-vizme-coral/20 bg-vizme-coral/5 p-4">
          <h3 className="font-display text-base font-medium text-vizme-navy">
            ¿Qué puedes hacer?
          </h3>
          <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-vizme-navy">
            <li>
              Sube un archivo con columnas que correspondan a las métricas faltantes
              (ej. una columna llamada exactamente como la métrica).
            </li>
            <li>
              Si tu archivo ya tiene esas columnas, intenta reextraer — a veces el
              cambio de un encabezado ambiguo basta.
            </li>
            {status === 'no_data' && (
              <li>
                Verifica que tu archivo tenga al menos 1 columna de fecha y 1 de valor numérico.
              </li>
            )}
          </ol>

          <div className="mt-4 flex flex-wrap gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="inline-flex items-center gap-2 rounded-full bg-vizme-navy px-4 py-2 text-sm text-white transition-all hover:bg-vizme-coral disabled:opacity-50"
              >
                {retrying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {retrying ? 'Reintentando…' : 'Reintentar extracción'}
              </button>
            )}
            {onUpload && (
              <button
                type="button"
                onClick={onUpload}
                className="inline-flex items-center gap-2 rounded-full border border-vizme-navy/15 bg-white px-4 py-2 text-sm text-vizme-navy transition-all hover:border-vizme-coral hover:text-vizme-coral"
              >
                <UploadCloud size={14} />
                Subir archivo nuevo
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
