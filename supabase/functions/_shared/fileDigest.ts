// ============================================================
// VIZME V5 — File Digest (Deno port para Edge Functions)
// Mantener sincronizado con lib/fileDigest.ts (Node).
//
// Regla dura: NO cortar filas en mitad de una hoja — las filas
// "Total", "Gran Total", "Resumen" suelen estar enterradas.
// ============================================================

import * as XLSX from 'npm:xlsx@0.18.5';
import type { FileDigest, HeaderCandidate, NotableRow, SampleSheet, SheetKind, SheetSummary } from './types.ts';

const NOTABLE_KEYWORDS = [
  'total',
  'gran total',
  'subtotal',
  'suma',
  'resumen',
  'promedio',
  'ingresos',
  'ventas',
  'productos',
  'utilidad',
  'ganancia',
  'gasto',
  'costo',
  'egreso',
  'inventario',
  'existencia',
];

// Tope duro de tokens del digest (user prompt). El system prompt (~1k tokens)
// y el overhead de mensajería llevan el request total a ~150k máx.
const APPROX_TOKEN_BUDGET = 100_000;

// Nivel 1 — reducción base que SIEMPRE se aplica.
const LEVEL1_MAX_SAMPLE_SHEETS = 3;
const LEVEL1_MAX_ROWS_PER_SHEET = 100;
const LEVEL1_MAX_NOTABLE_ROWS = 200;

// Nivel 2 — reducción adicional si seguimos por encima del budget.
const LEVEL2_MAX_SHEETS_SUMMARY = 50;

export class DigestTooLargeError extends Error {
  constructor() {
    super(
      'Archivo demasiado complejo para análisis automático. Planes Enterprise ofrecen procesamiento de archivos grandes con onboarding asistido. Contáctanos.'
    );
    this.name = 'DigestTooLargeError';
  }
}

function classifySheet(name: string): SheetKind {
  const n = name.toLowerCase();
  if (/semana|week|wk\b/.test(n)) return 'semanal';
  if (/mes|mensual|month/.test(n)) return 'mensual';
  if (/año|anual|year/.test(n)) return 'anual';
  if (/invent|stock|exist/.test(n)) return 'inventario';
  if (/resumen|summary|total|global/.test(n)) return 'resumen';
  return 'desconocido';
}

function detectFileType(fileName: string): 'xlsx' | 'xls' | 'csv' {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'xls') return 'xls';
  if (ext === 'csv') return 'csv';
  return 'xlsx';
}

function cleanCell(v: unknown): string | number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function isNonEmptyRow(row: Array<string | number | null>): boolean {
  return row.some((c) => c !== null);
}

function sheetToRows(ws: XLSX.WorkSheet): Array<Array<string | number | null>> {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });
  return raw.map((r) => (r ?? []).map(cleanCell)).filter(isNonEmptyRow);
}

function detectNotableRow(row: Array<string | number | null>): { keyword: string } | null {
  const firstCell = row[0];
  if (typeof firstCell !== 'string') return null;
  const lower = firstCell.toLowerCase();
  for (const kw of NOTABLE_KEYWORDS) {
    if (lower.includes(kw)) return { keyword: kw };
  }
  return null;
}

function pickSampleIndexes(total: number): number[] {
  if (total <= LEVEL1_MAX_SAMPLE_SHEETS)
    return Array.from({ length: total }, (_, i) => i);
  const first = 0;
  const middle = Math.floor(total / 2);
  const last = total - 1;
  const unique = Array.from(new Set([first, middle, last]));
  return unique.sort((a, b) => a - b);
}

function estimateDigestTokens(digest: FileDigest): number {
  const json = JSON.stringify(digest);
  return Math.ceil(json.length / 4);
}

