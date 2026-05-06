// Tests del catálogo por dominio — Sprint 4.3.

import { describe, expect, it } from 'vitest';
import {
  getDomainWidgets,
  compactDomainWidgetsForPrompt,
  ALL_INDUSTRIES,
} from '../domainWidgetCatalog.ts';
import { VALID_VISUALIZATION_TYPES } from '../visualizationCatalog.ts';

describe('getDomainWidgets — mapeo de industrias', () => {
  it('reconoce restaurantes con variantes', () => {
    expect(getDomainWidgets('restaurantes')[0].id.startsWith('rest_')).toBe(true);
    expect(getDomainWidgets('Restaurante')[0].id.startsWith('rest_')).toBe(true);
    expect(getDomainWidgets('food_service')[0].id.startsWith('rest_')).toBe(true);
  });

  it('reconoce barberías', () => {
    expect(getDomainWidgets('barberias')[0].id.startsWith('barb_')).toBe(true);
    expect(getDomainWidgets('Barber Shop')[0].id.startsWith('barb_')).toBe(true);
  });

  it('reconoce retail / farmacias / logística', () => {
    expect(getDomainWidgets('retail')[0].id.startsWith('ret_')).toBe(true);
    expect(getDomainWidgets('farmacia')[0].id.startsWith('farm_')).toBe(true);
    expect(getDomainWidgets('logistica')[0].id.startsWith('log_')).toBe(true);
  });

  it('cae a generic con industria desconocida', () => {
    expect(getDomainWidgets('astrologia')[0].id.startsWith('gen_')).toBe(true);
    expect(getDomainWidgets(null)[0].id.startsWith('gen_')).toBe(true);
    expect(getDomainWidgets(undefined)[0].id.startsWith('gen_')).toBe(true);
  });
});

describe('catálogo — integridad estructural', () => {
  it('cada widget de cada industria usa un type válido del catálogo de viz', () => {
    for (const ind of ALL_INDUSTRIES) {
      const widgets = getDomainWidgets(ind);
      for (const w of widgets) {
        expect(VALID_VISUALIZATION_TYPES.has(w.type), `${ind}/${w.id} usa type "${w.type}" inválido`).toBe(true);
      }
    }
  });

  it('cada industria tiene al menos un widget priority=1', () => {
    for (const ind of ALL_INDUSTRIES) {
      const widgets = getDomainWidgets(ind);
      expect(widgets.some((w) => w.priority === 1)).toBe(true);
    }
  });

  it('cada industria tiene al menos un widget de tipo kpi_hero', () => {
    for (const ind of ALL_INDUSTRIES) {
      const widgets = getDomainWidgets(ind);
      expect(widgets.some((w) => w.type === 'kpi_hero')).toBe(true);
    }
  });
});

describe('compactDomainWidgetsForPrompt', () => {
  it('genera texto consumible por LLM', () => {
    const txt = compactDomainWidgetsForPrompt('restaurantes');
    expect(txt).toContain('rest_ventas_hero');
    expect(txt).toContain('audience=');
    expect(txt).toContain('priority=');
  });
});
