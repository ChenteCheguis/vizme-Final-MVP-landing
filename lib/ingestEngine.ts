// ============================================================
// VIZME V5 — Ingest Engine (pure JS, no AI calls)
// Sprint 4.2 — Robust extraction over real-world files
//
// Strategy (in priority order):
//  1. extraction_rules.field_mappings: parse natural-language
//     descriptors ("columna X", "X", "campo Y") → real header
//  2. Fuzzy match metric.name vs headers (substring + plural-tolerant)
//  3. Smart date column detection per sheet (keyword + value sniffing)
//  4. Per-column date format detection (D/M/Y vs M/D/Y vs ISO)
//  5. Single-sheet auto-fallback (no sheet matching needed)
//
// All-pure → fully unit-testable, no Deno / no Supabase deps.
// ============================================================

import * as XLSX from 'xlsx';
import type { BusinessSchema, ExtractionRule, Metric } from './v5types';

export interface IngestDataPoint {
  period_start: string; // ISO yyyy-mm-dd
  period_end?: string;
  value: number;
  // Sprint 4.3: # of source-file rows aggregated into `value`.
  // Required for correct period-level count/avg in metricCalculator.
  count_source_rows: number;
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
  match_strategy: 'rule' | 'fuzzy' | 'none';
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

const DATE_HEADER_KEYWORDS = [
  'fecha', 'date', 'periodo', 'period', 'día', 'dia', 'day',
  'semana', 'week', 'mes', 'month', 'año', 'year',
];

const COLUMN_KEYWORDS = ['columna', 'column', 'campo', 'field', 'header', 'col\\.'];

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

  const rules = schema.extraction_rules ?? [];

  for (const metric of schema.metrics ?? []) {
    const result = extractMetric(metric, rules, sheets);
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

// ============================================================
// PARSING
// ============================================================

function parseWorkbook(buffer: ArrayBuffer | Uint8Array): ParsedSheet[] {
  const wb = XLSX.read(buffer, { type: 'array', raw: true, dateNF: 'yyyy-mm-dd', cellDates: true });
  const out: ParsedSheet[] = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true, blankrows: false });
    if (raw.length < 2) continue;
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
  if (s.length === 0) return null;
  // VERDADERO/FALSO from Excel/CSV exports
  const lower = s.toLowerCase();
  if (lower === 'verdadero' || lower === 'true') return 1;
  if (lower === 'falso' || lower === 'false') return 0;
  return s;
}

// ============================================================
// EXTRACTION — rule first, fuzzy fallback
// ============================================================

