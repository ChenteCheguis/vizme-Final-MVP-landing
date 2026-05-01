// KPI widgets: kpi_hero, kpi_card, sparkline.
// Editorial: número grande con tipografía display, cambio porcentual con
// flecha direccional, sparkline embebido para hero.

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { formatMetricValue, formatChangePercent, getColorScheme } from '../format';
import { WidgetShell, EmptyWidget } from './WidgetShell';
import type { WidgetRenderProps } from './widgetTypes';

function ChangeBadge({
  pct,
  dir,
}: {
  pct: number | null | undefined;
  dir: 'up' | 'down' | 'neutral' | null | undefined;
}) {
  if (pct === null || pct === undefined) return null;
  const isUp = dir === 'up';
  const isDown = dir === 'down';
  const Icon = isUp ? ArrowUp : isDown ? ArrowDown : Minus;
  const cls = isUp
    ? 'bg-emerald-100 text-emerald-700'
    : isDown
      ? 'bg-rose-100 text-rose-700'
      : 'bg-vizme-navy/10 text-vizme-greyblue';
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-xs font-medium',
        cls,
      ].join(' ')}
    >
      <Icon size={12} />
      {formatChangePercent(pct)}
    </span>
  );
}

export function KpiHero({ widget, calcs, metrics, calcsAllTime }: WidgetRenderProps) {
  const metricId = widget.metric_ids[0];
  const calc = metricId ? calcs[metricId] : undefined;
  const metric = metricId ? metrics[metricId] : undefined;
  const value = calc?.value.value ?? null;
  const changePct = calc?.value.change_percent ?? null;
  const changeDir = calc?.value.change_direction ?? null;
  const series = calcsAllTime?.[metricId ?? '']?.value.time_series ?? calc?.value.time_series ?? [];
  const colors = getColorScheme(widget.chart_config.color_scheme);

  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle ?? metric?.name} insight={widget.insight}>
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <p className="font-display text-[clamp(2.5rem,5vw,4rem)] font-light leading-none tracking-tight text-vizme-navy">
            {formatMetricValue(value, metric)}
          </p>
          <div className="mt-3">
            <ChangeBadge pct={changePct} dir={changeDir} />
          </div>
        </div>
        {series && series.length > 1 && (
          <div className="h-16 w-full">
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={colors.primary}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}

export function KpiCard({ widget, calcs, metrics }: WidgetRenderProps) {
  const metricId = widget.metric_ids[0];
  const calc = metricId ? calcs[metricId] : undefined;
  const metric = metricId ? metrics[metricId] : undefined;
  const value = calc?.value.value ?? null;
  const changePct = calc?.value.change_percent ?? null;
  const changeDir = calc?.value.change_direction ?? null;

  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle ?? metric?.name} insight={widget.insight}>
      <div className="flex h-full flex-col justify-between">
        <p className="font-display text-3xl font-light tracking-tight text-vizme-navy">
          {formatMetricValue(value, metric)}
        </p>
        <div className="mt-3">
          <ChangeBadge pct={changePct} dir={changeDir} />
        </div>
      </div>
    </WidgetShell>
  );
}

export function SparklineWidget({ widget, calcs, calcsAllTime }: WidgetRenderProps) {
  const metricId = widget.metric_ids[0];
  const calc = metricId ? calcsAllTime?.[metricId] ?? calcs[metricId] : undefined;
  const series = calc?.value.time_series ?? [];
  const colors = getColorScheme(widget.chart_config.color_scheme);

  if (!series.length) {
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget />
      </WidgetShell>
    );
  }

  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="h-24 w-full">
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={colors.primary}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}
