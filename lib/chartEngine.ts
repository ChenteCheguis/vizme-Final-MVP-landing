// ─────────────────────────────────────────────
// chartEngine.ts
// Calls the Edge Function with a DataProfile and
// receives Claude's chart / KPI decisions.
// ─────────────────────────────────────────────

import { supabase, invokeFunction } from './supabase';
import type { DataProfile } from './inferDataProfile';

// ─────────────────────────────────────────────
// Types (shared with DynamicChart and Dashboard)
// ─────────────────────────────────────────────

export type ChartType =
  | 'bar_horizontal'
  | 'bar_vertical'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'bubble'
  | 'composed'
  | 'radialbar'
  | 'funnel';

export interface ChartDecision {
  id: string;
  type: ChartType;
  title: string;
  subtitle: string;
  xAxis: string | null;
  yAxis: string | null;
  yAxis2?: string | null;
  groupBy: string | null;
  aggregation: 'sum' | 'avg' | 'count' | 'max' | 'min';
  sortBy: 'value_desc' | 'value_asc' | 'name_asc' | 'none';
  insight: string;
  priority: number;
  size: 'large' | 'medium' | 'small';
  colorScheme?: string;
}

export interface KPIDecision {
  id: string;
  label: string;
  column: string;
  aggregation: 'sum' | 'avg' | 'max' | 'min' | 'count';
  format: 'currency' | 'number' | 'percentage';
  insight: string;
}

export interface MainInsight {
  title: string;
  body: string;
  type: 'opportunity' | 'risk' | 'trend';
}

export interface EngineAlert {
  title: string;
  body: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ChartEngineResult {
  charts: ChartDecision[];
  kpis: KPIDecision[];
  mainInsight: MainInsight;
  alerts: EngineAlert[];
}

// ─────────────────────────────────────────────
// Saved dashboard (localStorage)
// ─────────────────────────────────────────────

export interface SavedDashboard {
  id: string;
  name: string;
  description: string;
  tags: string[];
  chartDecisions: ChartDecision[];
  kpiDecisions: KPIDecision[];
  mainInsight: MainInsight;
  alerts: EngineAlert[];
  dataProfileSnapshot: DataProfile;
  period: '7D' | '30D' | '90D' | 'all';
  createdAt: string;
  isActive: boolean;
}

// ─────────────────────────────────────────────
// LocalStorage persistence
// ─────────────────────────────────────────────

const LS_KEY = 'vizme_dashboards';
const MAX_SAVED = 5;

export function getSavedDashboards(): SavedDashboard[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as SavedDashboard[];
  } catch {
    return [];
  }
}

export function saveDashboard(dashboard: Omit<SavedDashboard, 'id' | 'createdAt'>): SavedDashboard {
  const existing = getSavedDashboards();
  const id = `dash_${Date.now()}`;
  const created: SavedDashboard = { ...dashboard, id, createdAt: new Date().toISOString() };
  // Deactivate others
  const updated = existing.map((d) => ({ ...d, isActive: false })).slice(0, MAX_SAVED - 1);
  localStorage.setItem(LS_KEY, JSON.stringify([created, ...updated]));
  return created;
}

export function updateDashboard(id: string, patch: Partial<SavedDashboard>): void {
  const existing = getSavedDashboards();
  const updated = existing.map((d) => d.id === id ? { ...d, ...patch } : d);
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
}

export function deleteDashboard(id: string): void {
  const existing = getSavedDashboards().filter((d) => d.id !== id);
  localStorage.setItem(LS_KEY, JSON.stringify(existing));
}

export function setActiveDashboard(id: string): void {
  const existing = getSavedDashboards();
  const updated = existing.map((d) => ({ ...d, isActive: d.id === id }));
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
}

// ─────────────────────────────────────────────
// Edge Function call
// ─────────────────────────────────────────────

export async function getChartDecisions(
  dataProfile: DataProfile,
  profile: { company_name?: string | null; industry?: string | null; onboarding_data?: Record<string, unknown> | null } | null,
  projectId?: string,
): Promise<ChartEngineResult> {
  const { data, error } = await invokeFunction('analyze-data', {
    body: { dataProfile, profileContext: profile, projectId },
  });

  if (error) {
    throw new Error(error.message ?? 'Error desconocido');
  }
  if (!data?.success) throw new Error(data?.error ?? 'Error en motor de gráficas');

  return data.chartEngine as ChartEngineResult;
}

// ─────────────────────────────────────────────
// Executive report request
// ─────────────────────────────────────────────

export interface ExecutiveReport {
  score: number;
  scoreJustification: string;
  fortalezas: string[];
  debilidades: string[];
  recomendaciones: {
    numero: number;
    accion: string;
    impacto: string;
    plazo: 'inmediato' | '1 mes' | 'trimestre';
  }[];
  resumenEjecutivo: string;
}

export async function getExecutiveReport(
  dataProfile: DataProfile,
  chartResult: ChartEngineResult,
  projectId?: string,
): Promise<ExecutiveReport> {
  const { data, error } = await invokeFunction('analyze-data', {
    body: { reportData: { dataProfile, chartResult }, projectId },
  });

  if (error) {
    throw new Error(error.message ?? 'Error desconocido');
  }
  if (!data?.success) throw new Error(data?.error ?? 'Error generando reporte');

  return data.report as ExecutiveReport;
}

// ─────────────────────────────────────────────
// Internal analysis types & request
// ─────────────────────────────────────────────

export interface KPINegocio {
  nombre: string;
  valor: string;
  benchmark: string;
  status: 'bueno' | 'alerta' | 'critico';
  tendencia: 'subiendo' | 'bajando' | 'estable';
}

export interface SegmentoAnalysis {
  nombre: string;
  descripcion: string;
  porcentaje: number;
  valor: string;
}

