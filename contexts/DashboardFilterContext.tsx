// ============================================================
// VIZME V5 — Sprint 4.3 P3 — Dashboard filter & drill-down state
//
// Mantiene los filtros activos cross-widget y el breadcrumb de
// drill-down temporal. Click en una barra/segmento agrega un
// filtro; click en un punto temporal navega un nivel del path.
//
// El hook `useFilteredMetrics` consume este estado para regresar
// `MetricCalculation` filtrados client-side — sin refetch al edge.
// ============================================================

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type DrillLevel = 'year' | 'month' | 'week' | 'day' | 'hour';

export interface DashboardFilter {
  // dimension lógica del breakdown (`mesero`, `dia_semana`, etc.).
  dimension: string;
  // valor seleccionado (la `key` del breakdown).
  value: string;
  // texto humano para el chip; si no se da, se usa value.
  label?: string;
  // qué widget originó el filtro (para debugging y resaltar).
  sourceWidgetId: string;
}

export interface DrillStep {
  level: DrillLevel;
  // ISO yyyy-mm-dd cuando level=day, yyyy-mm cuando month, yyyy cuando year.
  value: string;
  label: string;
}

interface DashboardFilterState {
  activeFilters: DashboardFilter[];
  drillPath: DrillStep[];
}

interface DashboardFilterApi extends DashboardFilterState {
  addFilter: (filter: DashboardFilter) => void;
  removeFilter: (dimension: string) => void;
  toggleFilter: (filter: DashboardFilter) => void;
  clearAllFilters: () => void;
  drillDown: (step: DrillStep) => void;
  drillUp: () => void;
  resetDrill: () => void;
  isFilterActive: (dimension: string, value: string) => boolean;
  getActiveValueForDimension: (dimension: string) => string | null;
}

const DashboardFilterContext = createContext<DashboardFilterApi | undefined>(undefined);

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [activeFilters, setActiveFilters] = useState<DashboardFilter[]>([]);
  const [drillPath, setDrillPath] = useState<DrillStep[]>([]);

  const addFilter = useCallback((filter: DashboardFilter) => {
    setActiveFilters((prev) => {
      // Reemplaza el filtro previo de la misma dimensión (single-select por dim).
      const without = prev.filter((f) => f.dimension !== filter.dimension);
      return [...without, filter];
    });
  }, []);

  const removeFilter = useCallback((dimension: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.dimension !== dimension));
  }, []);

  const toggleFilter = useCallback((filter: DashboardFilter) => {
    setActiveFilters((prev) => {
      const existing = prev.find((f) => f.dimension === filter.dimension);
      if (existing && existing.value === filter.value) {
        return prev.filter((f) => f.dimension !== filter.dimension);
      }
      const without = prev.filter((f) => f.dimension !== filter.dimension);
      return [...without, filter];
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setActiveFilters([]);
    setDrillPath([]);
  }, []);

  const drillDown = useCallback((step: DrillStep) => {
    setDrillPath((prev) => [...prev, step]);
  }, []);

  const drillUp = useCallback(() => {
    setDrillPath((prev) => prev.slice(0, -1));
  }, []);

  const resetDrill = useCallback(() => setDrillPath([]), []);

  const isFilterActive = useCallback(
    (dimension: string, value: string) =>
      activeFilters.some((f) => f.dimension === dimension && f.value === value),
    [activeFilters]
  );

  const getActiveValueForDimension = useCallback(
    (dimension: string) => activeFilters.find((f) => f.dimension === dimension)?.value ?? null,
    [activeFilters]
  );

  const value = useMemo<DashboardFilterApi>(
    () => ({
      activeFilters,
      drillPath,
      addFilter,
      removeFilter,
      toggleFilter,
      clearAllFilters,
      drillDown,
      drillUp,
      resetDrill,
      isFilterActive,
      getActiveValueForDimension,
    }),
    [
      activeFilters,
      drillPath,
      addFilter,
      removeFilter,
      toggleFilter,
      clearAllFilters,
      drillDown,
      drillUp,
      resetDrill,
      isFilterActive,
      getActiveValueForDimension,
    ]
  );

  return (
    <DashboardFilterContext.Provider value={value}>{children}</DashboardFilterContext.Provider>
  );
}

export function useDashboardFilters(): DashboardFilterApi {
  const ctx = useContext(DashboardFilterContext);
  if (!ctx) {
    throw new Error('useDashboardFilters debe usarse dentro de un DashboardFilterProvider.');
  }
  return ctx;
}

// Hook seguro para widgets — devuelve un API no-op si no hay provider
// (útil para tests aislados o reutilización fuera del dashboard).
export function useOptionalDashboardFilters(): DashboardFilterApi | null {
  return useContext(DashboardFilterContext) ?? null;
}
