import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface SheetInfo {
  name: string;
  estimatedRows: number;
}

export interface HealthIssue {
  type: 'empty_values' | 'type_mismatch' | 'duplicates' | 'suspicious_name';
  column?: string;
  detail: string;
  severity: 'error' | 'warning' | 'info';
  autoFixable: boolean;
}

export interface DataHealth {
  score: number; // 0–100
  issues: HealthIssue[];
}

export interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  preview: Record<string, unknown>[];
  sheets: SheetInfo[];
  selectedSheet: string;
  health: DataHealth;
}

// ─── Raw Extraction types (new Stage 1: Claude as universal parser) ──────────

export interface NotableRow {
  sheetName: string;
  rowIndex: number;
  cells: unknown[];
  matchedKeyword: string;
}

export interface RawExtraction {
  sheetCount: number;
  sheetNames: string[];
  sample: Record<string, unknown[][]>;  // sheet name → rows (2D arrays)
  notableRows: NotableRow[];
  isSimpleFile: boolean;                // true = 1 sheet, clean headers, skip AI
}

// ─────────────────────────────────────────────
// Notable row keywords
// ─────────────────────────────────────────────

const NOTABLE_KEYWORDS = [
  'total', 'subtotal', 'suma', 'gran total', 'promedio', 'average',
  'total de', 'totales', 'resumen', 'summary', 'net', 'neto',
];

