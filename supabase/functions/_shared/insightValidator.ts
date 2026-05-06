// ============================================================
// VIZME V5 — Sprint 4.3 anti-hallucination validator
//
// Sonnet genera narrativas que pueden alucinar números. Este
// validador exige que cada número visible esté citado con un
// marcador [METRIC:id] o [PCT:id], que el id exista en los
// datos enviados, y que el valor citado coincida (≤5%) con
// el valor calculado por Vizme.
//
// Flow:
//   const v = validateInsight(narrative, refs, metricsSummary);
//   if (!v.valid) drop(insight, v.errors);
//   else displayNarrative = v.cleaned;   // sin marcadores
// ============================================================

export interface ValidatorMetric {
  metric_id: string;
  period: string;
  value: number | null;
  change_percent: number | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  cleaned: string;
}

const METRIC_TAG = /\[METRIC:([a-zA-Z0-9_\-]+)\]/g;
const PCT_TAG = /\[PCT:([a-zA-Z0-9_\-]+)\]/g;

// Sólo validamos números UNAMBIGUAMENTE métricos:
//  - prefijados con $ (moneda)              ej. $538 / $1,200.50 / $12k
//  - sufijados con %                        ej. 5% / -3.2% / +12%
// Otros números (días, conteos, fechas) no se validan para evitar
// falsos positivos.
const MONEY_PATTERN =
  /\$\s*(-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\-?\d+(?:[.,]\d+)?)\s*(k|mil|millones?|m)?(?!\w)/gi;
const PERCENT_PATTERN =
  /(?<![\w])([+\-]?\d+(?:[.,]\d+)?)\s*%/g;

const NUMERIC_TOLERANCE_PCT = 0.05; // 5%

function parseNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$\s]/g, '').replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function applySuffix(n: number, suffix: string | undefined): number {
  if (!suffix) return n;
  const s = suffix.toLowerCase();
  if (s === 'k' || s === 'mil') return n * 1_000;
  if (s === 'm' || s.startsWith('millon')) return n * 1_000_000;
  return n;
}

interface ExtractedNumber {
  value: number;
  isPercent: boolean;
  raw: string;
  start: number;
  end: number;
}

function extractNumbers(text: string): ExtractedNumber[] {
  const out: ExtractedNumber[] = [];
  for (const m of text.matchAll(MONEY_PATTERN)) {
    const parsed = parseNumber(m[1] ?? '');
    if (parsed === null) continue;
    const value = applySuffix(parsed, m[2]);
    out.push({
      value,
      isPercent: false,
      raw: m[0],
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
    });
  }
  for (const m of text.matchAll(PERCENT_PATTERN)) {
    const parsed = parseNumber(m[1] ?? '');
    if (parsed === null) continue;
    out.push({
      value: parsed,
      isPercent: true,
      raw: m[0],
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
    });
  }
  return out.sort((a, b) => a.start - b.start);
}

interface Tag {
  type: 'METRIC' | 'PCT';
  id: string;
  start: number;
  end: number;
}

function extractTags(text: string): Tag[] {
  const out: Tag[] = [];
  for (const m of text.matchAll(METRIC_TAG)) {
    out.push({ type: 'METRIC', id: m[1], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  for (const m of text.matchAll(PCT_TAG)) {
    out.push({ type: 'PCT', id: m[1], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  return out.sort((a, b) => a.start - b.start);
}

function nearestTag(num: ExtractedNumber, tags: Tag[]): Tag | null {
  // Tag debe venir DESPUÉS del número (estilo "$500 [METRIC:ventas]")
  // y dentro de 80 caracteres para ser considerado adyacente.
  let best: Tag | null = null;
  let bestDist = Infinity;
  for (const t of tags) {
    if (t.start < num.end) continue;
    const d = t.start - num.end;
    if (d < bestDist && d <= 80) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

function findMetricValue(
  metrics: ValidatorMetric[],
  id: string,
  preferPeriod?: string
): { value: number | null; change_percent: number | null } | null {
  const candidates = metrics.filter((m) => m.metric_id === id);
  if (candidates.length === 0) return null;
  const exact = preferPeriod ? candidates.find((c) => c.period === preferPeriod) : null;
  const chosen = exact ?? candidates[0];
  return { value: chosen.value, change_percent: chosen.change_percent };
}

function withinTolerance(claimed: number, real: number): boolean {
  if (real === 0) return Math.abs(claimed) < 1; // claim ~0 si real es 0
  return Math.abs(claimed - real) / Math.abs(real) <= NUMERIC_TOLERANCE_PCT;
}

export function validateInsight(
  narrative: string,
  refs: string[],
  metrics: ValidatorMetric[]
): ValidationResult {
  const errors: string[] = [];

  if (!narrative || narrative.trim().length === 0) {
    return { valid: false, errors: ['Narrativa vacía.'], cleaned: '' };
  }

  const tags = extractTags(narrative);
  const knownIds = new Set(metrics.map((m) => m.metric_id));

  // 1. Cada tag debe referir a una metric_id real.
  for (const t of tags) {
    if (!knownIds.has(t.id)) {
      errors.push(`Tag [${t.type}:${t.id}] referencia métrica no existente.`);
    }
  }

  // 2. Cada metric_reference declarada debe existir.
  for (const r of refs) {
    if (!knownIds.has(r)) {
      errors.push(`metric_references incluye id desconocido: ${r}.`);
    }
  }

  // 3. Cada número en la narrativa debe estar acompañado de un tag adyacente
  //    Y el valor debe estar dentro del 5% del valor real.
  const nums = extractNumbers(narrative);
  for (const n of nums) {
    const tag = nearestTag(n, tags);
    if (!tag) {
      errors.push(`Número "${n.raw.trim()}" sin marcador [METRIC:id] adyacente.`);
      continue;
    }
    const found = findMetricValue(metrics, tag.id);
    if (!found) {
      // Ya cubierto arriba pero defensivo.
      continue;
    }
    if (tag.type === 'PCT') {
      const real = found.change_percent;
      if (real === null || real === undefined) {
        errors.push(`PCT cita ${tag.id} pero no hay change_percent calculado.`);
        continue;
      }
      // Comparamos magnitud (signo lo dirige el texto).
      if (!withinTolerance(Math.abs(n.value), Math.abs(real))) {
        errors.push(
          `PCT ${n.value}% no coincide con change_percent real ${real.toFixed(2)}% para ${tag.id}.`
        );
      }
    } else {
      // METRIC: comparar contra value
      const real = found.value;
      if (real === null || real === undefined) {
        errors.push(`METRIC cita ${tag.id} pero el valor calculado es null.`);
        continue;
      }
      if (!withinTolerance(n.value, real)) {
        errors.push(
          `Valor ${n.raw.trim()} no coincide con valor real ${real.toFixed(2)} para ${tag.id} (>5% de diferencia).`
        );
      }
    }
  }

  // 4. Limpiar marcadores del texto visible.
  const cleaned = narrative
    .replace(METRIC_TAG, '')
    .replace(PCT_TAG, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s([.,;:!?])/g, '$1')
    .trim();

  return { valid: errors.length === 0, errors, cleaned };
}
