// ============================================================
// VIZME V5 — Test de regresión con archivo real (PIX)
//
// Reproduce el bug reportado por Diego (silent failure en wizard
// paso 3 con Ventas_PIX_nov22_feb24_pruebavizme.csv): 6,593 filas
// de un restaurante mexicano. El test pasa si buildFileDigest:
//   - completa sin lanzar
//   - devuelve un digest coherente
//   - emite eventos de progreso reales (no sólo done)
//
// Si el fixture no está presente (no commiteado al repo por
// privacidad), el test se salta — no rompe CI.
// ============================================================

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildFileDigest, type DigestProgressEvent } from '../fileDigest';

const FIXTURE_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'scripts',
  'fixtures',
  'Ventas_PIX_nov22_feb24_pruebavizme.csv'
);

const fixtureExists = fs.existsSync(FIXTURE_PATH);

describe('buildFileDigest — fixture real (PIX restaurante)', () => {
  it.skipIf(!fixtureExists)('parsea CSV de 6,593 filas sin colgarse', async () => {
    const buf = fs.readFileSync(FIXTURE_PATH);
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

    const events: DigestProgressEvent[] = [];
    const start = Date.now();

    const digest = await buildFileDigest({
      buffer: arrayBuffer,
      file_name: 'Ventas_PIX_nov22_feb24_pruebavizme.csv',
      onProgress: (e) => events.push(e),
    });

    const elapsed = Date.now() - start;

    expect(digest.file_type).toBe('csv');
    expect(digest.total_sheets).toBeGreaterThanOrEqual(1);
    expect(digest.total_rows_approx).toBeGreaterThan(6000);
    expect(digest.sheets_summary[0].rows_total).toBeGreaterThan(6000);
    expect(digest.sheets_summary[0].cols_total).toBeGreaterThanOrEqual(10);
    expect(digest.sheets_summary[0].header_candidates).toHaveLength(3);
    expect(digest.sample_sheets[0].rows.length).toBeGreaterThan(6000);

    const stages = events.map((e) => e.stage);
    expect(stages[0]).toBe('reading_workbook');
    expect(stages).toContain('workbook_parsed');
    expect(stages).toContain('processing_sheet');
    expect(stages).toContain('picking_samples');
    expect(stages[stages.length - 1]).toBe('done');
    expect(events.length).toBeGreaterThanOrEqual(5);

    const lastPercent = events[events.length - 1].percent;
    expect(lastPercent).toBe(100);

    if (process.env.VIZME_VERBOSE === '1') {
      console.log(
        `[fileDigest_pix] ${digest.total_rows_approx.toLocaleString('es-MX')} filas en ${elapsed}ms — ${events.length} eventos de progreso`
      );
    }
  });

  it.skipIf(fixtureExists)('skipped — fixture PIX no presente en scripts/fixtures/', () => {
    expect(true).toBe(true);
  });
});
