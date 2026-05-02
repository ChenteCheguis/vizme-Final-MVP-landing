// ============================================================
// VIZME V5 — Dashboard Health Calculator
// Sprint 4.2 — Tolerant UX
//
// Pure function: takes the schema (what we expected) and the latest
// metric_calculations (what we actually got) and returns a 4-level
// health score the UI uses to decide which banner / fallback to show.
// ============================================================

import type { BusinessSchema, Metric } from './v5types';

export type HealthStatus = 'complete' | 'partial' | 'limited' | 'no_data';

export interface HealthDetails {
  extracted: number;
  total: number;
  percent: number; // 0-100
  missing_metric_ids: string[];
  missing_metric_names: string[];
  reasons: string[];
}

export interface DashboardHealth {
  status: HealthStatus;
  details: HealthDetails;
  last_calculated_at: string; // ISO
}

export interface MetricCalculationLite {
  metric_id: string;
  data_points?: unknown[] | null;
  warnings?: string[] | null;
  source_column?: string | null;
}

export interface CalculateHealthArgs {
  schema: Pick<BusinessSchema, 'metrics'>;
  calculations: MetricCalculationLite[];
}

/**
 * Compute the dashboard health score.
 *
 * A metric counts as "extracted" iff it has at least one data point
 * in the latest calculation row. We do not penalize for low absolute
 * values — only for missing data.
 */
export function calculateDashboardHealth({
  schema,
  calculations,
}: CalculateHealthArgs): DashboardHealth {
  const total = schema.metrics?.length ?? 0;
  const calcByMetric = new Map<string, MetricCalculationLite>();
  for (const c of calculations) {
    if (c.metric_id) calcByMetric.set(c.metric_id, c);
  }

  const missingIds: string[] = [];
  const missingNames: string[] = [];
  const reasons = new Set<string>();
  let extracted = 0;

  for (const m of schema.metrics ?? []) {
    const calc = calcByMetric.get(m.id);
    const points = Array.isArray(calc?.data_points) ? calc!.data_points : [];
    if (points.length > 0) {
      extracted++;
      continue;
    }
    missingIds.push(m.id);
    missingNames.push(m.name);
    if (calc?.warnings && calc.warnings.length > 0) {
      // Use first warning as the canonical reason
      reasons.add(calc.warnings[0]);
    } else if (!calc) {
      reasons.add(`No corrimos cálculo para "${m.name}".`);
    } else {
      reasons.add(`No encontramos datos para "${m.name}" en el archivo subido.`);
    }
  }

  const percent = total === 0 ? 0 : Math.round((extracted / total) * 100);

  return {
    status: bucketize(extracted, total),
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

function bucketize(extracted: number, total: number): HealthStatus {
  if (total === 0) return 'no_data';
  if (extracted === 0) return 'no_data';
  const pct = (extracted / total) * 100;
  if (pct >= 100) return 'complete';
  if (pct >= 50) return 'partial';
  return 'limited';
}

// ============================================================
// UI helpers — Spanish copy + visual classification
// ============================================================

export interface HealthCopy {
  variant: 'success' | 'warning' | 'caution' | 'error' | 'none';
  title: string;
  body: string;
  cta: string | null;
  showBanner: boolean;
}

export function healthCopy(health: Pick<DashboardHealth, 'status' | 'details'>): HealthCopy {
  const { status, details } = health;
  const { extracted, total, missing_metric_names } = details;
  const missingPreview = missing_metric_names.slice(0, 3).join(', ');
  const more = missing_metric_names.length > 3 ? ` y ${missing_metric_names.length - 3} más` : '';

  switch (status) {
    case 'complete':
      return {
        variant: 'success',
        title: 'Dashboard completo',
        body: `Extrajimos las ${total} métricas que diseñamos para tu negocio.`,
        cta: null,
        showBanner: false,
      };
    case 'partial':
      return {
        variant: 'warning',
        title: `Dashboard parcial — ${extracted} de ${total} métricas`,
        body: `Faltan datos para: ${missingPreview}${more}. Tu dashboard sigue siendo útil, pero podrías subir un archivo más completo.`,
        cta: 'Reintentar extracción',
        showBanner: true,
      };
    case 'limited':
      return {
        variant: 'caution',
        title: `Datos limitados — solo ${extracted} de ${total} métricas`,
        body: `El archivo no cubre la mayoría de las métricas. Te recomendamos subir un histórico más rico antes de confiar en los insights.`,
        cta: 'Reintentar extracción',
        showBanner: true,
      };
    case 'no_data':
      return {
        variant: 'error',
        title: 'Sin datos extraídos',
        body: 'No encontramos columnas que correspondan a las métricas en tu archivo. Revisa los detalles o sube un archivo distinto.',
        cta: 'Ver diagnóstico',
        showBanner: true,
      };
  }
}
