// Hook que carga el blueprint activo + metric_calculations + insights
// para un proyecto. Devuelve un loader unificado para el renderer.

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  DashboardBlueprint,
  MetricCalculation,
  MetricCalculationPeriod,
  Insight,
  Metric,
} from '../../lib/v5types';

export interface DashboardDataState {
  blueprint: DashboardBlueprint | null;
  metricsById: Map<string, Metric>;
  // calcsByMetricPeriod[metric_id][period] = MetricCalculation
  calcsByMetricPeriod: Map<string, Map<MetricCalculationPeriod, MetricCalculation>>;
  insightsByPage: Map<string, Insight[]>;
  loading: boolean;
  error: string | null;
  hasCalcs: boolean;
}

export function useDashboardData(projectId: string | undefined): DashboardDataState & {
  reload: () => void;
} {
  const [state, setState] = useState<DashboardDataState>({
    blueprint: null,
    metricsById: new Map(),
    calcsByMetricPeriod: new Map(),
    insightsByPage: new Map(),
    loading: true,
    error: null,
    hasCalcs: false,
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const [bpRes, schemaRes, calcsRes, insRes] = await Promise.all([
          supabase
            .from('dashboard_blueprints')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_active', true)
            .order('version', { ascending: false })
            .limit(1),
          supabase
            .from('business_schemas')
            .select('metrics')
            .eq('project_id', projectId)
            .order('version', { ascending: false })
            .limit(1),
          supabase
            .from('metric_calculations')
            .select('*')
            .eq('project_id', projectId),
          supabase
            .from('insights')
            .select('*')
            .eq('project_id', projectId)
            .order('priority', { ascending: true })
            .order('generated_at', { ascending: false }),
        ]);

        if (cancelled) return;

        if (bpRes.error) throw new Error(`Blueprint: ${bpRes.error.message}`);
        if (schemaRes.error) throw new Error(`Schema: ${schemaRes.error.message}`);
        if (calcsRes.error) throw new Error(`Cálculos: ${calcsRes.error.message}`);
        if (insRes.error) throw new Error(`Insights: ${insRes.error.message}`);

        const blueprint = (bpRes.data?.[0] ?? null) as unknown as DashboardBlueprint | null;
        const metricsArr =
          (schemaRes.data?.[0]?.metrics ?? []) as unknown as Metric[];
        const metricsById = new Map(metricsArr.map((m) => [m.id, m]));

        const calcsByMetricPeriod = new Map<
          string,
          Map<MetricCalculationPeriod, MetricCalculation>
        >();
        for (const c of (calcsRes.data ?? []) as unknown as MetricCalculation[]) {
          if (!calcsByMetricPeriod.has(c.metric_id))
            calcsByMetricPeriod.set(c.metric_id, new Map());
          calcsByMetricPeriod.get(c.metric_id)!.set(c.period, c);
        }

        const insightsByPage = new Map<string, Insight[]>();
        for (const i of (insRes.data ?? []) as unknown as Insight[]) {
          const key = i.page_id ?? '__no_page__';
          if (!insightsByPage.has(key)) insightsByPage.set(key, []);
          insightsByPage.get(key)!.push(i);
        }

        setState({
          blueprint,
          metricsById,
          calcsByMetricPeriod,
          insightsByPage,
          loading: false,
          error: null,
          hasCalcs: (calcsRes.data?.length ?? 0) > 0,
        });
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: (err as Error).message ?? 'Error cargando dashboard.',
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  return { ...state, reload };
}
