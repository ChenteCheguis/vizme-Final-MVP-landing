// ============================================================
// VIZME V5 — Sprint 4.3 quality gate
//
// Calcula métricas del CSV PIX manualmente con Node y las compara
// contra la salida de runIngestExtraction + calculateAllMetrics.
// Threshold de error: 1%. Si CUALQUIER métrica falla, exit 1.
//
// Uso:
//   npm run validate:pix
//   npm run validate:pix -- --file ./scripts/fixtures/Otro.csv
// ============================================================

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runIngestExtraction } from '../lib/ingestEngine.js';
import {
  calculateAllMetrics,
  type MetricMeta,
  type TimeSeriesPoint,
} from '../supabase/functions/_shared/metricCalculator.js';
import type { BusinessSchema, Metric } from '../lib/v5types.js';

const argv = process.argv.slice(2);
const fileArgIdx = argv.indexOf('--file');
const filePath = resolve(
  fileArgIdx >= 0 ? argv[fileArgIdx + 1] : './scripts/fixtures/Ventas_PIX_nov22_feb24_pruebavizme.csv'
);

if (!existsSync(filePath)) {
  console.error(`✘ No encontré ${filePath}.`);
  process.exit(1);
}

console.log(`\n→ Validando ${filePath}\n`);

// ── 1. Cálculo manual desde el CSV ─────────────────────
const raw = readFileSync(filePath);
const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);

interface PixRow {
  ID_CHEQUE: string;
  TOTAL: number;
  CANCELADO: string;
  PAGO_EFECTIVO_TOTAL: number;
  PAGO_TARJETA_TOTAL: number;
  PROPINA: number;
  FECHA: string;
  mesero: string;
}

const text = raw.toString('utf-8');
const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
const headers = lines[0].split(',');
const rows: PixRow[] = lines.slice(1).map((line) => {
  const cells = line.split(',');
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => (obj[h] = cells[i] ?? ''));
  return {
    ID_CHEQUE: obj.ID_CHEQUE,
    TOTAL: Number(obj.TOTAL) || 0,
    CANCELADO: obj.CANCELADO,
    PAGO_EFECTIVO_TOTAL: Number(obj.PAGO_EFECTIVO_TOTAL) || 0,
    PAGO_TARJETA_TOTAL: Number(obj.PAGO_TARJETA_TOTAL) || 0,
    PROPINA: Number(obj.PROPINA) || 0,
    FECHA: obj.FECHA,
    mesero: obj.mesero,
  };
});

const valid = rows.filter((r) => r.CANCELADO?.trim().toUpperCase() === 'FALSO');

const manual = {
  ventas_totales: valid.reduce((a, r) => a + r.TOTAL, 0),
  tickets_exitosos: valid.length,
  ticket_promedio: valid.reduce((a, r) => a + r.TOTAL, 0) / valid.length,
  pago_efectivo_totales: valid.reduce((a, r) => a + r.PAGO_EFECTIVO_TOTAL, 0),
  pago_tarjeta_totales: valid.reduce((a, r) => a + r.PAGO_TARJETA_TOTAL, 0),
  propinas_totales: valid.reduce((a, r) => a + r.PROPINA, 0),
};

console.log('Cálculo manual desde CSV (excluye CANCELADO=VERDADERO):');
console.log(`  Filas totales:           ${rows.length}`);
console.log(`  Filas válidas:           ${valid.length}`);
console.log(`  Ventas totales:          $${manual.ventas_totales.toFixed(2)}`);
console.log(`  Ticket promedio:         $${manual.ticket_promedio.toFixed(2)}`);
console.log(`  Tickets exitosos:        ${manual.tickets_exitosos}`);
console.log(`  Pago efectivo:           $${manual.pago_efectivo_totales.toFixed(2)}`);
console.log(`  Pago tarjeta:            $${manual.pago_tarjeta_totales.toFixed(2)}`);
console.log(`  Propinas totales:        $${manual.propinas_totales.toFixed(2)}`);