function extractMetric(
  metric: Metric,
  rules: ExtractionRule[],
  sheets: ParsedSheet[]
): IngestExtractionResult {
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
    match_strategy: 'none',
    warnings,
  };

  const ruleMatch = matchUsingRules(metric, rules, sheets);
  const fuzzyMatch = matchUsingFuzzy(metric, sheets);
  const best = ruleMatch ?? fuzzyMatch;

  if (!best) {
    warnings.push(`No encontramos columna que corresponda a "${metric.name}" en este archivo.`);
    return result;
  }

  result.source_sheet = best.sheet.name;
  result.source_column = best.column;
  result.match_strategy = ruleMatch ? 'rule' : 'fuzzy';

  const dateCol = findDateColumn(best.sheet);
  result.date_column = dateCol;

  if (!dateCol) {
    const numericValues = best.sheet.rows
      .map((r) => toNumber(r[best.column]))
      .filter((n): n is number => n !== null);
    if (numericValues.length === 0) {
      warnings.push(`La columna "${best.column}" no tiene valores numéricos legibles.`);
      return result;
    }
    const aggValue = aggregate(numericValues, metric.aggregation);
    result.data_points.push({
      period_start: new Date().toISOString().slice(0, 10),
      value: aggValue,
      count_source_rows: numericValues.length,
      dimension_values: {},
    });
    warnings.push('No detectamos una columna de fecha — usamos hoy como período.');
    result.confidence = 'low';
    return result;
  }

  // Detect date format from a sample of the column to handle US M/D/Y vs MX D/M/Y
  const dateFormat = detectDateFormat(best.sheet.rows.slice(0, 200).map((r) => r[dateCol]));

  // Sprint 4.3 — apply optional pre-filter from schema (e.g. CANCELADO=FALSO)
  // BEFORE bucketing, so cancelled tickets never enter sums or averages.
  const filteredRows = applyMetricFilter(best.sheet.rows, metric.filter);
  if (metric.filter && filteredRows.length < best.sheet.rows.length) {
    warnings.push(
      `Filtramos ${best.sheet.rows.length - filteredRows.length} filas por ${metric.filter.field} ${metric.filter.op} ${JSON.stringify(metric.filter.value)}.`
    );
  }

  const buckets = new Map<string, number[]>();
  let parsedRows = 0;
  let skippedRows = 0;
  for (const row of filteredRows) {
    const dateRaw = row[dateCol];
    const numericRaw = toNumber(row[best.column]);
    const dateIso = toIsoDate(dateRaw, dateFormat);
    if (!dateIso || numericRaw === null) {
      skippedRows++;
      continue;
    }
    parsedRows++;
    if (!buckets.has(dateIso)) buckets.set(dateIso, []);
    buckets.get(dateIso)!.push(numericRaw);
  }

  if (buckets.size === 0) {
    warnings.push('No pudimos asociar fechas con valores numéricos en este metric.');
    return result;
  }

  if (skippedRows > parsedRows * 0.5) {
    warnings.push(
      `Saltamos ${skippedRows} filas por fechas o números inválidos (procesadas ${parsedRows}).`
    );
  }

  const sorted = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));
  for (const [date, values] of sorted) {
    result.data_points.push({
      period_start: date,
      value: aggregate(values, metric.aggregation),
      count_source_rows: values.length,
      dimension_values: {},
    });
  }

  // Confidence: rule > fuzzy, more periods = higher
  if (ruleMatch && result.data_points.length >= 4) result.confidence = 'high';
  else if (result.data_points.length >= 4) result.confidence = 'high';
  else if (result.data_points.length >= 2) result.confidence = 'medium';
  else result.confidence = 'low';

  return result;
}

// ============================================================
// MATCH STRATEGY 1 — extraction_rules
// ============================================================

interface ColumnHit {
  sheet: ParsedSheet;
  column: string;
  score: number;
}

function matchUsingRules(
  metric: Metric,
  rules: ExtractionRule[],
  sheets: ParsedSheet[]
): ColumnHit | null {
  if (rules.length === 0) return null;

  const metricTokens = tokenize(metric.name);
  const formulaTokens = metric.formula ? tokenize(metric.formula) : new Set<string>();
  const allMetricTokens = new Set<string>([...metricTokens, ...formulaTokens]);

  let best: ColumnHit | null = null;

  for (const rule of rules) {
    const mappings = rule.field_mappings ?? {};
    for (const [fieldKey, descriptor] of Object.entries(mappings)) {
      if (typeof descriptor !== 'string') continue;
      const fieldTokens = tokenize(fieldKey);
      const descriptorTokens = tokenize(descriptor);

      const fieldRelevance = relevanceScore(allMetricTokens, fieldTokens);
      const descriptorRelevance = relevanceScore(allMetricTokens, descriptorTokens);
      const relevance = Math.max(fieldRelevance, descriptorRelevance);

      // Even if field key is "monto" and metric is "ventas", the descriptor
      // might mention "ventas" so we still try. But we need *some* relation.
      if (relevance === 0) continue;

      const candidate = parseDescriptorToColumn(descriptor, sheets);
      if (!candidate) continue;
      const score = relevance + 5; // rule-based gets a baseline boost
      if (!best || score > best.score) {
        best = { sheet: candidate.sheet, column: candidate.column, score };
      }
    }
  }

  return best;
}

