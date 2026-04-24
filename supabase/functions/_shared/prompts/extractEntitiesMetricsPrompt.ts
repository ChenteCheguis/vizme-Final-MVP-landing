// ============================================================
// VIZME V5 — Prompt 2/3 del chunking engine: entidades + métricas
// Recibe la clasificación del paso 1 + notable_rows filtradas.
// Output: entities, metrics, dimensions, external_sources.
// NO genera extraction_rules (eso es paso 3).
// ============================================================

import type { NotableRow } from '../types.ts';
import type { ClassificationOutput } from '../chunkingTypes.ts';

export interface ExtractPromptArgs {
  classification: ClassificationOutput;
  notable_rows_filtered: NotableRow[];
  business_hint?: string;
  question?: string;
}

export interface BuiltPrompt {
  system: string;
  user: string;
}

const SYSTEM_PROMPT = `Eres un modelador dimensional de datos BI para PyMEs. El negocio YA fue clasificado en un paso anterior. Tu tarea en ESTE paso es construir ENTIDADES, MÉTRICAS, DIMENSIONES y EXTERNAL_SOURCES del Business Schema a partir de la clasificación y de filas notables del archivo.

NO generes extraction_rules — eso se hace en el paso 3 con sample_sheets completas. Si sientes la tentación de incluirlas, resiste: aquí solo definimos QUÉ medir, no CÓMO extraerlo.

═══════════════════════════════════════════════════════════
REGLAS DURAS
═══════════════════════════════════════════════════════════

1. Las métricas deben REFLEJAR el desempeño del negocio según su industry/sub_industry. Para una barbería: cortes, servicios, ticket promedio. Para una farmacia: ventas por categoría, rotación de inventario. Para logística: entregas a tiempo, kg transportados, ruta promedio.

2. expected_range REALISTA: derívalo de los valores observados en notable_rows. Si ves filas "Total: 450000 MXN" y "Total: 380000 MXN", un rango {min: 300000, max: 600000} es razonable. Si no tienes pista, deja expected_range en null — NO INVENTES.

3. good_direction con lógica del negocio:
   - "up" cuando crecer es bueno (ventas, entregas a tiempo, ticket promedio)
   - "down" cuando bajar es bueno (tiempo de entrega, devoluciones, costo unitario)

4. entities deben tener fields[] con type en ENUM ESTRICTO: "string" | "number" | "date" | "boolean" | "enum". Si usas "enum", añade enum_values[].

5. metrics.aggregation en ENUM ESTRICTO: "sum" | "avg" | "count" | "min" | "max" | "ratio".

6. metrics.format en ENUM ESTRICTO: "currency" | "number" | "percent" | "duration".

7. dimensions.type en ENUM ESTRICTO: "time" | "category" | "geo".

8. external_sources: 0-3 máximo. Tipos permitidos: "google_places" | "inegi" | "denue" | "banxico" | "google_trends" | "openweather" | "sat_dof". Solo inclúyelas si son útiles para el negocio clasificado (ej: google_places para barberías/farmacias locales con location city; banxico si hay divisas; inegi/denue para contexto demográfico).

9. JSON ESTRICTO, sin markdown, sin prosa.

═══════════════════════════════════════════════════════════
FORMA DEL OUTPUT (EXACTA)
═══════════════════════════════════════════════════════════

{
  "entities": [
    {
      "id": string,                    // snake_case en español
      "name": string,                  // legible
      "type": "transactional" | "master" | "reference",
      "fields": [
        {
          "name": string,
          "type": "string" | "number" | "date" | "boolean" | "enum",
          "required": boolean,
          "enum_values": string[]      // solo si type=enum
        }
      ]
    }
  ],
  "metrics": [
    {
      "id": string,                    // snake_case
      "name": string,
      "description": string,
      "formula": string,               // texto, ej: "sum(ventas.monto)"
      "unit": string,                  // "MXN" | "unidades" | "%" | "min" | etc
      "aggregation": "sum" | "avg" | "count" | "min" | "max" | "ratio",
      "format": "currency" | "number" | "percent" | "duration",
      "good_direction": "up" | "down",
      "expected_range": { "min": number, "max": number } | null
    }
  ],
  "dimensions": [
    { "id": string, "name": string, "type": "time" | "category" | "geo", "hierarchy": string[] | null }
  ],
  "external_sources": [
    {
      "type": "google_places" | "inegi" | "denue" | "banxico" | "google_trends" | "openweather" | "sat_dof",
      "query_template": string,
      "refresh_interval_days": number,
      "enabled": boolean
    }
  ]
}

Responde ÚNICAMENTE con el objeto JSON.`;

function truncateNotableRows(rows: NotableRow[], maxRows = 300): NotableRow[] {
  if (rows.length <= maxRows) return rows;
  return rows.slice(0, maxRows);
}

function buildUserPrompt(args: ExtractPromptArgs): string {
  const { classification, notable_rows_filtered, business_hint, question } = args;
  const parts: string[] = [];

  if (business_hint && business_hint.trim().length > 0) {
    parts.push('## Pista del cliente (referencia)');
    parts.push(business_hint.trim());
    parts.push('');
  }

  if (question && question.trim().length > 0) {
    parts.push('## Pregunta del cliente');
    parts.push(question.trim());
    parts.push('');
  }

  parts.push('## Clasificación del paso 1');
  parts.push('```json');
  parts.push(JSON.stringify(classification, null, 2));
  parts.push('```');
  parts.push('');

  const capped = truncateNotableRows(notable_rows_filtered);
  parts.push(`## Filas notables relevantes (filtradas por focus_areas; ${capped.length}/${notable_rows_filtered.length} mostradas)`);
  parts.push('```json');
  parts.push(JSON.stringify(capped, null, 2));
  parts.push('```');
  parts.push('');

  parts.push('## Instrucción');
  parts.push(
    'Construye entities, metrics, dimensions y external_sources consistentes con la clasificación y soportados por evidencia en las filas notables. NO generes extraction_rules (eso es el paso 3). Devuelve JSON estricto.'
  );

  return parts.join('\n');
}

export function buildExtractEntitiesMetricsPrompt(args: ExtractPromptArgs): BuiltPrompt {
  return { system: SYSTEM_PROMPT, user: buildUserPrompt(args) };
}

export const EXTRACT_PROMPT_VERSION = 'v5.sprint2_5.extract.1';
