// ─────────────────────────────────────────────
// inferDataProfile.ts
// Pure computation — no API calls.
// Takes ParsedFile rows + headers and returns DataProfile.
// ─────────────────────────────────────────────

export type ColType = 'numeric' | 'categorical' | 'date' | 'text' | 'unknown';
export type DataType = 'ventas' | 'inventario' | 'clientes' | 'operaciones' | 'financiero' | 'desconocido';

export interface ColumnProfile {
  name: string;
  type: ColType;
  nullPercentage: number;
  uniqueValues: number;
  sample: unknown[];
}

export interface ColStats {
  min: number;
  max: number;
  mean: number;
  sum: number;
  stdDev: number;
  uniqueValues?: number;
}

export interface DataProfile {
  totalRows: number;
  columns: ColumnProfile[];
  hasDateColumn: boolean;
  dateColumnName?: string;
  hasCategoryColumn: boolean;
  categoryColumns: string[];
  hasNumericColumns: boolean;
  numericColumns: string[];
  hasGeoColumn: boolean;
  geoColumnName?: string;
  dataType: DataType;
  stats: Record<string, ColStats>;
  categoryCardinality: Record<string, number>;
  nullCount: Record<string, number>;
  duplicateRows: number;
}

// ─────────────────────────────────────────────
// Patterns
// ─────────────────────────────────────────────

const DATE_PATTERN   = /fecha|date|día|dia|mes|month|semana|week|tiempo|periodo|hora|time|año|year|dt|timestamp/i;
const GEO_PATTERN    = /ciudad|estado|pais|país|región|region|municipio|city|state|country|zip|postal|colonia|delegacion/i;
const NUMERIC_FMTS   = /^\s*[$€£¥]?\s*-?[\d,]+(\.\d+)?\s*[%]?\s*$/;

const DATA_TYPE_SIGNALS: Record<DataType, RegExp> = {
  ventas:      /venta|ingres|precio|revenue|factura|ticket|compra|sale|amount|importe|cobro/i,
  inventario:  /stock|inventar|existencia|cantidad|unidad|almacen|bodega/i,
  clientes:    /client|customer|usuario|user|suscriptor|subscriber|comprad|buyer/i,
  operaciones: /operac|proceso|tarea|task|emplead|hora|tiempo|proyecto/i,
  financiero:  /gasto|costo|cost|expense|utilidad|margen|margin|egreso|profit|flujo|cash/i,
  desconocido: /.*/,
};

// ─────────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────────

function parseNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const s = String(v).replace(/[$€£¥,\s%]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function isDateValue(v: unknown): boolean {
  if (!v) return false;
  if (v instanceof Date) return true;
  const s = String(v);
  // Common date formats
  return /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(s)
    || /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(s)
    || /^\d{4}-\d{2}-\d{2}T/.test(s)
    || (!isNaN(Date.parse(s)) && s.length >= 6 && !/^\d+$/.test(s));
}

// ─────────────────────────────────────────────
// Column type detection
// ─────────────────────────────────────────────

function detectColumnType(name: string, values: unknown[]): ColType {
  if (DATE_PATTERN.test(name)) return 'date';
  const nonNull = values.filter((v) => v != null && v !== '');
  if (nonNull.length === 0) return 'unknown';

  const dateCount  = nonNull.filter(isDateValue).length;
  if (dateCount / nonNull.length >= 0.7) return 'date';

  const numericCount = nonNull.filter((v) => NUMERIC_FMTS.test(String(v)) || (typeof v === 'number' && !isNaN(v))).length;
  const numRatio = numericCount / nonNull.length;

  if (numRatio >= 0.7) return 'numeric';

  const uniqueRatio = new Set(nonNull.map(String)).size / nonNull.length;
  if (uniqueRatio <= 0.5 || nonNull.length > 20) return 'categorical';
  if (nonNull.some((v) => String(v).length > 50)) return 'text';

  return 'categorical';
}

// ─────────────────────────────────────────────
// Numeric stats
// ─────────────────────────────────────────────

function computeStats(values: unknown[]): ColStats | null {
  const nums = values.map(parseNumber).filter((n): n is number => n !== null);
  if (nums.length === 0) return null;

  const sum  = nums.reduce((a, b) => a + b, 0);
  const mean = sum / nums.length;
  const min  = Math.min(...nums);
  const max  = Math.max(...nums);
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  const stdDev = Math.sqrt(variance);

  return { min, max, mean, sum, stdDev };
}

// ─────────────────────────────────────────────
// Duplicate detection
// ─────────────────────────────────────────────

function countDuplicates(rows: Record<string, unknown>[], headers: string[]): number {
  const keyCols = headers.slice(0, Math.min(4, headers.length));
  const seen = new Set<string>();
  let dupes = 0;
  for (const row of rows) {
    const fp = keyCols.map((k) => String(row[k] ?? '')).join('||');
    if (seen.has(fp)) dupes++;
    else seen.add(fp);
  }
  return dupes;
}

// ─────────────────────────────────────────────
// DataType inference
// ─────────────────────────────────────────────

function inferDataType(headers: string[]): DataType {
  const allCols = headers.join(' ');
  const order: DataType[] = ['ventas', 'inventario', 'clientes', 'operaciones', 'financiero'];
  for (const dt of order) {
    if (DATA_TYPE_SIGNALS[dt].test(allCols)) return dt;
  }
  return 'desconocido';
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// Enriched profile for V3 AI calls
// ─────────────────────────────────────────────

import type { EnrichedProfile, CrossTab, TimeSeries } from './v3types';

function parseNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const n = parseFloat(String(v).replace(/[$€£¥,\s%]/g, ''));
  return isNaN(n) ? null : n;
}

function pearsonR(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 4) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const dx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0));
  const dy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return dx === 0 || dy === 0 ? 0 : num / (dx * dy);
}

