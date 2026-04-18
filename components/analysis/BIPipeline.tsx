import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, Circle, Clock, ArrowRight, Loader2,
  TrendingUp, Lock, Zap, BarChart2, Brain, ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getV3Predictions } from '../../lib/chartEngine';
import type { V3PredictionsResult, MadurezAnalitica } from '../../lib/chartEngine';
import type { EnrichedProfile } from '../../lib/v3types';
import type { DataProfile } from '../../lib/inferDataProfile';
import type { ChartEngineResult } from '../../lib/chartEngine';

interface Props {
  projectId?: string;
  // Legacy props (kept for AnalysisPage compat)
  dataProfile?: DataProfile | null;
  chartResult?: ChartEngineResult | null;
  hasMultipleFiles?: boolean;
}

type StepStatus = 'complete' | 'in_progress' | 'pending';

interface PipelineStep {
  id: number;
  title: string;
  description: string;
  detail: string;
  status: StepStatus;
}

function buildSteps(ep: EnrichedProfile | null, dp: DataProfile | null, cr: ChartEngineResult | null): PipelineStep[] {
  const hasData    = ep !== null || dp !== null;
  const hasNumeric = ep ? ep.columnDetails.some(c => c.type === 'numeric') : (dp?.numericColumns?.length ?? 0) > 0;
  const hasDate    = ep ? ep.columnDetails.some(c => c.type === 'date') : (dp?.hasDateColumn ?? false);
  const hasInsight = cr !== null || ep !== null;
  const hasPred    = hasDate && hasData;
  const hasPresc   = hasInsight;

  const rows = ep?.totalRows ?? dp?.totalRows ?? 0;
  const cols = ep?.columnDetails.length ?? dp?.columns.length ?? 0;

  return [
    {
      id: 1,
      title: 'Ingesta y ETL',
      description: 'Carga y transformación de datos crudos',
      detail: hasData
        ? `${rows.toLocaleString('es-MX')} registros cargados desde ${cols} columnas.${ep ? ` Calidad: ${Math.round((ep.columnDetails.reduce((s, c) => s + (c.nullPct ?? 0), 0) / Math.max(cols, 1)) * 100)}% completo.` : ''}`
        : 'Sube tu primer archivo para iniciar.',
      status: hasData ? 'complete' : 'pending',
    },
    {
      id: 2,
      title: 'Normalización y tipado',
      description: 'Detección automática de tipos de columnas',
      detail: hasData
        ? ep
          ? `${ep.columnDetails.filter(c => c.type === 'numeric').length} numéricas, ${ep.columnDetails.filter(c => c.type === 'categorical').length} categóricas${hasDate ? ', 1+ fecha' : ''}.`
          : `${dp?.numericColumns?.length ?? 0} numéricas, ${dp?.categoryColumns?.length ?? 0} categóricas${dp?.hasDateColumn ? `, fecha: ${dp.dateColumnName}` : ''}.`
        : 'Pendiente de datos.',
      status: hasData ? 'complete' : 'pending',
    },
    {
      id: 3,
      title: 'Análisis descriptivo',
      description: 'Estadísticas básicas y distribuciones',
      detail: hasNumeric
        ? ep
          ? `${ep.columnDetails.filter(c => c.type === 'numeric').length} métricas analizadas.${ep.correlations?.length ? ` ${ep.correlations.length} correlaciones detectadas.` : ''}`
          : `Suma, promedio, min/max calculados para ${dp?.numericColumns?.length ?? 0} métricas.`
        : 'Pendiente de columnas numéricas.',
      status: hasNumeric ? 'complete' : hasData ? 'in_progress' : 'pending',
    },
    {
      id: 4,
      title: 'Análisis de diagnóstico',
      description: 'Insights, alertas y causas raíz con IA',
      detail: hasInsight
        ? ep ? 'Perfil enriquecido listo. Dashboard IA generado con KPIs y alertas.' : `${cr?.charts?.length ?? 0} visualizaciones y ${cr?.kpis?.length ?? 0} KPIs definidos.`
        : 'Genera el dashboard para activar este análisis.',
      status: hasInsight ? 'complete' : hasNumeric ? 'in_progress' : 'pending',
    },
    {
      id: 5,
      title: 'Análisis predictivo',
      description: 'Tendencias y proyecciones a futuro',
      detail: hasPred
        ? 'Columna de fecha detectada. Genera predicciones para proyecciones a 30/90 días.'
        : 'Agrega una columna de fecha a tus datos para habilitar predicciones.',
      status: hasPred ? 'in_progress' : hasInsight ? 'in_progress' : 'pending',
    },
    {
      id: 6,
      title: 'Análisis prescriptivo',
      description: 'Recomendaciones concretas de acción',
      detail: hasPresc
        ? 'Genera predicciones para obtener el plan de acción prescriptivo completo.'
        : 'Completa el análisis de diagnóstico primero.',
      status: hasPresc ? 'in_progress' : hasInsight ? 'in_progress' : 'pending',
    },
  ];
}

