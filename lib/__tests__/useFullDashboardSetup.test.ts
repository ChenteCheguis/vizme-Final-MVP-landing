// Pruebas del orquestador post-schema:
//   - Caso éxito completo (4 pasos OK).
//   - Falla en paso 2 (recalculate_metrics).
//   - Falla parcial en paso 4 (1 página falla, dashboard sigue siendo
//     usable → success=true, insightsFailed > 0).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BusinessSchema } from '../v5types';

// ── Mocks ─────────────────────────────────────────────
const invokeMock = vi.fn();

vi.mock('../supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}));

vi.mock('../ingestEngine', () => ({
  runIngestExtraction: vi.fn(() => ({
    summary: {
      file_name: 'test.csv',
      total_data_points: 50,
      metrics_extracted: 5,
      metrics_skipped: 0,
      period_range: { start: '2024-01-01', end: '2024-12-31' },
      inferred_grain: 'month',
      warnings: [],
    },
    extractions: [
      {
        metric_id: 'm1',
        metric_name: 'Ventas',
        source_sheet: 'Sheet1',
        source_column: 'Total',
        date_column: 'Fecha',
        aggregation: 'sum',
        confidence: 'high',
        data_points: [
          {
            period_start: '2024-01-01',
            value: 100,
            dimension_values: {},
          },
        ],
      },
    ],
  })),
}));

// Imports AFTER mocks so the SUT picks up mocked deps.
const { runFullDashboardSetup } = await import('../hooks/useFullDashboardSetup');

const baseFile = new File(['x'], 'test.csv', { type: 'text/csv' });
// Stub arrayBuffer for jsdom-less node env
Object.defineProperty(baseFile, 'arrayBuffer', {
  value: async () => new ArrayBuffer(8),
});

const baseSchema: BusinessSchema = {
  business_identity: {
    industry: 'restaurantes',
    business_model: 'b2c',
    language: 'es-MX',
    location: { country: 'MX' },
  },
  entities: [],
  metrics: [
    { id: 'm1', name: 'Ventas', aggregation: 'sum' } as never,
  ],
  dimensions: [],
  extraction_rules: [],
  external_sources: [],
} as unknown as BusinessSchema;

beforeEach(() => {
  invokeMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('runFullDashboardSetup', () => {
  it('completa los 4 pasos y reporta progreso por etapa', async () => {
    invokeMock
      .mockResolvedValueOnce({ data: { inserted: 50 }, error: null })
      .mockResolvedValueOnce({
        data: { metrics_calculated: 5 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          blueprint_id: 'bp1',
          pages: [{ id: 'p1' }, { id: 'p2' }],
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { insights_created: 4 }, error: null })
      .mockResolvedValueOnce({ data: { insights_created: 3 }, error: null });

    const stages: string[] = [];
    const result = await runFullDashboardSetup({
      projectId: 'proj1',
      fileId: 'file1',
      schemaId: 'schema1',
      file: baseFile,
      schema: baseSchema,
      onProgress: (stage) => stages.push(stage),
    });

    expect(result.success).toBe(true);
    expect(result.blueprintId).toBe('bp1');
    expect(result.stats?.insertedRows).toBe(50);
    expect(result.stats?.metricsCalculated).toBe(5);
    expect(result.stats?.pagesGenerated).toBe(2);
    expect(result.stats?.insightsGenerated).toBe(7);
    expect(result.stats?.insightsFailed).toBe(0);
    expect(stages).toEqual([
      'ingesting',
      'calculating',
      'designing',
      'writing_insights',
      'done',
    ]);
    expect(invokeMock).toHaveBeenCalledTimes(5);
  });

  it('reporta failedStep="calculating" si recalculate_metrics falla', async () => {
    invokeMock
      .mockResolvedValueOnce({ data: { inserted: 50 }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'DB connection lost' },
      });

    const result = await runFullDashboardSetup({
      projectId: 'proj1',
      fileId: 'file1',
      schemaId: 'schema1',
      file: baseFile,
      schema: baseSchema,
    });

    expect(result.success).toBe(false);
    expect(result.failedStep).toBe('calculating');
    expect(result.error).toContain('DB connection lost');
    // No debió llamar a build_dashboard_blueprint
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it('insights fallidos no bloquean el dashboard (success=true)', async () => {
    invokeMock
      .mockResolvedValueOnce({ data: { inserted: 50 }, error: null })
      .mockResolvedValueOnce({
        data: { metrics_calculated: 5 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          blueprint_id: 'bp1',
          pages: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
        },
        error: null,
      })
      // 1 success + 2 failures en insights
      .mockResolvedValueOnce({ data: { insights_created: 4 }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'rate limit' },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'timeout' },
      });

    const result = await runFullDashboardSetup({
      projectId: 'proj1',
      fileId: 'file1',
      schemaId: 'schema1',
      file: baseFile,
      schema: baseSchema,
    });

    expect(result.success).toBe(true);
    expect(result.blueprintId).toBe('bp1');
    expect(result.stats?.pagesGenerated).toBe(3);
    expect(result.stats?.insightsGenerated).toBe(4);
    expect(result.stats?.insightsFailed).toBe(2);
  });
});