// ── 2. Construir un schema mínimo PIX ─────────────────
const metrics: Metric[] = [
  {
    id: 'ventas_totales',
    name: 'Ventas Totales',
    description: 'Suma de TOTAL en tickets no cancelados.',
    formula: 'sum(TOTAL) where CANCELADO=FALSO',
    unit: 'MXN',
    aggregation: 'sum',
    format: 'currency',
    good_direction: 'up',
    filter: { field: 'CANCELADO', op: '=', value: 'FALSO' },
  },
  {
    id: 'tickets_exitosos',
    name: 'Tickets Exitosos',
    description: 'Conteo de tickets con CANCELADO=FALSO.',
    formula: 'count(*) where CANCELADO=FALSO',
    unit: 'tickets',
    aggregation: 'count',
    format: 'number',
    good_direction: 'up',
    filter: { field: 'CANCELADO', op: '=', value: 'FALSO' },
  },
  {
    id: 'ticket_promedio',
    name: 'Ticket Promedio',
    description: 'Promedio de TOTAL en tickets no cancelados.',
    formula: 'avg(TOTAL) where CANCELADO=FALSO',
    unit: 'MXN',
    aggregation: 'avg',
    format: 'currency',
    good_direction: 'up',
    filter: { field: 'CANCELADO', op: '=', value: 'FALSO' },
  },
  {
    id: 'pago_efectivo_totales',
    name: 'Pago Efectivo Totales',
    description: 'Suma de PAGO_EFECTIVO_TOTAL en tickets no cancelados.',
    formula: 'sum(PAGO_EFECTIVO_TOTAL) where CANCELADO=FALSO',
    unit: 'MXN',
    aggregation: 'sum',
    format: 'currency',
    good_direction: 'up',
    filter: { field: 'CANCELADO', op: '=', value: 'FALSO' },
  },
  {
    id: 'pago_tarjeta_totales',
    name: 'Pago Tarjeta Totales',
    description: 'Suma de PAGO_TARJETA_TOTAL en tickets no cancelados.',
    formula: 'sum(PAGO_TARJETA_TOTAL) where CANCELADO=FALSO',
    unit: 'MXN',
    aggregation: 'sum',
    format: 'currency',
    good_direction: 'up',
    filter: { field: 'CANCELADO', op: '=', value: 'FALSO' },
  },
  {
    id: 'propinas_totales',
    name: 'Propinas Totales',
    description: 'Suma de PROPINA en tickets no cancelados.',
    formula: 'sum(PROPINA) where CANCELADO=FALSO',
    unit: 'MXN',
    aggregation: 'sum',
    format: 'currency',
    good_direction: 'up',
    filter: { field: 'CANCELADO', op: '=', value: 'FALSO' },
  },
];

const schema: BusinessSchema = {
  id: 'pix-validation',
  project_id: 'pix-validation',
  version: 1,
  business_identity: {
    industry: 'restaurantes',
    business_model: 'b2c',
    language: 'es-MX',
    location: { country: 'MX' },
  } as never,
  entities: [],
  metrics,
  dimensions: [],
  extraction_rules: [
    {
      source_pattern: '*',
      target_entity: 'ticket',
      field_mappings: {
        ventas_totales: 'TOTAL',
        tickets_exitosos: 'ID_CHEQUE',
        ticket_promedio: 'TOTAL',
        pago_efectivo_totales: 'PAGO_EFECTIVO_TOTAL',
        pago_tarjeta_totales: 'PAGO_TARJETA_TOTAL',
        propinas_totales: 'PROPINA',
      },
    },
  ],
  external_sources: [],
  model_used: 'manual-test',
  created_at: '',
  updated_at: '',
};

// ── 3. Vizme: extraer + calcular ─────────────────────
console.log('\n→ Corriendo runIngestExtraction…');
const ingest = runIngestExtraction({ buffer, fileName: 'pix.csv', schema });
console.log(`  Métricas extraídas: ${ingest.summary.metrics_extracted}/${ingest.summary.metrics_extracted + ingest.summary.metrics_skipped}`);
console.log(`  Total data points:  ${ingest.summary.total_data_points}`);
for (const ex of ingest.extractions) {
  console.log(
    `    - ${ex.metric_id}: ${ex.match_strategy} → ${ex.source_column ?? '(null)'} | dp=${ex.data_points.length} | warn=${ex.warnings.length}`
  );
  if (ex.warnings.length > 0) {
    for (const w of ex.warnings.slice(0, 2)) console.log(`        ! ${w}`);
  }
}

