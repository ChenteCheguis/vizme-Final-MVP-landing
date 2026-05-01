// Pruebas del catálogo: 19 entradas únicas, todas con campos
// obligatorios, y el helper compactCatalogForPrompt produce
// algo razonable.

import { describe, expect, it } from 'vitest';
import {
  VISUALIZATION_CATALOG,
  VALID_VISUALIZATION_TYPES,
  compactCatalogForPrompt,
} from '../visualizationCatalog.ts';

describe('VISUALIZATION_CATALOG', () => {
  it('tiene exactamente 19 visualizaciones', () => {
    expect(VISUALIZATION_CATALOG).toHaveLength(19);
  });

  it('cada id es único', () => {
    const ids = VISUALIZATION_CATALOG.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada entrada tiene name, description, when_to_use no vacíos', () => {
    for (const v of VISUALIZATION_CATALOG) {
      expect(v.name.length).toBeGreaterThan(0);
      expect(v.description.length).toBeGreaterThan(0);
      expect(v.when_to_use.length).toBeGreaterThan(0);
    }
  });

  it('chart_library válido en cada entrada', () => {
    const allowed = new Set(['recharts', 'react-calendar-heatmap', 'react-gauge-component', 'custom']);
    for (const v of VISUALIZATION_CATALOG) {
      expect(allowed.has(v.chart_library)).toBe(true);
    }
  });

  it('VALID_VISUALIZATION_TYPES coincide con el catálogo', () => {
    expect(VALID_VISUALIZATION_TYPES.size).toBe(19);
    for (const v of VISUALIZATION_CATALOG) {
      expect(VALID_VISUALIZATION_TYPES.has(v.id)).toBe(true);
    }
  });

  it('incluye los tipos esperados (kpi_hero, line_chart, donut_chart, etc.)', () => {
    const expected = [
      'kpi_hero',
      'kpi_card',
      'line_chart',
      'area_chart',
      'bar_chart',
      'donut_chart',
      'heatmap_calendar',
      'sparkline',
      'gauge',
      'data_table',
    ];
    for (const id of expected) {
      expect(VALID_VISUALIZATION_TYPES.has(id)).toBe(true);
    }
  });
});

describe('compactCatalogForPrompt', () => {
  it('devuelve string no vacío con todas las entradas', () => {
    const out = compactCatalogForPrompt();
    expect(out.length).toBeGreaterThan(500);
    for (const v of VISUALIZATION_CATALOG) {
      expect(out).toContain(`"${v.id}"`);
    }
  });
});
