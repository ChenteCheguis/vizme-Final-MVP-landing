// ============================================================
// VIZME V5 — Tests del Dashboard Health Calculator
// Sprint 4.2
// ============================================================

import { describe, it, expect } from 'vitest';
import { calculateDashboardHealth, healthCopy } from '../dashboardHealth';
import type { BusinessSchema, Metric } from '../v5types';

function metric(id: string, name: string): Metric {
  return {
    id,
    name,
    description: '',
    formula: '',
    unit: 'MXN',
    aggregation: 'sum',
    format: 'currency',
    good_direction: 'up',
  };
}

function schemaWith(metrics: Metric[]): Pick<BusinessSchema, 'metrics'> {
  return { metrics };
}

describe('calculateDashboardHealth', () => {
  it('= complete cuando todas las métricas tienen data_points', () => {
    const schema = schemaWith([metric('a', 'Ventas'), metric('b', 'Propinas')]);
    const result = calculateDashboardHealth({
      schema,
      calculations: [
        { metric_id: 'a', data_points: [{ value: 1 }] },
        { metric_id: 'b', data_points: [{ value: 2 }, { value: 3 }] },
      ],
    });
    expect(result.status).toBe('complete');
    expect(result.details.percent).toBe(100);
    expect(result.details.missing_metric_ids).toEqual([]);
  });

  it('= partial cuando 50–99% extraídos', () => {
    const schema = schemaWith([
      metric('a', 'Ventas'),
      metric('b', 'Propinas'),
      metric('c', 'Comensales'),
      metric('d', 'Tickets'),
    ]);
    const result = calculateDashboardHealth({
      schema,
      calculations: [
        { metric_id: 'a', data_points: [{ value: 1 }] },
        { metric_id: 'b', data_points: [{ value: 2 }] },
        { metric_id: 'c', data_points: [{ value: 3 }] },
        // d missing
      ],
    });
    expect(result.status).toBe('partial');
    expect(result.details.percent).toBe(75);
    expect(result.details.missing_metric_names).toEqual(['Tickets']);
  });

  it('= limited cuando < 50%', () => {
    const schema = schemaWith([
      metric('a', 'A'),
      metric('b', 'B'),
      metric('c', 'C'),
      metric('d', 'D'),
    ]);
    const result = calculateDashboardHealth({
      schema,
      calculations: [{ metric_id: 'a', data_points: [{ value: 1 }] }],
    });
    expect(result.status).toBe('limited');
    expect(result.details.percent).toBe(25);
  });

  it('= no_data cuando 0 métricas extraídas', () => {
    const schema = schemaWith([metric('a', 'Ventas')]);
    const result = calculateDashboardHealth({
      schema,
      calculations: [{ metric_id: 'a', data_points: [] }],
    });
    expect(result.status).toBe('no_data');
    expect(result.details.percent).toBe(0);
  });

  it('= no_data cuando schema vacío', () => {
    const result = calculateDashboardHealth({
      schema: schemaWith([]),
      calculations: [],
    });
    expect(result.status).toBe('no_data');
  });

  it('captura warnings como reasons', () => {
    const schema = schemaWith([metric('a', 'Ventas'), metric('b', 'Propinas')]);
    const result = calculateDashboardHealth({
      schema,
      calculations: [
        { metric_id: 'a', data_points: [{ value: 1 }] },
        { metric_id: 'b', data_points: [], warnings: ['Columna PROPINA no encontrada.'] },
      ],
    });
    expect(result.status).toBe('partial');
    expect(result.details.reasons).toContain('Columna PROPINA no encontrada.');
  });

  it('considera missing si no hay calculation row para esa métrica', () => {
    const schema = schemaWith([metric('a', 'A'), metric('b', 'B')]);
    const result = calculateDashboardHealth({
      schema,
      calculations: [{ metric_id: 'a', data_points: [{ value: 1 }] }],
    });
    expect(result.details.missing_metric_ids).toEqual(['b']);
    expect(result.details.reasons[0]).toContain('"B"');
  });
});

describe('healthCopy', () => {
  it('complete → no banner', () => {
    const copy = healthCopy({
      status: 'complete',
      details: { extracted: 5, total: 5, percent: 100, missing_metric_ids: [], missing_metric_names: [], reasons: [] },
    });
    expect(copy.showBanner).toBe(false);
    expect(copy.variant).toBe('success');
  });

  it('partial → warning amarillo + CTA', () => {
    const copy = healthCopy({
      status: 'partial',
      details: { extracted: 3, total: 4, percent: 75, missing_metric_ids: ['d'], missing_metric_names: ['Tickets'], reasons: [] },
    });
    expect(copy.showBanner).toBe(true);
    expect(copy.variant).toBe('warning');
    expect(copy.cta).toBe('Reintentar extracción');
    expect(copy.title).toContain('3 de 4');
  });

  it('limited → caution naranja', () => {
    const copy = healthCopy({
      status: 'limited',
      details: { extracted: 1, total: 4, percent: 25, missing_metric_ids: [], missing_metric_names: ['A','B','C'], reasons: [] },
    });
    expect(copy.variant).toBe('caution');
    expect(copy.cta).toBe('Reintentar extracción');
  });

  it('no_data → error rojo', () => {
    const copy = healthCopy({
      status: 'no_data',
      details: { extracted: 0, total: 5, percent: 0, missing_metric_ids: [], missing_metric_names: [], reasons: [] },
    });
    expect(copy.variant).toBe('error');
    expect(copy.cta).toBe('Ver diagnóstico');
  });
});
