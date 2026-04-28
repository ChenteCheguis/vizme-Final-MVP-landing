// ============================================================
// VIZME V5 — Ingest Engine (pure JS, no AI calls)
// Sprint 3 — Ingesta Recurrente
//
// Reads a periodic Excel/CSV upload + the project's existing
// BusinessSchema, and produces a list of TimeSeriesPoint candidates
// ready to insert into time_series_data.
//
// Strategy (heuristic, pragmatic — perfect extraction is V6):
//  1. For each metric in schema.metrics, locate the best matching
//     column in any sheet by token-overlap of metric.name vs headers.
//  2. Detect a date/period column per sheet by header keywords
//     (fecha, period, semana, mes, week, month, date, día, day).
//  3. Bin every row into a period bucket (week/month inferred from
//     density) and aggregate using metric.aggregation.
//  4. Emit candidates with a confidence score so the UI can let the
//     user inspect & approve.
//
// All-pure → fully unit-testable, no Deno / no Supabase deps.
// ============================================================

import * as XLSX from 'xlsx';
import type { BusinessSchema, Metric } from './v5types';

export interface IngestDataPoint {
  period_start: string; // ISO yyyy-mm-dd
  period_end?: string;
  value: number;
  dimension_values: Record<string, string>;
}

export interface IngestExtractionResult {
  metric_id: string;
  metric_name: string;
  source_sheet: string | null;
  source_column: string | null;
  date_column: string | null;
  aggregation: Metric['aggregation'];
  data_points: IngestDataPoint[];
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

export interface IngestSummary {
  file_name: string;
  total_data_points: number;
  metrics_extracted: number;
  metrics_skipped: number;
  period_range: { start: string; end: string } | null;
  inferred_grain: 'day' | 'week' | 'month' | null;
  warnings: string[];
}

export interface IngestRunResult {
  summary: IngestSummary;
  extractions: IngestExtractionResult[];
}

const DATE_HEADER_KEYWORDS = ['fecha', 'date', 'periodo', 'period', 'día', 'dia', 'day', 'semana', 'week', 'mes', 'month', 'año', 'year'];

interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Array<Record<string, string | number | null>>;
}

export interface RunIngestArgs {
  buffer: ArrayBuffer | Uint8Array;
  fileName: string;
  schema: BusinessSchema;
}

export function runIngestExtraction({ buffer, fileName, schema }: RunIngestArgs): IngestRunResult {
  const sheets = parseWorkbook(buffer);
  const allWarnings: string[] = [];

  if (sheets.length === 0) {
    return {
      summary: emptySummary(fileName, 'Ningún sheet legible en el archivo.'),
      extractions: [],
    };
  }

  const extractions: IngestExtractionResult[] = [];
  let extracted = 0;
  let skipped = 0;
  const allDates: string[] = [];

  for (const metric of schema.metrics ?? []) {
    const result = extractMetric(metric, sheets);
    extractions.push(result);
    if (result.data_points.length > 0) {
      extracted++;
      result.data_points.forEach((p) => allDates.push(p.period_start));
    } else {
      skipped++;
    }
  }

  const periodRange = allDates.length > 0
    ? { start: allDates.reduce((a, b) => (a < b ? a : b)), end: allDates.reduce((a, b) => (a > b ? a : b)) }
    : null;

  const inferredGrain = inferGrain(allDates);

  return {
    summary: {
      file_name: fileName,
      total_data_points: extractions.reduce((acc, e) => acc + e.data_points.length, 0),
      metrics_extracted: extracted,
      metrics_skipped: skipped,
      period_range: periodRange,
      inferred_grain: inferredGrain,
      warnings: allWarnings,
    },
    extractions,
  };
}

// ------------- Internals -------------

function parseWorkbook(buffer: ArrayBuffer | Uint8Array): ParsedSheet[] {
  const wb = XLSX.read(buffer, { type: 'array', raw: true, dateNF: 'yyyy-mm-dd', cellDates: true });
  const out: ParsedSheet[] = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true, blankrows: false });
    if (raw.length < 2) continue;
    // Pick header row: first row with majority strings
    const headerRowIdx = pickHeaderRow(raw);
    const headers = (raw[headerRowIdx] ?? []).map((h) => normalizeHeader(h));
    const dataRows = raw.slice(headerRowIdx + 1);
    const rows = dataRows
      .map((r) => {
        const rec: Record<string, string | number | null> = {};
        headers.forEach((h, i) => {
          if (!h) return;
          rec[h] = cleanCell(r[i]);
        });
        return rec;
      })
      .filter((r) => Object.values(r).some((v) => v !== null && v !== ''));
    out.push({ name, headers: headers.filter(Boolean), rows });
  }
  return out;
}

