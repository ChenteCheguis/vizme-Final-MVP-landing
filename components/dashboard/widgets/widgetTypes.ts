// Tipos compartidos por todos los widgets del dashboard.

import type {
  DashboardWidget,
  Metric,
  MetricCalculation,
  MetricCalculationPeriod,
} from '../../../lib/v5types';

export interface WidgetRenderProps {
  widget: DashboardWidget;
  period: MetricCalculationPeriod;
  // map metric_id -> calc (en el período actual) si existe
  calcs: Record<string, MetricCalculation | undefined>;
  metrics: Record<string, Metric | undefined>;
  // map metric_id -> calc histórico (all_time) para sparklines/heatmap_calendar
  calcsAllTime?: Record<string, MetricCalculation | undefined>;
}

export interface WidgetCardShellProps {
  title: string;
  subtitle?: string | null;
  insight?: string | null;
  children: React.ReactNode;
  className?: string;
}
