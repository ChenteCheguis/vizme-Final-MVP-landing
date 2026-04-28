// ============================================================
// VIZME V5 — Validador del DashboardBlueprint v2
// Sprint 4
//
// Asegura que lo que devuelve Opus encaje con la forma que
// el renderer espera. Si algo no encaja, devuelve errores
// específicos para que el orquestador pueda decidir si
// reintentar o reportar.
// ============================================================

import { VALID_VISUALIZATION_TYPES } from './visualizationCatalog.ts';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_SECTION_TYPES = new Set(['hero', 'kpi_row', 'chart_grid', 'insight_card', 'data_table']);
const VALID_SOPHISTICATION = new Set(['simple', 'medium', 'complex']);

interface ParsedBlueprint {
  sophistication_level?: string;
  layout_strategy?: string;
  opus_reasoning?: string;
  pages?: Array<{
    id?: string;
    title?: string;
    icon?: string;
    description?: string;
    audience?: string;
    priority?: number;
    sections?: Array<{
      id?: string;
      type?: string;
      title?: string | null;
      subtitle?: string | null;
      grid_layout?: { columns?: number; gap?: string };
      widgets?: Array<{
        id?: string;
        type?: string;
        title?: string;
        subtitle?: string | null;
        metric_ids?: string[];
        dimension_ids?: string[];
        chart_config?: Record<string, unknown>;
        grid_position?: { column_span?: number; row_span?: number };
        insight?: string | null;
        priority?: number;
      }>;
    }>;
  }>;
}

export function validateDashboardBlueprint(
  raw: unknown,
  knownMetricIds: Set<string>,
  knownDimensionIds: Set<string>
): ValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Blueprint no es un objeto.'] };
  }
  const bp = raw as ParsedBlueprint;

  if (!bp.sophistication_level || !VALID_SOPHISTICATION.has(bp.sophistication_level)) {
    errors.push(`sophistication_level inválido (recibido: ${bp.sophistication_level}).`);
  }
  if (!bp.layout_strategy || typeof bp.layout_strategy !== 'string') {
    errors.push('Falta layout_strategy.');
  }
  if (!bp.opus_reasoning || typeof bp.opus_reasoning !== 'string') {
    errors.push('Falta opus_reasoning.');
  }
  if (!Array.isArray(bp.pages) || bp.pages.length === 0) {
    errors.push('Blueprint debe tener al menos 1 página.');
    return { valid: errors.length === 0, errors };
  }

  const seenPagePriorities = new Set<number>();
  for (let i = 0; i < bp.pages.length; i++) {
    const page = bp.pages[i];
    const ctx = `pages[${i}]`;
    if (!page.id) errors.push(`${ctx}: falta id.`);
    if (!page.title) errors.push(`${ctx}: falta title.`);
    if (!page.icon) errors.push(`${ctx}: falta icon.`);
    if (typeof page.priority !== 'number') errors.push(`${ctx}: priority debe ser number.`);
    else if (seenPagePriorities.has(page.priority))
      errors.push(`${ctx}: priority ${page.priority} duplicada.`);
    else seenPagePriorities.add(page.priority);

    if (!Array.isArray(page.sections) || page.sections.length === 0) {
      errors.push(`${ctx}: debe tener al menos 1 sección.`);
      continue;
    }

    for (let j = 0; j < page.sections.length; j++) {
      const section = page.sections[j];
      const sctx = `${ctx}.sections[${j}]`;
      if (!section.id) errors.push(`${sctx}: falta id.`);
      if (!section.type || !VALID_SECTION_TYPES.has(section.type))
        errors.push(`${sctx}: type inválido (recibido: ${section.type}).`);
      if (!section.grid_layout || typeof section.grid_layout.columns !== 'number')
        errors.push(`${sctx}: grid_layout.columns requerido.`);
      if (!Array.isArray(section.widgets) || section.widgets.length === 0) {
        errors.push(`${sctx}: debe tener al menos 1 widget.`);
        continue;
      }

      for (let k = 0; k < section.widgets.length; k++) {
        const w = section.widgets[k];
        const wctx = `${sctx}.widgets[${k}]`;
        if (!w.id) errors.push(`${wctx}: falta id.`);
        if (!w.type || !VALID_VISUALIZATION_TYPES.has(w.type))
          errors.push(`${wctx}: type "${w.type}" no está en el catálogo.`);
        if (!w.title) errors.push(`${wctx}: falta title.`);
        if (!Array.isArray(w.metric_ids))
          errors.push(`${wctx}: metric_ids debe ser array.`);
        else {
          for (const mid of w.metric_ids) {
            if (!knownMetricIds.has(mid))
              errors.push(`${wctx}: metric_id "${mid}" no existe en el schema.`);
          }
        }
        if (!Array.isArray(w.dimension_ids))
          errors.push(`${wctx}: dimension_ids debe ser array.`);
        else {
          for (const did of w.dimension_ids) {
            if (!knownDimensionIds.has(did))
              errors.push(`${wctx}: dimension_id "${did}" no existe en el schema.`);
          }
        }
        if (!w.grid_position) errors.push(`${wctx}: grid_position requerido.`);
        else {
          const cs = w.grid_position.column_span;
          const rs = w.grid_position.row_span;
          if (typeof cs !== 'number' || cs < 1 || cs > 4)
            errors.push(`${wctx}: column_span debe estar en [1,4].`);
          if (typeof rs !== 'number' || rs < 1 || rs > 3)
            errors.push(`${wctx}: row_span debe estar en [1,3].`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function countTotalWidgets(bp: ParsedBlueprint): number {
  let n = 0;
  for (const page of bp.pages ?? []) {
    for (const section of page.sections ?? []) {
      n += section.widgets?.length ?? 0;
    }
  }
  return n;
}