function buildCrossTabs(
  rows: Record<string, unknown>[],
  catCols: string[],
  numCols: string[],
  limit = 15,
): CrossTab[] {
  const tabs: CrossTab[] = [];
  for (const cat of catCols.slice(0, 4)) {
    for (const num of numCols.slice(0, 5)) {
      const buckets: Record<string, number[]> = {};
      for (const row of rows) {
        const key = String(row[cat] ?? 'N/A').trim();
        if (!key || key === 'null') continue;
        const v = parseNum(row[num]);
        if (v !== null) {
          buckets[key] = buckets[key] ?? [];
          buckets[key].push(v);
        }
      }
      const total = Object.values(buckets).flat().reduce((a, b) => a + b, 0);
      const data = Object.entries(buckets)
        .map(([name, vals]) => ({
          name,
          value: Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100,
          pct: total > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
      if (data.length >= 2) {
        tabs.push({ catColumn: cat, numColumn: num, aggregation: 'sum', data });
      }
    }
  }
  return tabs;
}

function detectDateGranularity(vals: string[]): 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' {
  const sample = vals.slice(0, 20);
  if (sample.some(v => /^\d{4}$/.test(v.trim()))) return 'yearly';
  if (sample.some(v => /Q\d/i.test(v))) return 'quarterly';
  if (sample.some(v => /^\d{4}-\d{2}$|^[a-z]{3,}-?\d{2,4}$/i.test(v.trim()))) return 'monthly';
  // Check date spread
  const dates = sample.map(v => new Date(v)).filter(d => !isNaN(d.getTime()));
  if (dates.length < 2) return 'monthly';
  const span = (Math.max(...dates.map(d => d.getTime())) - Math.min(...dates.map(d => d.getTime()))) / 86400000;
  if (span <= 90) return 'daily';
  if (span <= 365) return 'weekly';
  if (span <= 730) return 'monthly';
  return 'quarterly';
}

function buildTimeSeries(
  rows: Record<string, unknown>[],
  dateCol: string,
  numCols: string[],
): TimeSeries[] {
  const series: TimeSeries[] = [];
  const dateVals = rows.map(r => String(r[dateCol] ?? '')).filter(Boolean);
  const granularity = detectDateGranularity(dateVals);

  for (const num of numCols.slice(0, 3)) {
    const buckets: Record<string, number[]> = {};
    for (const row of rows) {
      const raw = String(row[dateCol] ?? '').trim();
      if (!raw) continue;
      // Normalize to period key
      let period = raw;
      try {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          if (granularity === 'yearly') period = String(d.getFullYear());
          else if (granularity === 'quarterly') period = `${d.getFullYear()} Q${Math.ceil((d.getMonth() + 1) / 3)}`;
          else if (granularity === 'monthly') period = d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short' });
          else period = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        }
      } catch { /* keep raw */ }
      const v = parseNum(row[num]);
      if (v !== null) {
        buckets[period] = buckets[period] ?? [];
        buckets[period].push(v);
      }
    }
    const data = Object.entries(buckets)
      .map(([period, vals]) => ({ period, value: Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 }))
      .slice(0, 24);
    if (data.length >= 2) {
      series.push({ dateColumn: dateCol, numColumn: num, aggregation: 'sum', granularity, data });
    }
  }
  return series;
}

/**
 * New extracted_data format from Claude transform_data:
 * { columns: [...], data: [...], understanding: string, ... }
 */
export interface TransformedData {
  understanding: string;
  columns: { name: string; original_name: string; type: string; description?: string }[];
  data: Record<string, unknown>[];
  summary_rows?: { label: string; value: unknown; type: string }[];
  sheet_pattern?: string;
  period_column?: string | null;
  metrics_for_weekly_entry?: { field_name: string; label: string; type: string; description: string; example_value: string }[];
  warnings?: string[];
}

export function buildEnrichedProfile(
  rows: Record<string, unknown>[],
  headers: string[],
  dp: DataProfile,
  extractedData?: TransformedData | null,
): EnrichedProfile {
  // Quality score
  const highNullCols = dp.columns.filter(c => c.nullPercentage > 0.15).length;
  const qualityScore = Math.max(10, Math.round(100 - highNullCols * 10 - (dp.duplicateRows / dp.totalRows) * 20));

  // Top values per categorical column
  const topValuesMap: Record<string, { value: string; count: number; pct: number }[]> = {};
  for (const col of dp.categoryColumns) {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const v = String(row[col] ?? '').trim();
      if (v && v !== 'null') counts[v] = (counts[v] ?? 0) + 1;
    }
    topValuesMap[col] = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([value, count]) => ({ value, count, pct: Math.round((count / rows.length) * 1000) / 10 }));
  }

  // Column details
  const columnDetails: EnrichedProfile['columnDetails'] = dp.columns.map(col => {
    const base = {
      name: col.name,
      type: col.type,
      nullPct: col.nullPercentage,
      uniqueValues: col.uniqueValues,
      sampleValues: col.sample,
    };
    if (col.type === 'numeric' && dp.stats[col.name]) {
      const s = dp.stats[col.name];
      return { ...base, min: s.min, max: s.max, mean: Math.round(s.mean * 100) / 100, sum: s.sum };
    }
    if (col.type === 'categorical' && topValuesMap[col.name]) {
      return { ...base, topValues: topValuesMap[col.name].slice(0, 10) };
    }
    if (col.type === 'date') {
      const vals = rows.map(r => String(r[col.name] ?? '')).filter(Boolean);
      if (vals.length > 0) return { ...base, dateRange: { min: vals[0], max: vals[vals.length - 1] } };
    }
    return base;
  });

  // Correlations
  const correlations: { col1: string; col2: string; r: number }[] = [];
  for (let i = 0; i < dp.numericColumns.length; i++) {
    for (let j = i + 1; j < dp.numericColumns.length; j++) {
      const c1 = dp.numericColumns[i];
      const c2 = dp.numericColumns[j];
      const pairs = rows.map(r => [parseNum(r[c1]), parseNum(r[c2])]).filter(([a, b]) => a !== null && b !== null) as [number, number][];
      if (pairs.length >= 5) {
        const r = Math.round(pearsonR(pairs.map(p => p[0]), pairs.map(p => p[1])) * 100) / 100;
        if (Math.abs(r) > 0.3) correlations.push({ col1: c1, col2: c2, r });
      }
    }
  }

  // If we have Claude's clean extracted data, use IT as the primary source
  const hasExtracted = extractedData && Array.isArray(extractedData.data) && extractedData.data.length > 0;

  // Use extracted data rows for cross tabs and time series when available
  const effectiveRows = hasExtracted ? extractedData!.data : rows;
  const effectiveHeaders = hasExtracted
    ? extractedData!.columns.map(c => c.name)
    : headers;

  // Detect numeric/category columns from extracted data
  let finalNumericColumns = dp.numericColumns;
  let finalCategoryColumns = dp.categoryColumns;
  let finalDateColumn = dp.dateColumnName ?? null;

  if (hasExtracted) {
    finalNumericColumns = extractedData!.columns
      .filter(c => ['number', 'currency', 'percentage'].includes(c.type))
      .map(c => c.name);
    finalCategoryColumns = extractedData!.columns
      .filter(c => ['text', 'category'].includes(c.type))
      .map(c => c.name);
    finalDateColumn = extractedData!.period_column
      ?? extractedData!.columns.find(c => c.type === 'date')?.name
      ?? finalDateColumn;
  }

  let finalTimeSeries: TimeSeries[] = [];
  if (finalDateColumn) {
    finalTimeSeries = buildTimeSeries(effectiveRows as Record<string, unknown>[], finalDateColumn, finalNumericColumns);
  }

  // Build key_metrics_summary from extracted data summary_rows or aggregated data
  let keyMetricsSummary: { name: string; total: number; periods: number }[] | undefined;
  if (hasExtracted) {
    keyMetricsSummary = finalNumericColumns.map(col => {
      const vals = extractedData!.data
        .map(r => parseNum(r[col]))
        .filter((n): n is number => n !== null);
      return {
        name: col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        total: Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100,
        periods: vals.length,
      };
    }).filter(m => m.total !== 0);
  }

  return {
    totalRows: hasExtracted ? extractedData!.data.length : dp.totalRows,
    totalColumns: effectiveHeaders.length,
    columnNames: effectiveHeaders,
    numericColumns: finalNumericColumns,
    categoryColumns: finalCategoryColumns,
    dateColumn: finalDateColumn,
    geoColumn: dp.geoColumnName ?? null,
    duplicateRows: dp.duplicateRows,
    detectedBusinessType: dp.dataType,
    qualityScore,
    columnDetails,
    crossTabs: buildCrossTabs(
      effectiveRows as Record<string, unknown>[],
      finalCategoryColumns,
      finalNumericColumns,
    ),
    timeSeries: finalTimeSeries,
    correlations: correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 10),
    source: hasExtracted ? 'extracted' : 'raw',
    structural_understanding: extractedData?.understanding ?? null,
    key_metrics_summary: keyMetricsSummary,
  };
}

