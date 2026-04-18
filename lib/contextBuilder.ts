// ─────────────────────────────────────────────
// contextBuilder.ts
// Builds a rich VizmeContext from Supabase data
// for injection into ALL Claude API calls.
// ─────────────────────────────────────────────

import { supabase } from './supabase';
import type { DataProfile } from './inferDataProfile';

// ─── Industry benchmarks (México) ────────────────────────────────────────────

const INDUSTRY_BENCHMARKS: Record<string, string> = {
  'Retail/Tienda':          'Margen bruto típico 25-45%. Rotación de inventario: 6-12x al año. Ticket promedio MX: $350-800.',
  'Restaurante/Food':       'Margen bruto 60-70%, margen neto 3-9%. Food cost ideal <30%. Ticket promedio MX: $180-450.',
  'Construcción':           'Margen bruto 15-25%. Ciclo de cobro: 30-90 días. Proyectos mayores = mejor margen.',
  'Salud/Clínica':          'Margen neto 10-20%. Ocupación óptima: >70%. Costo operativo principal: nómina (50-60%).',
  'Tech/Software':          'Margen bruto SaaS: 60-80%. Churn aceptable: <5% mensual. LTV/CAC ideal: >3x.',
  'Distribución/Logística': 'Margen neto 2-8%. Rotación inventario: alta. Costo principal: transporte (30-40% costos).',
  'Manufactura':            'Margen bruto 20-35%. OEE ideal: >85%. Desperdicio aceptable: <5%.',
  'Servicios Financieros':  'ROE objetivo: >15%. Cartera vencida aceptable: <3%. CAC promedio sector: alto.',
  'Educación':              'Margen neto 10-25%. Retención semestral objetivo: >85%. CAC variable por segmento.',
  'E-commerce':             'Margen bruto 20-50%. Tasa de conversión promedio MX: 1-3%. Costo de adquisición: $80-400 MXN.',
  'Hospitalidad':           'RevPAR y ocupación son KPIs clave. Margen neto 10-20%. Estacionalidad marcada.',
  'Otro':                   'Analiza tus márgenes vs industria específica. KPIs varían por sector.',
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CompanyContext {
  name: string;
  industryDetail: string;
  industryBroad: string;
  size: string;
  mainPains: string[];
  dataFrequency: string;
  expectations: string;
  benchmark: string;
}

export interface ProjectContext {
  id: string;
  name: string;
  analysisArea: string;
  period: string;
  mainQuestion: string;
  hypothesis?: string;
  decisionToMake: string;
  dashboardFocus: string;
  audience: string;
  needsPredictions: boolean;
  location: string;
  seasonality: string;
  externalFactors: string[];
}

export interface DataContext {
  dataProfile: DataProfile;
  periods: string[];
  hasMultiplePeriods: boolean;
  totalRows: number;
}

export interface HistoryContext {
  previousHealthScore?: number;
  previousAnalysisDate?: string;
  implementedRecommendations: string[];
  totalAnalyses: number;
}

export interface VizmeContext {
  company: CompanyContext;
  project: ProjectContext;
  data: DataContext;
  history: HistoryContext;
}

// ─── Builder ────────────────────────────────────────────────────────────────

export async function buildVizmeContext(
  projectId: string,
  dataProfile: DataProfile,
): Promise<VizmeContext> {
  const [projectRes, userRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.auth.getUser(),
  ]);

  const project = projectRes.data;
  const userId = userRes.data.user?.id;

  const [profileRes, uploadsRes, analysesRes, doneRecsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('uploads').select('period_label, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('analyses').select('health_score, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('recommendations').select('action').eq('project_id', projectId).eq('done', true),
  ]);

  const profile = profileRes.data;
  const companyCtx = (profile?.company_context ?? {}) as Record<string, unknown>;
  const od = (profile?.onboarding_data ?? {}) as Record<string, unknown>;

  const industryDetail = (companyCtx.industryDetail as string) ?? (profile?.industry as string) ?? 'empresa';
  const industryBroad = (companyCtx.industryBroad as string) ?? (profile?.industry as string) ?? 'empresa';

  const periods = ((uploadsRes.data ?? []) as Array<{ period_label: string | null }>)
    .map((u) => u.period_label ?? '')
    .filter(Boolean);

  const analyses = (analysesRes.data ?? []) as Array<{ health_score: number; created_at: string }>;
  const doneRecs = ((doneRecsRes.data ?? []) as Array<{ action: string }>).map((r) => r.action);

  return {
    company: {
      name: profile?.company_name ?? 'PyME',
      industryDetail,
      industryBroad,
      size: (companyCtx.size as string) ?? (od.teamSize as string) ?? 'no especificado',
      mainPains: (companyCtx.mainPains as string[]) ?? [],
      dataFrequency: (companyCtx.dataFrequency as string) ?? 'no especificado',
      expectations: (companyCtx.expectations as string) ?? '',
      benchmark: INDUSTRY_BENCHMARKS[industryDetail] ?? INDUSTRY_BENCHMARKS['Otro'],
    },
    project: {
      id: project?.id ?? projectId,
      name: project?.name ?? 'Proyecto',
      analysisArea: project?.analysis_area ?? 'general',
      period: project?.period ?? 'no especificado',
      mainQuestion: project?.main_question ?? '',
      hypothesis: project?.hypothesis ?? undefined,
      decisionToMake: project?.decision_to_make ?? '',
      dashboardFocus: project?.dashboard_focus ?? 'criterio_ia',
      audience: project?.audience ?? 'dueno',
      needsPredictions: project?.needs_predictions ?? false,
      location: project?.location ?? 'México',
      seasonality: project?.seasonality ?? 'no especificado',
      externalFactors: (project?.external_factors as string[]) ?? [],
    },
    data: {
      dataProfile,
      periods,
      hasMultiplePeriods: periods.length > 1,
      totalRows: dataProfile.totalRows,
    },
    history: {
      previousHealthScore: analyses[1]?.health_score,
      previousAnalysisDate: analyses[1]?.created_at,
      implementedRecommendations: doneRecs,
      totalAnalyses: analyses.length,
    },
  };
}

