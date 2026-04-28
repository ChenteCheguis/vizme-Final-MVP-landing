// ============================================================
// VIZME V5 — Tests del ingest engine
// Sprint 3 — Ingesta Recurrente
// ============================================================

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { runIngestExtraction } from '../ingestEngine';
import type { BusinessSchema, Metric } from '../v5types';

function makeWorkbook(sheets: Record<string, Array<Array<string | number | null>>>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

function metric(overrides: Partial<Metric> & { id: string; name: string; aggregation: Metric['aggregation'] }): Metric {
  return {
    id: overrides.id,
    name: overrides.name,
    description: overrides.description ?? '',
    formula: overrides.formula ?? '',
    unit: overrides.unit ?? 'MXN',
    aggregation: overrides.aggregation,
    format: overrides.format ?? 'currency',
    good_direction: overrides.good_direction ?? 'up',
    expected_range: overrides.expected_range,
  };
}

function makeSchema(metrics: Metric[]): BusinessSchema {
  return {
    id: 'test-schema',
    project_id: 'test-project',
    version: 1,
    business_identity: {
      industry: 'Retail',
      business_model: 'B2C',
      size: 'small',
      language: 'es',
      currency: 'MXN',
    },
    entities: [],
    metrics,
    dimensions: [],
    extraction_rules: [],
    external_sources: [],
    model_used: 'claude-opus-4-7',
    created_at: '',
    updated_at: '',
  };
}

describe('runIngestExtraction', () => {
  it('extrae métrica simple con sum agg sobre columna fechada', () => {
    const buf = makeWorkbook({
      Ventas: [
        ['fecha', 'ventas'],
        ['2026-01-01', 100],
        ['2026-01-02', 150],
        ['2026-01-03', 200],
      ],
    });
    const schema = makeSchema([metric({ id: 'm1', name: 'Ventas', aggregation: 'sum' })]);
    const result = runIngestExtraction({ buffer: buf, fileName: 'enero.xlsx', schema });

    expect(result.summary.metrics_extracted).toBe(1);
    const ex = result.extractions[0];
    expect(ex.source_sheet).toBe('Ventas');
    expect(ex.source_column).toBe('ventas');
    expect(ex.date_column).toBe('fecha');
    expect(ex.data_points).toHaveLength(3);
    expect(ex.data_points[0].value).toBe(100);
  });

  it('agrega múltiples filas en el mismo período (sum)', () => {
    const buf = makeWorkbook({
      Cortes: [
        ['fecha', 'cortes'],
        ['2026-01-01', 5],
        ['2026-01-01', 7],
        ['2026-01-02', 3],
      ],
    });
    const schema = makeSchema([metric({ id: 'm1', name: 'Cortes', aggregation: 'sum' })]);
    const result = runIngestExtraction({ buffer: buf, fileName: 'cortes.xlsx', schema });

    const ex = result.extractions[0];
    expect(ex.data_points).toHaveLength(2);
    expect(ex.data_points.find((p) => p.period_start === '2026-01-01')?.value).toBe(12);
    expect(ex.data_points.find((p) => p.period_start === '2026-01-02')?.value).toBe(3);
  });

  it('aplica avg cuando metric.aggregation = avg', () => {
    const buf = makeWorkbook({
      Tickets: [
        ['fecha', 'ticket promedio'],
        ['2026-01-01', 100],
        ['2026-01-01', 200],
      ],
    });
    const schema = makeSchema([
      metric({ id: 'm1', name: 'Ticket Promedio', aggregation: 'avg' }),
    ]);
    const result = runIngestExtraction({ buffer: buf, fileName: 't.xlsx', schema });
    expect(result.extractions[0].data_points[0].value).toBe(150);
  });

  it('skip métrica que no matchea ninguna columna', () => {
    const buf = makeWorkbook({
      Hoja1: [
        ['fecha', 'irrelevante'],
        ['2026-01-01', 1],
      ],
    });
    const schema = makeSchema([
      metric({ id: 'm1', name: 'NPS Score', aggregation: 'avg' }),
    ]);
    const result = runIngestExtraction({ buffer: buf, fileName: 'x.xlsx', schema });

    expect(result.summary.metrics_skipped).toBe(1);
    expect(result.extractions[0].data_points).toHaveLength(0);
    expect(result.extractions[0].warnings.length).toBeGreaterThan(0);
  });

  it('infiere granularidad mensual con espaciado típico', () => {
    const rows: Array<Array<string | number | null>> = [['fecha', 'ingresos']];
    rows.push(['2026-01-31', 1000]);
    rows.push(['2026-02-28', 1100]);
    rows.push(['2026-03-31', 1250]);
    const buf = makeWorkbook({ Mensual: rows });
    const schema = makeSchema([metric({ id: 'm1', name: 'Ingresos', aggregation: 'sum' })]);
    const result = runIngestExtraction({ buffer: buf, fileName: 'm.xlsx', schema });
    expect(result.summary.inferred_grain).toBe('month');
  });

  it('infiere granularidad semanal con espaciado de ~7 días', () => {
    const rows: Array<Array<string | number | null>> = [['semana', 'ventas']];
    rows.push(['2026-01-05', 500]);
    rows.push(['2026-01-12', 600]);
    rows.push(['2026-01-19', 550]);
    rows.push(['2026-01-26', 700]);
    const buf = makeWorkbook({ Semana: rows });
    const schema = makeSchema([metric({ id: 'm1', name: 'Ventas', aggregation: 'sum' })]);
    const result = runIngestExtraction({ buffer: buf, fileName: 's.xlsx', schema });
    expect(result.summary.inferred_grain).toBe('week');
  });

  it('parsea fechas en formato dd/mm/yyyy', () => {
    const buf = makeWorkbook({
      Datos: [
        ['fecha', 'monto'],
        ['01/03/2026', 50],
        ['02/03/2026', 75],
      ],
    });
    const schema = makeSchema([metric({ id: 'm1', name: 'Monto', aggregation: 'sum' })]);
    const result = runIngestExtraction({ buffer: buf, fileName: 'dmy.xlsx', schema });
    expect(result.extractions[0].data_points).toHaveLength(2);
    expect(result.extractions[0].data_points[0].period_start).toBe('2026-03-01');
  });

  it('limpia números con $ y comas', () => {
    const buf = makeWorkbook({
      Ventas: [
        ['fecha', 'ventas'],
        ['2026-01-01', '$1,500.50'],
        ['2026-01-02', '$2,000'],
      ],
    });
    const schema = makeSchema([metric({ id: 'm1', name: 'Ventas', aggregation: 'sum' })]);
    const result = runIngestExtraction({ buffer: buf, fileName: 'x.xlsx', schema });
    const total = result.extractions[0].data_points.reduce((a, p) => a + p.value, 0);
    expect(total).toBeCloseTo(3500.5, 2);
  });

  it('asigna confidence high cuando hay match fuerte y suficientes puntos', () => {
    const rows: Array<Array<string | number | null>> = [['fecha', 'ingresos brutos']];
    for (let i = 1; i <= 8; i++) rows.push([`2026-01-0${i}`, i * 100]);
    const buf = makeWorkbook({ Hoja: rows });
    const schema = makeSchema([
      metric({ id: 'm1', name: 'Ingresos Brutos Diarios', aggregation: 'sum' }),
    ]);
    const result = runIngestExtraction({ buffer: buf, fileName: 'h.xlsx', schema });
    expect(result.extractions[0].confidence).toBe('high');
  });

  it('reporta period_range en summary', () => {
    const buf = makeWorkbook({
      Ventas: [
        ['fecha', 'ventas'],
        ['2026-01-15', 100],
        ['2026-03-20', 200],
        ['2026-02-10', 150],
      ],
    });
    const schema = makeSchema([metric({ id: 'm1', name: 'Ventas', aggregation: 'sum' })]);
    const result = runIngestExtraction({ buffer: buf, fileName: 'r.xlsx', schema });
    expect(result.summary.period_range?.start).toBe('2026-01-15');
    expect(result.summary.period_range?.end).toBe('2026-03-20');
  });

  it('maneja workbook sin sheets legibles', () => {
    const buf = makeWorkbook({ Vacia: [] });
    const schema = makeSchema([metric({ id: 'm1', name: 'X', aggregation: 'sum' })]);
    const result = runIngestExtraction({ buffer: buf, fileName: 'e.xlsx', schema });
    expect(result.summary.metrics_extracted).toBe(0);
    expect(result.summary.warnings.length).toBeGreaterThan(0);
  });

  it('ignora tildes para matching (Inglés ≈ Ingles)', () => {
    const buf = makeWorkbook({
      Datos: [
        ['fecha', 'ventas en pesos'],
        ['2026-01-01', 100],
      ],
    });
    const schema = makeSchema([
      metric({ id: 'm1', name: 'Ventas en Pésos', aggregation: 'sum' }),
    ]);
    const result = runIngestExtraction({ buffer: buf, fileName: 'a.xlsx', schema });
    expect(result.extractions[0].data_points).toHaveLength(1);
  });
});
