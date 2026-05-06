// Tests para validateInsight — Sprint 4.3 anti-hallucination.

import { describe, expect, it } from 'vitest';
import { validateInsight, type ValidatorMetric } from '../insightValidator.ts';

const metrics: ValidatorMetric[] = [
  { metric_id: 'ticket_promedio', period: 'last_month', value: 538.65, change_percent: 12.3 },
  { metric_id: 'ventas_totales', period: 'last_month', value: 3_542_721.51, change_percent: -2.5 },
  { metric_id: 'churn', period: 'last_month', value: 0.04, change_percent: null },
];

describe('validateInsight — citas correctas pasan', () => {
  it('acepta narrativa con marcadores válidos y valores correctos', () => {
    const r = validateInsight(
      'Tu ticket promedio fue de $538 [METRIC:ticket_promedio] el mes pasado, 12% [PCT:ticket_promedio] arriba.',
      ['ticket_promedio'],
      metrics
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.cleaned).not.toContain('[METRIC');
    expect(r.cleaned).not.toContain('[PCT');
  });

  it('acepta narrativa cualitativa sin números monetarios/porcentuales', () => {
    const r = validateInsight(
      'Tus viernes están rindiendo más fuerte que el resto de la semana — vale la pena reforzar el staff esa noche.',
      ['ventas_totales'],
      metrics
    );
    expect(r.valid).toBe(true);
  });

  it('limpia espacios y puntuación tras quitar marcadores', () => {
    const r = validateInsight(
      'Vendiste $3,542,721 [METRIC:ventas_totales] en total.',
      ['ventas_totales'],
      metrics
    );
    expect(r.valid).toBe(true);
    expect(r.cleaned).toBe('Vendiste $3,542,721 en total.');
  });
});

describe('validateInsight — rechaza alucinaciones', () => {
  it('rechaza número monetario sin marcador', () => {
    const r = validateInsight(
      'Tu ticket promedio subió a $750 el mes pasado.',
      ['ticket_promedio'],
      metrics
    );
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('sin marcador'))).toBe(true);
  });

  it('rechaza porcentaje sin marcador', () => {
    const r = validateInsight(
      'Tus ventas crecieron 18% el mes pasado.',
      ['ventas_totales'],
      metrics
    );
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('sin marcador'))).toBe(true);
  });

  it('rechaza cuando el valor citado difiere >5% del real', () => {
    const r = validateInsight(
      'Tu ticket promedio fue $750 [METRIC:ticket_promedio] el mes pasado.',
      ['ticket_promedio'],
      metrics
    );
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('no coincide'))).toBe(true);
  });

  it('rechaza marcador con metric_id inexistente', () => {
    const r = validateInsight(
      'Tu numero_inventado fue $100 [METRIC:no_existe].',
      [],
      metrics
    );
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('no existente'))).toBe(true);
  });

  it('rechaza PCT cuando no hay change_percent calculado', () => {
    const r = validateInsight(
      'Tu churn varió 5% [PCT:churn] este mes.',
      ['churn'],
      metrics
    );
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('no hay change_percent'))).toBe(true);
  });

  it('acepta porcentaje dentro de tolerancia (12.3% real, 12% citado)', () => {
    const r = validateInsight(
      'Tu ticket subió 12% [PCT:ticket_promedio] vs el mes anterior.',
      ['ticket_promedio'],
      metrics
    );
    expect(r.valid).toBe(true);
  });
});

describe('validateInsight — casos límite', () => {
  it('rechaza narrativa vacía', () => {
    const r = validateInsight('', [], metrics);
    expect(r.valid).toBe(false);
  });

  it('no falla con números no monetarios (días, conteos)', () => {
    const r = validateInsight(
      'Llevamos 3 semanas seguidas viendo este patrón los viernes.',
      ['ventas_totales'],
      metrics
    );
    expect(r.valid).toBe(true);
  });

  it('valida formato $1.2k = $1200 (dentro de tolerancia)', () => {
    const m: ValidatorMetric[] = [
      { metric_id: 'x', period: 'last_month', value: 1200, change_percent: null },
    ];
    const r = validateInsight('Vendiste $1.2k [METRIC:x] esta semana.', ['x'], m);
    expect(r.valid).toBe(true);
  });

  it('valida con suffix mil', () => {
    const m: ValidatorMetric[] = [
      { metric_id: 'x', period: 'last_month', value: 1200, change_percent: null },
    ];
    const r = validateInsight('Vendiste $1.2 mil [METRIC:x] esta semana.', ['x'], m);
    expect(r.valid).toBe(true);
  });
});