interface DescriptorParseResult {
  sheet: ParsedSheet;
  column: string;
}

/**
 * Turn a natural-language column descriptor into an actual header on a sheet.
 * Handles forms like:
 *   - "TOTAL"                            (literal)
 *   - "columna TOTAL"                    (keyword + name)
 *   - "campo: PAGO_EFECTIVO_TOTAL"       (colon syntax)
 *   - "encabezado de columna A"          (column letter)
 *   - "header 'Ventas'"                  (quoted)
 */
export function parseDescriptorToColumn(
  descriptor: string,
  sheets: ParsedSheet[]
): DescriptorParseResult | null {
  const candidates = extractColumnNameCandidates(descriptor);

  for (const candidate of candidates) {
    // Direct match (case-insensitive, accent-insensitive)
    for (const sheet of sheets) {
      for (const header of sheet.headers) {
        if (normalizeForCompare(header) === normalizeForCompare(candidate)) {
          return { sheet, column: header };
        }
      }
    }
    // Substring match — pick the header with the longest overlap so
    // "PAGO_EFECTIVO_TOTAL" wins over "TOTAL" when the descriptor names
    // the longer one explicitly.
    let bestSubstring: { sheet: ParsedSheet; header: string; overlap: number } | null = null;
    for (const sheet of sheets) {
      for (const header of sheet.headers) {
        const h = normalizeForCompare(header);
        const c = normalizeForCompare(candidate);
        if (h.length >= 3 && c.length >= 3 && (h.includes(c) || c.includes(h))) {
          const overlap = Math.min(h.length, c.length);
          if (!bestSubstring || overlap > bestSubstring.overlap) {
            bestSubstring = { sheet, header, overlap };
          }
        }
      }
    }
    if (bestSubstring) return { sheet: bestSubstring.sheet, column: bestSubstring.header };
  }

  // Column letter fallback ("columna A", "col B")
  const letterMatch = descriptor.match(/\b(?:columna|column|col\.?)\s+([a-z])\b/i);
  if (letterMatch) {
    const idx = letterMatch[1].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
    for (const sheet of sheets) {
      if (idx < sheet.headers.length && sheet.headers[idx]) {
        return { sheet, column: sheet.headers[idx] };
      }
    }
  }

  // Last-resort: tokens of descriptor vs all headers, pick best overlap
  const descTokens = tokenize(descriptor);
  let best: { sheet: ParsedSheet; header: string; score: number } | null = null;
  for (const sheet of sheets) {
    for (const header of sheet.headers) {
      const score = relevanceScore(descTokens, tokenize(header));
      if (score > 0 && (!best || score > best.score)) {
        best = { sheet, header, score };
      }
    }
  }
  if (best) return { sheet: best.sheet, column: best.header };

  return null;
}

