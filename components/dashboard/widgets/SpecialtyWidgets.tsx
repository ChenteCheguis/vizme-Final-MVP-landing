import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  FunnelChart,
  Funnel,
  LabelList,
} from 'recharts';
import GaugeComponent from 'react-gauge-component';
import { formatCompactNumber, getColorScheme, formatMetricValue } from '../format';
import { WidgetShell, EmptyWidget } from './WidgetShell';
import type { WidgetRenderProps } from './widgetTypes';

export function ScatterChartWidget({ widget, calcs, calcsAllTime }: WidgetRenderProps) {
  const [xMid, yMid] = widget.metric_ids;
  const xCalc = xMid ? calcsAllTime?.[xMid] ?? calcs[xMid] : undefined;
  const yCalc = yMid ? calcsAllTime?.[yMid] ?? calcs[yMid] : undefined;
  const xs = xCalc?.value.time_series ?? [];
  const ys = yCalc?.value.time_series ?? [];
  const colors = getColorScheme(widget.chart_config.color_scheme);
  if (xs.length === 0 || ys.length === 0)
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget message="Necesitamos dos métricas con serie temporal para correlacionar." />
      </WidgetShell>
    );
  const yByDate = new Map(ys.map((p) => [p.date, p.value]));
  const points = xs
    .filter((p) => yByDate.has(p.date))
    .map((p) => ({ x: p.value, y: yByDate.get(p.date)! }));
  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="x" type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis dataKey="y" type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip />
            <Scatter data={points} fill={colors.primary} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}

export function GaugeWidget({ widget, calcs, metrics }: WidgetRenderProps) {
  const metricId = widget.metric_ids[0];
  const calc = metricId ? calcs[metricId] : undefined;
  const metric = metricId ? metrics[metricId] : undefined;
  const value = calc?.value.value ?? null;
  if (value === null)
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget />
      </WidgetShell>
    );
  const range = metric?.expected_range ?? { min: 0, max: Math.max(value * 1.5, 100) };
  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="grid h-full place-items-center">
        <GaugeComponent
          type="semicircle"
          value={value}
          minValue={range.min}
          maxValue={range.max}
          arc={{
            colorArray: ['#ef4444', '#f59e0b', '#10b981'],
            subArcs: [{ limit: range.max * 0.4 }, { limit: range.max * 0.7 }, {}],
            padding: 0.02,
            width: 0.2,
          }}
          labels={{
            valueLabel: { formatTextValue: () => formatMetricValue(value, metric) },
          }}
        />
      </div>
    </WidgetShell>
  );
}

export function RadialBarWidget({ widget, calcs, metrics }: WidgetRenderProps) {
  const metricId = widget.metric_ids[0];
  const calc = metricId ? calcs[metricId] : undefined;
  const metric = metricId ? metrics[metricId] : undefined;
  const value = calc?.value.value ?? null;
  const colors = getColorScheme(widget.chart_config.color_scheme);
  if (value === null)
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget />
      </WidgetShell>
    );
  const target = metric?.expected_range?.max ?? value * 1.25;
  const data = [{ name: 'progreso', value, fill: colors.primary }];
  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="grid h-72 place-items-center">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="60%" outerRadius="95%" data={data} startAngle={180} endAngle={0}>
            <RadialBar dataKey="value" background cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
        <p className="-mt-24 font-display text-3xl font-light text-vizme-navy">
          {formatMetricValue(value, metric)}
        </p>
        <p className="text-[10px] uppercase tracking-[0.16em] text-vizme-greyblue">
          Meta: {formatCompactNumber(target)}
        </p>
      </div>
    </WidgetShell>
  );
}

export function FunnelChartWidget({ widget, calcs }: WidgetRenderProps) {
  const metricId = widget.metric_ids[0];
  const calc = metricId ? calcs[metricId] : undefined;
  const dimId = widget.dimension_ids[0];
  const bd = calc?.value.breakdown_by_dimension ?? {};
  const target = (dimId ? bd[dimId] : undefined) ?? Object.values(bd)[0] ?? [];
  const colors = getColorScheme(widget.chart_config.color_scheme);
  if (target.length === 0)
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget />
      </WidgetShell>
    );
  const data = target.slice(0, 6).map((b, i) => ({
    name: b.key,
    value: b.value,
    fill: colors.palette[i % colors.palette.length],
  }));
  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <FunnelChart>
            <Tooltip />
            <Funnel dataKey="value" data={data} isAnimationActive={false}>
              <LabelList position="right" fill="#374151" stroke="none" dataKey="name" />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}

