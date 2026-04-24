// ============================================================
// VIZME V5 — Validador del JSON que Opus devuelve
// Asegura que cumple el contrato BusinessSchemaPayload mínimo
// antes de persistirlo en business_schemas.
// ============================================================

import type { BusinessSchemaPayload } from './types.ts';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  payload?: BusinessSchemaPayload;
}

function isStringEnum<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v);
}

const SIZE_VALUES = ['micro', 'small', 'medium', 'large'] as const;
const ENTITY_TYPES = ['transactional', 'master', 'reference'] as const;
const FIELD_TYPES = ['string', 'number', 'date', 'boolean', 'enum'] as const;
const AGGREGATIONS = ['sum', 'avg', 'count', 'min', 'max', 'ratio'] as const;
const FORMATS = ['currency', 'number', 'percent', 'duration'] as const;
const DIRECTIONS = ['up', 'down'] as const;
const DIM_TYPES = ['time', 'category', 'geo'] as const;

export function validateBusinessSchemaPayload(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['El output no es un objeto JSON.'] };
  }
  const o = raw as Record<string, unknown>;

  // business_identity
  const bi = o.business_identity as Record<string, unknown> | undefined;
  if (!bi || typeof bi !== 'object') errors.push('Falta business_identity.');
  else {
    if (typeof bi.industry !== 'string') errors.push('business_identity.industry inválido.');
    if (typeof bi.business_model !== 'string') errors.push('business_identity.business_model inválido.');
    if (!isStringEnum(bi.size, SIZE_VALUES)) errors.push('business_identity.size inválido.');
    if (typeof bi.language !== 'string') errors.push('business_identity.language inválido.');
    if (typeof bi.currency !== 'string') errors.push('business_identity.currency inválido.');
  }

  // entities
  const entities = o.entities;
  if (!Array.isArray(entities)) errors.push('entities debe ser arreglo.');
  else {
    entities.forEach((e, i) => {
      const en = e as Record<string, unknown>;
      if (typeof en.id !== 'string') errors.push(`entities[${i}].id inválido.`);
      if (typeof en.name !== 'string') errors.push(`entities[${i}].name inválido.`);
      if (!isStringEnum(en.type, ENTITY_TYPES)) errors.push(`entities[${i}].type inválido.`);
      if (!Array.isArray(en.fields)) errors.push(`entities[${i}].fields debe ser arreglo.`);
      else {
        (en.fields as unknown[]).forEach((f, j) => {
          const fi = f as Record<string, unknown>;
          if (typeof fi.name !== 'string') errors.push(`entities[${i}].fields[${j}].name inválido.`);
          if (!isStringEnum(fi.type, FIELD_TYPES)) errors.push(`entities[${i}].fields[${j}].type inválido.`);
        });
      }
    });
  }

  // metrics
  const metrics = o.metrics;
  if (!Array.isArray(metrics)) errors.push('metrics debe ser arreglo.');
  else {
    if (metrics.length < 1) errors.push('Debe haber al menos 1 metric.');
    metrics.forEach((m, i) => {
      const mi = m as Record<string, unknown>;
      if (typeof mi.id !== 'string') errors.push(`metrics[${i}].id inválido.`);
      if (typeof mi.name !== 'string') errors.push(`metrics[${i}].name inválido.`);
      if (typeof mi.formula !== 'string') errors.push(`metrics[${i}].formula inválido.`);
      if (!isStringEnum(mi.aggregation, AGGREGATIONS)) errors.push(`metrics[${i}].aggregation inválido.`);
      if (!isStringEnum(mi.format, FORMATS)) errors.push(`metrics[${i}].format inválido.`);
      if (!isStringEnum(mi.good_direction, DIRECTIONS)) errors.push(`metrics[${i}].good_direction inválido.`);
    });
  }

  // dimensions
  const dimensions = o.dimensions;
  if (!Array.isArray(dimensions)) errors.push('dimensions debe ser arreglo.');
  else {
    dimensions.forEach((d, i) => {
      const di = d as Record<string, unknown>;
      if (typeof di.id !== 'string') errors.push(`dimensions[${i}].id inválido.`);
      if (typeof di.name !== 'string') errors.push(`dimensions[${i}].name inválido.`);
      if (!isStringEnum(di.type, DIM_TYPES)) errors.push(`dimensions[${i}].type inválido.`);
    });
  }

  // extraction_rules
  const rules = o.extraction_rules;
  if (!Array.isArray(rules)) errors.push('extraction_rules debe ser arreglo.');
  else {
    if (rules.length < 1) errors.push('Debe haber al menos 1 extraction_rule.');
    rules.forEach((r, i) => {
      const ri = r as Record<string, unknown>;
      if (typeof ri.source_pattern !== 'string') errors.push(`extraction_rules[${i}].source_pattern inválido.`);
      if (typeof ri.target_entity !== 'string') errors.push(`extraction_rules[${i}].target_entity inválido.`);
      if (!ri.field_mappings || typeof ri.field_mappings !== 'object')
        errors.push(`extraction_rules[${i}].field_mappings inválido.`);
    });
  }

  // external_sources (puede ser vacío)
  const ext = o.external_sources;
  if (!Array.isArray(ext)) errors.push('external_sources debe ser arreglo (vacío permitido).');

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], payload: raw as BusinessSchemaPayload };
}

export function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  // Caso ideal: JSON puro
  try {
    return JSON.parse(trimmed);
  } catch (_) { /* fallthrough */ }
  // Caso defensivo: viene con markdown ```json ... ```
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) {
    return JSON.parse(fence[1]);
  }
  // Último intento: agarrar el primer { ... } balanceado
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }
  throw new Error('No se pudo extraer JSON del texto del modelo.');
}
