// data_table — listado tabular del top breakdown con valores formateados.

import { formatMetricValue } from '../format';
import { WidgetShell, EmptyWidget } from './WidgetShell';
import type { WidgetRenderProps } from './widgetTypes';

export function DataTableWidget({ widget, calcs, metrics }: WidgetRenderProps) {
  const metricId = widget.metric_ids[0];
  const calc = metricId ? calcs[metricId] : undefined;
  const metric = metricId ? metrics[metricId] : undefined;
  const dimId = widget.dimension_ids[0];
  const bd = calc?.value.breakdown_by_dimension ?? {};
  const target = (dimId ? bd[dimId] : undefined) ?? Object.values(bd)[0] ?? [];
  const limit = widget.chart_config.limit ?? 20;
  const rows = target.slice(0, limit);

  if (rows.length === 0)
    return (
      <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
        <EmptyWidget />
      </WidgetShell>
    );

  return (
    <WidgetShell title={widget.title} subtitle={widget.subtitle} insight={widget.insight}>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vizme-navy/10 text-[10px] uppercase tracking-[0.16em] text-vizme-greyblue">
              <th className="py-2 text-left font-medium">{dimId ?? 'Categoría'}</th>
              <th className="py-2 text-right font-medium">{metric?.name ?? 'Valor'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-vizme-navy/5">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="py-2 text-vizme-navy">{r.key}</td>
                <td className="py-2 text-right font-mono text-vizme-navy">
                  {formatMetricValue(r.value, metric)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}
