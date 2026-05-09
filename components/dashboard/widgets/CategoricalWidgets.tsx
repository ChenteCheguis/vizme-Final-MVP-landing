import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Treemap,
} from 'recharts';
import { formatCompactNumber, getColorScheme } from '../format';
import { WidgetShell, EmptyWidget } from './WidgetShell';
import { RichTooltip } from './RichTooltip';
import type { WidgetRenderProps } from './widgetTypes';
import { useOptionalDashboardFilters } from '../../../contexts/DashboardFilterContext';

// Sprint 4.3 P3 — handler de click compartido entre widgets categóricos.
// Al hacer click en una barra/segmento, hace toggle del filtro
// (dim, value) y los demás widgets reaccionan vía useFilteredMetrics.
function useCategoricalClick(widget: WidgetRenderProps['widget']) {
  const filters = useOptionalDashboardFilters();
  const dimensionId = widget.dimension_ids[0];
  const activeValue = filters && dimensionId
    ? filters.getActiveValueForDimension(dimensionId)
    : null;

  const handle = dimensionId && filters
    ? (key: string, label?: string) => {
        filters.toggleFilter({
          dimension: dimensionId,
          value: key,
          label: label ?? key,
          sourceWidgetId: widget.id,
        });
      }
    : undefined;

  return { handle, dimensionId, activeValue, hasFilters: !!filters };
}

function pickBreakdown(
  widget: WidgetRenderProps['widget'],
  calcs: WidgetRenderProps['calcs']
): Array<{ name: string; value: number; source_rows?: number }> {
  const metricId = widget.metric_ids[0];
  const calc = metricId ? calcs[metricId] : undefined;
  const dimId = widget.dimension_ids[0];
  if (!calc) return [];
  const bd = calc.value.breakdown_by_dimension ?? {};
  const target = (dimId ? bd[dimId] : undefined) ?? Object.values(bd)[0] ?? [];
  const limit = widget.chart_config.limit ?? 10;
  return target.slice(0, limit).map((b) => ({
    name: b.key,
    value: b.value,
    source_rows: b.source_rows,
  }));
}