function pickHeaderRow(rows: unknown[][]): number {
  const limit = Math.min(rows.length, 5);
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < limit; i++) {
    const cells = rows[i] ?? [];
    const stringCount = cells.filter((c) => typeof c === 'string' && (c as string).trim().length > 0).length;
    if (stringCount > bestScore) {
      bestScore = stringCount;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function normalizeHeader(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function cleanCell(v: unknown): string | number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function extractMetric(metric: Metric, sheets: ParsedSheet[]): IngestExtractionResult {
  const warnings: string[] = [];
  const result: IngestExtractionResult = {
    metric_id: metric.id,
    metric_name: metric.name,
    source_sheet: null,
    source_column: null,
    date_column: null,
    aggregation: metric.aggregation,
    data_points: [],
    confidence: 'low',
    warnings,
  };

  // Find best matching column across all sheets
  const metricTokens = tokenize(metric.name);
  let bestMatch: { sheet: ParsedSheet; column: string; score: number } | null = null;

  for (const sheet of sheets) {
    for (const col of sheet.headers) {
      const score = tokenOverlap(metricTokens, tokenize(col));
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { sheet, column: col, score };
      }
    }
  }

  if (!bestMatch) {
    warnings.push(`No encontramos una columna que matchee "${metric.name}" en este archivo.`);
    return result;
  }

  result.source_sheet = bestMatch.sheet.name;
  result.source_column = bestMatch.column;

  // Find date column in same sheet
  const dateCol = findDateColumn(bestMatch.sheet);
  result.date_column = dateCol;

  if (!dateCol) {
    // No date column — emit a single aggregated point with today as period
    const numericValues = bestMatch.sheet.rows
      .map((r) => toNumber(r[bestMatch!.column]))
      .filter((n): n is number => n !== null);
    if (numericValues.length === 0) {
      warnings.push(`La columna "${bestMatch.column}" no tiene valores numéricos legibles.`);
      return result;
    }
    const aggValue = aggregate(numericValues, metric.aggregation);
    result.data_points.push({
      period_start: new Date().toISOString().slice(0, 10),
      value: aggValue,
      dimension_values: {},
    });
    warnings.push('No detectamos fecha — usamos hoy como período. Considera agregar una columna fecha.');
    result.confidence = 'low';
    return result;
  }

  // Bucket rows by date
  const buckets = new Map<string, number[]>();
  for (const row of bestMatch.sheet.rows) {
    const dateRaw = row[dateCol];
    const numericRaw = toNumber(row[bestMatch.column]);
    const dateIso = toIsoDate(dateRaw);
    if (!dateIso || numericRaw === null) continue;
    if (!buckets.has(dateIso)) buckets.set(dateIso, []);
    buckets.get(dateIso)!.push(numericRaw);
  }

  if (buckets.size === 0) {
    warnings.push('No pudimos asociar fechas con valores numéricos en este metric.');
    return result;
  }

  // Emit data points (sorted)
  const sorted = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));
  for (const [date, values] of sorted) {
    result.data_points.push({
      period_start: date,
      value: aggregate(values, metric.aggregation),
      dimension_values: {},
    });
  }

  // Confidence: column score + presence of multiple periods
  if (bestMatch.score >= 2 && result.data_points.length >= 4) result.confidence = 'high';
  else if (bestMatch.score >= 1 && result.data_points.length >= 2) result.confidence = 'medium';
  else result.confidence = 'low';

  return result;
}

function findDateColumn(sheet: ParsedSheet): string | null {
  for (const col of sheet.headers) {
    const lower = col.toLowerCase();
    if (DATE_HEADER_KEYWORDS.some((kw) => lower.includes(kw))) {
      // Verify at least one row parses as a date
      const sample = sheet.rows.slice(0, 10);
      const valid = sample.some((r) => toIsoDate(r[col]) !== null);
      if (valid) return col;
    }
  }
  // Fallback: any column where most cells parse as ISO dates
  for (const col of sheet.headers) {
    const sample = sheet.rows.slice(0, 10);
    const valid = sample.filter((r) => toIsoDate(r[col]) !== null).length;
    if (valid >= Math.max(3, Math.floor(sample.length * 0.7))) return col;
  }
  return null;
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3)
  );
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  a.forEach((t) => {
    if (b.has(t)) n++;
  });
  return n;
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[$,\s]/g, '').replace(',', '.');
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toIsoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    // Excel serial date (days since 1899-12-30)
    if (v > 20000 && v < 80000) {
      const ms = (v - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return null;
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  // ISO-ish
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // dd/mm/yyyy or dd-mm-yyyy
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Generic Date constructor (last resort)
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function aggregate(values: number[], agg: Metric['aggregation']): number {
  if (values.length === 0) return 0;
  switch (agg) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'count':
      return values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'ratio':
      // For ratio metrics we don't have enough info from a single column → fall back to avg
      return values.reduce((a, b) => a + b, 0) / values.length;
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

function inferGrain(dates: string[]): 'day' | 'week' | 'month' | null {
  if (dates.length < 2) return null;
  const sorted = [...new Set(dates)].sort();
  const diffs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = new Date(sorted[i - 1]).getTime();
    const b = new Date(sorted[i]).getTime();
    diffs.push((b - a) / (1000 * 60 * 60 * 24));
  }
  const median = diffs.sort((a, b) => a - b)[Math.floor(diffs.length / 2)];
  if (median <= 1.5) return 'day';
  if (median <= 9) return 'week';
  return 'month';
}

function emptySummary(fileName: string, warning: string): IngestSummary {
  return {
    file_name: fileName,
    total_data_points: 0,
    metrics_extracted: 0,
    metrics_skipped: 0,
    period_range: null,
    inferred_grain: null,
    warnings: [warning],
  };
}
