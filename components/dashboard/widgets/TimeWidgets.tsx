// Widgets temporales: line_chart, area_chart, composed_chart, heatmap_calendar.

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
import type { WidgetRenderProps } from './widgetTypes';

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

export function LineChartWidget({ widget, calcs, calcsAllTime, metrics }: WidgetRenderProps) {
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
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v) => formatCompactNumber(v)}
            />
            <Tooltip />
            {widget.chart_config.show_legend && <Legend />}
            {keys.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={colors.palette[i % colors.palette.length]}
                strokeWidth={2}
                dot={false}
                name={metricName(k, metrics)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}

export function AreaChartWidget({ widget, calcs, calcsAllTime, metrics }: WidgetRenderProps) {
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
          <AreaChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v) => formatCompactNumber(v)}
            />
            <Tooltip />
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
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v) => formatCompactNumber(v)}
            />
            <Tooltip />
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
