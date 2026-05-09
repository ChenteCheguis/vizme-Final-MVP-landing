// Sprint 4.3 P3 — Tests del filtrado client-side de métricas.
// La lógica pura `applyFiltersToCalcs` se valida sin React.

import { describe, expect, it } from 'vitest';
import { applyFiltersToCalcs, type CalcsByMetricPeriod } from '../hooks/useFilteredMetrics';
import type {
  Metric,
  MetricCalculation,
  MetricCalculationValue,
  MetricCalculationPeriod,
} from '../v5types';
import type { DashboardFilter, DrillStep } from '../../contexts/DashboardFilterContext';

function makeCalc(
  metric_id: string,
  period: MetricCalculationPeriod,
  value: Partial<MetricCalculationValue>
): MetricCalculation {
  return {
    id: `${metric_id}-${period}`,
    project_id: 'p1',
    metric_id,
    period,
    calculated_at: '2026-01-01T00:00:00Z',
    value: {
      value: value.value ?? null,
      change_percent: null,
      change_direction: null,
      breakdown_by_dimension: value.breakdown_by_dimension ?? {},
      time_series: value.time_series ?? null,
      ...value,
    },
  };
}

function buildCalcs(...rows: MetricCalculation[]): CalcsByMetricPeriod {
  const out: CalcsByMetricPeriod = new Map();
  for (const r of rows) {
    if (!out.has(r.metric_id)) out.set(r.metric_id, new Map());
    out.get(r.metric_id)!.set(r.period, r);
  }
  return out;
}

const ventasMetric: Metric = {
  id: 'ventas_totales',
  name: 'Ventas Totales',
  description: '',
  formula: 'sum(TOTAL)',
  unit: 'MXN',
  aggregation: 'sum',
  format: 'currency',
  good_direction: 'up',
};

const tickets: Metric = {
  id: 'tickets',
  name: 'Tickets',
  description: '',
  formula: 'count()',
  unit: 'tickets',
  aggregation: 'count',
  format: 'number',
  good_direction: 'up',
};

const ticketAvg: Metric = {
  id: 'ticket_promedio',
  name: 'Ticket Promedio',
  description: '',
  formula: 'avg(TOTAL)',
  unit: 'MXN',
  aggregation: 'avg',
  format: 'currency',
  good_direction: 'up',
};

const metricsById = new Map<string, Metric>([
  [ventasMetric.id, ventasMetric],
  [tickets.id, tickets],
  [ticketAvg.id, ticketAvg],
]);

describe('applyFiltersToCalcs — sin filtros', () => {
  it('regresa input intacto cuando no hay filtros ni drill', () => {
    const calcs = buildCalcs(
      makeCalc('ventas_totales', 'last_month', { value: 1000 })
    );
    const r = applyFiltersToCalcs(calcs, metricsById, [], []);
    expect(r.filtered).toBe(calcs);
    expect(r.hasActiveFilters).toBe(false);
    expect(r.hasActiveDrill).toBe(false);
  });
});

describe('applyFiltersToCalcs — cross-filter por dimensión', () => {
  it('filtra breakdown a sólo el value seleccionado y recalcula sum', () => {
    const calcs = buildCalcs(
      makeCalc('ventas_totales', 'last_month', {
        value: 1000,
        breakdown_by_dimension: {
          mesero: [
            { key: 'M1', value: 600 },
            { key: 'M2', value: 300 },
            { key: 'M3', value: 100 },
          ],
        },
      })
    );
    const filters: DashboardFilter[] = [
      { dimension: 'mesero', value: 'M1', sourceWidgetId: 'w1' },
    ];
    const r = applyFiltersToCalcs(calcs, metricsById, filters, []);
    const out = r.filtered.get('ventas_totales')!.get('last_month')!;
    expect(out.value.value).toBe(600);
    expect(out.value.breakdown_by_dimension.mesero).toHaveLength(1);
    expect(out.value.breakdown_by_dimension.mesero[0].key).toBe('M1');
  });

  it('count también suma los breakdowns filtrados', () => {
    const calcs = buildCalcs(
      makeCalc('tickets', 'last_month', {
        value: 100,
        breakdown_by_dimension: {
          mesero: [
            { key: 'M1', value: 60 },
            { key: 'M2', value: 40 },
          ],
        },
      })
    );
    const r = applyFiltersToCalcs(
      calcs,
      metricsById,
      [{ dimension: 'mesero', value: 'M2', sourceWidgetId: 'w' }],
      []
    );
    expect(r.filtered.get('tickets')!.get('last_month')!.value.value).toBe(40);
  });

  it('preserva el value original cuando aggregation es avg (sin cross-tab honesto)', () => {
    const calcs = buildCalcs(
      makeCalc('ticket_promedio', 'last_month', {
        value: 538,
        breakdown_by_dimension: {
          mesero: [
            { key: 'M1', value: 700 },
            { key: 'M2', value: 400 },
          ],
        },
      })
    );
    const r = applyFiltersToCalcs(
      calcs,
      metricsById,
      [{ dimension: 'mesero', value: 'M1', sourceWidgetId: 'w' }],
      []
    );
    // No re-ponderamos avg sin source_rows reales — preservamos value.
    expect(r.filtered.get('ticket_promedio')!.get('last_month')!.value.value).toBe(538);
    // pero el breakdown sí queda filtrado para que widget muestre M1 sola.
    expect(
      r.filtered.get('ticket_promedio')!.get('last_month')!.value.breakdown_by_dimension.mesero
    ).toHaveLength(1);
  });

  it('NO toca breakdowns de OTRAS dimensiones (no inventa cross-tab)', () => {
    const calcs = buildCalcs(
      makeCalc('ventas_totales', 'last_month', {
        value: 1000,
        breakdown_by_dimension: {
          mesero: [{ key: 'M1', value: 600 }, { key: 'M2', value: 400 }],
          dia_semana: [
            { key: 'lunes', value: 200 },
            { key: 'sabado', value: 800 },
          ],
        },
      })
    );
    const r = applyFiltersToCalcs(
      calcs,
      metricsById,
      [{ dimension: 'mesero', value: 'M1', sourceWidgetId: 'w' }],
      []
    );
    const bd = r.filtered.get('ventas_totales')!.get('last_month')!.value.breakdown_by_dimension;
    // mesero filtrado a M1
    expect(bd.mesero).toHaveLength(1);
    // dia_semana NO se toca — no inventamos qué pasó cuando el filtro es M1
    expect(bd.dia_semana).toHaveLength(2);
  });
});