// ─── Serializer for prompt injection ────────────────────────────────────────

export function serializeContextForPrompt(ctx: VizmeContext): string {
  const lines: string[] = [
    `═══ CONTEXTO COMPLETO DE LA EMPRESA ═══`,
    `EMPRESA: ${ctx.company.name}`,
    `INDUSTRIA: ${ctx.company.industryDetail} (${ctx.company.industryBroad})`,
    `TAMAÑO: ${ctx.company.size}`,
    ctx.company.mainPains.length ? `DOLORES PRINCIPALES: ${ctx.company.mainPains.join(' | ')}` : '',
    ctx.company.dataFrequency ? `MADUREZ DE DATOS: ${ctx.company.dataFrequency}` : '',
    ctx.company.expectations ? `OBJETIVO CON VIZME: ${ctx.company.expectations}` : '',
    `BENCHMARK INDUSTRIA: ${ctx.company.benchmark}`,
    ``,
    `═══ CONTEXTO DEL PROYECTO ═══`,
    `PROYECTO: ${ctx.project.name}`,
    `ÁREA: ${ctx.project.analysisArea}`,
    `PERÍODO: ${ctx.project.period}`,
    `PREGUNTA PRINCIPAL: ${ctx.project.mainQuestion}`,
    ctx.project.hypothesis ? `HIPÓTESIS: ${ctx.project.hypothesis}` : '',
    `DECISIÓN A TOMAR: ${ctx.project.decisionToMake}`,
    `DASHBOARD: ${ctx.project.dashboardFocus} | AUDIENCIA: ${ctx.project.audience}`,
    `PREDICCIONES: ${ctx.project.needsPredictions ? 'Sí (cliente las pidió)' : 'No'}`,
    `UBICACIÓN: ${ctx.project.location}`,
    `ESTACIONALIDAD: ${ctx.project.seasonality}`,
    ctx.project.externalFactors.length ? `FACTORES EXTERNOS: ${ctx.project.externalFactors.join(', ')}` : '',
    ``,
    `═══ DATOS ═══`,
    `Registros: ${ctx.data.totalRows}`,
    `Períodos disponibles: ${ctx.data.periods.length} (${ctx.data.periods.join(', ') || 'sin etiqueta'})`,
    `Múltiples períodos: ${ctx.data.hasMultiplePeriods ? 'Sí — comparación temporal posible' : 'No — solo análisis puntual'}`,
  ];

  if (ctx.history.totalAnalyses > 0) {
    lines.push('', `═══ HISTORIAL VIZME ═══`);
    lines.push(`Análisis anteriores: ${ctx.history.totalAnalyses}`);
    if (ctx.history.previousHealthScore !== undefined) {
      lines.push(`Score anterior: ${ctx.history.previousHealthScore}/10`);
    }
    if (ctx.history.implementedRecommendations.length) {
      lines.push(`Ya implementaron: ${ctx.history.implementedRecommendations.join(' | ')}`);
    }
  }

  return lines.filter((l) => l !== '').join('\n');
}