const STATUS_CONFIG: Record<StepStatus, { icon: React.ReactNode; color: string; badge: string; badgeColor: string }> = {
  complete:    { icon: <CheckCircle2 size={18} className="text-emerald-500" />, color: 'border-emerald-200 bg-emerald-50/30', badge: 'Completado', badgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  in_progress: { icon: <Clock size={18} className="text-vizme-orange" />,       color: 'border-vizme-orange/30 bg-orange-50/20', badge: 'En proceso', badgeColor: 'text-vizme-orange bg-orange-50 border-vizme-orange/20' },
  pending:     { icon: <Circle size={18} className="text-vizme-greyblue/30" />, color: 'border-vizme-navy/5 bg-white',           badge: 'Pendiente', badgeColor: 'text-vizme-greyblue bg-vizme-bg border-vizme-navy/10' },
};

const MADUREZ_CONFIG: Record<MadurezAnalitica['nivel_actual'], { label: string; color: string; pct: number }> = {
  basico:       { label: 'Básico',       color: 'bg-vizme-greyblue', pct: 25 },
  intermedio:   { label: 'Intermedio',   color: 'bg-vizme-orange',   pct: 50 },
  avanzado:     { label: 'Avanzado',     color: 'bg-vizme-red',      pct: 75 },
  experto:      { label: 'Experto',      color: 'bg-emerald-500',    pct: 100 },
};

const CONFIANZA_COLOR: Record<string, string> = {
  alta:   'text-emerald-600 bg-emerald-50 border-emerald-200',
  media:  'text-vizme-orange bg-orange-50 border-vizme-orange/20',
  baja:   'text-vizme-red bg-red-50 border-vizme-red/20',
};

const ESFUERZO_COLOR: Record<string, string> = {
  bajo:  'text-emerald-600 bg-emerald-50 border-emerald-200',
  medio: 'text-vizme-orange bg-orange-50 border-vizme-orange/20',
  alto:  'text-vizme-red bg-red-50 border-vizme-red/20',
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

const BIPipeline: React.FC<Props> = ({ projectId, dataProfile, chartResult, hasMultipleFiles }) => {
  const [enrichedProfile, setEnrichedProfile] = useState<EnrichedProfile | null>(null);
  const [predictions, setPredictions] = useState<V3PredictionsResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProjections, setShowProjections] = useState(true);
  const [showBlocked, setShowBlocked] = useState(false);

  // Load enriched profile from files table
  useEffect(() => {
    if (!projectId) return;
    supabase
      .from('files')
      .select('enriched_profile')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.enriched_profile) setEnrichedProfile(data.enriched_profile as EnrichedProfile);
      });
  }, [projectId]);

  const steps = buildSteps(enrichedProfile, dataProfile ?? null, chartResult ?? null);
  const completedCount = steps.filter((s) => s.status === 'complete').length;
  const progressPct = (completedCount / steps.length) * 100;

  const handleGenerate = async () => {
    const ep = enrichedProfile;
    if (!ep) {
      setError('No hay perfil de datos disponible. Sube un archivo en "Mis Datos" primero.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const result = await getV3Predictions(ep, projectId);
      setPredictions(result);
    } catch (err: any) {
      setError(err?.message ?? 'Error generando predicciones');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* Progress header */}
      <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-vizme-navy">Pipeline BI Vizme</p>
          <p className="text-xs font-bold text-vizme-greyblue">
            {completedCount}/{steps.length} fases
          </p>
        </div>
        <div className="h-2 bg-vizme-bg rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-vizme-red to-vizme-orange transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[10px] text-vizme-greyblue mt-2">
          {completedCount === steps.length
            ? 'Pipeline completo. Tu negocio está totalmente instrumentado.'
            : `${steps.length - completedCount} fase${steps.length - completedCount !== 1 ? 's' : ''} pendiente${steps.length - completedCount !== 1 ? 's' : ''} para análisis completo.`}
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const cfg = STATUS_CONFIG[step.status];
          return (
            <div key={step.id} className="relative">
              {idx < steps.length - 1 && (
                <div className="absolute left-[18px] top-10 bottom-0 w-px bg-vizme-navy/5 -mb-3" />
              )}
              <div className={`relative bg-white rounded-2xl border p-4 shadow-sm ${cfg.color}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="text-sm font-semibold text-vizme-navy leading-tight">{step.title}</p>
                        <p className="text-[10px] text-vizme-greyblue mt-0.5">{step.description}</p>
                      </div>
                      <span className={`flex-shrink-0 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${cfg.badgeColor}`}>
                        {cfg.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-vizme-greyblue leading-relaxed mt-1.5">{step.detail}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Predictions CTA / Results */}
      {!predictions ? (
        <div className="bg-vizme-navy rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={18} className="text-vizme-orange" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Análisis predictivo con IA</p>
              <p className="text-[11px] text-white/60 mt-0.5">
                Genera proyecciones a 30/90 días, detecta análisis disponibles y mide tu madurez analítica.
              </p>
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-vizme-red bg-vizme-red/10 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || (!enrichedProfile && !dataProfile)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-vizme-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-vizme-orange transition-all disabled:opacity-50"
          >
            {generating
              ? <><Loader2 size={14} className="animate-spin" />Generando predicciones...</>
              : <><Brain size={14} />Generar predicciones IA</>
            }
          </button>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Madurez analítica */}
          {predictions.madurez_analitica && (
            <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue mb-3">Madurez Analítica</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-xl bg-vizme-bg flex items-center justify-center">
                  <BarChart2 size={16} className="text-vizme-navy" />
                </div>
                <div>
                  <p className="text-sm font-bold text-vizme-navy capitalize">
                    {MADUREZ_CONFIG[predictions.madurez_analitica.nivel_actual]?.label ?? predictions.madurez_analitica.nivel_actual}
                  </p>
                  <p className="text-[10px] text-vizme-greyblue">{predictions.madurez_analitica.descripcion}</p>
                </div>
                <div className="ml-auto">
                  <span className="text-xs font-bold text-vizme-navy">
                    {MADUREZ_CONFIG[predictions.madurez_analitica.nivel_actual]?.pct ?? 0}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-vizme-bg rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${MADUREZ_CONFIG[predictions.madurez_analitica.nivel_actual]?.color ?? 'bg-vizme-navy'}`}
                  style={{ width: `${MADUREZ_CONFIG[predictions.madurez_analitica.nivel_actual]?.pct ?? 0}%` }}
                />
              </div>
              <div className="flex items-start gap-2 bg-vizme-bg rounded-xl px-3 py-2">
                <ArrowRight size={12} className="text-vizme-orange mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-vizme-navy">{predictions.madurez_analitica.siguiente_paso}</p>
              </div>
            </div>
          )}

          {/* Análisis disponibles */}
          {predictions.analisis_disponibles?.length > 0 && (
            <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue mb-3">
                Análisis disponibles ({predictions.analisis_disponibles.length})
              </p>
              <div className="space-y-2.5">
                {predictions.analisis_disponibles.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                    <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-vizme-navy">{a.nombre}</p>
                      <p className="text-[10px] text-vizme-greyblue mt-0.5">{a.descripcion}</p>
                      {a.insight && (
                        <p className="text-[10px] text-emerald-700 mt-1 italic">"{a.insight}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proyecciones */}
          {predictions.proyecciones?.length > 0 && (
            <div className="bg-white rounded-2xl border border-vizme-navy/8 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowProjections(!showProjections)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue">
                  Proyecciones ({predictions.proyecciones.length} métricas)
                </p>
                {showProjections ? <ChevronUp size={14} className="text-vizme-greyblue" /> : <ChevronDown size={14} className="text-vizme-greyblue" />}
              </button>

              {showProjections && (
                <div className="px-5 pb-5 space-y-3">
                  {predictions.proyecciones.map((p, i) => (
                    <div key={i} className="border border-vizme-navy/8 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold text-vizme-navy">{p.metrica}</p>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${CONFIANZA_COLOR[p.confianza] ?? ''}`}>
                          {p.confianza}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                          { label: 'Actual', value: p.valor_actual },
                          { label: '30 días', value: p.proyeccion_30d },
                          { label: '90 días', value: p.proyeccion_90d },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-vizme-bg rounded-lg p-2">
                            <p className="text-[9px] text-vizme-greyblue uppercase tracking-wider">{label}</p>
                            <p className="text-xs font-bold text-vizme-navy mt-0.5">{value}</p>
                          </div>
                        ))}
                      </div>
                      {p.metodologia && (
                        <p className="text-[10px] text-vizme-greyblue mt-2 italic">{p.metodologia}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Análisis bloqueados */}
          {predictions.analisis_bloqueados?.length > 0 && (
            <div className="bg-white rounded-2xl border border-vizme-navy/8 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowBlocked(!showBlocked)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue">
                  Análisis por desbloquear ({predictions.analisis_bloqueados.length})
                </p>
                {showBlocked ? <ChevronUp size={14} className="text-vizme-greyblue" /> : <ChevronDown size={14} className="text-vizme-greyblue" />}
              </button>

              {showBlocked && (
                <div className="px-5 pb-5 space-y-2.5">
                  {predictions.analisis_bloqueados.map((b, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-vizme-bg border border-vizme-navy/5">
                      <Lock size={13} className="text-vizme-greyblue flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-vizme-navy">{b.nombre}</p>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border flex-shrink-0 ${ESFUERZO_COLOR[b.esfuerzo] ?? ''}`}>
                            {b.esfuerzo}
                          </span>
                        </div>
                        <p className="text-[10px] text-vizme-greyblue mt-0.5">
                          Necesitas: <span className="font-medium text-vizme-navy">{b.columna_necesaria}</span>
                        </p>
                        <p className="text-[10px] text-vizme-greyblue mt-0.5">{b.desbloquea}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recomendaciones de datos */}
          {predictions.recomendaciones_datos?.length > 0 && (
            <div className="bg-vizme-navy rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={13} className="text-vizme-orange" />
                <p className="text-xs font-bold text-white">Mejora tu dataset</p>
              </div>
              {predictions.recomendaciones_datos.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-vizme-orange text-xs font-bold flex-shrink-0">{i + 1}.</span>
                  <p className="text-[11px] text-white/70">{r}</p>
                </div>
              ))}
            </div>
          )}

          {/* Regenerate */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-vizme-navy/10 px-4 py-2.5 text-xs font-semibold text-vizme-greyblue hover:bg-vizme-bg transition-all disabled:opacity-50"
          >
            {generating
              ? <><Loader2 size={12} className="animate-spin" />Regenerando...</>
              : 'Regenerar análisis predictivo'
            }
          </button>
        </div>
      )}
    </div>
  );
};

export default BIPipeline;