describe('applyFiltersToCalcs — drill temporal', () => {
  it('recorta time_series al rango del último drill step', () => {
    const calcs = buildCalcs(
      makeCalc('ventas_totales', 'all_time', {
        value: 5000,
        time_series: [
          { date: '2023-01-15', value: 100 },
          { date: '2023-02-20', value: 200 },
          { date: '2024-03-10', value: 300 },
          { date: '2024-04-05', value: 400 },
        ],
      })
    );
    const drill: DrillStep[] = [{ level: 'year', value: '2023', label: '2023' }];
    const r = applyFiltersToCalcs(calcs, metricsById, [], drill);
    const out = r.filtered.get('ventas_totales')!.get('all_time')!;
    expect(out.value.time_series).toHaveLength(2);
    // Re-suma los puntos en el rango para sum/count
    expect(out.value.value).toBe(300);
  });

  it('drill a mes filtra a yyyy-mm', () => {
    const calcs = buildCalcs(
      makeCalc('ventas_totales', 'all_time', {
        value: 5000,
        time_series: [
          { date: '2024-03-10', value: 100 },
          { date: '2024-03-15', value: 200 },
          { date: '2024-04-01', value: 300 },
        ],
      })
    );
    const drill: DrillStep[] = [{ level: 'month', value: '2024-03', label: 'mar 2024' }];
    const r = applyFiltersToCalcs(calcs, metricsById, [], drill);
    expect(r.filtered.get('ventas_totales')!.get('all_time')!.value.time_series).toHaveLength(2);
    expect(r.filtered.get('ventas_totales')!.get('all_time')!.value.value).toBe(300);
  });
});

describe('applyFiltersToCalcs — combinaciones', () => {
  it('aplica filtro por dimensión y drill al mismo tiempo', () => {
    const calcs = buildCalcs(
      makeCalc('ventas_totales', 'all_time', {
        value: 5000,
        breakdown_by_dimension: {
          mesero: [{ key: 'M1', value: 3000 }, { key: 'M2', value: 2000 }],
        },
        time_series: [
          { date: '2023-06-01', value: 1000 },
          { date: '2024-01-01', value: 4000 },
        ],
      })
    );
    const r = applyFiltersToCalcs(
      calcs,
      metricsById,
      [{ dimension: 'mesero', value: 'M1', sourceWidgetId: 'w' }],
      [{ level: 'year', value: '2024', label: '2024' }]
    );
    const out = r.filtered.get('ventas_totales')!.get('all_time')!;
    // Filtro por mesero recalcula value (sum filtrado breakdown)
    expect(out.value.value).toBe(3000);
    // Series recortadas a 2024 también
    expect(out.value.time_series).toHaveLength(1);
    expect(out.value.time_series![0].date).toBe('2024-01-01');
  });

  it('hasActiveFilters/hasActiveDrill se reportan correctamente', () => {
    const calcs = buildCalcs(makeCalc('ventas_totales', 'last_month', { value: 100 }));
    const a = applyFiltersToCalcs(
      calcs,
      metricsById,
      [{ dimension: 'mesero', value: 'M1', sourceWidgetId: 'w' }],
      []
    );
    expect(a.hasActiveFilters).toBe(true);
    expect(a.hasActiveDrill).toBe(false);

    const b = applyFiltersToCalcs(
      calcs,
      metricsById,
      [],
      [{ level: 'year', value: '2024', label: '2024' }]
    );
    expect(b.hasActiveFilters).toBe(false);
    expect(b.hasActiveDrill).toBe(true);
  });
});