export function HeatmapGridWidget({ widget, calcs, metrics }: WidgetRenderProps) {
  const colors = getColorScheme(widget.chart_config.color_scheme);
  const dimId = widget.dimension_ids[0];

  const series = widget.metric_ids
    .map((mid) => {
      const calc = calcs[mid];
      const bd = calc?.value.breakdown_by_dimension ?? {};
      const target = (dimId ? bd[dimId] : undefined) ?? Object.values(bd)[0] ?? [];
      return {
        metricId: mid,
        name: metrics[mid]?.name ?? mid,
        breakdown: target,
      };
    })
    .filter((s) => s.breakdown.length > 0);

  if (series.length === 0) {
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget message="Aún no hay categorías con suficientes datos para construir el mapa." />
      </WidgetShell>
    );
  }

  if (series.length >= 2) {
    const categoryTotals = new Map<string, number>();
    for (const s of series) {
      for (const b of s.breakdown) {
        categoryTotals.set(b.key, (categoryTotals.get(b.key) ?? 0) + b.value);
      }
    }
    const rows = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([key]) => key);
    const maxByMetric = new Map(
      series.map((s) => [s.metricId, Math.max(...s.breakdown.map((b) => b.value), 1)])
    );

    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-medium uppercase tracking-[0.16em] text-vizme-greyblue" />
                {series.map((s) => (
                  <th
                    key={s.metricId}
                    className="px-2 py-1 text-left text-[10px] font-medium uppercase tracking-[0.16em] text-vizme-greyblue"
                  >
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cat) => (
                <tr key={cat}>
                  <th className="pr-3 text-right text-[11px] font-medium text-vizme-navy">
                    {cat}
                  </th>
                  {series.map((s) => {
                    const point = s.breakdown.find((b) => b.key === cat);
                    const v = point?.value ?? 0;
                    const ratio = v / (maxByMetric.get(s.metricId) ?? 1);
                    return (
                      <td
                        key={s.metricId}
                        className="rounded-lg px-3 py-2 text-center font-mono"
                        style={{
                          background: colors.primary,
                          opacity: v === 0 ? 0.05 : 0.2 + ratio * 0.8,
                          color: ratio > 0.5 ? '#fff' : '#1e2a44',
                        }}
                      >
                        {v === 0 ? '—' : formatCompactNumber(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WidgetShell>
    );
  }

  const target = series[0].breakdown;
  const max = Math.max(...target.map((t) => t.value));
  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(80px,1fr))] gap-2">
        {target.slice(0, 24).map((t) => {
          const ratio = t.value / max;
          return (
            <div
              key={t.key}
              className="rounded-xl p-3 text-center"
              style={{
                background: colors.primary,
                opacity: 0.2 + ratio * 0.8,
                color: ratio > 0.5 ? '#fff' : '#1e2a44',
              }}
            >
              <p className="truncate text-[10px] font-medium uppercase tracking-wide">{t.key}</p>
              <p className="mt-1 font-mono text-sm">{formatCompactNumber(t.value)}</p>
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}

export function SankeyWidget({ widget, calcs }: WidgetRenderProps) {
  // Fallback elegante a una lista de flujos hasta que tengamos flow_data.
  const metricId = widget.metric_ids[0];
  const calc = metricId ? calcs[metricId] : undefined;
  const dimId = widget.dimension_ids[0];
  const bd = calc?.value.breakdown_by_dimension ?? {};
  const target = (dimId ? bd[dimId] : undefined) ?? Object.values(bd)[0] ?? [];
  const colors = getColorScheme(widget.chart_config.color_scheme);
  if (target.length === 0)
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget message="El diagrama de flujo se habilita cuando tengas datos de transición entre estados." />
      </WidgetShell>
    );
  const total = target.reduce((acc, t) => acc + t.value, 0);
  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <ul className="space-y-2">
        {target.slice(0, 8).map((t, i) => {
          const pct = (t.value / total) * 100;
          return (
            <li key={t.key} className="space-y-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-vizme-navy">{t.key}</span>
                <span className="font-mono text-vizme-greyblue">{pct.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-vizme-navy/5">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: colors.palette[i % colors.palette.length],
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}
