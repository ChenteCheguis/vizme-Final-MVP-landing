// ============================================================
// VIZME V5 — Dashboard Health (Deno mirror of lib/dashboardHealth.ts)
// Sprint 4.2
//
// Pure TS, zero Deno deps, kept in sync with the browser-side
// version in /lib/dashboardHealth.ts. If you change the bucket
// thresholds here, change them there too (and vice versa).
// ============================================================

export type HealthStatus = 'complete' | 'partial' | 'limited' | 'no_data';

export interface HealthDetails {
  extracted: number;
  total: number;
  percent: number;
  missing_metric_ids: string[];
  missing_metric_names: string[];
  reasons: string[];
}

export interface DashboardHealth {
  status: HealthStatus;
  details: HealthDetails;
  last_calculated_at: string;
}

export interface MetricLite {
  id: string;
  name: string;
}

export interface MetricCalculationLite {
  metric_id: string;
  data_points?: unknown[] | null;
  warnings?: string[] | null;
}

export function calculateDashboardHealth(args: {
  metrics: MetricLite[];
  calculations: MetricCalculationLite[];
}): DashboardHealth {
  const total = args.metrics.length;
  const calcByMetric = new Map<string, MetricCalculationLite>();
  for (const c of args.calculations) {
    if (c.metric_id) calcByMetric.set(c.metric_id, c);
  }

  const missingIds: string[] = [];
  const missingNames: string[] = [];
  const reasons = new Set<string>();
  let extracted = 0;

  for (const m of args.metrics) {
    const calc = calcByMetric.get(m.id);
    const points = Array.isArray(calc?.data_points) ? calc!.data_points : [];
    if (points.length > 0) {
      extracted++;
      continue;
    }
    missingIds.push(m.id);
    missingNames.push(m.name);
    if (calc?.warnings && calc.warnings.length > 0) {
      reasons.add(calc.warnings[0]);
    } else if (!calc) {
      reasons.add(`No corrimos cálculo para "${m.name}".`);
    } else {
      reasons.add(`No encontramos datos para "${m.name}" en el archivo subido.`);
    }
  }

  const percent = total === 0 ? 0 : Math.round((extracted / total) * 100);
  const status: HealthStatus =
    total === 0 || extracted === 0
      ? 'no_data'
      : extracted >= total
      ? 'complete'
      : (extracted / total) * 100 >= 50
      ? 'partial'
      : 'limited';

  return {
    status,
    details: {
      extracted,
      total,
      percent,
      missing_metric_ids: missingIds,
      missing_metric_names: missingNames,
      reasons: Array.from(reasons),
    },
    last_calculated_at: new Date().toISOString(),
  };
}
