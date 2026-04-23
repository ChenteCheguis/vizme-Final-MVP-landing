// ============================================================
// VIZME V5 — Tests del file digest
// ============================================================

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildFileDigest } from '../fileDigest';

function makeWorkbook(sheets: Record<string, Array<Array<string | number | null>>>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('buildFileDigest', () => {
  it('genera digest válido para CSV simple', () => {
    const csv = 'fecha,ventas\n2026-01-01,100\n2026-01-02,200\n';
    const buf = new TextEncoder().encode(csv).buffer;
    const digest = buildFileDigest({ buffer: buf, file_name: 'ventas.csv' });

    expect(digest.file_type).toBe('csv');
    expect(digest.total_sheets).toBeGreaterThanOrEqual(1);
    expect(digest.sheets_summary.length).toBeGreaterThanOrEqual(1);
    expect(digest.sheets_summary[0].rows_total).toBeGreaterThanOrEqual(2);
  });

  it('clasifica hojas por nombre', () => {
    const buf = makeWorkbook({
      'Ventas Semanales': [['prod', 'monto'], ['cafe', 50]],
      'Resumen Mensual': [['mes', 'total'], ['enero', 1500]],
      'Inventario': [['sku', 'stock'], ['A1', 20]],
    });
    const digest = buildFileDigest({ buffer: buf, file_name: 'negocio.xlsx' });

    const kinds = digest.sheets_summary.map((s) => s.kind);
    expect(kinds).toContain('semanal');
    expect(kinds).toContain('mensual');
    expect(kinds).toContain('inventario');
  });

  it('extrae 3 header candidates por hoja', () => {
    const buf = makeWorkbook({
      Data: [
        ['H1', 'H2'],
        ['h1b', 'h2b'],
        ['h1c', 'h2c'],
        ['a', 1],
        ['b', 2],
      ],
    });
    const digest = buildFileDigest({ buffer: buf, file_name: 'x.xlsx' });
    expect(digest.sheets_summary[0].header_candidates).toHaveLength(3);
  });

  it('detecta filas notables enterradas (fila Total en posición 58)', () => {
    const rows: Array<Array<string | number | null>> = [['producto', 'monto']];
    for (let i = 1; i < 58; i++) rows.push([`producto_${i}`, i * 10]);
    rows.push(['Total General', 999999]);
    const buf = makeWorkbook({ Hoja1: rows });

    const digest = buildFileDigest({ buffer: buf, file_name: 'ventas.xlsx' });
    const notable = digest.notable_rows.find((r) => r.row_index === 58);
    expect(notable).toBeDefined();
    expect(notable?.matched_keyword).toBe('total');
    expect(notable?.content[1]).toBe(999999);
  });

  it('incluye sample_sheets con TODAS las filas (no recorta a 30)', () => {
    const rows: Array<Array<string | number | null>> = [['col']];
    for (let i = 0; i < 120; i++) rows.push([`r${i}`]);
    const buf = makeWorkbook({ Larga: rows });

    const digest = buildFileDigest({ buffer: buf, file_name: 'larga.xlsx' });
    expect(digest.sample_sheets[0].rows.length).toBeGreaterThanOrEqual(120);
  });

  it('selecciona sample_sheets representativas de un workbook con muchas hojas', () => {
    const sheets: Record<string, Array<Array<string | number | null>>> = {};
    for (let i = 0; i < 12; i++) sheets[`Hoja${i + 1}`] = [['c'], ['v']];
    const buf = makeWorkbook(sheets);

    const digest = buildFileDigest({ buffer: buf, file_name: 'multi.xlsx' });
    expect(digest.total_sheets).toBe(12);
    expect(digest.sample_sheets.length).toBeGreaterThanOrEqual(3);
    expect(digest.sample_sheets.length).toBeLessThanOrEqual(5);
    expect(digest.sample_sheets[0].name).toBe('Hoja1');
    expect(digest.sample_sheets[digest.sample_sheets.length - 1].name).toBe('Hoja12');
  });

  it('omite filas completamente vacías', () => {
    const buf = makeWorkbook({
      Data: [['a', 'b'], [null, null], ['x', 1], [null, null], ['y', 2]],
    });
    const digest = buildFileDigest({ buffer: buf, file_name: 'x.xlsx' });
    expect(digest.sheets_summary[0].rows_total).toBe(3);
  });
});
