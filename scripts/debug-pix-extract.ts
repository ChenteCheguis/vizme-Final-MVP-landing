import { runIngestExtraction } from '../lib/ingestEngine.js';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const buf = readFileSync('./scripts/fixtures/Ventas_PIX_nov22_feb24_pruebavizme.csv');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];
console.log('First 3 rows from xlsx:');
console.log(JSON.stringify(rows.slice(0, 3), null, 2));
console.log('Cancelado values seen:', [...new Set(rows.slice(0, 50).map((r) => r.CANCELADO))]);


const schema = {
  id: 't',
  project_id: 't',
  version: 1,
  business_identity: { industry: 'restaurantes' } as never,
  entities: [],
  metrics: [
    {
      id: 'ventas_totales',
      name: 'Ventas Totales',
      description: '',
      formula: 'sum(TOTAL) where CANCELADO=FALSO',
      unit: 'MXN',
      aggregation: 'sum' as const,
      format: 'currency' as const,
      good_direction: 'up' as const,
    },
  ],
  dimensions: [],
  extraction_rules: [
    {
      source_pattern: '*',
      target_entity: 'ticket',
      field_mappings: { ventas_totales: 'TOTAL' },
    },
  ],
  external_sources: [],
  model_used: 't',
  created_at: '',
  updated_at: '',
};

const r = runIngestExtraction({ buffer: ab, fileName: 'pix.csv', schema: schema as never });
console.log('Summary:', JSON.stringify(r.summary, null, 2));
console.log('Ext[0] meta:', {
  metric_id: r.extractions[0]?.metric_id,
  source_column: r.extractions[0]?.source_column,
  source_sheet: r.extractions[0]?.source_sheet,
  date_column: r.extractions[0]?.date_column,
  match_strategy: r.extractions[0]?.match_strategy,
  data_points_count: r.extractions[0]?.data_points?.length,
  warnings: r.extractions[0]?.warnings,
});
console.log('Sample dp:', JSON.stringify(r.extractions[0]?.data_points?.slice(0, 2), null, 2));
