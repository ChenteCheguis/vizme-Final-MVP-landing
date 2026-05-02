// ============================================================
// VIZME V5 — Dashboard Health Banner (Sprint 4.2)
//
// 4 niveles editoriales:
//   complete → no banner (la vista normal cuenta como "todo bien")
//   partial  → amarillo, CTA "Reintentar extracción"
//   limited  → naranja, mismo CTA + tono más urgente
//   no_data  → rojo, CTA "Ver diagnóstico" + sugerir nuevo archivo
// ============================================================

import { AlertTriangle, AlertCircle, Info, Loader2, RefreshCw } from 'lucide-react';
import { healthCopy, type DashboardHealth } from '../../lib/dashboardHealth';

export interface DashboardHealthBannerProps {
  health: Pick<DashboardHealth, 'status' | 'details'>;
  onRetry?: () => void;
  onShowDiagnostics?: () => void;
  retrying?: boolean;
}

const VARIANT_CLASSES: Record<string, string> = {
  warning: 'border-amber-300 bg-amber-50/80 text-amber-900',
  caution: 'border-orange-300 bg-orange-50/80 text-orange-900',
  error: 'border-rose-300 bg-rose-50/80 text-rose-900',
};

const ICON_CLASSES: Record<string, string> = {
  warning: 'text-amber-600',
  caution: 'text-orange-600',
  error: 'text-rose-600',
};

function VariantIcon({ variant }: { variant: 'warning' | 'caution' | 'error' | string }) {
  const cls = ICON_CLASSES[variant] ?? 'text-vizme-greyblue';
  if (variant === 'error') return <AlertCircle size={20} className={cls} />;
  if (variant === 'caution') return <AlertTriangle size={20} className={cls} />;
  return <Info size={20} className={cls} />;
}

export default function DashboardHealthBanner({
  health,
  onRetry,
  onShowDiagnostics,
  retrying,
}: DashboardHealthBannerProps) {
  const copy = healthCopy(health);
  if (!copy.showBanner) return null;

  const variantCls = VARIANT_CLASSES[copy.variant] ?? 'border-vizme-navy/15 bg-white/70';

  const handleCta = () => {
    if (copy.variant === 'error') {
      onShowDiagnostics?.();
    } else {
      onRetry?.();
    }
  };

  return (
    <section
      className={[
        'flex flex-wrap items-start justify-between gap-4 rounded-2xl border-l-4 p-4 shadow-sm',
        variantCls,
      ].join(' ')}
      role={copy.variant === 'error' ? 'alert' : 'status'}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <VariantIcon variant={copy.variant} />
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-medium leading-tight">{copy.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-pretty">{copy.body}</p>
          {health.details.missing_metric_names.length > 0 && copy.variant !== 'error' && (
            <p className="mt-2 text-xs opacity-80">
              {health.details.percent}% extraído ·{' '}
              {health.details.extracted}/{health.details.total} métricas
            </p>
          )}
        </div>
      </div>

      {copy.cta && (onRetry || onShowDiagnostics) && (
        <button
          type="button"
          onClick={handleCta}
          disabled={retrying}
          className="inline-flex shrink-0 items-center gap-2 self-center rounded-full border border-current/30 bg-white/70 px-4 py-2 text-xs font-medium transition-all hover:bg-white disabled:opacity-50"
        >
          {retrying ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          {retrying ? 'Reintentando…' : copy.cta}
        </button>
      )}
    </section>
  );
}
