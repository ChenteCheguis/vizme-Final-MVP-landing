// Dispatcher: dado el widget.type, renderiza el componente correcto.
// Si Opus pidió un tipo que no existe (no debería pasar por el validador),
// caemos a un placeholder explícito en vez de romper la página.

import type { VisualizationType } from '../../../lib/v5types';
import type { WidgetRenderProps } from './widgetTypes';
import { WidgetShell, EmptyWidget } from './WidgetShell';
import { KpiHero, KpiCard, SparklineWidget } from './KpiWidgets';
import {
  LineChartWidget,
  AreaChartWidget,
  ComposedChartWidget,
  HeatmapCalendarWidget,
} from './TimeWidgets';
import {
  BarChartWidget,
  BarHorizontalWidget,
  BarStackedWidget,
  DonutChartWidget,
  TreemapWidget,
} from './CategoricalWidgets';
import {
  ScatterChartWidget,
  GaugeWidget,
  RadialBarWidget,
  FunnelChartWidget,
  HeatmapGridWidget,
  SankeyWidget,
} from './SpecialtyWidgets';
import { DataTableWidget } from './TableWidget';

const REGISTRY: Record<VisualizationType, React.ComponentType<WidgetRenderProps>> = {
  kpi_hero: KpiHero,
  kpi_card: KpiCard,
  line_chart: LineChartWidget,
  area_chart: AreaChartWidget,
  bar_chart: BarChartWidget,
  bar_horizontal: BarHorizontalWidget,
  bar_stacked: BarStackedWidget,
  donut_chart: DonutChartWidget,
  heatmap_grid: HeatmapGridWidget,
  heatmap_calendar: HeatmapCalendarWidget,
  scatter_chart: ScatterChartWidget,
  composed_chart: ComposedChartWidget,
  sparkline: SparklineWidget,
  gauge: GaugeWidget,
  radial_bar: RadialBarWidget,
  funnel_chart: FunnelChartWidget,
  treemap: TreemapWidget,
  sankey: SankeyWidget,
  data_table: DataTableWidget,
};

export function DashboardWidgetView(props: WidgetRenderProps) {
  const Component = REGISTRY[props.widget.type];
  if (!Component) {
    return (
      <WidgetShell title={props.widget.title} insight={props.widget.insight}>
        <EmptyWidget message={`Tipo de visualización desconocido: ${props.widget.type}`} />
      </WidgetShell>
    );
  }
  return <Component {...props} />;
}

export { REGISTRY as WIDGET_REGISTRY };
