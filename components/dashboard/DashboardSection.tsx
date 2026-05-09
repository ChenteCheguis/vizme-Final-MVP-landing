// Sección "Tu dashboard en vivo" — orquesta:
//   - Cargar blueprint + cálculos + insights
//   - Si no hay blueprint, ofrecer "Generar dashboard" (Opus)
//   - Si no hay cálculos, ofrecer "Recalcular métricas"
//   - Si no hay insights de la página activa, permitir generar
//   - Cuando todo está listo, renderear DashboardRenderer
//
// Toda acción AI dispara la Edge Function analyze-data en su modo
// correspondiente y luego pide reload() del data loader.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertCircle, RefreshCw, Wand2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useDashboardData } from './useDashboardData';
import { useRetryExtraction } from '../../lib/hooks/useRetryExtraction';
import DashboardRenderer from './DashboardRenderer';
import DashboardSkeleton from './DashboardSkeleton';
import PeriodPicker from './PeriodPicker';
import DashboardHealthBanner from './DashboardHealthBanner';
import DashboardDiagnosticsModal from './DashboardDiagnosticsModal';
import FilterBar from './FilterBar';
import { DashboardFilterProvider } from '../../contexts/DashboardFilterContext';
import type { MetricCalculationPeriod } from '../../lib/v5types';

interface DashboardSectionProps {
  projectId: string;
  schemaId: string | undefined;
  // Cuando el usuario sube data nueva, refrescamos los cálculos
  reloadKey?: number;
}

async function callEdge<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('analyze-data', { body });
  if (error) {
    const ctx = error as Error & { context?: Response };
    let detail = ctx.message;
    try {
      if (ctx.context && typeof ctx.context.json === 'function') {
        const parsed = await ctx.context.json();
        if (parsed?.error) detail = String(parsed.error);
        else if (parsed?.message) detail = String(parsed.message);
      }
    } catch (_) {
      // ignore JSON parse errors
    }
    throw new Error(detail);
  }
  return data as T;
}