const points: TimeSeriesPoint[] = [];
for (const ex of ingest.extractions) {
  for (const dp of ex.data_points) {
    points.push({
      metric_id: ex.metric_id,
      value: dp.value,
      count_source_rows: dp.count_source_rows,
      period_start: dp.period_start,
      dimension_values: dp.dimension_values ?? null,
    });
  }
}

const refDateMs = points
  .map((p) => new Date(p.period_start).getTime())
  .filter(Number.isFinite)
  .sort()
  .at(-1) ?? Date.now();

const calcMetas: MetricMeta[] = metrics.map((m) => ({
  id: m.id,
  name: m.name,
  aggregation: m.aggregation,
  good_direction: m.good_direction,
}));
const calculated = calculateAllMetrics({ metrics: calcMetas, points, refDateMs });

const allTime = new Map<string, number | null>();
for (const c of calculated) {
  if (c.period === 'all_time') allTime.set(c.metric_id, c.value.value);
}

// ── 4. Comparar y reportar ─────────────────────
const checks: Array<{ name: string; real: number; vizme: number | null; threshold: number }> = [
  { name: 'ventas_totales', real: manual.ventas_totales, vizme: allTime.get('ventas_totales') ?? null, threshold: 0.01 },
  { name: 'tickets_exitosos', real: manual.tickets_exitosos, vizme: allTime.get('tickets_exitosos') ?? null, threshold: 0.01 },
  { name: 'ticket_promedio', real: manual.ticket_promedio, vizme: allTime.get('ticket_promedio') ?? null, threshold: 0.01 },
  { name: 'pago_efectivo_totales', real: manual.pago_efectivo_totales, vizme: allTime.get('pago_efectivo_totales') ?? null, threshold: 0.01 },
  { name: 'pago_tarjeta_totales', real: manual.pago_tarjeta_totales, vizme: allTime.get('pago_tarjeta_totales') ?? null, threshold: 0.01 },
  { name: 'propinas_totales', real: manual.propinas_totales, vizme: allTime.get('propinas_totales') ?? null, threshold: 0.01 },
];

console.log('\n┌──────────────────────────┬──────────────────┬──────────────────┬──────────┬────────┐');
console.log('│ Métrica                  │ Real (CSV)       │ Vizme            │ Diff %   │ Status │');
console.log('├──────────────────────────┼──────────────────┼──────────────────┼──────────┼────────┤');

let failed = 0;
for (const c of checks) {
  const real = c.real;
  const vizme = c.vizme;
  if (vizme === null || vizme === undefined) {
    console.log(`│ ${c.name.padEnd(24)} │ ${real.toFixed(2).padStart(16)} │ ${'(null)'.padStart(16)} │ ${'—'.padStart(8)} │   ❌    │`);
    failed++;
    continue;
  }
  const diff = real === 0 ? (vizme === 0 ? 0 : 1) : Math.abs(real - vizme) / Math.abs(real);
  const ok = diff < c.threshold;
  if (!ok) failed++;
  console.log(
    `│ ${c.name.padEnd(24)} │ ${real.toFixed(2).padStart(16)} │ ${vizme.toFixed(2).padStart(16)} │ ${(diff * 100).toFixed(2).padStart(7)}% │   ${ok ? '✅' : '❌'}    │`
  );
}

console.log('└──────────────────────────┴──────────────────┴──────────────────┴──────────┴────────┘');

if (failed > 0) {
  console.error(`\n✘ ${failed} métricas falladas (threshold ${(checks[0].threshold * 100).toFixed(1)}%).\n`);
  process.exit(1);
}
console.log('\n✓ Todas las métricas dentro del threshold.\n');
