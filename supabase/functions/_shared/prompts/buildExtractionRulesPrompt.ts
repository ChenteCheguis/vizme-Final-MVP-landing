// ============================================================
// VIZME V5 — Prompt 3/3 del chunking engine: extraction rules
// Recibe entities/metrics/dimensions del paso 2 + sample_sheets
// completas (5 hojas con todas sus filas). Genera reglas de
// extracción para que un motor JS (sin IA) pueda poblar entities
// semana a semana sin re-llamar a Claude.
// ============================================================

import type { SampleSheet } from '../types.ts';
import type { EntitiesMetricsOutput } from '../chunkingTypes.ts';

export interface RulesPromptArgs {
  entities_metrics: EntitiesMetricsOutput;
  sample_sheets: SampleSheet[];
  business_hint?: string;
}

export interface BuiltPrompt {
  system: string;
  user: string;
}

const SYSTEM_PROMPT = `Eres experto en extracción programática de datos de archivos Excel/CSV. Ya existen entidades y métricas definidas en un paso previo. Tu trabajo en ESTE paso es generar EXTRACTION_RULES específicas que permitan a un motor JavaScript (sin IA) leer archivos similares del cliente cada semana y poblar las entidades.

═══════════════════════════════════════════════════════════
REGLAS DURAS
═══════════════════════════════════════════════════════════

1. CADA extraction_rule debe apuntar a UNA entidad transactional específica (target_entity = id de entity).

2. location tiene estos campos:
   - sheet_match: regex o string literal que identifica la hoja. Usa regex cuando el cliente tenga muchas hojas con patrón (ej: "^Semana\\\\s?\\\\d+$" para hojas "Semana 1", "Semana 2").
   - label_match (opcional): etiqueta de celda a buscar cuando el valor está junto a un label (ej: "Total General"). Útil para filas enterradas al final de hojas grandes.
   - column_offset (opcional): columnas a la derecha del label para encontrar el valor (default 1).
   - row_offset (opcional): filas debajo del label para encontrar el valor (default 0).

3. field_mappings es un objeto: {field_id_del_entity: descripcion_de_donde_sale}. Ejemplo:
   { "fecha": "encabezado de columna A", "monto": "columna B fila del label Total" }

4. source_pattern: descripción humana del patrón (ej: "xlsx con hoja semanal que termina en fila 'Total General'"). Útil para que el motor sepa si el archivo nuevo matchea.

5. validations: array de {field, rule} con reglas de sanidad (ej: {"field":"monto","rule":"number>=0"}, {"field":"fecha","rule":"iso_date"}).

6. NUNCA generes una regla que no tenga soporte en las sample_sheets observadas. Si no ves la forma, no inventes la regla.

7. Crea UNA regla POR hoja o POR patrón de hoja — no mezcles granularidades distintas (semanal + mensual en la misma regla).

8. JSON ESTRICTO, sin markdown, sin prosa.

═══════════════════════════════════════════════════════════
FORMA DEL OUTPUT (EXACTA)
═══════════════════════════════════════════════════════════

{
  "extraction_rules": [
    {
      "source_pattern": string,        // ej: "xlsx con hojas semanales y fila 'Total de cortes'"
      "target_entity": string,         // id de entity del paso 2
      "field_mappings": { [field_id: string]: string },
      "location": {
        "sheet_match": string,         // regex o literal
        "label_match": string | null,  // null si no aplica
        "column_offset": number | null,
        "row_offset": number | null
      },
      "validations": [
        { "field": string, "rule": string }
      ]
    }
  ]
}

Responde ÚNICAMENTE con el objeto JSON. Debe haber AL MENOS 1 extraction_rule.`;

function compactSampleSheet(sheet: SampleSheet, maxRowsPerSheet = 80): string {
  const rows = sheet.rows.slice(0, maxRowsPerSheet);
  const truncated = sheet.rows.length > maxRowsPerSheet
    ? `\n... (+${sheet.rows.length - maxRowsPerSheet} filas más truncadas)`
    : '';
  const lines = rows.map((r, i) => `  ${i}: ${JSON.stringify(r)}`).join('\n');
  return `### Hoja "${sheet.name}" (kind=${sheet.kind}, ${sheet.rows.length} filas totales)\n${lines}${truncated}`;
}

function buildUserPrompt(args: RulesPromptArgs): string {
  const { entities_metrics, sample_sheets, business_hint } = args;
  const parts: string[] = [];

  if (business_hint && business_hint.trim().length > 0) {
    parts.push('## Pista del cliente (referencia)');
    parts.push(business_hint.trim());
    parts.push('');
  }

  parts.push('## Entidades, métricas y dimensiones del paso 2');
  parts.push('```json');
  parts.push(JSON.stringify({
    entities: entities_metrics.entities,
    metrics: entities_metrics.metrics,
    dimensions: entities_metrics.dimensions,
  }, null, 2));
  parts.push('```');
  parts.push('');

  parts.push(`## Sample sheets completas (${sample_sheets.length} hojas representativas)`);
  for (const sheet of sample_sheets) {
    parts.push(compactSampleSheet(sheet));
    parts.push('');
  }

  parts.push('## Instrucción');
  parts.push(
    'Genera extraction_rules específicas para cada entity transactional, con soporte empírico en las sample_sheets. Devuelve JSON estricto con AL MENOS 1 regla.'
  );

  return parts.join('\n');
}

export function buildExtractionRulesPrompt(args: RulesPromptArgs): BuiltPrompt {
  return { system: SYSTEM_PROMPT, user: buildUserPrompt(args) };
}

export const RULES_PROMPT_VERSION = 'v5.sprint2_5.rules.1';
