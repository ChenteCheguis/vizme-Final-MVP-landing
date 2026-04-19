// ============================================================
// VIZME V5 — Smoke test: timeSeriesRepo shape
// ============================================================

import { describe, it, expect } from 'vitest';
import { timeSeriesRepo } from '../timeSeriesRepo';
import type { TimeSeriesPoint } from '../../v5types';

describe('timeSeriesRepo', () => {
  it('expone los métodos esperados', () => {
    expect(typeof timeSeriesRepo.listByMetric).toBe('function');
    expect(typeof timeSeriesRepo.bulkInsert).toBe('function');
    expect(typeof timeSeriesRepo.removeByFile).toBe('function');
  });

  it('TimeSeriesPoint type admite el contrato mínimo', () => {
    const sample: TimeSeriesPoint = {
      id: 'uuid',
      project_id: 'uuid',
      metric_id: 'revenue_total',
      dimension_values: { channel: 'online', region: 'CDMX' },
      value: 12500.5,
      period_start: '2026-04-01T00:00:00Z',
      period_end: '2026-04-30T23:59:59Z',
      created_at: new Date().toISOString(),
    };
    expect(sample.metric_id).toBe('revenue_total');
    expect(sample.value).toBeGreaterThan(0);
  });

  it('bulkInsert con array vacío devuelve []', async () => {
    const result = await timeSeriesRepo.bulkInsert([]);
    expect(result).toEqual([]);
  });
});
