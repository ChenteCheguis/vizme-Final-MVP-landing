// ─────────────────────────────────────────────
// aggregateData.ts
// Groups and aggregates raw rows for Recharts.
// ─────────────────────────────────────────────

export type Aggregation = 'sum' | 'avg' | 'count' | 'max' | 'min';
export type SortOrder   = 'value_desc' | 'value_asc' | 'name_asc' | 'none';

// Strip common currency / percent formatting and parse to number
export function parseNumeric(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const s = String(v).replace(/[$€£¥,\s%]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ─────────────────────────────────────────────
// Core aggregation
// ─────────────────────────────────────────────

export function aggregateData(
  rawData: Record<string, unknown>[],
  groupByColumn: string,
  valueColumn: string,
  aggregation: Aggregation,
  sortBy: SortOrder = 'value_desc',
  limit = 20,
): { name: string; value: number }[] {
  const buckets: Record<string, number[]> = {};

  for (const row of rawData) {
    const key = String(row[groupByColumn] ?? 'N/A').trim();
    if (!key || key === '' || key === 'null' || key === 'undefined') continue;

    const num = parseNumeric(row[valueColumn]);

    if (!(key in buckets)) buckets[key] = [];
    if (aggregation === 'count') {
      buckets[key].push(1);
    } else if (num !== null) {
      buckets[key].push(num);
    }
  }

  const result: { name: string; value: number }[] = Object.entries(buckets)
    .map(([name, vals]) => {
      let value: number;
      switch (aggregation) {
        case 'sum':   value = vals.reduce((a, b) => a + b, 0); break;
        case 'avg':   value = vals.reduce((a, b) => a + b, 0) / vals.length; break;
        case 'count': value = vals.length; break;
        case 'max':   value = Math.max(...vals); break;
        case 'min':   value = Math.min(...vals); break;
      }
      return { name, value };
    })
    .filter((d) => isFinite(d.value));

  switch (sortBy) {
    case 'value_desc': result.sort((a, b) => b.value - a.value); break;
    case 'value_asc':  result.sort((a, b) => a.value - b.value); break;
    case 'name_asc':   result.sort((a, b) => a.name.localeCompare(b.name)); break;
  }

  return result.slice(0, limit);
}

// ─────────────────────────────────────────────
// Temporal series (for line/area charts)
// ─────────────────────────────────────────────

export function buildTimeSeries(
  rawData: Record<string, unknown>[],
  dateColumn: string,
  valueColumns: string[],
  aggregation: Aggregation = 'sum',
): Record<string, unknown>[] {
  const buckets: Record<string, Record<string, number[]>> = {};

  for (const row of rawData) {
    const rawDate = row[dateColumn];
    if (!rawDate) continue;

    let dateKey: string;
    try {
      const d = new Date(String(rawDate));
      if (isNaN(d.getTime())) continue;
      // Group by month (YYYY-MM) for enough data points
      dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } catch {
      continue;
    }

    if (!buckets[dateKey]) buckets[dateKey] = {};
    for (const col of valueColumns) {
      if (!buckets[dateKey][col]) buckets[dateKey][col] = [];
      const num = parseNumeric(row[col]);
      if (num !== null) buckets[dateKey][col].push(num);
    }
  }

  // If fewer than 3 unique months, fall back to day grouping
  const keys = Object.keys(buckets).sort();
  if (keys.length < 3) {
    const dayBuckets: Record<string, Record<string, number[]>> = {};
    for (const row of rawData) {
      const rawDate = row[dateColumn];
      if (!rawDate) continue;
      try {
        const d = new Date(String(rawDate));
        if (isNaN(d.getTime())) continue;
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!dayBuckets[dateKey]) dayBuckets[dateKey] = {};
        for (const col of valueColumns) {
          if (!dayBuckets[dateKey][col]) dayBuckets[dateKey][col] = [];
          const num = parseNumeric(row[col]);
          if (num !== null) dayBuckets[dateKey][col].push(num);
        }
      } catch { /* skip */ }
    }
    return buildFromBuckets(dayBuckets, valueColumns, aggregation);
  }

  return buildFromBuckets(buckets, valueColumns, aggregation);
}

function buildFromBuckets(
  buckets: Record<string, Record<string, number[]>>,
  valueColumns: string[],
  aggregation: Aggregation,
): Record<string, unknown>[] {
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, colVals]) => {
      const entry: Record<string, unknown> = { label };
      for (const col of valueColumns) {
        const vals = colVals[col] ?? [];
        if (vals.length === 0) { entry[col] = 0; continue; }
        switch (aggregation) {
          case 'sum':   entry[col] = vals.reduce((a, b) => a + b, 0); break;
          case 'avg':   entry[col] = vals.reduce((a, b) => a + b, 0) / vals.length; break;
          case 'count': entry[col] = vals.length; break;
          case 'max':   entry[col] = Math.max(...vals); break;
          case 'min':   entry[col] = Math.min(...vals); break;
        }
      }
      return entry;
    });
}

// ─────────────────────────────────────────────
// Scatter/bubble data
// ─────────────────────────────────────────────

export function buildScatterData(
  rawData: Record<string, unknown>[],
  xColumn: string,
  yColumn: string,
  sizeColumn?: string,
): { x: number; y: number; z?: number }[] {
  const result: { x: number; y: number; z?: number }[] = [];
  for (const row of rawData) {
    const x = parseNumeric(row[xColumn]);
    const y = parseNumeric(row[yColumn]);
    if (x === null || y === null) continue;
    const z = sizeColumn ? (parseNumeric(row[sizeColumn]) ?? undefined) : undefined;
    result.push({ x, y, z });
    if (result.length >= 200) break;
  }
  return result;
}

// ─────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────

export function formatValue(value: number, format: 'currency' | 'number' | 'percentage'): string {
  if (!isFinite(value)) return '—';
  switch (format) {
    case 'currency':
      return value >= 1_000_000
        ? `$${(value / 1_000_000).toFixed(1)}M`
        : value >= 1_000
        ? `$${(value / 1_000).toFixed(0)}K`
        : `$${value.toFixed(0)}`;
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return value >= 1_000_000
        ? `${(value / 1_000_000).toFixed(1)}M`
        : value >= 1_000
        ? `${(value / 1_000).toFixed(0)}K`
        : value % 1 === 0
        ? value.toLocaleString('es-MX')
        : value.toFixed(2);
  }
}
