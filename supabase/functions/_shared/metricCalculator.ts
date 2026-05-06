// ============================================================
// VIZME V5 — Calculadora de métricas
// Sprint 4.3 — Correctness fix using count_source_rows
//
// Each TimeSeriesPoint represents a PRE-AGGREGATED bucket:
//   value             = the aggregated value for that bucket
//   count_source_rows = how many original CSV rows produced it
//
// Period-level aggregation rules (Sprint 4.3 fix):
//   sum   → Σ value                                  (unchanged)
//   count → Σ value             ← was values.length  (FIX)
//   avg   → Σ(value × cs) / Σ cs ← was mean(values)  (FIX)
//   min   → min(value)                               (unchanged)
//   max   → max(value)                               (unchanged)
//
// Without count_source_rows (legacy rows = default 1) the avg falls
// back to a simple mean, which is what the old code did.
// ============================================================

export type Period = 'all_time' | 'last_year' | 'last_quarter' | 'last_month' | 'last_week';

export interface TimeSeriesPoint {
  metric_id: string;
  value: number;
  count_source_rows?: number; // optional for backward compatibility
  period_start: string;
  dimension_values: Record<string, unknown> | null;
}

export interface MetricMeta {
  id: string;
  name: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'ratio';
  good_direction?: 'up' | 'down';
}

export interface CalculatedValue {
  value: number | null;
  // Sprint 4.3 — `source_rows` = total source rows behind `value`.
  // `data_points` = number of TimeSeriesPoints aggregated.
  // Old code only had `count` and confused the two.
  source_rows: number;
  data_points: number;
  change_percent: number | null;
  change_direction: 'up' | 'down' | 'neutral' | null;
  breakdown_by_dimension: Record<string, Array<{ key: string; value: number; source_rows: number }>>;
  time_series: Array<{ date: string; value: number; source_rows: number }> | null;
}

export const PERIODS: Period[] = ['all_time', 'last_year', 'last_quarter', 'last_month', 'last_week'];

const PERIOD_DAYS: Record<Period, number | null> = {
  all_time: null,
  last_year: 365,
  last_quarter: 90,
  last_month: 30,
  last_week: 7,
};

