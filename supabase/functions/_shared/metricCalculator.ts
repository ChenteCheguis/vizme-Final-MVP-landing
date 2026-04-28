// ============================================================
// VIZME V5 — Calculadora de métricas (Sprint 4)
//
// Pure-JS aggregation sobre time_series_data. NO usa LLM.
// Agrupa por (metric_id, period) y produce el shape que el
// dashboard renderea: value, count, change_percent vs período
// anterior, time_series para sparklines, breakdown por
// dimensión (top 10).
//
// Períodos soportados:
//   all_time      → todo lo cargado
//   last_year     → últimos 365 días
//   last_quarter  → últimos 90 días
//   last_month    → últimos 30 días
//   last_week     → últimos 7 días
// ============================================================

export type Period = 'all_time' | 'last_year' | 'last_quarter' | 'last_month' | 'last_week';

export interface TimeSeriesPoint {
  metric_id: string;
  value: number;
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
  count: number;
  change_percent: number | null;
  change_direction: 'up' | 'down' | 'neutral' | null;
  breakdown_by_dimension: Record<string, Array<{ key: string; value: number }>>;
  time_series: Array<{ date: string; value: number }> | null;
}

export const PERIODS: Period[] = ['all_time', 'last_year', 'last_quarter', 'last_month', 'last_week'];

const PERIOD_DAYS: Record<Period, number | null> = {
  all_time: null,
  last_year: 365,
  last_quarter: 90,
  last_month: 30,
  last_week: 7,
};

function aggregate(points: TimeSeriesPoint[], how: MetricMeta['aggregation']): number | null {
  if (points.length === 0) return null;
  const values = points.map((p) => Number(p.value)).filter((v) => Number.isFinite(v));
  if (values.length === 0) return null;
  switch (how) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'count':
      return values.length;
    case 'avg':
    case 'ratio':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
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

function buildTimeSeries(
  points: TimeSeriesPoint[],
  how: MetricMeta['aggregation']
): Array<{ date: string; value: number }> {
  // Group by date (yyyy-mm-dd), aggregate within day.
  const byDay = new Map<string, number[]>();
  for (const p of points) {
    const d = (p.period_start ?? '').slice(0, 10);
    if (!d) continue;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(Number(p.value));
  }
  const out: Array<{ date: string; value: number }> = [];
  for (const [date, vals] of byDay.entries()) {
    const filtered = vals.filter(Number.isFinite);
    if (filtered.length === 0) continue;
    let v: number;
    switch (how) {
      case 'sum':
      case 'count':
        v = filtered.reduce((a, b) => a + b, 0);
        break;
      case 'min':
        v = Math.min(...filtered);
        break;
      case 'max':
        v = Math.max(...filtered);
        break;
      default:
        v = filtered.reduce((a, b) => a + b, 0) / filtered.length;
    }
    out.push({ date, value: v });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

function buildBreakdown(
  points: TimeSeriesPoint[],
  how: MetricMeta['aggregation']
): Record<string, Array<{ key: string; value: number }>> {
  const byDim = new Map<string, Map<string, number[]>>();
  for (const p of points) {
    const dvs = (p.dimension_values ?? {}) as Record<string, unknown>;
    for (const [dim, val] of Object.entries(dvs)) {
      if (val === null || val === undefined) continue;
      const key = String(val);
      if (!byDim.has(dim)) byDim.set(dim, new Map());
      const map = byDim.get(dim)!;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(Number(p.value));
    }
  }
  const out: Record<string, Array<{ key: string; value: number }>> = {};
  for (const [dim, keyMap] of byDim.entries()) {
    const arr: Array<{ key: string; value: number }> = [];
    for (const [key, vals] of keyMap.entries()) {
      const filtered = vals.filter(Number.isFinite);
      if (filtered.length === 0) continue;
      let v: number;
      switch (how) {
        case 'sum':
        case 'count':
          v = filtered.reduce((a, b) => a + b, 0);
          break;
        case 'min':
          v = Math.min(...filtered);
          break;
        case 'max':
          v = Math.max(...filtered);
          break;
        default:
          v = filtered.reduce((a, b) => a + b, 0) / filtered.length;
      }
      arr.push({ key, value: v });
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

  return {
    value,
    count: window.length,
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
