// Tarjeta editorial para 1 insight narrativo de Sonnet.
// Tipos: opportunity (verde), risk (rojo), trend (azul), anomaly (naranja).

import { TrendingUp, AlertTriangle, Activity, Sparkles } from 'lucide-react';
import type { Insight } from '../../lib/v5types';

const TYPE_STYLES: Record<
  string,
  { bg: string; border: string; text: string; iconBg: string; icon: typeof TrendingUp; label: string }
> = {
  opportunity: {
    bg: 'bg-emerald-50/80',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    iconBg: 'bg-emerald-500/15 text-emerald-700',
    icon: Sparkles,
    label: 'Oportunidad',
  },
  risk: {
    bg: 'bg-rose-50/80',
    border: 'border-rose-200',
    text: 'text-rose-900',
    iconBg: 'bg-rose-500/15 text-rose-700',
    icon: AlertTriangle,
    label: 'Riesgo',
  },
  trend: {
    bg: 'bg-vizme-navy/5',
    border: 'border-vizme-navy/15',
    text: 'text-vizme-navy',
    iconBg: 'bg-vizme-navy/10 text-vizme-navy',
    icon: TrendingUp,
    label: 'Tendencia',
  },
  anomaly: {
    bg: 'bg-vizme-orange/10',
    border: 'border-vizme-orange/30',
    text: 'text-vizme-navy',
    iconBg: 'bg-vizme-orange/20 text-vizme-orange',
    icon: Activity,
    label: 'Anomalía',
  },
};

export default function InsightCard({ insight }: { insight: Insight }) {
  const style = TYPE_STYLES[insight.type] ?? TYPE_STYLES.trend;
  const Icon = style.icon;

  return (
    <article
      className={[
        'rounded-3xl border p-6 backdrop-blur transition-all hover:-translate-y-0.5',
        style.bg,
        style.border,
      ].join(' ')}
    >
      <div className="flex items-start gap-4">
        <span
          className={['grid h-10 w-10 shrink-0 place-items-center rounded-xl', style.iconBg].join(' ')}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-vizme-greyblue">
              {style.label}
            </span>
            {insight.priority <= 2 && (
              <span className="rounded-full bg-vizme-coral/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-vizme-coral">
                Prioritario
              </span>
            )}
          </div>
          <h3 className={['font-display text-xl font-light tracking-editorial', style.text].join(' ')}>
            {insight.title}
          </h3>
          <p className={['text-sm leading-relaxed text-pretty', style.text, 'opacity-90'].join(' ')}>
            {insight.content}
          </p>
        </div>
      </div>
    </article>
  );
}