export default function DashboardSection({ projectId, schemaId, reloadKey }: DashboardSectionProps) {
  const data = useDashboardData(projectId);
  const retry = useRetryExtraction(projectId);
  const [period, setPeriod] = useState<MetricCalculationPeriod>('last_month');
  const [busy, setBusy] = useState<null | 'blueprint' | 'recalc' | 'insights'>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  const handleRetry = useCallback(async () => {
    setActionError(null);
    const r = await retry.retry();
    if (!r.success) {
      setActionError(r.error ?? 'No pudimos reintentar.');
      return;
    }
    data.reload();
  }, [retry, data]);

  useEffect(() => {
    if (reloadKey !== undefined) data.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const buildBlueprint = useCallback(async () => {
    if (!schemaId) {
      setActionError('Necesitamos un schema antes de diseñar el dashboard.');
      return;
    }
    setActionError(null);
    setBusy('blueprint');
    try {
      await callEdge({ mode: 'build_dashboard_blueprint', project_id: projectId, schema_id: schemaId });
      data.reload();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }, [projectId, schemaId, data]);

  const recalc = useCallback(async () => {
    setActionError(null);
    setBusy('recalc');
    try {
      await callEdge({ mode: 'recalculate_metrics', project_id: projectId });
      data.reload();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }, [projectId, data]);

  const generateInsights = useCallback(
    async (pageId: string) => {
      setActionError(null);
      setBusy('insights');
      try {
        await callEdge({ mode: 'generate_insights', project_id: projectId, page_id: pageId });
        data.reload();
      } catch (err) {
        setActionError((err as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [projectId, data]
  );

  if (data.loading) {
    return <DashboardSkeleton />;
  }

  if (data.error) {
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50/60 p-8 text-center">
        <AlertCircle size={20} className="mx-auto text-rose-500" />
        <p className="mt-3 text-sm text-rose-800">{data.error}</p>
      </section>
    );
  }

  if (!data.blueprint) {
    return (
      <section className="rounded-3xl border border-dashed border-vizme-navy/15 bg-gradient-to-br from-white/70 to-vizme-bg/40 p-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-vizme-coral/10 text-vizme-coral">
          <Wand2 size={22} />
        </div>
        <p className="mt-5 font-display text-2xl font-light tracking-editorial text-vizme-navy">
          Tu dashboard editorial está a un click.
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-vizme-greyblue text-pretty">
          Opus 4.7 leerá tu schema y diseñará la estructura óptima — cuántas
          páginas, qué widgets en cada espacio, qué métrica acompaña a qué
          dimensión.
        </p>
        {actionError && <p className="mt-3 text-xs text-rose-600">{actionError}</p>}
        <button
          type="button"
          onClick={buildBlueprint}
          disabled={busy === 'blueprint' || !schemaId}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-vizme-coral px-6 py-3 text-white shadow-glow-coral transition-all hover:-translate-y-0.5 hover:bg-vizme-orange disabled:opacity-50"
        >
          {busy === 'blueprint' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {busy === 'blueprint' ? 'Diseñando…' : 'Generar dashboard con Opus'}
        </button>
      </section>
    );
  }

  // health derivado del blueprint (Sprint 4.2). Si todavía no se ha calculado
  // (proyectos viejos antes de migration 14), inferimos desde hasCalcs.
  const health = data.blueprint.health_status
    ? {
        status: data.blueprint.health_status,
        details: data.blueprint.health_details ?? {
          extracted: 0,
          total: data.metricsById.size,
          percent: 0,
          missing_metric_ids: [],
          missing_metric_names: [],
          reasons: [],
        },
      }
    : data.hasCalcs
    ? null // legacy: assume complete, hide banner
    : {
        status: 'no_data' as const,
        details: {
          extracted: 0,
          total: data.metricsById.size,
          percent: 0,
          missing_metric_ids: [],
          missing_metric_names: Array.from(data.metricsById.values()).map((m) => m.name),
          reasons: ['Aún no se han calculado las métricas.'],
        },
      };

  // Ghost dashboard cuando health=no_data: blueprint existe pero no hay datos
  if (health?.status === 'no_data') {
    return (
      <div className="space-y-6">
        <DashboardHealthBanner
          health={health}
          onRetry={handleRetry}
          onShowDiagnostics={() => setDiagnosticsOpen(true)}
          retrying={retry.busy}
        />
        <section className="relative overflow-hidden rounded-3xl border border-dashed border-vizme-navy/15 bg-white/40 p-10 text-center">
          {/* Ghost cards detrás del mensaje */}
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 gap-3 p-6 opacity-30">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-vizme-navy/5" />
            ))}
          </div>
          <div className="relative">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-vizme-coral/10 text-vizme-coral">
              <Sparkles size={22} />
            </div>
            <p className="mt-5 font-display text-2xl font-light tracking-editorial text-vizme-navy">
              Tu dashboard está esperando datos.
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-vizme-greyblue text-pretty">
              El diseño está listo, pero no encontramos columnas que correspondan a tus métricas.
              Reintenta la extracción o sube un archivo distinto desde la pestaña Archivos.
            </p>
            {actionError && <p className="mt-3 text-xs text-rose-600">{actionError}</p>}
            <button
              type="button"
              onClick={() => setDiagnosticsOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-vizme-navy px-6 py-3 text-sm text-white transition-all hover:-translate-y-0.5 hover:bg-vizme-coral"
            >
              Ver diagnóstico
            </button>
          </div>
        </section>
        <DashboardDiagnosticsModal
          open={diagnosticsOpen}
          onClose={() => setDiagnosticsOpen(false)}
          health={health}
          onRetry={handleRetry}
          retrying={retry.busy}
        />
      </div>
    );
  }

  if (!data.hasCalcs) {
    return (
      <section className="rounded-3xl border border-vizme-coral/20 bg-vizme-coral/5 p-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/70 text-vizme-coral">
          <RefreshCw size={22} />
        </div>
        <p className="mt-5 font-display text-2xl font-light tracking-editorial text-vizme-navy">
          Falta calcular tus métricas.
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-vizme-greyblue text-pretty">
          Subiste datos pero todavía no agregamos los totales por período.
          Esto toma unos segundos y no consume créditos de IA.
        </p>
        {actionError && <p className="mt-3 text-xs text-rose-600">{actionError}</p>}
        <button
          type="button"
          onClick={recalc}
          disabled={busy === 'recalc'}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-vizme-navy px-6 py-3 text-white transition-all hover:-translate-y-0.5 hover:bg-vizme-coral disabled:opacity-50"
        >
          {busy === 'recalc' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          {busy === 'recalc' ? 'Calculando…' : 'Calcular métricas'}
        </button>
      </section>
    );
  }

  return (
    <DashboardFilterProvider>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="label-eyebrow">Dashboard editorial</p>
            <p className="text-sm text-vizme-greyblue">
              Sofisticación: <span className="font-semibold text-vizme-navy">{data.blueprint.sophistication_level}</span>{' '}
              · {data.blueprint.total_widgets ?? 0} widgets · v{data.blueprint.version}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PeriodPicker value={period} onChange={setPeriod} />
            <button
              type="button"
              onClick={recalc}
              disabled={busy === 'recalc'}
              className="inline-flex items-center gap-1.5 rounded-full border border-vizme-navy/15 bg-white/70 px-3 py-1.5 text-xs font-medium text-vizme-navy transition-all hover:border-vizme-coral hover:text-vizme-coral disabled:opacity-50"
            >
              {busy === 'recalc' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Refrescar
            </button>
            <button
              type="button"
              onClick={buildBlueprint}
              disabled={busy === 'blueprint'}
              className="inline-flex items-center gap-1.5 rounded-full border border-vizme-coral/40 bg-vizme-coral/5 px-3 py-1.5 text-xs font-medium text-vizme-coral transition-all hover:bg-vizme-coral hover:text-white disabled:opacity-50"
            >
              {busy === 'blueprint' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              Rediseñar
            </button>
          </div>
        </div>

        {actionError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800">
            {actionError}
          </div>
        )}

        {health && health.status !== 'complete' && (
          <DashboardHealthBanner
            health={health}
            onRetry={handleRetry}
            onShowDiagnostics={() => setDiagnosticsOpen(true)}
            retrying={retry.busy}
          />
        )}

        <FilterBar />

        <DashboardRenderer
          blueprint={data.blueprint}
          metricsById={data.metricsById}
          calcsByMetricPeriod={data.calcsByMetricPeriod}
          insightsByPage={data.insightsByPage}
          period={period}
          onRequestInsights={generateInsights}
          insightsLoading={busy === 'insights'}
        />

        {health && (
          <DashboardDiagnosticsModal
            open={diagnosticsOpen}
            onClose={() => setDiagnosticsOpen(false)}
            health={health}
            onRetry={handleRetry}
            retrying={retry.busy}
          />
        )}
      </div>
    </DashboardFilterProvider>
  );
}
