// ============================================================
// VIZME V5 — File Digest
// Representación inteligente de un Excel/CSV para que Opus 4.7
// construya el BusinessSchema. NO parsea datos; sólo resume
// con suficiente profundidad para que la IA deduzca la forma.
//
// Regla dura: NO cortar filas en mitad de una hoja — las filas
// "Total", "Gran Total", "Resumen" suelen estar enterradas.
//
// Diseño asíncrono con onProgress: emite eventos de progreso
// en checkpoints reales (XLSX.read, por hoja, scan de filas
// notables, sample picking) y cede al event loop entre etapas
// para que el browser pinte el progreso real al usuario.
//
// Principio de diseño (Diego, abril 2026): NUNCA matar un
// parseo legítimo con timeouts arbitrarios. Si tarda, que
// tarde — el usuario debe ver progreso real, no spinners mudos.
// ============================================================

import * as XLSX from 'xlsx';

export type SheetKind = 'semanal' | 'mensual' | 'anual' | 'inventario' | 'resumen' | 'desconocido';

export interface HeaderCandidate {
  row_index: number;
  cells: Array<string | number | null>;
}

export interface SheetSummary {
  name: string;
  kind: SheetKind;
  rows_total: number;
  cols_total: number;
  header_candidates: HeaderCandidate[];
}

export interface SampleSheet {
  name: string;
  kind: SheetKind;
  rows: Array<Array<string | number | null>>;
}

export interface NotableRow {
  sheet_name: string;
  row_index: number;
  content: Array<string | number | null>;
  matched_keyword: string;
}

export interface FileDigest {
  file_name: string;
  file_type: 'xlsx' | 'xls' | 'csv';
  total_sheets: number;
  total_rows_approx: number;
  sheets_summary: SheetSummary[];
  sample_sheets: SampleSheet[];
  notable_rows: NotableRow[];
}

export type DigestProgressStage =
  | 'reading_workbook'
  | 'workbook_parsed'
  | 'processing_sheet'
  | 'scanning_notable_rows'
  | 'picking_samples'
  | 'done';

export interface DigestProgressEvent {
  stage: DigestProgressStage;
  message: string;
  percent: number; // 0–100
  detail?: Record<string, string | number>;
}

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

function detectNotableRow(
  row: Array<string | number | null>
): { keyword: string } | null {
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
  const middle = [
    Math.floor(total * 0.25),
    Math.floor(total * 0.5),
    Math.floor(total * 0.75),
  ];
  const unique = Array.from(new Set([first, ...middle, last]));
  return unique.sort((a, b) => a - b);
}

// Yield to the event loop so the browser can paint progress updates
// between sync-heavy chunks. setTimeout(0) gives the layout a tick.
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export interface BuildDigestArgs {
  buffer: ArrayBuffer | Uint8Array;
  file_name: string;
  onProgress?: (event: DigestProgressEvent) => void;
}

export async function buildFileDigest({
  buffer,
  file_name,
  onProgress,
}: BuildDigestArgs): Promise<FileDigest> {
  const emit = (event: DigestProgressEvent) => {
    try {
      onProgress?.(event);
    } catch {
      // Never let a faulty progress callback block parsing.
    }
  };

  emit({ stage: 'reading_workbook', message: 'Leyendo encabezados del archivo…', percent: 2 });
  await tick();

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array', raw: true, dateNF: 'yyyy-mm-dd', cellDates: true });
  } catch (err) {
    throw new Error(
      `No pudimos abrir el archivo (${(err as Error).message ?? 'formato desconocido'}). ` +
        'Verifica que sea un Excel o CSV válido.'
    );
  }

  const sheet_names = wb.SheetNames;
  if (sheet_names.length === 0) {
    throw new Error('El archivo no contiene hojas legibles.');
  }

  emit({
    stage: 'workbook_parsed',
    message: `Estructura detectada — ${sheet_names.length} hoja${sheet_names.length === 1 ? '' : 's'}`,
    percent: 8,
    detail: { total_sheets: sheet_names.length },
  });
  await tick();

  const sheets_summary: SheetSummary[] = [];
  const notable_rows: NotableRow[] = [];
  let total_rows_approx = 0;

  const perSheetRows = new Map<string, Array<Array<string | number | null>>>();

  // Sheet processing budget (8 → 85%). Per-sheet share is uniform.
  const sheetBudgetStart = 10;
  const sheetBudgetEnd = 85;
  const sheetBudgetSpan = sheetBudgetEnd - sheetBudgetStart;

  for (let s = 0; s < sheet_names.length; s++) {
    const name = sheet_names[s];
    const sheetBase = sheetBudgetStart + Math.floor((s / sheet_names.length) * sheetBudgetSpan);

    emit({
      stage: 'processing_sheet',
      message: `Procesando hoja "${name}" (${s + 1}/${sheet_names.length})…`,
      percent: sheetBase,
      detail: { sheet_name: name, sheet_index: s + 1, total_sheets: sheet_names.length },
    });
    await tick();

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

    // Notable-row scan with periodic yield for very large sheets.
    // 1000 rows is a comfortable batch — past that we let the browser breathe.
    const ROW_YIELD_BATCH = 1000;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const hit = detectNotableRow(row);
      if (hit) {
        notable_rows.push({
          sheet_name: name,
          row_index: r,
          content: row,
          matched_keyword: hit.keyword,
        });
      }
      if (r > 0 && r % ROW_YIELD_BATCH === 0) {
        const intra = Math.floor((r / rows.length) * (sheetBudgetSpan / sheet_names.length));
        emit({
          stage: 'scanning_notable_rows',
          message: `Hoja "${name}" — ${r.toLocaleString('es-MX')} de ${rows.length.toLocaleString('es-MX')} filas`,
          percent: Math.min(sheetBudgetEnd, sheetBase + intra),
          detail: { sheet_name: name, processed: r, total: rows.length },
        });
        await tick();
      }
    }
  }

  emit({
    stage: 'picking_samples',
    message: 'Seleccionando hojas representativas…',
    percent: 90,
    detail: { total_rows: total_rows_approx, notable_rows: notable_rows.length },
  });
  await tick();

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

  emit({
    stage: 'done',
    message: 'Listo para analizar',
    percent: 100,
    detail: {
      total_sheets: digest.total_sheets,
      total_rows: digest.total_rows_approx,
      notable_rows: digest.notable_rows.length,
      sample_sheets: digest.sample_sheets.length,
    },
  });

  return digest;
}
