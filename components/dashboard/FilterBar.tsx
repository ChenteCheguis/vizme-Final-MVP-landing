// Sprint 4.3 P3 — Barra de filtros activos arriba del dashboard.
// Render condicional: si no hay filtros ni drill, no aparece.
// Chips removibles + breadcrumb temporal con CTAs ↑ y ↺.

import { X, ChevronRight, ArrowUp, RotateCcw } from 'lucide-react';
import { useDashboardFilters } from '../../contexts/DashboardFilterContext';

export default function FilterBar() {
  const filters = useDashboardFilters();
  const hasFilters = filters.activeFilters.length > 0;
  const hasDrill = filters.drillPath.length > 0;

  if (!hasFilters && !hasDrill) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-vizme-coral/20 bg-vizme-coral/5 px-4 py-3">
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-vizme-greyblue">
            Filtros
          </span>
          {filters.activeFilters.map((f) => (
            <button
              key={`${f.dimension}-${f.value}`}
              type="button"
              onClick={() => filters.removeFilter(f.dimension)}
              className="group inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-vizme-navy shadow-soft transition-all hover:bg-vizme-coral hover:text-white"
              title={`Quitar filtro ${f.dimension}=${f.label ?? f.value}`}
            >
              <span className="text-[10px] uppercase tracking-wider text-vizme-greyblue group-hover:text-white/70">
                {f.dimension}:
              </span>
              <span>{f.label ?? f.value}</span>
              <X size={12} className="opacity-50 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}

      {hasDrill && (
        <div className="flex flex-wrap items-center gap-1.5">
          {hasFilters && <span className="text-vizme-navy/30">·</span>}
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-vizme-greyblue">
            Mostrando
          </span>
          {filters.drillPath.map((step, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs text-vizme-navy">
              <span className="font-medium">{step.label}</span>
              {i < filters.drillPath.length - 1 && (
                <ChevronRight size={12} className="text-vizme-navy/30" />
              )}
            </span>
          ))}
          <button
            type="button"
            onClick={filters.drillUp}
            className="ml-2 inline-flex items-center gap-1 rounded-full border border-vizme-navy/15 bg-white px-2.5 py-1 text-[11px] text-vizme-navy transition-all hover:border-vizme-coral hover:text-vizme-coral"
          >
            <ArrowUp size={10} />
            Subir nivel
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={filters.clearAllFilters}
        className="ml-auto inline-flex items-center gap-1 rounded-full border border-vizme-navy/15 bg-white px-2.5 py-1 text-[11px] text-vizme-navy transition-all hover:border-vizme-coral hover:text-vizme-coral"
      >
        <RotateCcw size={10} />
        Limpiar todo
      </button>
    </div>
  );
}
