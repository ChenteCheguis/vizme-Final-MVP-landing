// Pruebas unitarias para metricCalculator — agregaciones, ventanas
// temporales, change_percent y breakdown por dimensión.

import { describe, expect, it } from 'vitest';
import {
  calculateMetric,
  calculateAllMetrics,
  type MetricMeta,
  type TimeSeriesPoint,
} from '../metricCalculator.ts';

const day = (iso: string, value: number, dim?: Record<string, unknown>): TimeSeriesPoint => ({
  metric_id: 'ventas',
  value,
  period_start: iso,
  dimension_values: dim ?? null,
});

const sumMeta: MetricMeta = { id: 'ventas', name: 'Ventas', aggregation: 'sum', good_direction: 'up' };
const avgMeta: MetricMeta = { id: 'ticket', name: 'Ticket', aggregation: 'avg' };

describe('calculateMetric — agregaciones básicas', () => {
  it('suma valores en la ventana', () => {
    const pts = [day('2026-04-01', 100), day('2026-04-15', 200), day('2026-04-30', 300)];
    const r = calculateMetric(sumMeta, pts, 'last_month', new Date('2026-04-30').getTime());
    expect(r.value).toBe(600);
    expect(r.data_points).toBe(3);
    expect(r.source_rows).toBe(3); // default 1 each
  });

  it('promedia con avg', () => {
    const pts = [day('2026-04-01', 100), day('2026-04-15', 200), day('2026-04-30', 300)];
    const r = calculateMetric(avgMeta, pts, 'last_month', new Date('2026-04-30').getTime());
    expect(r.value).toBe(200);
  });

  it('devuelve null si no hay puntos en la ventana', () => {
    const pts = [day('2025-01-01', 100)];
    const r = calculateMetric(sumMeta, pts, 'last_week', new Date('2026-04-30').getTime());
    expect(r.value).toBeNull();
    expect(r.data_points).toBe(0);
    expect(r.source_rows).toBe(0);
  });

  it('count suma counts diarios (no cuenta el # de filas TS)', () => {
    // ingestEngine almacena daily counts en `value`. count(period) = sum(values).
    const meta: MetricMeta = { id: 'tx', name: 'Transacciones', aggregation: 'count' };
    const pts = [
      { ...day('2026-04-29', 50), count_source_rows: 50 },
      { ...day('2026-04-30', 75), count_source_rows: 75 },
    ];
    const r = calculateMetric(meta, pts, 'last_week', new Date('2026-04-30').getTime());
    expect(r.value).toBe(125); // antes daba 2 (cuenta de filas), ahora 125 (suma)
    expect(r.source_rows).toBe(125);
  });

  it('avg pondera por count_source_rows (Sprint 4.3)', () => {
    // Día A: 100 tickets con avg $500 = $50,000 total
    // Día B: 10 tickets con avg $1000 = $10,000 total
    // Promedio simple: (500+1000)/2 = $750 ❌
    // Weighted avg: $60,000 / 110 = $545.45 ✅
    const meta: MetricMeta = { id: 'tk', name: 'Ticket', aggregation: 'avg' };
    const pts: TimeSeriesPoint[] = [
      { metric_id: 'tk', value: 500, count_source_rows: 100, period_start: '2026-04-29', dimension_values: null },
      { metric_id: 'tk', value: 1000, count_source_rows: 10, period_start: '2026-04-30', dimension_values: null },
    ];
    const r = calculateMetric(meta, pts, 'last_week', new Date('2026-04-30').getTime());
    expect(r.value).toBeCloseTo(545.45, 1);
  });
});

describe('calculateMetric — change_percent vs período anterior', () => {
  it('calcula cambio positivo cuando ventana actual sube', () => {
    const pts = [
      day('2026-03-15', 50), // ventana previa (last_month previo: marzo aprox)
      day('2026-04-15', 150), // ventana actual
    ];
    const r = calculateMetric(sumMeta, pts, 'last_month', new Date('2026-04-30').getTime());
    expect(r.value).toBe(150);
    expect(r.change_percent).not.toBeNull();
    expect(r.change_percent! > 0).toBe(true);
    expect(r.change_direction).toBe('up');
  });

  it('respeta good_direction=down (un alza es "mala")', () => {
    const meta: MetricMeta = {
      id: 'churn',
      name: 'Churn',
      aggregation: 'sum',
      good_direction: 'down',
    };
    const pts = [day('2026-03-15', 50), day('2026-04-15', 150)];
    const r = calculateMetric(meta, pts, 'last_month', new Date('2026-04-30').getTime());
    expect(r.change_direction).toBe('down');
  });

  it('change_percent es null para period=all_time (sin previa)', () => {
    const pts = [day('2026-04-15', 100)];
    const r = calculateMetric(sumMeta, pts, 'all_time', new Date('2026-04-30').getTime());
    expect(r.change_percent).toBeNull();
  });
});

describe('calculateMetric — time_series y breakdown', () => {
  it('genera time_series cuando period es all_time o last_year', () => {
    const pts = [day('2026-04-01', 10), day('2026-04-02', 20), day('2026-04-03', 30)];
    const r = calculateMetric(sumMeta, pts, 'all_time', new Date('2026-04-30').getTime());
    expect(r.time_series).not.toBeNull();
    expect(r.time_series!.length).toBe(3);
    expect(r.time_series![0].date).toBe('2026-04-01');
  });

  it('NO genera time_series para last_week (ventana corta)', () => {
    const pts = [day('2026-04-29', 10)];
    const r = calculateMetric(sumMeta, pts, 'last_week', new Date('2026-04-30').getTime());
    expect(r.time_series).toBeNull();
  });

  it('breakdown agrupa por dimensión y ordena descendiente', () => {
    const pts = [
      day('2026-04-01', 100, { sucursal: 'A' }),
      day('2026-04-02', 50, { sucursal: 'A' }),
      day('2026-04-03', 200, { sucursal: 'B' }),
    ];
    const r = calculateMetric(sumMeta, pts, 'last_month', new Date('2026-04-30').getTime());
    const bd = r.breakdown_by_dimension.sucursal;
    expect(bd).toHaveLength(2);
    expect(bd[0].key).toBe('B');
    expect(bd[0].value).toBe(200);
    expect(bd[1].key).toBe('A');
    expect(bd[1].value).toBe(150);
  });
});

describe('calculateAllMetrics', () => {
  it('produce 5 períodos por métrica', () => {
    const pts = [day('2026-04-15', 100)];
    const rows = calculateAllMetrics({
      metrics: [sumMeta],
      points: pts,
      refDateMs: new Date('2026-04-30').getTime(),
    });
    expect(rows).toHaveLength(5); // all_time, last_year, last_quarter, last_month, last_week
    expect(rows.every((r) => r.metric_id === 'ventas')).toBe(true);
    const periods = new Set(rows.map((r) => r.period));
    expect(periods.has('last_month')).toBe(true);
    expect(periods.has('all_time')).toBe(true);
  });
});