function extractColumnNameCandidates(descriptor: string): string[] {
  const out: string[] = [];
  const trimmed = descriptor.trim();

  // Whole descriptor as a candidate
  out.push(trimmed);

  // After "columna" / "campo" / "header" / "field" / "col."
  const keywordPattern = new RegExp(
    `(?:${COLUMN_KEYWORDS.join('|')})\\s*:?\\s+([\\p{L}0-9_\\-\\.\\s]+)`,
    'iu'
  );
  const kwMatch = trimmed.match(keywordPattern);
  if (kwMatch) out.push(kwMatch[1].trim());

  // After "inferir:" or ":" (Opus sometimes outputs "inferir: TOTAL")
  const colonMatch = trimmed.match(/(?:inferir|inferred)\s*:\s*(.+)$/i);
  if (colonMatch) out.push(colonMatch[1].trim());
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon >= 0 && lastColon < trimmed.length - 1) {
    out.push(trimmed.slice(lastColon + 1).trim());
  }

  // Quoted: "X" or 'X' or `X`
  const quoted = trimmed.match(/['"`]([^'"`]+)['"`]/);
  if (quoted) out.push(quoted[1].trim());

  // Strip common Spanish prepositions and try
  const stripped = trimmed.replace(
    /^(de\s+la\s+|del\s+|de\s+|en\s+la\s+|en\s+el\s+|en\s+|the\s+)/i,
    ''
  );
  if (stripped !== trimmed) out.push(stripped);

  return Array.from(new Set(out)).filter((s) => s.length > 0);
}

// ============================================================
// MATCH STRATEGY 2 — fuzzy (improved)
// ============================================================

function matchUsingFuzzy(metric: Metric, sheets: ParsedSheet[]): ColumnHit | null {
  const metricTokens = tokenize(metric.name);
  let best: ColumnHit | null = null;

  for (const sheet of sheets) {
    for (const header of sheet.headers) {
      const headerTokens = tokenize(header);
      const score = relevanceScore(metricTokens, headerTokens);
      if (score > 0 && (!best || score > best.score)) {
        best = { sheet, column: header, score };
      }
    }
  }

  return best;
}

// ============================================================
// TOKEN MATCHING (substring + plural-tolerant)
// ============================================================

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2)
  );
}

function stem(token: string): string {
  // Spanish plural rules (loose):
  //   -ales  → -al   (totales → total)
  //   -es    → ''     (meses → mes)
  //   -s     → ''     (ventas → venta) only if length > 3
  if (token.endsWith('ales') && token.length > 4) return token.slice(0, -2); // total
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
}

/**
 * Score the relation between two token sets. Higher = better.
 * Counts:
 *   2 pts per direct token match
 *   1 pt per stem match
 *   1 pt per substring containment (≥3 char tokens)
 */
function relevanceScore(a: Set<string>, b: Set<string>): number {
  let score = 0;
  for (const ta of a) {
    for (const tb of b) {
      if (ta === tb) {
        score += 2;
        continue;
      }
      if (stem(ta) === stem(tb) && stem(ta).length >= 3) {
        score += 1;
        continue;
      }
      if (ta.length >= 3 && tb.length >= 3 && (ta.includes(tb) || tb.includes(ta))) {
        score += 1;
      }
    }
  }
  return score;
}

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ============================================================
// DATE COLUMN + FORMAT DETECTION
// ============================================================

function findDateColumn(sheet: ParsedSheet): string | null {
  for (const col of sheet.headers) {
    const lower = col.toLowerCase();
    if (DATE_HEADER_KEYWORDS.some((kw) => lower.includes(kw))) {
      const sample = sheet.rows.slice(0, 20);
      const valid = sample.some((r) => toIsoDate(r[col], 'auto') !== null);
      if (valid) return col;
    }
  }
  for (const col of sheet.headers) {
    const sample = sheet.rows.slice(0, 20);
    const valid = sample.filter((r) => toIsoDate(r[col], 'auto') !== null).length;
    if (valid >= Math.max(3, Math.floor(sample.length * 0.7))) return col;
  }
  return null;
}

export type DateFormat = 'iso' | 'dmy' | 'mdy' | 'auto';

/**
 * Sniff a sample of values to decide whether the slash/dash format is
 * D/M/Y (Mexican default) or M/D/Y (US). Returns 'auto' when unclear,
 * which downstream interprets as D/M/Y (safer for our market).
 */
export function detectDateFormat(samples: unknown[]): DateFormat {
  let dmyEvidence = 0; // first part > 12 → must be day
  let mdyEvidence = 0; // second part > 12 → must be month

  for (const v of samples) {
    if (typeof v !== 'string') continue;
    const m = v.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!m) continue;
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a > 12 && b <= 12) dmyEvidence++;
    if (b > 12 && a <= 12) mdyEvidence++;
  }

  if (mdyEvidence > 0 && dmyEvidence === 0) return 'mdy';
  if (dmyEvidence > 0 && mdyEvidence === 0) return 'dmy';
  return 'dmy'; // default: Mexican convention
}

export function toIsoDate(v: unknown, format: DateFormat = 'auto'): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
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

  // ISO yyyy-mm-dd
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // dd/mm/yyyy or mm/dd/yyyy or dd-mm-yyyy
  const slash = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slash) {
    const [, p1, p2, p3] = slash;
    const yyyy = p3.length === 2 ? `20${p3}` : p3;
    const a = parseInt(p1, 10);
    const b = parseInt(p2, 10);
    let day: number, month: number;
    if (format === 'mdy') {
      month = a;
      day = b;
    } else if (format === 'dmy') {
      day = a;
      month = b;
    } else {
      // 'auto' / 'iso' fallback: smart per-value detection
      if (a > 12) {
        day = a;
        month = b;
      } else if (b > 12) {
        month = a;
        day = b;
      } else {
        day = a;
        month = b; // Spanish default
      }
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Last resort
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

// ============================================================
// NUMERIC + AGGREGATION + GRAIN
// ============================================================

export function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    let s = v.trim();
    if (!s) return null;
    // Strip currency symbols and spaces
    s = s.replace(/[$€£¥\s]/g, '');
    // If both '.' and ',' present, the last one is decimal sep; remove the other as thousands
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma >= 0 && lastDot >= 0) {
      if (lastComma > lastDot) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (lastComma >= 0 && lastDot < 0) {
      // Only commas: ambiguous (1,500 = 1500 vs 1,5 = 1.5). Heuristic: if
      // exactly 3 digits after the last comma, treat as thousands sep.
      const after = s.length - lastComma - 1;
      if (after === 3) s = s.replace(/,/g, '');
      else s = s.replace(',', '.');
    }
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// Sprint 4.3 — pre-bucketing filter (e.g. CANCELADO=FALSO).
// Compares case-insensitively as strings. cleanCell coerces VERDADERO/FALSO
// (Spanish) and TRUE/FALSE (English) to 1/0 before bucketing — we mirror
// that coercion on the filter side so {field: 'CANCELADO', value: 'FALSO'}
// matches a cell that's now stored as the number 0.
function applyMetricFilter(
  rows: Array<Record<string, string | number | null>>,
  filter: Metric['filter']
): Array<Record<string, string | number | null>> {
  if (!filter) return rows;
  const targetField = findHeaderInsensitive(rows, filter.field);
  if (!targetField) return rows; // filter references missing column → no-op
  const norm = (v: unknown) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? '1' : '0';
    const s = String(v).trim().toLowerCase();
    if (s === 'verdadero' || s === 'true') return '1';
    if (s === 'falso' || s === 'false') return '0';
    return s;
  };
  const expected = Array.isArray(filter.value)
    ? filter.value.map((v) => norm(v))
    : [norm(filter.value)];
  return rows.filter((row) => {
    const cell = norm(row[targetField]);
    switch (filter.op) {
      case '=':
        return cell === expected[0];
      case '!=':
        return cell !== expected[0];
      case 'in':
        return expected.includes(cell);
      case 'not_in':
        return !expected.includes(cell);
      default:
        return true;
    }
  });
}

function findHeaderInsensitive(
  rows: Array<Record<string, string | number | null>>,
  field: string
): string | null {
  if (rows.length === 0) return null;
  const target = field.trim().toLowerCase();
  for (const key of Object.keys(rows[0])) {
    if (key.trim().toLowerCase() === target) return key;
  }
  return null;
}

function aggregate(values: number[], agg: Metric['aggregation']): number {
  if (values.length === 0) return 0;
  switch (agg) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'count': return values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    case 'ratio': return values.reduce((a, b) => a + b, 0) / values.length;
    default: return values.reduce((a, b) => a + b, 0);
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