export function inferDataProfile(
  rows: Record<string, unknown>[],
  headers: string[],
): DataProfile {
  const totalRows = rows.length;
  const columns: ColumnProfile[] = [];
  const stats: Record<string, ColStats> = {};
  const categoryCardinality: Record<string, number> = {};
  const nullCount: Record<string, number> = {};

  const numericColumns: string[] = [];
  const categoryColumns: string[] = [];
  let dateColumnName: string | undefined;
  let geoColumnName: string | undefined;

  for (const col of headers) {
    const vals = rows.map((r) => r[col]);
    const nonNull = vals.filter((v) => v != null && v !== '');
    const nulls = vals.length - nonNull.length;
    nullCount[col] = nulls;

    const type = detectColumnType(col, vals);
    const sample = nonNull.slice(0, 5);
    const uniqueValues = new Set(nonNull.map(String)).size;

    columns.push({
      name: col,
      type,
      nullPercentage: totalRows > 0 ? nulls / totalRows : 0,
      uniqueValues,
      sample,
    });

    if (type === 'numeric') {
      numericColumns.push(col);
      const s = computeStats(vals);
      if (s) stats[col] = { ...s, uniqueValues };
    }
    if (type === 'categorical') {
      categoryColumns.push(col);
      categoryCardinality[col] = uniqueValues;
    }
    if (type === 'date' && !dateColumnName) {
      dateColumnName = col;
    }
    if (!geoColumnName && GEO_PATTERN.test(col)) {
      geoColumnName = col;
    }
  }

  return {
    totalRows,
    columns,
    hasDateColumn: !!dateColumnName,
    dateColumnName,
    hasCategoryColumn: categoryColumns.length > 0,
    categoryColumns,
    hasNumericColumns: numericColumns.length > 0,
    numericColumns,
    hasGeoColumn: !!geoColumnName,
    geoColumnName,
    dataType: inferDataType(headers),
    stats,
    categoryCardinality,
    nullCount,
    duplicateRows: countDuplicates(rows, headers),
  };
}
