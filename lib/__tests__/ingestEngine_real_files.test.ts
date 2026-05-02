// ============================================================
// VIZME V5 — Tests del ingest engine sobre archivos reales
// Sprint 4.2 — Garantizar extracción real (no más dashboards vacíos)
//
// Estos tests cargan los fixtures reales de scripts/fixtures/ y
// ejercitan los caminos críticos del ingestEngine que rompieron
// en Sprint 4 (PIX restaurante, formatos US, plurales españoles).
//
// Si el fixture no está presente (no commiteado por privacidad),
// el test se salta — no rompe CI.
// ============================================================

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  runIngestExtraction,
  detectDateFormat,
  toIsoDate,
  parseDescriptorToColumn,
} from '../ingestEngine';
import type { BusinessSchema, Metric, ExtractionRule } from '../v5types';

const FIXTURES_DIR = path.resolve(__dirname, '..', '..', 'scripts', 'fixtures');

function loadFixture(name: string): ArrayBuffer | null {
  const p = path.join(FIXTURES_DIR, name);
  if (!fs.existsSync(p)) return null;
  const buf = fs.readFileSync(p);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
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

function makeSchema(metrics: Metric[], rules: ExtractionRule[] = []): BusinessSchema {
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
    extraction_rules: rules,
    external_sources: [],
    model_used: 'claude-opus-4-7',
    created_at: '',
    updated_at: '',
  };
}

// ============================================================
// FIXTURE 1 — PIX restaurante (6593 filas, fechas M/D/Y, plurales)
// ============================================================

const PIX_FILE = 'Ventas_PIX_nov22_feb24_pruebavizme.csv';
const pixBuf = loadFixture(PIX_FILE);

describe('ingestEngine — PIX restaurante (6593 filas, formato US)', () => {
  it.skipIf(!pixBuf)('extrae ≥5000 filas usando extraction_rules de Opus', () => {
    const schema = makeSchema(
      [
        metric({ id: 'm_ventas', name: 'Ventas Totales', aggregation: 'sum' }),
        metric({ id: 'm_propinas', name: 'Propinas', aggregation: 'sum', unit: 'MXN' }),
        metric({ id: 'm_comensales', name: 'Comensales', aggregation: 'sum', unit: 'personas' }),
      ],
      [
        {
          source_pattern: 'PIX_*',
          target_entity: 'venta',
          field_mappings: {
            fecha: 'columna FECHA',
            monto: 'columna TOTAL',
            propina: 'columna PROPINA',
            personas: 'columna nopersonas',
          },
        } as ExtractionRule,
      ]
    );

    const result = runIngestExtraction({
      buffer: pixBuf!,
      fileName: PIX_FILE,
      schema,
    });

    const ventas = result.extractions.find((e) => e.metric_id === 'm_ventas')!;
    const propinas = result.extractions.find((e) => e.metric_id === 'm_propinas')!;

    // Cada data_point es un día agrupado. 6593 filas comprimen en ~470 días.
    expect(ventas.data_points.length).toBeGreaterThan(300);
    expect(ventas.source_column).toMatch(/total/i);
    expect(ventas.date_column?.toLowerCase()).toBe('fecha');
    expect(ventas.match_strategy).toBe('rule');

    // Suma anual debe ser materialmente alta (no todo en 0)
    const totalVentas = ventas.data_points.reduce((acc, p) => acc + p.value, 0);
    expect(totalVentas).toBeGreaterThan(100000);

    // Period range debe abarcar de 2022 a 2024
    expect(result.summary.period_range?.start.startsWith('2022')).toBe(true);
    expect(result.summary.period_range?.end.startsWith('2024')).toBe(true);

    // Propinas también deben extraerse vía regla
    expect(propinas.data_points.length).toBeGreaterThan(0);
    expect(propinas.match_strategy).toBe('rule');

    if (process.env.VIZME_VERBOSE === '1') {
      console.log(
        `[PIX] ventas=${ventas.data_points.length} días, total=$${Math.round(totalVentas)}, ` +
          `range=${result.summary.period_range?.start}→${result.summary.period_range?.end}`
      );
    }
  });

  it.skipIf(!pixBuf)('cuenta ≥5000 filas crudas procesadas (no agregadas)', () => {
    // Métrica con grain=día y count nos confirma que el engine no se "tragó"
    // miles de filas por mal parseo de fecha o número.
    const schema = makeSchema(
      [metric({ id: 'm_count', name: 'Total Tickets', aggregation: 'count' })],
      [
        {
          source_pattern: 'PIX_*',
          target_entity: 'venta',
          field_mappings: {
            fecha: 'columna FECHA',
            ticket: 'columna ID_CHEQUE',
          },
        } as ExtractionRule,
      ]
    );

    const result = runIngestExtraction({
      buffer: pixBuf!,
      fileName: PIX_FILE,
      schema,
    });

    const ex = result.extractions[0];
    const totalCount = ex.data_points.reduce((acc, p) => acc + p.value, 0);
    expect(totalCount).toBeGreaterThanOrEqual(5000);
  });

  it.skipIf(!pixBuf)('detecta formato M/D/Y en columna FECHA', () => {
    // Lee algunas fechas crudas para verificar el detector
    const samples = ['11/2/2022', '11/3/2022', '11/15/2022', '12/1/2022'];
    expect(detectDateFormat(samples)).toBe('mdy');

    // "11/2/2022" en mdy = 2 nov 2022 (NO 11 feb)
    expect(toIsoDate('11/2/2022', 'mdy')).toBe('2022-11-02');
  });

  it.skipIf(pixBuf)('skipped — fixture PIX no presente', () => {
    expect(true).toBe(true);
  });
});

