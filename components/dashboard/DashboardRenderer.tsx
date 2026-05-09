// Renderer principal del dashboard editorial multi-página.
// Recibe el blueprint + cálculos + insights + período actual y dibuja la
// página activa. Layout: hero + secciones, grid 4 columnas con gap.

import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type {
  DashboardBlueprint,
  DashboardPage,
  DashboardSection,
  DashboardWidget,
  Insight,
  Metric,
  MetricCalculation,
  MetricCalculationPeriod,
} from '../../lib/v5types';
import { DashboardWidgetView } from './widgets';
import InsightCard from './InsightCard';
import PageNav from './PageNav';
import type { WidgetRenderProps } from './widgets/widgetTypes';
import { useFilteredMetrics } from '../../lib/hooks/useFilteredMetrics';

export interface DashboardRendererProps {
  blueprint: DashboardBlueprint;
  metricsById: Map<string, Metric>;
  calcsByMetricPeriod: Map<string, Map<MetricCalculationPeriod, MetricCalculation>>;
  insightsByPage: Map<string, Insight[]>;
  period: MetricCalculationPeriod;
  onRequestInsights?: (pageId: string) => void;
  insightsLoading?: boolean;
}

function gapClass(g: 'sm' | 'md' | 'lg'): string {
  if (g === 'sm') return 'gap-3';
  if (g === 'lg') return 'gap-6';
  return 'gap-4';
}

function Section({
  section,
  renderWidget,
}: {
  section: DashboardSection;
  renderWidget: (w: DashboardWidget) => React.ReactNode;
}) {
  const cols = section.grid_layout?.columns ?? 4;
  const gap = gapClass(section.grid_layout?.gap ?? 'md');

  // Tailwind needs static class strings — map common cases.
  const colsClass =
    cols === 1
      ? 'grid-cols-1'
      : cols === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : cols === 3
          ? 'grid-cols-1 md:grid-cols-3'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';

  return (
    <section className="space-y-4">
      {(section.title || section.subtitle) && (
        <header>
          {section.subtitle && <p className="label-eyebrow">{section.subtitle}</p>}
          {section.title && (
            <h2 className="mt-1 font-display text-2xl font-light tracking-editorial text-vizme-navy">
              {section.title}
            </h2>
          )}
        </header>
      )}
      <div className={['grid', colsClass, gap].join(' ')}>
        {section.widgets.map((w) => {
          const span = w.grid_position?.column_span ?? 1;
          const row = w.grid_position?.row_span ?? 1;
          const spanClass =
            span >= 4
              ? 'md:col-span-2 lg:col-span-4'
              : span === 3
                ? 'md:col-span-2 lg:col-span-3'
                : span === 2
                  ? 'md:col-span-2 lg:col-span-2'
                  : 'md:col-span-1';
          const rowClass = row >= 2 ? 'lg:row-span-2' : '';
          return (
            <div key={w.id} className={[spanClass, rowClass].join(' ')}>
              {renderWidget(w)}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PageBody({
  page,
  renderWidget,
  insights,
  onRequestInsights,
  insightsLoading,
}: {
  page: DashboardPage;
  renderWidget: (w: DashboardWidget) => React.ReactNode;
  insights: Insight[];
  onRequestInsights?: (pageId: string) => void;
  insightsLoading?: boolean;
}) {
  return (
    <div className="space-y-10">
      <header>
        <p className="label-eyebrow">Audiencia · {page.audience}</p>
        <h1 className="mt-1 font-display text-4xl font-light tracking-editorial text-vizme-navy lg:text-5xl">
          {page.title}
        </h1>
        {page.description && (
          <p className="mt-2 max-w-3xl text-sm text-vizme-greyblue text-pretty">
            {page.description}
          </p>
        )}
      </header>

      {page.sections.map((s) => (
        <Section key={s.id} section={s} renderWidget={renderWidget} />
      ))}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="label-eyebrow">Sonnet 4.6 lee tus datos</p>
            <h2 className="mt-1 font-display text-2xl font-light tracking-editorial text-vizme-navy">
              Insights de esta página
            </h2>
          </div>
          {onRequestInsights && (
            <button
              type="button"
              onClick={() => onRequestInsights(page.id)}
              disabled={insightsLoading}
              className="inline-flex items-center gap-2 rounded-full border border-vizme-coral/40 bg-vizme-coral/5 px-4 py-2 text-xs font-medium text-vizme-coral transition-all hover:bg-vizme-coral hover:text-white disabled:opacity-50"
            >
              <Sparkles size={12} />
              {insightsLoading ? 'Generando…' : 'Regenerar insights'}
            </button>
          )}
        </div>
        {insights.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-vizme-navy/15 bg-white/40 p-8 text-center text-sm text-vizme-greyblue">
            Aún no hay insights para esta página. Pídele a Sonnet que los genere.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function DashboardRenderer({
  blueprint,
  metricsById,
  calcsByMetricPeriod,
  insightsByPage,
  period,
  onRequestInsights,
  insightsLoading,
}: DashboardRendererProps) {
  const pages = useMemo(() => {
    const arr = Array.isArray(blueprint.pages) ? [...blueprint.pages] : [];
    arr.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    return arr;
  }, [blueprint]);

  const [activeId, setActiveId] = useState<string>(pages[0]?.id ?? '');
  const activePage = pages.find((p) => p.id === activeId) ?? pages[0];

  // Sprint 4.3 P3 — aplica filtros activos del DashboardFilterContext
  // (cross-filter + drill temporal) sobre los cálculos client-side.
  const { filtered } = useFilteredMetrics({
    calcsByMetricPeriod,
    metricsById,
  });

  const renderWidget = useMemo(() => {
    return (w: DashboardWidget) => {
      const calcs: WidgetRenderProps['calcs'] = {};
      const calcsAllTime: WidgetRenderProps['calcsAllTime'] = {};
      const metricsRecord: WidgetRenderProps['metrics'] = {};
      for (const mid of w.metric_ids) {
        calcs[mid] = filtered.get(mid)?.get(period);
        calcsAllTime[mid] = filtered.get(mid)?.get('all_time');
        metricsRecord[mid] = metricsById.get(mid);
      }
      return (
        <DashboardWidgetView
          widget={w}
          period={period}
          calcs={calcs}
          calcsAllTime={calcsAllTime}
          metrics={metricsRecord}
        />
      );
    };
  }, [filtered, metricsById, period]);

  if (!activePage) {
    return (
      <div className="rounded-3xl border border-dashed border-vizme-navy/15 bg-white/40 p-10 text-center">
        <p className="font-display text-2xl font-light text-vizme-navy">
          El blueprint no tiene páginas para mostrar.
        </p>
      </div>
    );
  }

  const insights = insightsByPage.get(activePage.id) ?? [];

  return (
    <div className="space-y-8">
      <PageNav pages={pages} activeId={activePage.id} onSelect={setActiveId} />
      <PageBody
        page={activePage}
        renderWidget={renderWidget}
        insights={insights}
        onRequestInsights={onRequestInsights}
        insightsLoading={insightsLoading}
      />
    </div>
  );
}
