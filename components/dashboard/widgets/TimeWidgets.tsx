// Widgets temporales: line_chart, area_chart, composed_chart, heatmap_calendar.
// Sprint 4.3 P3 — drill-down temporal: click en un punto navega a un nivel
// más fino del path (year → month → day). El próximo nivel se infiere del
// prefijo ISO del punto clickeado.

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import { formatCompactNumber, getColorScheme } from '../format';
import { WidgetShell, EmptyWidget } from './WidgetShell';
import { RichTooltip, formatIsoDateLabel } from './RichTooltip';
import type { WidgetRenderProps } from './widgetTypes';
import {
  useOptionalDashboardFilters,
  type DrillStep,
  type DrillLevel,
} from '../../../contexts/DashboardFilterContext';

function mergeSeries(
  metricIds: string[],
  calcs: WidgetRenderProps['calcs'],
  calcsAllTime: WidgetRenderProps['calcsAllTime']
): { rows: Array<Record<string, number | string>>; keys: string[] } {
  const byDate = new Map<string, Record<string, number | string>>();
  const keys: string[] = [];
  for (const mid of metricIds) {
    const calc = calcsAllTime?.[mid] ?? calcs[mid];
    const series = calc?.value.time_series ?? [];
    if (series.length === 0) continue;
    keys.push(mid);
    for (const point of series) {
      if (!byDate.has(point.date)) byDate.set(point.date, { date: point.date });
      byDate.get(point.date)![mid] = point.value;
    }
  }
  const rows = Array.from(byDate.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
  return { rows, keys };
}

function metricName(id: string, metrics: WidgetRenderProps['metrics']): string {
  return metrics[id]?.name ?? id;
}

// Sprint 4.3 P3 — agrega rows por mes/año cuando el time_series viene en
// días pero el drill todavía está al nivel "year" o "month". Esto da una
// curva visualmente legible y un eje X clickeable sin saturarse.
function aggregateByLevel(
  rows: Array<Record<string, number | string>>,
  keys: string[],
  level: DrillLevel
): Array<Record<string, number | string>> {
  if (rows.length === 0) return rows;
  const sliceLen = level === 'year' ? 4 : level === 'month' ? 7 : 10;
  const buckets = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const date = String(r.date);
    const bucketKey = date.slice(0, sliceLen);
    if (!buckets.has(bucketKey)) {
      const empty: Record<string, number | string> = { date: bucketKey };
      for (const k of keys) empty[k] = 0;
      buckets.set(bucketKey, empty);
    }
    const target = buckets.get(bucketKey)!;
    for (const k of keys) {
      const v = Number(r[k]);
      if (Number.isFinite(v)) target[k] = (Number(target[k]) || 0) + v;
    }
  }
  return Array.from(buckets.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
}

function inferDrillStepFromClick(
  clickedDate: string,
  currentLevel: DrillLevel
): DrillStep | null {
  // year → month → day. (week/hour requieren columnas que no tenemos hoy.)
  if (currentLevel === 'year') {
    const m = /^(\d{4})$/.exec(clickedDate);
    if (!m) return null;
    return { level: 'year', value: m[1], label: m[1] };
  }
  if (currentLevel === 'month') {
    const m = /^(\d{4})-(\d{2})$/.exec(clickedDate);
    if (!m) return null;
    return { level: 'month', value: clickedDate, label: formatIsoDateLabel(clickedDate) };
  }
  // day-level click — ya estamos en granularidad final
  return null;
}

function deriveDisplayLevel(
  rows: Array<Record<string, number | string>>,
  drillPath: DrillStep[]
): DrillLevel {
  // Si ya hay un mes en el path, mostramos por día. Si hay un año, mostramos
  // por mes. Si no hay drill, mostramos por año cuando hay >18 meses; por mes
  // cuando hay >60 días; por día en otro caso.
  const last = drillPath[drillPath.length - 1];
  if (last?.level === 'month') return 'day';
  if (last?.level === 'year') return 'month';
  if (rows.length === 0) return 'day';
  const distinctMonths = new Set(rows.map((r) => String(r.date).slice(0, 7))).size;
  const distinctYears = new Set(rows.map((r) => String(r.date).slice(0, 4))).size;
  if (distinctYears > 1 && distinctMonths > 18) return 'year';
  if (distinctMonths > 6) return 'month';
  return 'day';
}

function NextLevelHint({ level }: { level: DrillLevel }) {
  const next =
    level === 'year' ? 'meses' : level === 'month' ? 'días' : null;
  if (!next) return null;
  return (
    <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-vizme-greyblue">
      Click en un punto para ver {next}
    </p>
  );
}

export function LineChartWidget({ widget, calcs, calcsAllTime, metrics }: WidgetRenderProps) {
  const { rows, keys } = mergeSeries(widget.metric_ids, calcs, calcsAllTime);
  const colors = getColorScheme(widget.chart_config.color_scheme);
  const filters = useOptionalDashboardFilters();
  const displayLevel = deriveDisplayLevel(rows, filters?.drillPath ?? []);
  const aggregated = aggregateByLevel(rows, keys, displayLevel);
  const interactive = !!filters && (displayLevel === 'year' || displayLevel === 'month');

  if (aggregated.length === 0)
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget />
      </WidgetShell>
    );

  const handleClick = interactive
    ? (entry: { activeLabel?: string | number; activePayload?: Array<{ payload: { date: string } }> }) => {
        const clicked =
          (entry?.activePayload?.[0]?.payload?.date as string | undefined) ??
          (typeof entry?.activeLabel === 'string' ? entry.activeLabel : null);
        if (!clicked) return;
        const step = inferDrillStepFromClick(clicked, displayLevel);
        if (step && filters) filters.drillDown(step);
      }
    : undefined;

  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart
            data={aggregated}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            onClick={handleClick}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v) => formatIsoDateLabel(String(v))}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v) => formatCompactNumber(v)}
            />
            <Tooltip
              content={(props) => (
                <RichTooltip
                  {...props}
                  metrics={metrics}
                  formatLabel={(l) => formatIsoDateLabel(l as string)}
                />
              )}
            />
            {widget.chart_config.show_legend && <Legend />}
            {keys.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={colors.palette[i % colors.palette.length]}
                strokeWidth={2}
                dot={interactive ? { r: 3 } : false}
                activeDot={{ r: 5 }}
                name={metricName(k, metrics)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {interactive && <NextLevelHint level={displayLevel} />}
    </WidgetShell>
  );
}