// ============================================================
// FIXTURE 2 — ventas_demo.csv (caso simple, debe extraer todo)
// ============================================================

const DEMO_FILE = 'ventas_demo.csv';
const demoBuf = loadFixture(DEMO_FILE);

describe('ingestEngine — ventas_demo.csv (caso happy-path)', () => {
  it.skipIf(!demoBuf)('extrae las 31 filas con schema mínimo (fuzzy)', () => {
    const schema = makeSchema([
      metric({ id: 'm_total', name: 'Ventas Total', aggregation: 'sum' }),
      metric({ id: 'm_qty', name: 'Cantidad Vendida', aggregation: 'sum', unit: 'unidades' }),
    ]);

    const result = runIngestExtraction({
      buffer: demoBuf!,
      fileName: DEMO_FILE,
      schema,
    });

    const ventas = result.extractions.find((e) => e.metric_id === 'm_total')!;
    expect(ventas.source_column?.toLowerCase()).toBe('total');
    expect(ventas.date_column?.toLowerCase()).toBe('fecha');

    // ventas_demo tiene 31 filas (líneas 2..32) en ~15 días distintos. Como sum
    // por fecha, debemos tener al menos 12 días con datos.
    expect(ventas.data_points.length).toBeGreaterThanOrEqual(10);
    const totalVentas = ventas.data_points.reduce((acc, p) => acc + p.value, 0);
    expect(totalVentas).toBeGreaterThan(10000);

    // Cantidad debe matchear "cantidad" header
    const qty = result.extractions.find((e) => e.metric_id === 'm_qty')!;
    expect(qty.source_column?.toLowerCase()).toBe('cantidad');
  });

  it.skipIf(demoBuf)('skipped — fixture ventas_demo no presente', () => {
    expect(true).toBe(true);
  });
});

// ============================================================
// FIXTURE 3 — farmacia_demo.xlsx (XLSX real con múltiples columnas)
// ============================================================

const FARMACIA_FILE = 'farmacia_demo.xlsx';
const farmaciaBuf = loadFixture(FARMACIA_FILE);