export interface Anomalia {
  descripcion: string;
  severidad: 'alta' | 'media' | 'baja';
  accion: string;
}

export interface AccionPlan {
  accion: string;
  impacto: string;
  plazo: 'inmediato' | '1 mes' | 'trimestre';
  responsable: string;
}

export interface InternalAnalysisResult {
  health_score: number;
  health_justification: string;
  kpis_negocio: KPINegocio[];
  segmentacion: {
    dimension: string;
    segmentos: SegmentoAnalysis[];
  };
  anomalias: Anomalia[];
  fortalezas_operativas: string[];
  areas_criticas: string[];
  plan_accion: AccionPlan[];
}

export async function getInternalAnalysis(
  dataProfile: DataProfile,
  chartResult: ChartEngineResult,
  projectId?: string,
): Promise<InternalAnalysisResult> {
  const { data, error } = await invokeFunction('analyze-data', {
    body: { internalAnalysis: { dataProfile, chartResult }, projectId },
  });

  if (error) {
    throw new Error(error.message ?? 'Error desconocido');
  }
  if (!data?.success) throw new Error(data?.error ?? 'Error en análisis interno');

  return data.internalAnalysis as InternalAnalysisResult;
}

// ─────────────────────────────────────────────
// External analysis types & request
// ─────────────────────────────────────────────

export interface BenchmarkExterno {
  metrica: string;
  tu_valor: string;
  rango_mercado: string;
  status: 'arriba' | 'dentro' | 'abajo';
  interpretacion: string;
}

export interface TendenciaSector {
  tendencia: string;
  impacto: 'positivo' | 'negativo' | 'neutro';
  relevancia: 'alta' | 'media' | 'baja';
}

export interface ExternalAnalysisResult {
  posicionamiento: {
    nivel: 'lider' | 'competitivo' | 'rezagado' | 'emergente';
    descripcion: string;
  };
  benchmarks: BenchmarkExterno[];
  tendencias_sector: TendenciaSector[];
  oportunidades_mercado: string[];
  amenazas_externas: string[];
  estrategia_recomendada: string;
}

export async function getExternalAnalysis(
  dataProfile: DataProfile,
  industry: string,
  projectId?: string,
): Promise<ExternalAnalysisResult> {
  const { data, error } = await invokeFunction('analyze-data', {
    body: { externalAnalysis: { dataProfile, industry }, projectId },
  });

  if (error) {
    throw new Error(error.message ?? 'Error desconocido');
  }
  if (!data?.success) throw new Error(data?.error ?? 'Error en análisis externo');

  return data.externalAnalysis as ExternalAnalysisResult;
}

// ─────────────────────────────────────────────
// V3 Dashboard generation
// ─────────────────────────────────────────────

import type { EnrichedProfile, V3DashboardResponse } from './v3types';

export async function getV3Dashboard(
  enrichedProfile: EnrichedProfile,
  profileContext: { company_name?: string | null; industry?: string | null } | null,
  projectId?: string,
  extractedData?: unknown,
): Promise<V3DashboardResponse> {
  let data: any;
  let error: any;

  try {
    const reqBody: Record<string, unknown> = {
      mode: 'dashboard',
      enrichedProfile,
      profileContext,
      projectId,
    };
    if (extractedData) reqBody.extractedData = extractedData;

    const result = await invokeFunction('analyze-data', { body: reqBody });
    data = result.data;
    error = result.error;
  } catch (e: any) {
    throw new Error(`Error de conexión con el servidor: ${e?.message ?? 'Verifica tu conexión a internet'}`);
  }

  if (error) {
    let msg = error.message ?? 'Error desconocido';
    try {
      if (error.context && typeof error.context.json === 'function') {
        const b = await error.context.json();
        msg = b?.error ?? msg;
      }
    } catch {}
    throw new Error(`Error del servidor: ${msg}`);
  }

  if (!data) throw new Error('El servidor no respondió. Intenta de nuevo en unos segundos.');
  if (!data.success) throw new Error(data.error ?? 'Error generando el dashboard. Intenta de nuevo.');

  return data.dashboard as V3DashboardResponse;
}

// ─────────────────────────────────────────────
// V3 Predictions / BI Pipeline
// ─────────────────────────────────────────────

export interface AnalisisDisponible {
  nombre: string;
  descripcion: string;
  disponible: boolean;
  insight: string;
}

export interface AnalisisBloqueado {
  nombre: string;
  columna_necesaria: string;
  desbloquea: string;
  esfuerzo: 'bajo' | 'medio' | 'alto';
}

export interface Proyeccion {
  metrica: string;
  valor_actual: string;
  proyeccion_30d: string;
  proyeccion_90d: string;
  confianza: 'alta' | 'media' | 'baja';
  metodologia: string;
}

export interface MadurezAnalitica {
  nivel_actual: 'basico' | 'intermedio' | 'avanzado' | 'experto';
  descripcion: string;
  siguiente_paso: string;
}

export interface V3PredictionsResult {
  analisis_disponibles: AnalisisDisponible[];
  analisis_bloqueados: AnalisisBloqueado[];
  proyecciones: Proyeccion[];
  madurez_analitica: MadurezAnalitica;
  recomendaciones_datos: string[];
}

export async function getV3Predictions(
  enrichedProfile: EnrichedProfile,
  projectId?: string,
): Promise<V3PredictionsResult> {
  const { data, error } = await invokeFunction('analyze-data', {
    body: {
      mode: 'predictions',
      enrichedProfile,
      projectId,
    },
  });

  if (error) {
    throw new Error(error.message ?? 'Error desconocido');
  }
  if (!data?.success) throw new Error(data?.error ?? 'Error generando predicciones');

  return data.predictions as V3PredictionsResult;
}
