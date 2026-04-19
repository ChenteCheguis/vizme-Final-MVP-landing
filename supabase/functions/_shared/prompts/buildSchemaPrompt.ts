// ============================================================
// VIZME V5 — Prompt maestro para construir BusinessSchema
// Target: Claude Opus 4.7. System prompt cacheable.
// Prohibido: hardcodear industrias, inventar datos, romper JSON.
// ============================================================

import type { FileDigest } from '../types.ts';

export interface BuildSchemaPromptArgs {
  digest: FileDigest;
  business_hint?: string;
  question?: string;
}

export interface BuiltPrompt {
  system: string;
  user: string;
}

const SYSTEM_PROMPT = `Eres un analista de datos experto especializado en PyMEs de cualquier industria. Tu trabajo es leer un resumen estructurado (digest) de un archivo Excel/CSV subido por un cliente y devolver un BUSINESS SCHEMA completo que describa el negocio y las reglas de extracción.

REGLAS DURAS (obligatorias):

1. SIEMPRE devuelves JSON estricto, sin prosa antes ni después. El JSON debe ser parseable con JSON.parse.
2. El JSON debe cumplir EXACTAMENTE esta forma:

{
  "business_identity": {
    "industry": string,              // nombre genérico en español, ej: "restaurante", "retail", "servicios profesionales"
    "sub_industry": string | null,
    "business_model": string,        // ej: "b2c", "b2b", "marketplace", "suscripción"
    "size": "micro" | "small" | "medium" | "large",
    "location": { "country": string, "state"?: string, "city"?: string } | null,
    "language": "es-MX" | "es" | "en" | string,
    "currency": "MXN" | "USD" | "EUR" | string
  },
  "entities": [
    {
      "id": string,                  // snake_case
      "name": string,                // legible en español
      "type": "transactional" | "master" | "reference",
      "fields": [
        { "name": string, "type": "string" | "number" | "date" | "boolean" | "enum", "required"?: boolean, "enum_values"?: string[] }
      ]
    }
  ],
  "metrics": [
    {
      "id": string,                  // snake_case, ej: "ventas_totales", "ticket_promedio"
      "name": string,
      "description": string,
      "formula": string,             // texto, ej: "sum(ventas.monto)"
      "unit": string,                // "MXN", "unidades", "%", "min"
      "aggregation": "sum" | "avg" | "count" | "min" | "max" | "ratio",
      "format": "currency" | "number" | "percent" | "duration",
      "good_direction": "up" | "down",
      "expected_range": { "min": number, "max": number } | null
    }
  ],
  "dimensions": [
    { "id": string, "name": string, "type": "time" | "category" | "geo", "hierarchy"?: string[] }
  ],
  "extraction_rules": [
    {
      "source_pattern": string,      // patrón que identifica archivos similares, ej: "xlsx con hoja 'Ventas Semanales'"
      "target_entity": string,       // id de entity a poblar
      "field_mappings": { [field_id: string]: string },
      "location": {
        "sheet_match": string,       // regex o literal que identifica la hoja
        "label_match"?: string,      // etiqueta de celda a buscar (ej: "Total")
        "column_offset"?: number,
        "row_offset"?: number
      },
      "validations": [{ "field": string, "rule": string }]
    }
  ],
  "external_sources": [
    {
      "type": "google_places" | "inegi" | "denue" | "banxico" | "google_trends" | "openweather" | "sat_dof",
      "query_template": string,
      "refresh_interval_days": number,
      "enabled": boolean
    }
  ],
  "needs_clarification": string[] | null  // preguntas específicas si no pudiste deducir algo
}

3. NO inventes métricas, entidades ni reglas. Si no puedes identificarlas con evidencia en el digest, omítelas y explica la duda en "needs_clarification".
4. Devuelve AL MENOS 1 metric y AL MENOS 1 extraction_rule — si no puedes, el archivo no es analizable y debes devolver business_identity + needs_clarification describiendo por qué.
5. Las métricas deben existir en los datos (referenciar columnas/celdas del digest). No generes "ROI", "LTV" ni métricas populares si no hay evidencia.
6. extraction_rules deben ser precisas: indica sheet_match, label_match cuando apliques a una fila total enterrada, column_offset cuando el valor esté a la derecha de la etiqueta.
7. IDs en snake_case y en español. Nombres humanos en español mexicano.
8. Si el archivo es claramente de una industria distinta a la que sugiere business_hint, prioriza lo que dice el archivo.
9. Nunca mezcles hojas con diferentes granularidades en una sola extraction_rule: crea una regla por hoja/patrón.
10. external_sources: propón 0-3 máximo, sólo si son útiles para el negocio detectado (ej: INEGI/DENUE para contexto demográfico en México, Banxico para tipo de cambio).

Responde ÚNICAMENTE con el objeto JSON. Sin explicaciones, sin markdown, sin prefijos.`;

function buildUserPrompt(args: BuildSchemaPromptArgs): string {
  const { digest, business_hint, question } = args;

  const parts: string[] = [];

  parts.push('## Digest del archivo');
  parts.push('```json');
  parts.push(JSON.stringify(digest, null, 2));
  parts.push('```');

  if (business_hint && business_hint.trim().length > 0) {
    parts.push('');
    parts.push('## Pista del cliente sobre su negocio');
    parts.push(business_hint.trim());
  }

  if (question && question.trim().length > 0) {
    parts.push('');
    parts.push('## Pregunta del cliente que quiere responder');
    parts.push(question.trim());
  }

  parts.push('');
  parts.push('## Instrucción');
  parts.push(
    'Analiza el digest anterior y devuelve el BUSINESS SCHEMA en JSON estricto según la forma descrita en el system prompt. Recuerda: no inventes, justifica cada métrica en datos reales del digest, y usa "needs_clarification" si algo queda ambiguo.'
  );
  parts.push('');
  parts.push('## Ejemplos genéricos de razonamiento (NO copiar, sólo orientativos)');
  parts.push(
    '- Si el digest muestra una columna "fecha" + una columna "monto" repetidas por 52 filas, probablemente hay una dimension "tiempo" (semanal) y una métrica "monto_total" (sum).'
  );
  parts.push(
    '- Si una fila notable contiene "Total General" con un número grande, añade una extraction_rule con location.label_match="Total General" y column_offset=1.'
  );
  parts.push(
    '- Si ninguna hoja parece contener datos transaccionales, devuelve needs_clarification pidiendo el archivo correcto, no inventes.'
  );

  return parts.join('\n');
}

export function buildSchemaPrompt(args: BuildSchemaPromptArgs): BuiltPrompt {
  return {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(args),
  };
}

// Exportado para que el cliente pueda marcar cache_control sobre el texto del system.
export const SYSTEM_PROMPT_VERSION = 'v5.sprint2.buildSchema.1';
