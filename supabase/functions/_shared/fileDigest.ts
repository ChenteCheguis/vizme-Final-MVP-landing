// ============================================================
// VIZME V5 — File Digest (Deno port para Edge Functions)
// Mantener sincronizado con lib/fileDigest.ts (Node).
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

const APPROX_TOKEN_BUDGET = 150_000;

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
  if (total <= 5) return Array.from({ length: total }, (_, i) => i);
  const first = 0;
  const last = total - 1;
  const middle = [Math.floor(total * 0.25), Math.floor(total * 0.5), Math.floor(total * 0.75)];
  const unique = Array.from(new Set([first, ...middle, last]));
  return unique.sort((a, b) => a - b);
}

function estimateDigestTokens(digest: FileDigest): number {
  const json = JSON.stringify(digest);
  return Math.ceil(json.length / 4);
}

function shrinkSampleSheets(digest: FileDigest): FileDigest {
  let next = digest;
  const targetCaps = [500, 300, 150, 80, 40];
  for (const cap of targetCaps) {
    next = {
      ...next,
      sample_sheets: next.sample_sheets.map((s) => ({
        ...s,
        rows:
          s.rows.length > cap
            ? [...s.rows.slice(0, Math.floor(cap * 0.7)), ...s.rows.slice(-Math.floor(cap * 0.3))]
            : s.rows,
      })),
    };
    if (estimateDigestTokens(next) <= APPROX_TOKEN_BUDGET) return next;
  }
  if (next.sample_sheets.length > 2) {
    next = { ...next, sample_sheets: [next.sample_sheets[0], next.sample_sheets[next.sample_sheets.length - 1]] };
  }
  return next;
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

  const digest: FileDigest = {
    file_name,
    file_type: detectFileType(file_name),
    total_sheets: sheet_names.length,
    total_rows_approx,
    sheets_summary,
    sample_sheets,
    notable_rows,
  };

  if (estimateDigestTokens(digest) > APPROX_TOKEN_BUDGET) {
    return shrinkSampleSheets(digest);
  }
  return digest;
}
