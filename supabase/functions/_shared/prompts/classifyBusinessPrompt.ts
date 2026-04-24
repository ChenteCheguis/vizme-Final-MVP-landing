// ============================================================
// VIZME V5 — Prompt 1/3 del chunking engine: clasificación
// Recibe SOLO sheets_summary (índice del archivo) — no data.
// Output: identidad del negocio + focus_areas para pasos siguientes.
// Target: Opus 4.7, system cacheable (>1024 tokens).
// ============================================================

import type { FileDigest, SheetSummary } from '../types.ts';

export interface ClassifyPromptArgs {
  digest: FileDigest;
  business_hint?: string;
  question?: string;
}

export interface BuiltPrompt {
  system: string;
  user: string;
}

const SYSTEM_PROMPT = `Eres un analista experto en datos de PyMEs mexicanas. Tu trabajo en ESTE paso es ÚNICAMENTE clasificar al negocio a partir del índice (nombres de hojas, contadores y pistas del cliente) — NO tendrás los datos completos en este paso.

═══════════════════════════════════════════════════════════
JERARQUÍA DE FUENTES DE VERDAD (CRÍTICO)
═══════════════════════════════════════════════════════════

Aplica estrictamente este orden cuando haya conflicto:

  1. business_hint (pista del cliente)  — AUTORIDAD MÁXIMA.
     El cliente sabe en qué negocio está. Si dice "Barbería", es una barbería.
     No sobrescribas aunque los nombres de hojas sugieran otra cosa.

  2. question (pregunta del cliente)     — Segunda prioridad.
     Indica qué áreas debes mencionar prioritariamente en focus_areas.

  3. nombres de hojas en el digest        — Tercera prioridad.
     Señales observacionales, nunca redefinen qué negocio es.

REGLA DE RECONCILIACIÓN:
Si los nombres de hojas sugieren otra industria que la declarada en business_hint,
NO cambies la industria: interpreta esas hojas como una LÍNEA de producto/servicio
dentro del negocio declarado y menciónalo en reasoning.

EJEMPLO:
  hint="Barbería en CDMX", hojas con nombres tipo juguetes
  ➜ industry="servicios personales", sub_industry="barbería"
  ➜ reasoning: "Los nombres de hojas sugieren inventario de juguetes —
     probablemente barbería infantil que usa juguetes como incentivo o
     entretenimiento. Mantengo la clasificación declarada."

═══════════════════════════════════════════════════════════
QUÉ DEBES DEVOLVER
═══════════════════════════════════════════════════════════

Devuelve JSON ESTRICTO (sin markdown, sin prosa) con esta forma EXACTA:

{
  "industry": string,                 // en español, genérico (ej: "servicios personales", "retail", "logística")
  "sub_industry": string | null,      // más específico (ej: "barbería infantil", "farmacia independiente")
  "business_model": string,           // "b2c" | "b2b" | "marketplace" | "suscripción" | etc
  "size": "micro" | "small" | "medium" | "large",  // ENUM ESTRICTO — no uses otros valores
  "currency": string,                 // "MXN" por default en México
  "language": string,                 // "es-MX" por default
  "location": {                       // null si no se puede inferir
    "country": string,
    "state": string | null,
    "city": string | null
  } | null,
  "focus_areas": string[],            // 3-6 palabras/frases clave que deben investigarse en próximos pasos
                                      // (ej: ["ventas", "cortes", "productos", "servicios", "total"])
  "confidence": number,               // 0.0 a 1.0 — qué tan seguro estás de la clasificación
  "reasoning": string                 // breve (2-4 líneas) — por qué llegaste a esta clasificación
}

REGLAS DURAS:
- size es un ENUM estricto: solo "micro", "small", "medium", "large". Si el digest no lo indica claramente, infiere conservador por total_sheets y total_rows_approx: <500 filas totales = "micro", <5k = "small", <50k = "medium", resto = "large".
- focus_areas deben ser palabras clave en español minúsculas, útiles para filtrar filas notables en el siguiente paso (pensar: "¿qué palabras aparecerían en un row 'Total X'?").
- NUNCA inventes una industria distinta al hint del cliente.
- Si no hay hint, deduce de los nombres de hojas y del file_name.
- JSON PARSEABLE con JSON.parse — sin fences \`\`\`json, sin texto antes/después.

Responde ÚNICAMENTE con el objeto JSON.`;

function formatSheetsIndex(summary: SheetSummary[]): string {
  const lines: string[] = [];
  const MAX = 60;
  const toShow = summary.slice(0, MAX);
  for (const s of toShow) {
    lines.push(
      `- "${s.name}" (kind=${s.kind}, rows=${s.rows_total}, cols=${s.cols_total})`
    );
  }
  if (summary.length > MAX) {
    lines.push(`... (+${summary.length - MAX} hojas más, truncadas para este paso de clasificación)`);
  }
  return lines.join('\n');
}

function buildUserPrompt(args: ClassifyPromptArgs): string {
  const { digest, business_hint, question } = args;
  const parts: string[] = [];

  if (business_hint && business_hint.trim().length > 0) {
    parts.push('## Pista del cliente (MÁXIMA AUTORIDAD)');
    parts.push(business_hint.trim());
    parts.push('');
  }

  if (question && question.trim().length > 0) {
    parts.push('## Pregunta del cliente');
    parts.push(question.trim());
    parts.push('');
  }

  parts.push('## Información del archivo');
  parts.push(`file_name: ${digest.file_name}`);
  parts.push(`file_type: ${digest.file_type}`);
  parts.push(`total_sheets: ${digest.total_sheets}`);
  parts.push(`total_rows_approx: ${digest.total_rows_approx}`);
  parts.push('');

  parts.push('## Índice de hojas');
  parts.push(formatSheetsIndex(digest.sheets_summary));
  parts.push('');

  parts.push('## Instrucción');
  parts.push(
    'Clasifica el negocio siguiendo la JERARQUÍA DE FUENTES DE VERDAD. Devuelve el JSON estricto con industry, sub_industry, business_model, size (enum), currency, language, location, focus_areas, confidence y reasoning. Recuerda que focus_areas se usará en el paso 2 para filtrar filas notables relevantes.'
  );

  return parts.join('\n');
}

export function buildClassifyBusinessPrompt(args: ClassifyPromptArgs): BuiltPrompt {
  return { system: SYSTEM_PROMPT, user: buildUserPrompt(args) };
}

export const CLASSIFY_PROMPT_VERSION = 'v5.sprint2_5.classify.1';