function srcRows(p: TimeSeriesPoint): number {
  const n = Number(p.count_source_rows);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function aggregate(points: TimeSeriesPoint[], how: MetricMeta['aggregation']): number | null {
  if (points.length === 0) return null;
  const numeric = points
    .map((p) => ({ v: Number(p.value), cs: srcRows(p) }))
    .filter((p) => Number.isFinite(p.v));
  if (numeric.length === 0) return null;

  switch (how) {
    case 'sum':
      return numeric.reduce((a, p) => a + p.v, 0);
    case 'count':
      // FIX 4.3: each point's `value` already represents a daily count
      // (because ingestEngine ran aggregate(rows, 'count') per day).
      // Period count = sum of those daily counts.
      return numeric.reduce((a, p) => a + p.v, 0);
    case 'avg':
    case 'ratio': {
      // FIX 4.3: weighted average using count_source_rows so that a
      // day with 100 tickets contributes 100x more than a day with 1.
      const numerator = numeric.reduce((a, p) => a + p.v * p.cs, 0);
      const denominator = numeric.reduce((a, p) => a + p.cs, 0);
      if (denominator === 0) return null;
      return numerator / denominator;
    }
    case 'min':
      return Math.min(...numeric.map((p) => p.v));
    case 'max':
      return Math.max(...numeric.map((p) => p.v));
  }
}

function pointsInWindow(
  points: TimeSeriesPoint[],
  endDateMs: number,
  windowDays: number | null
): TimeSeriesPoint[] {
  if (windowDays === null) return points;
  const startMs = endDateMs - windowDays * 86_400_000;
  return points.filter((p) => {
    const t = new Date(p.period_start).getTime();
    return Number.isFinite(t) && t >= startMs && t <= endDateMs;
  });
}

function previousWindow(
  points: TimeSeriesPoint[],
  endDateMs: number,
  windowDays: number
): TimeSeriesPoint[] {
  const prevEnd = endDateMs - windowDays * 86_400_000;
  return pointsInWindow(points, prevEnd, windowDays);
}

function changePct(curr: number | null, prev: number | null): number | null {
  if (curr === null || prev === null) return null;
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function direction(
  pct: number | null,
  good: 'up' | 'down' | undefined
): 'up' | 'down' | 'neutral' | null {
  if (pct === null) return null;
  if (Math.abs(pct) < 0.5) return 'neutral';
  if (pct > 0) return good === 'down' ? 'down' : 'up';
  return good === 'down' ? 'up' : 'down';
}

function aggregateBucket(
  rows: Array<{ v: number; cs: number }>,
  how: MetricMeta['aggregation']
): number {
  switch (how) {
    case 'sum':
    case 'count':
      return rows.reduce((a, p) => a + p.v, 0);
    case 'min':
      return Math.min(...rows.map((p) => p.v));
    case 'max':
      return Math.max(...rows.map((p) => p.v));
    case 'avg':
    case 'ratio':
    default: {
      const numerator = rows.reduce((a, p) => a + p.v * p.cs, 0);
      const denominator = rows.reduce((a, p) => a + p.cs, 0);
      return denominator === 0 ? 0 : numerator / denominator;
    }
  }
}

function buildTimeSeries(
  points: TimeSeriesPoint[],
  how: MetricMeta['aggregation']
): Array<{ date: string; value: number; source_rows: number }> {
  // Group by date (yyyy-mm-dd), aggregate within day.
  const byDay = new Map<string, Array<{ v: number; cs: number }>>();
  for (const p of points) {
    const d = (p.period_start ?? '').slice(0, 10);
    if (!d) continue;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push({ v: Number(p.value), cs: srcRows(p) });
  }
  const out: Array<{ date: string; value: number; source_rows: number }> = [];
  for (const [date, vals] of byDay.entries()) {
    const filtered = vals.filter((p) => Number.isFinite(p.v));
    if (filtered.length === 0) continue;
    out.push({
      date,
      value: aggregateBucket(filtered, how),
      source_rows: filtered.reduce((a, p) => a + p.cs, 0),
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

function buildBreakdown(
  points: TimeSeriesPoint[],
  how: MetricMeta['aggregation']
): Record<string, Array<{ key: string; value: number; source_rows: number }>> {
  const byDim = new Map<string, Map<string, Array<{ v: number; cs: number }>>>();
  for (const p of points) {
    const dvs = (p.dimension_values ?? {}) as Record<string, unknown>;
    for (const [dim, val] of Object.entries(dvs)) {
      if (val === null || val === undefined) continue;
      const key = String(val);
      if (!byDim.has(dim)) byDim.set(dim, new Map());
      const map = byDim.get(dim)!;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ v: Number(p.value), cs: srcRows(p) });
    }
  }
  const out: Record<string, Array<{ key: string; value: number; source_rows: number }>> = {};
  for (const [dim, keyMap] of byDim.entries()) {
    const arr: Array<{ key: string; value: number; source_rows: number }> = [];
    for (const [key, vals] of keyMap.entries()) {
      const filtered = vals.filter((p) => Number.isFinite(p.v));
      if (filtered.length === 0) continue;
      arr.push({
        key,
        value: aggregateBucket(filtered, how),
        source_rows: filtered.reduce((a, p) => a + p.cs, 0),
      });
    }
    arr.sort((a, b) => b.value - a.value);
    out[dim] = arr.slice(0, 10);
  }
  return out;
}

export function calculateMetric(
  meta: MetricMeta,
  metricPoints: TimeSeriesPoint[],
  period: Period,
  refDateMs: number = Date.now()
): CalculatedValue {
  const windowDays = PERIOD_DAYS[period];
  const window = pointsInWindow(metricPoints, refDateMs, windowDays);
  const value = aggregate(window, meta.aggregation);

  let changePercent: number | null = null;
  let changeDir: 'up' | 'down' | 'neutral' | null = null;
  if (windowDays !== null && window.length > 0) {
    const prev = previousWindow(metricPoints, refDateMs, windowDays);
    const prevValue = aggregate(prev, meta.aggregation);
    changePercent = changePct(value, prevValue);
    changeDir = direction(changePercent, meta.good_direction);
  }

  const ts =
    period === 'all_time' || period === 'last_year' ? buildTimeSeries(window, meta.aggregation) : null;

  const breakdown = buildBreakdown(window, meta.aggregation);
  const sourceRows = window.reduce((a, p) => a + srcRows(p), 0);

  return {
    value,
    source_rows: sourceRows,
    data_points: window.length,
    change_percent: changePercent,
    change_direction: changeDir,
    breakdown_by_dimension: breakdown,
    time_series: ts,
  };
}

export interface CalculateAllArgs {
  metrics: MetricMeta[];
  points: TimeSeriesPoint[];
  refDateMs?: number;
}

export interface CalculatedRow {
  metric_id: string;
  period: Period;
  value: CalculatedValue;
}

export function calculateAllMetrics(args: CalculateAllArgs): CalculatedRow[] {
  const refDateMs = args.refDateMs ?? Date.now();
  const byMetric = new Map<string, TimeSeriesPoint[]>();
  for (const p of args.points) {
    if (!byMetric.has(p.metric_id)) byMetric.set(p.metric_id, []);
    byMetric.get(p.metric_id)!.push(p);
  }

  const out: CalculatedRow[] = [];
  for (const meta of args.metrics) {
    const points = byMetric.get(meta.id) ?? [];
    for (const period of PERIODS) {
      const value = calculateMetric(meta, points, period, refDateMs);
      out.push({ metric_id: meta.id, period, value });
    }
  }
  return out;
}