function applyLevel1(digest: FileDigest): FileDigest {
  const capped_sheets_subset = digest.sample_sheets.slice(0, LEVEL1_MAX_SAMPLE_SHEETS);

  const notableIdx = new Map<string, Set<number>>();
  for (const nr of digest.notable_rows) {
    if (!notableIdx.has(nr.sheet_name)) notableIdx.set(nr.sheet_name, new Set());
    notableIdx.get(nr.sheet_name)!.add(nr.row_index);
  }

  const capped_sheets: SampleSheet[] = capped_sheets_subset.map((s) => {
    if (s.rows.length <= LEVEL1_MAX_ROWS_PER_SHEET) return s;
    const notableSet = notableIdx.get(s.name) ?? new Set<number>();
    const head = s.rows.slice(0, LEVEL1_MAX_ROWS_PER_SHEET);
    const tail: Array<Array<string | number | null>> = [];
    for (let i = LEVEL1_MAX_ROWS_PER_SHEET; i < s.rows.length; i++) {
      if (notableSet.has(i)) tail.push(s.rows[i]);
    }
    return { ...s, rows: [...head, ...tail] };
  });

  const capped_notables = digest.notable_rows.slice(0, LEVEL1_MAX_NOTABLE_ROWS);

  return {
    ...digest,
    sample_sheets: capped_sheets,
    notable_rows: capped_notables,
  };
}

function applyLevel2(digest: FileDigest): FileDigest {
  let sheets_summary = digest.sheets_summary;
  if (sheets_summary.length > LEVEL2_MAX_SHEETS_SUMMARY) {
    const kept = sheets_summary.slice(0, LEVEL2_MAX_SHEETS_SUMMARY);
    const remaining = sheets_summary.length - LEVEL2_MAX_SHEETS_SUMMARY;
    sheets_summary = [
      ...kept,
      {
        name: `... y ${remaining} hojas más del mismo patrón`,
        kind: 'desconocido',
        rows_total: 0,
        cols_total: 0,
        header_candidates: [],
      },
    ];
  }

  const seen = new Set<string>();
  const deduped: NotableRow[] = [];
  for (const nr of digest.notable_rows) {
    const key = nr.content
      .slice(0, 3)
      .map((c) => (c === null ? '' : String(c).toLowerCase().trim()))
      .join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(nr);
  }

  return { ...digest, sheets_summary, notable_rows: deduped };
}

export interface BuildDigestArgs {
  buffer: ArrayBuffer | Uint8Array;
  file_name: string;
}

export function buildFileDigest({ buffer, file_name }: BuildDigestArgs): FileDigest {
  const wb = XLSX.read(buffer, { type: 'array', raw: true, dateNF: 'yyyy-mm-dd', cellDates: true });
  const sheet_names = wb.SheetNames;

  const sheets_summary: SheetSummary[] = [];
  const notable_rows: NotableRow[] = [];
  let total_rows_approx = 0;

  const perSheetRows = new Map<string, Array<Array<string | number | null>>>();

  for (const name of sheet_names) {
    const ws = wb.Sheets[name];
    const rows = sheetToRows(ws);
    perSheetRows.set(name, rows);
    total_rows_approx += rows.length;

    const cols_total = rows.reduce((max, r) => Math.max(max, r.length), 0);
    const header_candidates: HeaderCandidate[] = rows.slice(0, 3).map((cells, i) => ({
      row_index: i,
      cells,
    }));

    sheets_summary.push({
      name,
      kind: classifySheet(name),
      rows_total: rows.length,
      cols_total,
      header_candidates,
    });

    rows.forEach((row, idx) => {
      const hit = detectNotableRow(row);
      if (hit) {
        notable_rows.push({
          sheet_name: name,
          row_index: idx,
          content: row,
          matched_keyword: hit.keyword,
        });
      }
    });
  }

  const sampleIdx = pickSampleIndexes(sheet_names.length);
  const sample_sheets: SampleSheet[] = sampleIdx.map((i) => {
    const name = sheet_names[i];
    return {
      name,
      kind: classifySheet(name),
      rows: perSheetRows.get(name) ?? [],
    };
  });

  const raw_digest: FileDigest = {
    file_name,
    file_type: detectFileType(file_name),
    total_sheets: sheet_names.length,
    total_rows_approx,
    sheets_summary,
    sample_sheets,
    notable_rows,
  };

  let digest = applyLevel1(raw_digest);
  if (estimateDigestTokens(digest) <= APPROX_TOKEN_BUDGET) return digest;

  digest = applyLevel2(digest);
  if (estimateDigestTokens(digest) <= APPROX_TOKEN_BUDGET) return digest;

  throw new DigestTooLargeError();
}
