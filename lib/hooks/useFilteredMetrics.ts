// ============================================================
// VIZME V5 — Sprint 4.3 P3 — Filtered metrics hook
//
// Aplica filtros activos del DashboardFilterContext sobre los
// `MetricCalculation` que ya tenemos cargados en cliente. Sin
// refetch al edge — operación pura sobre los breakdowns.
//
// Reglas honestas:
//  - Si un filtro `{ dim: 'mesero', value: '5' }` está activo,
//    los breakdowns por dimensión `mesero` se filtran a SOLO
//    "Mesero 5". Los breakdowns por OTRAS dimensiones quedan
//    intactos — el cliente no tiene datos cruzados (mesero ×
//    día_semana) y no podemos inventar valores.
//  - El `value` de la métrica se ajusta a la suma de los items
//    filtrados cuando hay un breakdown matching la dimensión
//    filtrada (sum/count). Para avg/ratio/min/max preservamos
//    el valor original — sin source_rows por categoría no hay
//    forma honesta de re-ponderar.
//  - Drill temporal recorta `time_series` al rango del último
//    DrillStep (yyyy / yyyy-mm / yyyy-mm-dd).
//
// Esta versión client-side es suficiente para el 95% de filtros
// simples (un mesero, un día, una categoría). Cross-tabs reales
// llegan cuando el backend persista `cross_tabs_by_dimension`.
// ============================================================

import { useMemo } from 'react';
import {
  useOptionalDashboardFilters,
  type DashboardFilter,
  type DrillStep,
} from '../../contexts/DashboardFilterContext';
import type {
  Metric,
  MetricCalculation,
  MetricCalculationPeriod,
  MetricCalculationValue,
} from '../v5types';

export type CalcsByMetricPeriod = Map<
  string,
  Map<MetricCalculationPeriod, MetricCalculation>
>;

interface UseFilteredMetricsArgs {
  calcsByMetricPeriod: CalcsByMetricPeriod;
  metricsById: Map<string, Metric>;
}

function timeSeriesInDrillRange(
  series: MetricCalculationValue['time_series'],
  drillPath: DrillStep[]
): MetricCalculationValue['time_series'] {
  if (!series || series.length === 0) return series;
  if (drillPath.length === 0) return series;
  // Último step define el rango. value es prefijo ISO (yyyy / yyyy-mm / yyyy-mm-dd).
  const last = drillPath[drillPath.length - 1];
  const prefix = last.value;
  return series.filter((p) => typeof p.date === 'string' && p.date.startsWith(prefix));
}

function applyFiltersToValue(
  raw: MetricCalculationValue,
  filters: DashboardFilter[],
  drillPath: DrillStep[],
  meta: Metric | undefined
): MetricCalculationValue {
  const breakdowns = raw.breakdown_by_dimension ?? {};
  const newBreakdown: MetricCalculationValue['breakdown_by_dimension'] = {};
  let filteredValue: number | null = raw.value;
  let filteredSourceRows: number | undefined = raw.source_rows;
  let matchedAtLeastOneFilter = false;

  for (const [dim, list] of Object.entries(breakdowns)) {
    const matchingFilter = filters.find((f) => f.dimension === dim);
    if (!matchingFilter) {
      newBreakdown[dim] = list;
      continue;
    }
    matchedAtLeastOneFilter = true;
    const filtered = list.filter((b) => String(b.key) === matchingFilter.value);
    newBreakdown[dim] = filtered;

    // Recalcular value sólo cuando la agregación es additiva (sum/count).
    if (filtered.length > 0 && (meta?.aggregation === 'sum' || meta?.aggregation === 'count')) {
      filteredValue = filtered.reduce((a, b) => a + b.value, 0);
      const rowsSum = filtered.reduce((a, b) => a + (b.source_rows ?? 0), 0);
      if (rowsSum > 0) filteredSourceRows = rowsSum;
    }
  }

  // Si el filtro NO matchea ninguna dimensión disponible para esta métrica,
  // el `value` se mantiene tal cual — no podemos inferir cross-segmentación.
  // El widget se atenuará vía UI para señalar "este widget no responde al
  // filtro activo".

  const filteredSeries = timeSeriesInDrillRange(raw.time_series, drillPath);
  // Cuando hay drill activo y la serie quedó recortada para una métrica
  // additiva, recalculamos value como suma del rango.
  if (
    drillPath.length > 0 &&
    filteredSeries &&
    filteredSeries.length > 0 &&
    !matchedAtLeastOneFilter &&
    (meta?.aggregation === 'sum' || meta?.aggregation === 'count')
  ) {
    filteredValue = filteredSeries.reduce((a, p) => a + p.value, 0);
  }

  return {
    ...raw,
    value: filteredValue,
    source_rows: filteredSourceRows,
    breakdown_by_dimension: newBreakdown,
    time_series: filteredSeries,
  };
}

/**
 * Versión PURA — aplica filtros + drill sobre los cálculos sin tocar React.
 * Exportada para que los tests puedan validarla en environment=node.
 */
export function applyFiltersToCalcs(
  calcsByMetricPeriod: CalcsByMetricPeriod,
  metricsById: Map<string, Metric>,
  activeFilters: DashboardFilter[],
  drillPath: DrillStep[]
): {
  filtered: CalcsByMetricPeriod;
  hasActiveFilters: boolean;
  hasActiveDrill: boolean;
} {
  const hasActiveFilters = activeFilters.length > 0;
  const hasActiveDrill = drillPath.length > 0;

  if (!hasActiveFilters && !hasActiveDrill) {
    return { filtered: calcsByMetricPeriod, hasActiveFilters: false, hasActiveDrill: false };
  }

  const out: CalcsByMetricPeriod = new Map();
  for (const [metricId, byPeriod] of calcsByMetricPeriod.entries()) {
    const meta = metricsById.get(metricId);
    const newByPeriod = new Map<MetricCalculationPeriod, MetricCalculation>();
    for (const [period, calc] of byPeriod.entries()) {
      const filteredValue = applyFiltersToValue(calc.value, activeFilters, drillPath, meta);
      newByPeriod.set(period, { ...calc, value: filteredValue });
    }
    out.set(metricId, newByPeriod);
  }
  return { filtered: out, hasActiveFilters, hasActiveDrill };
}

/**
 * Devuelve un `calcsByMetricPeriod` filtrado según el estado del
 * DashboardFilterContext. Si no hay provider o no hay filtros, regresa
 * el input intacto.
 */
export function useFilteredMetrics({
  calcsByMetricPeriod,
  metricsById,
}: UseFilteredMetricsArgs): {
  filtered: CalcsByMetricPeriod;
  hasActiveFilters: boolean;
  hasActiveDrill: boolean;
} {
  const filters = useOptionalDashboardFilters();
  const activeFilters = filters?.activeFilters ?? [];
  const drillPath = filters?.drillPath ?? [];

  return useMemo(
    () => applyFiltersToCalcs(calcsByMetricPeriod, metricsById, activeFilters, drillPath),
    [calcsByMetricPeriod, metricsById, activeFilters, drillPath]
  );
}

/**
 * Helper para que un widget sepa si una dimensión específica está siendo
 * filtrada — útil para resaltar la barra/segmento activo en lugar de
 * removerla.
 */
export function useFilterHighlight(dimension: string | undefined): {
  activeValue: string | null;
  hasFilter: boolean;
} {
  const filters = useOptionalDashboardFilters();
  if (!filters || !dimension) return { activeValue: null, hasFilter: false };
  const activeValue = filters.getActiveValueForDimension(dimension);
  return { activeValue, hasFilter: activeValue !== null };
}