export function AreaChartWidget({ widget, calcs, calcsAllTime, metrics }: WidgetRenderProps) {
  const { rows, keys } = mergeSeries(widget.metric_ids, calcs, calcsAllTime);
  const colors = getColorScheme(widget.chart_config.color_scheme);
  const filters = useOptionalDashboardFilters();
  const displayLevel = deriveDisplayLevel(rows, filters?.drillPath ?? []);
  const aggregated = aggregateByLevel(rows, keys, displayLevel);
  const interactive = !!filters && (displayLevel === 'year' || displayLevel === 'month');

  if (aggregated.length === 0)
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget />
      </WidgetShell>
    );

  const handleClick = interactive
    ? (entry: { activeLabel?: string | number; activePayload?: Array<{ payload: { date: string } }> }) => {
        const clicked =
          (entry?.activePayload?.[0]?.payload?.date as string | undefined) ??
          (typeof entry?.activeLabel === 'string' ? entry.activeLabel : null);
        if (!clicked) return;
        const step = inferDrillStepFromClick(clicked, displayLevel);
        if (step && filters) filters.drillDown(step);
      }
    : undefined;

  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <AreaChart
            data={aggregated}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            onClick={handleClick}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
          >
            <defs>
              {keys.map((k, i) => (
                <linearGradient key={k} id={`grad-${widget.id}-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={colors.palette[i % colors.palette.length]}
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="100%"
                    stopColor={colors.palette[i % colors.palette.length]}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v) => formatIsoDateLabel(String(v))}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v) => formatCompactNumber(v)}
            />
            <Tooltip
              content={(props) => (
                <RichTooltip
                  {...props}
                  metrics={metrics}
                  formatLabel={(l) => formatIsoDateLabel(l as string)}
                />
              )}
            />
            {widget.chart_config.show_legend && <Legend />}
            {keys.map((k, i) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                stroke={colors.palette[i % colors.palette.length]}
                fill={`url(#grad-${widget.id}-${k})`}
                strokeWidth={2}
                name={metricName(k, metrics)}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {interactive && <NextLevelHint level={displayLevel} />}
    </WidgetShell>
  );
}

export function ComposedChartWidget({ widget, calcs, calcsAllTime, metrics }: WidgetRenderProps) {
  const { rows, keys } = mergeSeries(widget.metric_ids, calcs, calcsAllTime);
  const colors = getColorScheme(widget.chart_config.color_scheme);
  if (rows.length === 0)
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget />
      </WidgetShell>
    );
  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v) => formatIsoDateLabel(String(v))}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v) => formatCompactNumber(v)}
            />
            <Tooltip
              content={(props) => (
                <RichTooltip
                  {...props}
                  metrics={metrics}
                  formatLabel={(l) => formatIsoDateLabel(l as string)}
                />
              )}
            />
            {widget.chart_config.show_legend && <Legend />}
            {keys.map((k, i) =>
              i === 0 ? (
                <Bar
                  key={k}
                  dataKey={k}
                  fill={colors.palette[i % colors.palette.length]}
                  name={metricName(k, metrics)}
                  radius={[6, 6, 0, 0]}
                />
              ) : (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={colors.palette[i % colors.palette.length]}
                  strokeWidth={2}
                  dot={false}
                  name={metricName(k, metrics)}
                />
              )
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}

export function HeatmapCalendarWidget({ widget, calcs, calcsAllTime }: WidgetRenderProps) {
  const metricId = widget.metric_ids[0];
  const calc = metricId ? calcsAllTime?.[metricId] ?? calcs[metricId] : undefined;
  const series = calc?.value.time_series ?? [];

  if (series.length === 0)
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget />
      </WidgetShell>
    );

  const dates = series.map((p) => new Date(p.date));
  const startDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const endDate = new Date(Math.max(...dates.map((d) => d.getTime())));
  const max = Math.max(...series.map((p) => p.value));
  const values = series.map((p) => ({ date: p.date, count: p.value }));

  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="vizme-heatmap">
        <CalendarHeatmap
          startDate={startDate}
          endDate={endDate}
          values={values}
          classForValue={(v) => {
            if (!v || !v.count) return 'color-empty';
            const ratio = v.count / max;
            if (ratio > 0.75) return 'color-scale-4';
            if (ratio > 0.5) return 'color-scale-3';
            if (ratio > 0.25) return 'color-scale-2';
            return 'color-scale-1';
          }}
        />
      </div>
    </WidgetShell>
  );
}
