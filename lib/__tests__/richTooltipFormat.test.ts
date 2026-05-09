// Sprint 4.3 P3 — Tests del formateador ISO usado por RichTooltip y los
// time widgets. Validamos las 3 granularidades + casos límite.

import { describe, expect, it } from 'vitest';
import { formatIsoDateLabel } from '../../components/dashboard/widgets/RichTooltip';

describe('formatIsoDateLabel', () => {
  it('formatea yyyy-mm-dd a "DD mmm YYYY"', () => {
    expect(formatIsoDateLabel('2023-10-21')).toBe('21 oct 2023');
    expect(formatIsoDateLabel('2024-01-05')).toBe('5 ene 2024');
    expect(formatIsoDateLabel('2024-12-31')).toBe('31 dic 2024');
  });

  it('formatea yyyy-mm a "mmm YYYY"', () => {
    expect(formatIsoDateLabel('2024-03')).toBe('mar 2024');
    expect(formatIsoDateLabel('2023-09')).toBe('sep 2023');
  });

  it('regresa el año tal cual cuando es yyyy', () => {
    expect(formatIsoDateLabel('2024')).toBe('2024');
  });

  it('cae con seguridad cuando recibe undefined o números', () => {
    expect(formatIsoDateLabel(undefined)).toBe('');
    expect(formatIsoDateLabel(2024)).toBe('2024');
  });

  it('regresa el input intacto si no matchea', () => {
    expect(formatIsoDateLabel('not-a-date')).toBe('not-a-date');
  });
});
