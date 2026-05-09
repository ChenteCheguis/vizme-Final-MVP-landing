// Sprint 4.3 P3 — Tooltip rico estilo PBI/Tableau para Recharts.
// Recibe `payload` y un mapa metric_id → Metric para formatear cada
// línea según el `format` declarado (currency / percent / number /
// duration). Si la métrica trae change_percent, lo dibuja con flecha.

import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { Metric } from '../../../lib/v5types';
import { formatMetricValue, formatChangePercent } from '../format';

interface RichTooltipProps extends TooltipProps<ValueType, NameType> {
  // metric_id → metadata para formatear correctamente.
  metrics?: Record<string, Metric | undefined>;
  // Para tooltips con un solo dataKey (BarChart/Donut/Treemap) — fuerza el
  // formato según esta métrica si los payloads no traen metric_id.
  defaultMetric?: Metric;
  // Optional contextual line abajo del valor.
  contextLine?: string;
  // Cuando hay change_percent disponible para mostrar (ej. en Donuts
  // donde el payload es un slice y queremos enseñar % del total).
  share?: { value: number; total: number } | null;
  // Formateador opcional del label superior — útil para fechas ISO.
  formatLabel?: (label: string | number | undefined) => string;
}

function ChangeArrow({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  const Icon = pct > 0.5 ? ArrowUp : pct < -0.5 ? ArrowDown : Minus;
  const cls =
    pct > 0.5
      ? 'text-emerald-600'
      : pct < -0.5
        ? 'text-rose-600'
        : 'text-vizme-greyblue';
  return (
    <span className={['inline-flex items-center gap-0.5 font-mono text-[11px]', cls].join(' ')}>
      <Icon size={11} />
      {formatChangePercent(pct)}
    </span>
  );
}

export function RichTooltip({
  active,
  payload,
  label,
  metrics,
  defaultMetric,
  contextLine,
  share,
  formatLabel,
}: RichTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const labelText =
    formatLabel && label !== undefined ? formatLabel(label) : label !== undefined ? String(label) : null;

  return (
    <div className="rounded-xl border border-vizme-navy/10 bg-white px-3.5 py-2.5 shadow-xl">
      {labelText && (
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-vizme-greyblue">
          {labelText}
        </p>
      )}
      <ul className="space-y-1">
        {payload.map((p, i) => {
          // Recharts pasa `dataKey` y `name`; cuando un widget seteó
          // dataKey = metric_id, lo usamos para mirar metadata.
          const dataKey = typeof p.dataKey === 'string' ? p.dataKey : undefined;
          const meta = (dataKey && metrics?.[dataKey]) || defaultMetric;
          const numValue = typeof p.value === 'number' ? p.value : Number(p.value ?? 0);
          const formatted = formatMetricValue(numValue, meta);
          const seriesLabel =
            typeof p.name === 'string' && p.name.length > 0
              ? p.name
              : meta?.name ?? 'Valor';

          return (
            <li key={i} className="flex items-center gap-2 text-xs">
              {p.color && (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: p.color }}
                />
              )}
              <span className="text-vizme-greyblue">{seriesLabel}</span>
              <span className="ml-auto font-mono font-semibold text-vizme-navy">{formatted}</span>
            </li>
          );
        })}
      </ul>
      {share && share.total > 0 && (
        <p className="mt-2 border-t border-vizme-navy/5 pt-1.5 text-[11px] text-vizme-greyblue">
          {((share.value / share.total) * 100).toFixed(1)}% del total
        </p>
      )}
      {contextLine && (
        <p className="mt-2 border-t border-vizme-navy/5 pt-1.5 text-[11px] text-vizme-greyblue">
          {contextLine}
        </p>
      )}
      {/* Cuando un widget pasa change_percent vía payload[0].payload */}
      {payload[0]?.payload?.change_percent !== undefined && (
        <p className="mt-1 text-[11px]">
          <ChangeArrow pct={payload[0].payload.change_percent as number} />
        </p>
      )}
    </div>
  );
}

// Formato amigable para fechas ISO yyyy-mm-dd → "21 oct 2023"
const MONTHS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

export function formatIsoDateLabel(iso: string | number | undefined): string {
  if (typeof iso !== 'string') return String(iso ?? '');
  // yyyy-mm-dd o yyyy-mm o yyyy
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(iso);
  if (!m) return iso;
  const year = m[1];
  const month = m[2] ? Number(m[2]) - 1 : null;
  const day = m[3] ? Number(m[3]) : null;
  if (day !== null && month !== null)
    return `${day} ${MONTHS_ES[month] ?? ''} ${year}`;
  if (month !== null) return `${MONTHS_ES[month] ?? ''} ${year}`;
  return year;
}