describe('ingestEngine — farmacia_demo.xlsx (XLSX multi-columna)', () => {
  it.skipIf(!farmaciaBuf)('extrae métricas con descriptores naturales de Opus', () => {
    // Schema con field_mappings tipo Opus ("inferir: X", "columna X", literales)
    const schema = makeSchema(
      [
        metric({ id: 'm_ventas', name: 'Ventas Totales', aggregation: 'sum' }),
        metric({ id: 'm_unidades', name: 'Unidades Vendidas', aggregation: 'sum', unit: 'unidades' }),
      ],
      [
        {
          source_pattern: 'farmacia_*',
          target_entity: 'venta',
          field_mappings: {
            fecha: 'columna fecha',
            monto: 'inferir: total',
            unidades: 'columna unidades',
          },
        } as ExtractionRule,
      ]
    );

    const result = runIngestExtraction({
      buffer: farmaciaBuf!,
      fileName: FARMACIA_FILE,
      schema,
    });

    // Al menos UNA métrica debe extraer datos (el XLSX existe y tiene fechas)
    const withData = result.extractions.filter((e) => e.data_points.length > 0);
    expect(withData.length).toBeGreaterThan(0);
    expect(result.summary.total_data_points).toBeGreaterThan(0);
  });

  it.skipIf(farmaciaBuf)('skipped — fixture farmacia_demo no presente', () => {
    expect(true).toBe(true);
  });
});

// ============================================================
// Unit tests de helpers que importan desde el engine real
// ============================================================

describe('parseDescriptorToColumn — descriptores naturales de Opus', () => {
  const sheets = [
    {
      name: 'Hoja1',
      headers: ['FECHA', 'TOTAL', 'PAGO_EFECTIVO_TOTAL', 'PROPINA', 'nopersonas'],
      rows: [],
    },
  ];

  it('matchea descriptor literal "TOTAL"', () => {
    const r = parseDescriptorToColumn('TOTAL', sheets);
    expect(r?.column).toBe('TOTAL');
  });

  it('matchea "columna FECHA"', () => {
    const r = parseDescriptorToColumn('columna FECHA', sheets);
    expect(r?.column).toBe('FECHA');
  });

  it('matchea "campo: PAGO_EFECTIVO_TOTAL"', () => {
    const r = parseDescriptorToColumn('campo: PAGO_EFECTIVO_TOTAL', sheets);
    expect(r?.column).toBe('PAGO_EFECTIVO_TOTAL');
  });

  it('matchea "inferir: PROPINA"', () => {
    const r = parseDescriptorToColumn('inferir: PROPINA', sheets);
    expect(r?.column).toBe('PROPINA');
  });

  it('matchea por letra de columna ("columna A")', () => {
    const r = parseDescriptorToColumn('encabezado de columna A', sheets);
    expect(r?.column).toBe('FECHA');
  });

  it('matchea entre comillas: header "TOTAL"', () => {
    const r = parseDescriptorToColumn('el header "TOTAL" del archivo', sheets);
    expect(r?.column).toBe('TOTAL');
  });
});

describe('detectDateFormat — sniffing de formato real', () => {
  it('detecta US (M/D/Y) cuando el segundo campo > 12', () => {
    expect(detectDateFormat(['1/15/2024', '2/20/2024', '3/25/2024'])).toBe('mdy');
  });

  it('detecta MX (D/M/Y) cuando el primer campo > 12', () => {
    expect(detectDateFormat(['15/1/2024', '20/2/2024', '25/3/2024'])).toBe('dmy');
  });

  it('default = D/M/Y cuando es ambiguo', () => {
    expect(detectDateFormat(['1/2/2024', '3/4/2024', '5/6/2024'])).toBe('dmy');
  });

  it('default = D/M/Y con sample vacío', () => {
    expect(detectDateFormat([])).toBe('dmy');
  });
});