export function BarChartWidget({ widget, calcs, metrics }: WidgetRenderProps) {
  const data = pickBreakdown(widget, calcs);
  const colors = getColorScheme(widget.chart_config.color_scheme);
  const { handle, dimensionId, activeValue, hasFilters } = useCategoricalClick(widget);
  const meta = metrics[widget.metric_ids[0]];

  if (data.length === 0)
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget />
      </WidgetShell>
    );
  const interactive = !!handle;
  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis tickFormatter={(v) => formatCompactNumber(v)} tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip
              cursor={{ fill: 'rgba(30, 42, 68, 0.04)' }}
              content={(props) => (
                <RichTooltip {...props} defaultMetric={meta} metrics={metrics} />
              )}
            />
            <Bar
              dataKey="value"
              fill={colors.primary}
              radius={[6, 6, 0, 0]}
              cursor={interactive ? 'pointer' : 'default'}
              onClick={
                handle
                  ? (entry: { name?: string }) => {
                      if (entry?.name) handle(String(entry.name));
                    }
                  : undefined
              }
            >
              {data.map((d) => (
                <Cell
                  key={d.name}
                  fill={
                    hasFilters && activeValue !== null && activeValue !== d.name
                      ? `${colors.primary}55`
                      : colors.primary
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {interactive && dimensionId && (
        <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-vizme-greyblue">
          Click para filtrar por {dimensionId}
        </p>
      )}
    </WidgetShell>
  );
}

export function BarHorizontalWidget({ widget, calcs, metrics }: WidgetRenderProps) {
  const data = pickBreakdown(widget, calcs);
  const colors = getColorScheme(widget.chart_config.color_scheme);
  const { handle, dimensionId, activeValue, hasFilters } = useCategoricalClick(widget);
  const meta = metrics[widget.metric_ids[0]];

  if (data.length === 0)
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget />
      </WidgetShell>
    );
  const interactive = !!handle;
  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 24, left: 12, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => formatCompactNumber(v)}
              tick={{ fontSize: 11, fill: '#6b7280' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 11, fill: '#374151' }}
            />
            <Tooltip
              cursor={{ fill: 'rgba(30, 42, 68, 0.04)' }}
              content={(props) => (
                <RichTooltip {...props} defaultMetric={meta} metrics={metrics} />
              )}
            />
            <Bar
              dataKey="value"
              fill={colors.primary}
              radius={[0, 6, 6, 0]}
              cursor={interactive ? 'pointer' : 'default'}
              onClick={
                handle
                  ? (entry: { name?: string }) => {
                      if (entry?.name) handle(String(entry.name));
                    }
                  : undefined
              }
            >
              {data.map((d) => (
                <Cell
                  key={d.name}
                  fill={
                    hasFilters && activeValue !== null && activeValue !== d.name
                      ? `${colors.primary}55`
                      : colors.primary
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {interactive && dimensionId && (
        <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-vizme-greyblue">
          Click para filtrar por {dimensionId}
        </p>
      )}
    </WidgetShell>
  );
}

export function BarStackedWidget({ widget, calcs, metrics }: WidgetRenderProps) {
  const colors = getColorScheme(widget.chart_config.color_scheme);
  const dimId = widget.dimension_ids[0];
  const limit = widget.chart_config.limit ?? 8;
  const { handle, activeValue, hasFilters } = useCategoricalClick(widget);

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
        <EmptyWidget message="Necesitamos al menos una categoría con datos para componer las barras." />
      </WidgetShell>
    );
  }

  const categoryTotals = new Map<string, number>();
  for (const s of series) {
    for (const b of s.breakdown) {
      categoryTotals.set(b.key, (categoryTotals.get(b.key) ?? 0) + b.value);
    }
  }
  const topCategories = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);

  const data = topCategories.map((cat) => {
    const row: Record<string, string | number> = { name: cat };
    for (const s of series) {
      const point = s.breakdown.find((b) => b.key === cat);
      row[s.metricId] = point?.value ?? 0;
    }
    return row;
  });

  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis
              tickFormatter={(v) => formatCompactNumber(v)}
              tick={{ fontSize: 11, fill: '#6b7280' }}
            />
            <Tooltip
              cursor={{ fill: 'rgba(30, 42, 68, 0.04)' }}
              content={(props) => <RichTooltip {...props} metrics={metrics} />}
            />
            {(widget.chart_config.show_legend ?? series.length > 1) && <Legend />}
            {series.map((s, i) => (
              <Bar
                key={s.metricId}
                dataKey={s.metricId}
                stackId="vizme-stack"
                fill={colors.palette[i % colors.palette.length]}
                name={s.name}
                radius={i === series.length - 1 ? [6, 6, 0, 0] : 0}
                cursor={handle ? 'pointer' : 'default'}
                onClick={
                  handle
                    ? (entry: { name?: string }) => {
                        if (entry?.name) handle(String(entry.name));
                      }
                    : undefined
                }
              >
                {data.map((d) => (
                  <Cell
                    key={`${s.metricId}-${d.name}`}
                    fill={
                      hasFilters && activeValue !== null && activeValue !== d.name
                        ? `${colors.palette[i % colors.palette.length]}55`
                        : colors.palette[i % colors.palette.length]
                    }
                  />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}

export function DonutChartWidget({ widget, calcs, metrics }: WidgetRenderProps) {
  const data = pickBreakdown(widget, calcs).slice(0, 7);
  const colors = getColorScheme(widget.chart_config.color_scheme);
  const { handle, dimensionId, activeValue, hasFilters } = useCategoricalClick(widget);
  const meta = metrics[widget.metric_ids[0]];

  if (data.length === 0)
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget />
      </WidgetShell>
    );
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const interactive = !!handle;
  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="grid h-72 w-full grid-cols-[1.2fr_1fr] items-center gap-4">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              cursor={interactive ? 'pointer' : 'default'}
              onClick={
                handle
                  ? (entry: { name?: string }) => {
                      if (entry?.name) handle(String(entry.name));
                    }
                  : undefined
              }
            >
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={
                    hasFilters && activeValue !== null && activeValue !== d.name
                      ? `${colors.palette[i % colors.palette.length]}55`
                      : colors.palette[i % colors.palette.length]
                  }
                />
              ))}
            </Pie>
            <Tooltip
              content={(props) => {
                const slice = props.payload?.[0];
                const v = typeof slice?.value === 'number' ? slice.value : 0;
                return (
                  <RichTooltip
                    {...props}
                    defaultMetric={meta}
                    metrics={metrics}
                    share={total > 0 ? { value: v, total } : null}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <ul className="space-y-2 overflow-auto pr-1">
          {data.map((d, i) => {
            const isActive =
              hasFilters && activeValue !== null && activeValue === d.name;
            const isInactive =
              hasFilters && activeValue !== null && activeValue !== d.name;
            return (
              <li
                key={d.name}
                onClick={handle ? () => handle(d.name) : undefined}
                className={[
                  'flex items-center gap-2 rounded-lg p-1.5 text-xs transition-colors',
                  handle ? 'cursor-pointer hover:bg-vizme-coral/5' : '',
                  isActive ? 'bg-vizme-coral/10' : '',
                  isInactive ? 'opacity-50' : '',
                ].join(' ')}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: colors.palette[i % colors.palette.length] }}
                />
                <span className="flex-1 truncate text-vizme-navy">{d.name}</span>
                <span className="font-mono text-vizme-greyblue">
                  {Math.round((d.value / total) * 100)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {interactive && dimensionId && (
        <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-vizme-greyblue">
          Click para filtrar por {dimensionId}
        </p>
      )}
    </WidgetShell>
  );
}

export function TreemapWidget({ widget, calcs, metrics }: WidgetRenderProps) {
  const data = pickBreakdown(widget, calcs);
  const colors = getColorScheme(widget.chart_config.color_scheme);
  const { handle, dimensionId, activeValue, hasFilters } = useCategoricalClick(widget);
  const meta = metrics[widget.metric_ids[0]];

  if (data.length === 0)
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget />
      </WidgetShell>
    );
  const treeData = data.map((d, i) => {
    const isInactive = hasFilters && activeValue !== null && activeValue !== d.name;
    return {
      name: d.name,
      size: d.value,
      fill: isInactive
        ? `${colors.palette[i % colors.palette.length]}55`
        : colors.palette[i % colors.palette.length],
    };
  });
  const interactive = !!handle;
  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <Treemap
            data={treeData}
            dataKey="size"
            stroke="#fff"
            fill={colors.primary}
            isAnimationActive={false}
            onClick={
              handle
                ? (entry: { name?: string }) => {
                    if (entry?.name) handle(String(entry.name));
                  }
                : undefined
            }
          >
            <Tooltip
              content={(props) => (
                <RichTooltip {...props} defaultMetric={meta} metrics={metrics} />
              )}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
      {interactive && dimensionId && (
        <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-vizme-greyblue">
          Click para filtrar por {dimensionId}
        </p>
      )}
    </WidgetShell>
  );
}