function isNotableRow(cells: unknown[]): string | null {
  for (const cell of cells) {
    if (cell == null || cell === '') continue;
    const s = String(cell).toLowerCase().trim();
    for (const kw of NOTABLE_KEYWORDS) {
      if (s.includes(kw)) return kw;
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// Simple file detection
// ─────────────────────────────────────────────

function isSimpleFile(sheetCount: number, firstSheetRows: unknown[][]): boolean {
  if (sheetCount !== 1) return false;
  if (firstSheetRows.length < 2) return false;

  const firstRow = firstSheetRows[0];
  if (!firstRow || firstRow.length === 0) return false;

  // 80%+ of first row cells must be non-empty strings (clean headers)
  const nonEmpty = firstRow.filter(v => v != null && v !== '');
  if (nonEmpty.length === 0) return false;
  const stringCount = nonEmpty.filter(v => typeof v === 'string' && isNaN(Number(v))).length;
  const stringPct = stringCount / nonEmpty.length;

  // No __EMPTY or generic column names
  const hasGenericCols = nonEmpty.some(v =>
    typeof v === 'string' && (/^__EMPTY/i.test(v) || /^col(umn)?\s*\d+$/i.test(v) || /^campo\s*\d+$/i.test(v))
  );

  return stringPct >= 0.8 && !hasGenericCols;
}

// ─────────────────────────────────────────────
// Pick representative sheets for sample
// ─────────────────────────────────────────────

function pickRepresentativeSheets(names: string[], maxSheets: number): string[] {
  if (names.length <= maxSheets) return names;
  const indices = new Set<number>();
  indices.add(0);                                    // first
  indices.add(names.length - 1);                     // last
  indices.add(Math.floor(names.length / 2));         // middle
  while (indices.size < Math.min(maxSheets, names.length)) {
    indices.add(Math.floor(Math.random() * names.length));
  }
  return [...indices].sort((a, b) => a - b).map(i => names[i]);
}

// ─────────────────────────────────────────────
// Phase A: Raw Extraction (≤100KB sample for Claude)
// ─────────────────────────────────────────────

const MAX_SAMPLE_BYTES = 95_000; // leave margin under 100KB
const MAX_ROWS_PER_SHEET = 30;
const MAX_SHEETS_FOR_SAMPLE = 5;

export function rawExtract(file: File): Promise<RawExtraction> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'array' });

        const sheetCount = workbook.SheetNames.length;
        const sheetNames = workbook.SheetNames;
        const notableRows: NotableRow[] = [];
        const sample: Record<string, unknown[][]> = {};

        // Pick which sheets to include in sample
        const sheetsForSample = pickRepresentativeSheets(sheetNames, MAX_SHEETS_FOR_SAMPLE);

        let currentSize = 0;

        for (const name of sheetsForSample) {
          const ws = workbook.Sheets[name];

          // Get rows as 2D array (preserves visual structure)
          const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
            header: 1,
            defval: null,
            blankrows: false,
          });

          // Take first N rows for sample
          const sampleRows = allRows.slice(0, MAX_ROWS_PER_SHEET);
          const serialized = JSON.stringify(sampleRows);

          // Check we're still under budget
          if (currentSize + serialized.length > MAX_SAMPLE_BYTES && Object.keys(sample).length > 0) {
            break; // already have at least 1 sheet, stop
          }

          sample[name] = sampleRows;
          currentSize += serialized.length;

          // Scan for notable rows (totals, subtotals) — scan up to 200 rows
          const scanLimit = Math.min(allRows.length, 200);
          for (let i = 0; i < scanLimit; i++) {
            const row = allRows[i];
            const keyword = isNotableRow(row);
            if (keyword) {
              notableRows.push({
                sheetName: name,
                rowIndex: i,
                cells: row.slice(0, 15),
                matchedKeyword: keyword,
              });
            }
          }
        }

        // Detect if this is a simple file that can skip AI transformation
        const firstSheetRows = sample[sheetsForSample[0]] ?? [];
        const simple = isSimpleFile(sheetCount, firstSheetRows);

        resolve({
          sheetCount,
          sheetNames,
          sample,
          notableRows: notableRows.slice(0, 50),
          isSimpleFile: simple,
        });
      } catch {
        reject(new Error('No se pudo leer la estructura del archivo.'));
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

// ─────────────────────────────────────────────
// Extract all data from file using Claude's pattern
// For files with many similar sheets (e.g., 52 weekly sheets)
// ─────────────────────────────────────────────

export interface ExtractAllResult {
  data: Record<string, unknown>[];
  sheetsProcessed: number;
  warnings: string[];
}

export function extractAllFromPattern(
  file: File,
  pattern: {
    columns: { name: string; original_name: string; type: string }[];
    sheet_pattern: string;
    period_column: string | null;
  },
): Promise<ExtractAllResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'array' });
        const allData: Record<string, unknown>[] = [];
        const warnings: string[] = [];
        let sheetsProcessed = 0;

        // Build a map from original column names to clean names
        const colMap = new Map<string, string>();
        for (const col of pattern.columns) {
          colMap.set(col.original_name.toLowerCase().trim(), col.name);
        }

        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
            header: 1,
            defval: null,
            blankrows: false,
          });

          if (rows.length < 2) continue;

          // Find header row — match against known original column names
          let headerRowIdx = -1;
          let headerMap: Map<number, string> | null = null;

          for (let i = 0; i < Math.min(10, rows.length); i++) {
            const row = rows[i];
            const mapped = new Map<number, string>();
            let matches = 0;

            for (let j = 0; j < row.length; j++) {
              const cell = row[j];
              if (cell == null || cell === '') continue;
              const cellStr = String(cell).toLowerCase().trim();
              const cleanName = colMap.get(cellStr);
              if (cleanName) {
                mapped.set(j, cleanName);
                matches++;
              }
            }

            // If we matched at least 50% of known columns, this is the header row
            if (matches >= Math.ceil(pattern.columns.length * 0.5)) {
              headerRowIdx = i;
              headerMap = mapped;
              break;
            }
          }

          if (headerRowIdx < 0 || !headerMap) {
            // For one_per_period pattern, try treating the sheet as a similar structure
            if (pattern.sheet_pattern === 'one_per_period') {
              // Assume same structure as first sheet — use column indices
              if (rows.length > 1) {
                const dataRows = rows.slice(1);
                for (const row of dataRows) {
                  if (isNotableRow(row)) continue; // skip total rows
                  const record: Record<string, unknown> = {};
                  if (pattern.period_column) {
                    record[pattern.period_column] = sheetName;
                  }
                  let hasData = false;
                  for (let j = 0; j < Math.min(row.length, pattern.columns.length); j++) {
                    record[pattern.columns[j].name] = row[j];
                    if (row[j] != null && row[j] !== '') hasData = true;
                  }
                  if (hasData) allData.push(record);
                }
                sheetsProcessed++;
              }
            } else {
              warnings.push(`Hoja "${sheetName}" no tiene estructura reconocible, se omitió.`);
            }
            continue;
          }

          // Extract data rows using the header map
          const dataRows = rows.slice(headerRowIdx + 1);
          for (const row of dataRows) {
            if (isNotableRow(row)) continue; // skip total/subtotal rows
            const record: Record<string, unknown> = {};
            let hasData = false;
            for (const [colIdx, colName] of headerMap) {
              record[colName] = row[colIdx] ?? null;
              if (row[colIdx] != null && row[colIdx] !== '') hasData = true;
            }
            // Add period from sheet name if applicable
            if (pattern.period_column && !record[pattern.period_column]) {
              record[pattern.period_column] = sheetName;
            }
            if (hasData) allData.push(record);
          }
          sheetsProcessed++;
        }

        resolve({
          data: allData,
          sheetsProcessed,
          warnings,
        });
      } catch {
        reject(new Error('No se pudo extraer datos del archivo.'));
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

// ─────────────────────────────────────────────
// Sheet discovery (legacy, still used)
// ─────────────────────────────────────────────

export function getSheetNames(file: File): Promise<SheetInfo[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'array', sheetRows: 2 });
        const sheets: SheetInfo[] = workbook.SheetNames.map((name) => {
          const ws = workbook.Sheets[name];
          const ref = ws['!ref'];
          let estimatedRows = 0;
          if (ref) {
            const range = XLSX.utils.decode_range(ref);
            estimatedRows = Math.max(0, range.e.r - range.s.r);
          }
          return { name, estimatedRows };
        });
        resolve(sheets);
      } catch {
        reject(new Error('No se pudo leer las hojas del archivo.'));
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

// ─────────────────────────────────────────────
// Health analysis
// ─────────────────────────────────────────────

function analyzeHealth(headers: string[], rows: Record<string, unknown>[]): DataHealth {
  const issues: HealthIssue[] = [];
  let score = 100;

  if (rows.length === 0) return { score: 0, issues: [{ type: 'empty_values', detail: 'El archivo no tiene filas de datos.', severity: 'error', autoFixable: false }] };

  for (const col of headers) {
    const emptyCount = rows.filter((r) => r[col] === '' || r[col] === null || r[col] === undefined).length;
    const pct = emptyCount / rows.length;
    if (pct > 0.5) {
      issues.push({ type: 'empty_values', column: col, detail: `Columna "${col}" tiene ${Math.round(pct * 100)}% de valores vacíos.`, severity: 'error', autoFixable: false });
      score -= 15;
    } else if (pct > 0.1) {
      issues.push({ type: 'empty_values', column: col, detail: `Columna "${col}" tiene ${Math.round(pct * 100)}% de valores vacíos (${emptyCount} filas).`, severity: 'warning', autoFixable: false });
      score -= 5;
    }
  }

  for (const col of headers) {
    const nonEmpty = rows.map((r) => r[col]).filter((v) => v !== '' && v !== null && v !== undefined);
    if (nonEmpty.length === 0) continue;
    const numericCount = nonEmpty.filter((v) => !isNaN(Number(v))).length;
    const pct = numericCount / nonEmpty.length;
    if (pct > 0.7 && pct < 1) {
      const textCount = nonEmpty.length - numericCount;
      issues.push({ type: 'type_mismatch', column: col, detail: `Columna "${col}" tiene ${textCount} valor(es) de texto mezclados con números.`, severity: 'warning', autoFixable: true });
      score -= 8;
    }
  }

  if (rows.length > 1) {
    const fingerprints = new Set<string>();
    let dupes = 0;
    const keyCols = headers.slice(0, Math.min(3, headers.length));
    for (const row of rows) {
      const fp = keyCols.map((k) => String(row[k] ?? '')).join('||');
      if (fingerprints.has(fp)) dupes++;
      else fingerprints.add(fp);
    }
    if (dupes > 0) {
      const pct = Math.round((dupes / rows.length) * 100);
      issues.push({ type: 'duplicates', detail: `Se detectaron ~${dupes} filas duplicadas (${pct}% del total).`, severity: pct > 10 ? 'error' : 'warning', autoFixable: true });
      score -= Math.min(20, pct);
    }
  }

  const suspiciousPattern = /^(col(umn)?[\s_]?\d+|unnamed|campo\s*\d+|[a-z]$)/i;
  for (const col of headers) {
    if (suspiciousPattern.test(col.trim())) {
      issues.push({ type: 'suspicious_name', column: col, detail: `La columna "${col}" tiene un nombre genérico.`, severity: 'info', autoFixable: false });
      score -= 3;
    }
  }

  return { score: Math.max(0, score), issues };
}

// ─────────────────────────────────────────────
// Parse ALL sheets into one combined dataset
// ─────────────────────────────────────────────

export function parseAllSheets(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'array' });

        const sheets: SheetInfo[] = workbook.SheetNames.map((name) => {
          const ws = workbook.Sheets[name];
          const ref = ws['!ref'];
          let estimatedRows = 0;
          if (ref) {
            const range = XLSX.utils.decode_range(ref);
            estimatedRows = Math.max(0, range.e.r - range.s.r);
          }
          return { name, estimatedRows };
        });

        const allRows: Record<string, unknown>[] = [];
        const allHeaders = new Set<string>();

        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName];
          const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
          for (const row of sheetRows) {
            const tagged = { _hoja: sheetName, ...row };
            for (const k of Object.keys(tagged)) allHeaders.add(k);
            allRows.push(tagged);
          }
        }

        if (allRows.length === 0) {
          reject(new Error('El archivo no contiene datos en ninguna hoja.'));
          return;
        }

        const headers = [...allHeaders];
        const health = analyzeHealth(headers, allRows);

        resolve({
          headers,
          rows: allRows,
          rowCount: allRows.length,
          preview: allRows.slice(0, 10),
          sheets,
          selectedSheet: `Todas (${sheets.length} hojas)`,
          health,
        });
      } catch {
        reject(new Error('No se pudo leer el archivo. Verifica que sea Excel o CSV valido.'));
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

// ─────────────────────────────────────────────
// Main parser (single sheet)
// ─────────────────────────────────────────────

export function parseFile(file: File, sheetName?: string): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'array' });

        const sheets: SheetInfo[] = workbook.SheetNames.map((name) => {
          const ws = workbook.Sheets[name];
          const ref = ws['!ref'];
          let estimatedRows = 0;
          if (ref) {
            const range = XLSX.utils.decode_range(ref);
            estimatedRows = Math.max(0, range.e.r - range.s.r);
          }
          return { name, estimatedRows };
        });

        const targetSheet = sheetName && workbook.SheetNames.includes(sheetName)
          ? sheetName
          : workbook.SheetNames[0];

        const worksheet = workbook.Sheets[targetSheet];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

        if (rows.length === 0) {
          reject(new Error('La hoja seleccionada está vacía o no tiene datos.'));
          return;
        }

        const headers = Object.keys(rows[0]);
        const health = analyzeHealth(headers, rows);

        resolve({
          headers,
          rows,
          rowCount: rows.length,
          preview: rows.slice(0, 10),
          sheets,
          selectedSheet: targetSheet,
          health,
        });
      } catch {
        reject(new Error('No se pudo leer el archivo. Verifica que sea Excel o CSV válido.'));
      }
    };

    reader.onerror = () => reject(new Error('Error leyendo el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}
